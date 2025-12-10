import { useQuery } from "@tanstack/react-query";
import { Connection, PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { Buffer } from "buffer";
import { Round } from "@/types";

const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "81K7nKnv7JiRhBCRNmagKot27Yu82eRWeeNA7dtGGaX6"
);
const CONFIG_PDA = new PublicKey(
  process.env.NEXT_PUBLIC_CONFIG_PDA || "DQ6T8gLKAYWhqvxMe8mHRjoY6ZMefRinZu8fkAV4ePA9"
);
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";

function getRoundPda(roundId: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("round"), new BN(roundId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
  return pda;
}

function decodeRound(data: Buffer): Round {
  let offset = 8; // skip discriminator

  const roundId = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  const assetSymbolLen = data.readUInt32LE(offset);
  offset += 4;
  const assetSymbol = data.slice(offset, offset + assetSymbolLen).toString("utf8");
  offset += assetSymbolLen;

  const startPrice = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  const endPrice = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  const startTime = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  const isNewLayout = data.length > 100;

  let bettingEndTime: BN;
  if (isNewLayout) {
    bettingEndTime = new BN(data.slice(offset, offset + 8), "le");
    offset += 8;
  } else {
    bettingEndTime = new BN(0);
  }

  const endTime = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  if (!isNewLayout) {
    bettingEndTime = endTime;
  }

  const statusByte = data[offset];
  offset += 1;

  const statusMap: { [key: number]: Round["status"] } = {
    0: "Open",
    1: "Locked",
    2: "PendingSettlement",
    3: "Settled",
  };
  const status = statusMap[statusByte] || "Open";

  const shortPool = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  const longPool = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  let shortWeightedPool: BN;
  let longWeightedPool: BN;
  if (isNewLayout) {
    shortWeightedPool = new BN(data.slice(offset, offset + 8), "le");
    offset += 8;
    longWeightedPool = new BN(data.slice(offset, offset + 8), "le");
    offset += 8;
  } else {
    shortWeightedPool = shortPool;
    longWeightedPool = longPool;
  }

  const betCount = data.readUInt32LE(offset);
  offset += 4;

  const payoutsProcessed = data.readUInt32LE(offset);
  offset += 4;

  const winningSideDiscriminant = data[offset];
  offset += 1;
  let winningSide: "SHORT" | "LONG" | null = null;
  if (winningSideDiscriminant === 1) {
    const sideValue = data[offset];
    winningSide = sideValue === 0 ? "SHORT" : "LONG";
  }

  return {
    roundId,
    assetSymbol,
    priceFeed: PublicKey.default,
    startPrice,
    endPrice,
    startTime,
    bettingEndTime,
    endTime,
    status,
    shortPool,
    longPool,
    shortWeightedPool,
    longWeightedPool,
    betCount,
    payoutsProcessed,
    winningSide,
  };
}

async function fetchAllRounds(): Promise<Round[]> {
  const connection = new Connection(RPC_URL, "confirmed");

  // Get round counter from config
  const configInfo = await connection.getAccountInfo(CONFIG_PDA);
  if (!configInfo) return [];

  const roundCounter = new BN(configInfo.data.slice(92, 100), "le").toNumber();
  if (roundCounter === 0) return [];

  // Fetch all rounds (0 to roundCounter-1)
  const roundPdas = Array.from({ length: roundCounter }, (_, i) => getRoundPda(i));
  const accounts = await connection.getMultipleAccountsInfo(roundPdas);

  const rounds: Round[] = [];
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    if (account) {
      try {
        const round = decodeRound(account.data as Buffer);
        rounds.push(round);
      } catch (err) {
        console.error(`Error decoding round ${i}:`, err);
      }
    }
  }

  // Sort by round ID descending (newest first)
  rounds.sort((a, b) => b.roundId.toNumber() - a.roundId.toNumber());

  return rounds;
}

export function useAllRounds() {
  return useQuery<Round[]>({
    queryKey: ["allRounds"],
    queryFn: fetchAllRounds,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

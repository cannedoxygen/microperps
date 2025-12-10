import { useQuery } from "@tanstack/react-query";
import { Connection, PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { Buffer } from "buffer";

const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "81K7nKnv7JiRhBCRNmagKot27Yu82eRWeeNA7dtGGaX6"
);
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";

export interface BetData {
  roundId: number;
  bettor: string;
  side: "SHORT" | "LONG";
  amount: number; // in SOL (pool contribution after fees)
  originalAmount: number; // in SOL (original bet amount)
  betTime: number; // unix timestamp
  weight: number; // weight multiplier (100 = 1x, 150 = 1.5x)
  betIndex: number;
  paidOut: boolean;
}

function getBetPda(roundId: number, betIndex: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("bet"),
      new BN(roundId).toArrayLike(Buffer, "le", 8),
      new BN(betIndex).toArrayLike(Buffer, "le", 4),
    ],
    PROGRAM_ID
  );
  return pda;
}

/**
 * Decode bet account data
 * Layout:
 * - 8 bytes: discriminator
 * - 8 bytes: round_id (u64)
 * - 32 bytes: bettor pubkey
 * - 1 byte: side (enum)
 * - 8 bytes: amount (u64) - pool contribution
 * - 8 bytes: original_amount (u64)
 * - 8 bytes: bet_time (i64)
 * - 8 bytes: weight (u64)
 * - 4 bytes: bet_index (u32)
 * - 1 byte: paid_out (bool)
 * - 1 byte: referrer option discriminant
 * - 32 bytes: referrer pubkey (if Some)
 * - 1 byte: bump
 */
function decodeBet(data: Buffer): BetData | null {
  try {
    let offset = 8; // skip discriminator

    const roundId = new BN(data.slice(offset, offset + 8), "le").toNumber();
    offset += 8;

    const bettor = new PublicKey(data.slice(offset, offset + 32)).toBase58();
    offset += 32;

    const sideByte = data[offset];
    const side = sideByte === 0 ? "SHORT" : "LONG";
    offset += 1;

    const amount = new BN(data.slice(offset, offset + 8), "le").toNumber() / 1e9; // lamports to SOL
    offset += 8;

    const originalAmount = new BN(data.slice(offset, offset + 8), "le").toNumber() / 1e9;
    offset += 8;

    const betTime = new BN(data.slice(offset, offset + 8), "le").toNumber();
    offset += 8;

    const weight = new BN(data.slice(offset, offset + 8), "le").toNumber();
    offset += 8;

    const betIndex = data.readUInt32LE(offset);
    offset += 4;

    const paidOut = data[offset] === 1;

    return {
      roundId,
      bettor,
      side,
      amount,
      originalAmount,
      betTime,
      weight,
      betIndex,
      paidOut,
    };
  } catch (err) {
    console.error("Error decoding bet:", err);
    return null;
  }
}

async function fetchRoundBets(roundId: number, betCount: number): Promise<BetData[]> {
  if (betCount === 0) return [];

  const connection = new Connection(RPC_URL, "confirmed");
  const bets: BetData[] = [];

  // Fetch all bet accounts for this round
  const betPdas = Array.from({ length: betCount }, (_, i) => getBetPda(roundId, i));

  // Batch fetch accounts
  const accounts = await connection.getMultipleAccountsInfo(betPdas);

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    if (account) {
      const bet = decodeBet(account.data as Buffer);
      if (bet) {
        bets.push(bet);
      }
    }
  }

  // Sort by bet time (newest first)
  bets.sort((a, b) => b.betTime - a.betTime);

  return bets;
}

export function useRoundBets(roundId: number | undefined, betCount: number | undefined) {
  return useQuery<BetData[]>({
    queryKey: ["roundBets", roundId, betCount],
    queryFn: () => {
      if (roundId === undefined || betCount === undefined) {
        return Promise.resolve([]);
      }
      return fetchRoundBets(roundId, betCount);
    },
    enabled: roundId !== undefined && betCount !== undefined && betCount > 0,
    refetchInterval: 15000, // Refresh every 15 seconds
    staleTime: 10000,
  });
}

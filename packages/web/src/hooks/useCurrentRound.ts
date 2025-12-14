import { useQuery } from "@tanstack/react-query";
import { Connection, PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { Round } from "@/types";

// Hardcoded defaults for devnet deployment
const DEFAULT_CONFIG_PDA = "DQ6T8gLKAYWhqvxMe8mHRjoY6ZMefRinZu8fkAV4ePA9";
const DEFAULT_PROGRAM_ID = "81K7nKnv7JiRhBCRNmagKot27Yu82eRWeeNA7dtGGaX6";
const DEFAULT_RPC_URL = "https://api.devnet.solana.com";

function getConfigPda(): PublicKey {
  const pdaString = typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_CONFIG_PDA || DEFAULT_CONFIG_PDA)
    : DEFAULT_CONFIG_PDA;
  return new PublicKey(pdaString);
}

function getProgramId(): PublicKey {
  const idString = typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_PROGRAM_ID || DEFAULT_PROGRAM_ID)
    : DEFAULT_PROGRAM_ID;
  return new PublicKey(idString);
}

function getRpcUrl(): string {
  return typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_RPC_URL || DEFAULT_RPC_URL)
    : DEFAULT_RPC_URL;
}

interface ConfigData {
  roundCounter: number;
  feeBps: number;
  minBetLamports: BN;
  maxBetLamports: BN;
  treasury: PublicKey;
}

interface RoundData {
  round: Round;
  config: ConfigData;
}

/**
 * Decode config account data
 * Layout:
 * - 8 bytes: discriminator
 * - 32 bytes: admin pubkey
 * - 2 bytes: fee_bps (u16)
 * - 2 bytes: referrer_fee_bps (u16)
 * - 8 bytes: min_bet_lamports (u64)
 * - 8 bytes: max_bet_lamports (u64)
 * - 32 bytes: treasury pubkey
 * - 8 bytes: round_counter (u64)
 * - 1 byte: bump
 */
function decodeConfig(data: Buffer): ConfigData {
  // Offsets: 8 disc + 32 admin = 40
  const feeBps = data.readUInt16LE(40);
  // 40 + 2 = 42
  // referrer_fee_bps at 42, skip it
  // 42 + 2 = 44
  const minBetLamports = new BN(data.slice(44, 52), "le");
  // 44 + 8 = 52
  const maxBetLamports = new BN(data.slice(52, 60), "le");
  // 52 + 8 = 60
  const treasury = new PublicKey(data.slice(60, 92));
  // 60 + 32 = 92
  const roundCounter = new BN(data.slice(92, 100), "le").toNumber();

  return {
    roundCounter,
    feeBps,
    minBetLamports,
    maxBetLamports,
    treasury,
  };
}

/**
 * Decode round account data
 * Supports both old (90 bytes) and new (114 bytes) layouts
 *
 * New Layout (with weighted pools):
 * - 8 bytes: discriminator
 * - 8 bytes: round_id (u64)
 * - 4 bytes: asset_symbol length (u32)
 * - N bytes: asset_symbol chars (max 10)
 * - 8 bytes: start_price (i64)
 * - 8 bytes: end_price (i64)
 * - 8 bytes: start_time (i64)
 * - 8 bytes: betting_end_time (i64) [NEW]
 * - 8 bytes: end_time (i64)
 * - 1 byte: status (enum)
 * - 8 bytes: left_pool (u64)
 * - 8 bytes: right_pool (u64)
 * - 8 bytes: left_weighted_pool (u64) [NEW]
 * - 8 bytes: right_weighted_pool (u64) [NEW]
 * - 4 bytes: bet_count (u32)
 * - 4 bytes: payouts_processed (u32)
 * - 1 byte: winning_side Option discriminant (0=None, 1=Some)
 * - 1 byte: winning_side value (if Some)
 * - 1 byte: bump
 */
function decodeRound(data: Buffer): Round {
  let offset = 8; // skip discriminator

  const roundId = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  // Asset symbol - Borsh String (4 byte length + chars, no padding)
  const assetSymbolLen = data.readUInt32LE(offset);
  offset += 4;
  const assetSymbol = data.slice(offset, offset + assetSymbolLen).toString("utf8");
  offset += assetSymbolLen;

  console.log("Decode round - assetSymbolLen:", assetSymbolLen, "assetSymbol:", assetSymbol, "offset after symbol:", offset, "data length:", data.length);

  const startPrice = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  const endPrice = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  const startTime = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  // betting_end_time is always present in the struct
  const bettingEndTime = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  const endTime = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  const statusByte = data[offset];
  offset += 1;

  const statusMap: { [key: number]: Round["status"] } = {
    0: "Open",
    1: "Locked",
    2: "PendingSettlement", // maps to "Settling" in program
    3: "Settled",
  };
  const status = statusMap[statusByte] || "Open";

  // left_pool = shortPool, right_pool = longPool (LEFT=down, RIGHT=up)
  const shortPool = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  const longPool = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  // Weighted pools for payout calculation - always present
  const shortWeightedPool = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;
  const longWeightedPool = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  const betCount = data.readUInt32LE(offset);
  offset += 4;

  const payoutsProcessed = data.readUInt32LE(offset);
  offset += 4;

  // Winning side - Option<Side>: 0 = None, 1 = Some(Left=0) = SHORT, 1 = Some(Right=1) = LONG
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
    priceFeed: PublicKey.default, // Not used in this version
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

export function useCurrentRound() {
  return useQuery<RoundData | null>({
    queryKey: ["currentRound"],
    queryFn: async () => {
      try {
        const connection = new Connection(getRpcUrl(), "confirmed");

        // First fetch config to get current round counter
        const configInfo = await connection.getAccountInfo(getConfigPda());
        if (!configInfo) {
          console.log("Config account not found - program not initialized yet");
          return null;
        }

        const config = decodeConfig(configInfo.data);
        console.log("Config:", config);

        // If no rounds exist yet
        if (config.roundCounter === 0) {
          console.log("No rounds created yet");
          return null;
        }

        // Fetch the latest round (roundCounter - 1 since counter increments after creation)
        const latestRoundId = config.roundCounter - 1;

        const [roundPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("round"), new BN(latestRoundId).toArrayLike(Buffer, "le", 8)],
          getProgramId()
        );

        const roundInfo = await connection.getAccountInfo(roundPda);
        if (!roundInfo) {
          console.log(`Round ${latestRoundId} not found`);
          return null;
        }

        const round = decodeRound(roundInfo.data);
        console.log("Round:", round);

        return { round, config };
      } catch (err) {
        console.log("Error fetching round data:", err);
        // Return null instead of throwing - shows "No Active Round" UI
        return null;
      }
    },
    refetchInterval: 10000, // Refresh every 10 seconds
    staleTime: 5000,
  });
}

export function useConfig() {
  return useQuery<ConfigData | null>({
    queryKey: ["config"],
    queryFn: async () => {
      const connection = new Connection(getRpcUrl(), "confirmed");
      const configInfo = await connection.getAccountInfo(getConfigPda());
      if (!configInfo) return null;
      return decodeConfig(configInfo.data);
    },
    staleTime: 60000, // Config doesn't change often
  });
}

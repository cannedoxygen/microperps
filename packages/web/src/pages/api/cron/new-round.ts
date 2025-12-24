import type { NextApiRequest, NextApiResponse } from "next";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import tokensData from "@/data/tokens.json";
import { tweetRoundStart, tweetRoundSettled } from "@/lib/twitter";

// Program and config
const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "81K7nKnv7JiRhBCRNmagKot27Yu82eRWeeNA7dtGGaX6"
);
const CONFIG_PDA = new PublicKey(
  process.env.NEXT_PUBLIC_CONFIG_PDA || "DQ6T8gLKAYWhqvxMe8mHRjoY6ZMefRinZu8fkAV4ePA9"
);

// Instruction discriminators (sha256 hash of "global:<instruction_name>")
const START_ROUND_DISCRIMINATOR = Buffer.from([144, 144, 43, 7, 193, 42, 217, 215]);
const SETTLE_ROUND_DISCRIMINATOR = Buffer.from([40, 101, 18, 1, 31, 129, 52, 77]);
const PROCESS_PAYOUT_DISCRIMINATOR = Buffer.from([48, 192, 129, 57, 230, 161, 233, 148]);

// Round duration: 24 hours in seconds (12h betting + 12h waiting)
const ROUND_DURATION = 24 * 60 * 60;

interface Token {
  pythFeedId: string;
  coinGeckoId: string;
  solanaPythFeedId: string;
  tokenName: string;
  tokenSymbol: string;
  tokenImageLogo: string;
  exponent: number;
}

interface PythPriceResponse {
  parsed: Array<{
    price: {
      price: string;
      expo: number;
    };
  }>;
}

/**
 * Fetch current price from Pyth Hermes API
 */
async function fetchPythPrice(pythFeedId: string): Promise<number> {
  // Remove 0x prefix if present
  const feedId = pythFeedId.startsWith("0x") ? pythFeedId.slice(2) : pythFeedId;

  const response = await fetch(
    `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${feedId}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Pyth price: ${response.statusText}`);
  }

  const data: PythPriceResponse = await response.json();

  if (!data.parsed || data.parsed.length === 0) {
    throw new Error("No price data returned from Pyth");
  }

  const priceData = data.parsed[0].price;
  const price = parseInt(priceData.price);
  const expo = priceData.expo;

  // Return price scaled to 8 decimals (our standard)
  // Pyth prices are price * 10^expo, we want price * 10^8
  const scaledPrice = price * Math.pow(10, 8 + expo);

  return Math.round(scaledPrice);
}

/**
 * Retry wrapper for async functions
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`Retry ${i + 1}/${maxRetries} failed: ${lastError.message}`);
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
      }
    }
  }
  throw lastError;
}

/**
 * Get the current round counter from config account
 */
async function getCurrentRoundCounter(connection: Connection): Promise<number> {
  const accountInfo = await withRetry(() => connection.getAccountInfo(CONFIG_PDA));
  if (!accountInfo) {
    throw new Error("Config account not found");
  }

  // Config layout (updated):
  // 8 bytes: discriminator
  // 32 bytes: admin pubkey
  // 2 bytes: fee_bps (u16)
  // 2 bytes: referrer_fee_bps (u16)
  // 8 bytes: min_bet_lamports (u64)
  // 8 bytes: max_bet_lamports (u64)
  // 32 bytes: treasury pubkey
  // 8 bytes: round_counter (u64) -> offset 92
  // 1 byte: bump
  const data = accountInfo.data;
  const roundCounter = new BN(data.slice(92, 100), "le");

  return roundCounter.toNumber();
}

/**
 * Get the asset symbol from a round's on-chain data
 */
async function getRoundAsset(connection: Connection, roundId: number): Promise<string | null> {
  const [roundPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("round"), new BN(roundId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );

  const roundInfo = await connection.getAccountInfo(roundPda);
  if (!roundInfo) return null;

  const data = roundInfo.data;
  // Layout: 8 (discriminator) + 8 (round_id) + 4 (string_len) + string_bytes
  const assetLen = data.readUInt32LE(16);
  const assetSymbol = data.slice(20, 20 + assetLen).toString("utf8");
  return assetSymbol.toUpperCase();
}

/**
 * Find token by symbol
 */
function findTokenBySymbol(symbol: string): Token | null {
  const tokens = tokensData.data as Token[];
  return tokens.find((t) => t.tokenSymbol.toUpperCase() === symbol.toUpperCase()) || null;
}

/**
 * Full round data for settlement tweets
 */
interface FullRoundInfo {
  betCount: number;
  status: number;
  assetSymbol: string;
  startPrice: number;
  endPrice: number;
  leftPool: number;
  rightPool: number;
  winningSide: "LONG" | "SHORT" | null;
}

/**
 * Check if a round has ended (past its end_time)
 */
async function isRoundEnded(
  connection: Connection,
  roundId: number
): Promise<{ ended: boolean; status: number; endTime: number } | null> {
  const [roundPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("round"), new BN(roundId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );

  const roundInfo = await connection.getAccountInfo(roundPda);
  if (!roundInfo) return null;

  const data = roundInfo.data;
  const assetLen = data.readUInt32LE(16);
  const baseOffset = 20 + assetLen;

  // end_time is at: baseOffset + 8 (start_price) + 8 (end_price) + 8 (start_time) + 8 (betting_end_time)
  const endTimeOffset = baseOffset + 32;
  const endTime = Number(data.readBigInt64LE(endTimeOffset));

  // status is at: endTimeOffset + 8
  const status = data.readUInt8(endTimeOffset + 8);

  const now = Math.floor(Date.now() / 1000);
  const ended = now >= endTime;

  return { ended, status, endTime };
}

/**
 * Get round info including bet count
 */
async function getRoundInfo(
  connection: Connection,
  roundId: number
): Promise<{ betCount: number; status: number } | null> {
  const [roundPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("round"), new BN(roundId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );

  const roundInfo = await connection.getAccountInfo(roundPda);
  if (!roundInfo) return null;

  const data = roundInfo.data;
  // Layout after discriminator (8 bytes):
  // 8: round_id
  // 4 + N: asset_symbol (String - 4 byte len + chars)
  // Need to read string length first to find bet_count offset
  const assetLen = data.readUInt32LE(16);
  const baseOffset = 20 + assetLen; // After asset_symbol

  // After asset_symbol:
  // 8: start_price
  // 8: end_price
  // 8: start_time
  // 8: betting_end_time
  // 8: end_time
  // 1: status
  // 8: left_pool
  // 8: right_pool
  // 8: left_weighted_pool
  // 8: right_weighted_pool
  // 4: bet_count
  const statusOffset = baseOffset + 8 + 8 + 8 + 8 + 8;
  const betCountOffset = statusOffset + 1 + 8 + 8 + 8 + 8;

  const status = data.readUInt8(statusOffset);
  const betCount = data.readUInt32LE(betCountOffset);

  return { betCount, status };
}

/**
 * Get full round data for settlement tweet
 */
async function getFullRoundInfo(
  connection: Connection,
  roundId: number
): Promise<FullRoundInfo | null> {
  const [roundPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("round"), new BN(roundId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );

  const roundInfo = await connection.getAccountInfo(roundPda);
  if (!roundInfo) return null;

  const data = roundInfo.data;
  let offset = 8; // skip discriminator

  // round_id (8)
  offset += 8;

  // asset_symbol (4 + N)
  const assetLen = data.readUInt32LE(offset);
  offset += 4;
  const assetSymbol = data.slice(offset, offset + assetLen).toString("utf8");
  offset += assetLen;

  // start_price (8)
  const startPrice = Number(data.readBigInt64LE(offset));
  offset += 8;

  // end_price (8)
  const endPrice = Number(data.readBigInt64LE(offset));
  offset += 8;

  // start_time (8)
  offset += 8;

  // betting_end_time (8)
  offset += 8;

  // end_time (8)
  offset += 8;

  // status (1)
  const status = data.readUInt8(offset);
  offset += 1;

  // left_pool (8) - SHORT
  const leftPool = Number(data.readBigUInt64LE(offset));
  offset += 8;

  // right_pool (8) - LONG
  const rightPool = Number(data.readBigUInt64LE(offset));
  offset += 8;

  // left_weighted_pool (8)
  offset += 8;

  // right_weighted_pool (8)
  offset += 8;

  // bet_count (4)
  const betCount = data.readUInt32LE(offset);
  offset += 4;

  // payouts_processed (4)
  offset += 4;

  // winning_side: Option<Side> (1 + 1 if Some)
  const winningSideDiscriminant = data.readUInt8(offset);
  offset += 1;
  let winningSide: "LONG" | "SHORT" | null = null;
  if (winningSideDiscriminant === 1) {
    const sideValue = data.readUInt8(offset);
    winningSide = sideValue === 0 ? "SHORT" : "LONG"; // 0=Left=SHORT, 1=Right=LONG
  }

  return {
    betCount,
    status,
    assetSymbol: assetSymbol.toUpperCase(),
    startPrice,
    endPrice,
    leftPool,
    rightPool,
    winningSide,
  };
}

/**
 * Get bettor pubkey from bet account
 */
async function getBetInfo(
  connection: Connection,
  roundId: number,
  betIndex: number
): Promise<{ bettor: PublicKey; betPda: PublicKey } | null> {
  const [betPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("bet"),
      new BN(roundId).toArrayLike(Buffer, "le", 8),
      new BN(betIndex).toArrayLike(Buffer, "le", 4),
    ],
    PROGRAM_ID
  );

  const betInfo = await connection.getAccountInfo(betPda);
  if (!betInfo) return null;

  // Bet layout after discriminator (8 bytes):
  // 8: round_id
  // 32: bettor
  const bettor = new PublicKey(betInfo.data.slice(16, 48));

  return { bettor, betPda };
}

/**
 * Process all payouts for a settled round
 */
async function processPayouts(
  connection: Connection,
  admin: Keypair,
  roundId: number
): Promise<number> {
  const roundInfo = await getRoundInfo(connection, roundId);
  if (!roundInfo) {
    console.log(`Round ${roundId} not found for payouts`);
    return 0;
  }

  // Status 2 = Settling (ready for payouts)
  if (roundInfo.status !== 2) {
    console.log(`Round ${roundId} not in Settling status (status=${roundInfo.status})`);
    return 0;
  }

  const betCount = roundInfo.betCount;
  console.log(`Processing ${betCount} payouts for round ${roundId}`);

  if (betCount === 0) {
    console.log(`No bets to process for round ${roundId}`);
    return 0;
  }

  // Find round and vault PDAs
  const [roundPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("round"), new BN(roundId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), new BN(roundId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );

  let processed = 0;

  // Process each bet (batch into transactions of up to 5 payouts each)
  const BATCH_SIZE = 5;
  for (let i = 0; i < betCount; i += BATCH_SIZE) {
    const batchEnd = Math.min(i + BATCH_SIZE, betCount);
    const tx = new Transaction();

    for (let j = i; j < batchEnd; j++) {
      const betInfo = await getBetInfo(connection, roundId, j);
      if (!betInfo) {
        console.log(`Bet ${j} not found, skipping`);
        continue;
      }

      // Build process_payout instruction
      const payoutIx = new TransactionInstruction({
        keys: [
          { pubkey: roundPda, isSigner: false, isWritable: true },
          { pubkey: betInfo.betPda, isSigner: false, isWritable: true },
          { pubkey: vaultPda, isSigner: false, isWritable: true },
          { pubkey: betInfo.bettor, isSigner: false, isWritable: true },
          { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: PROCESS_PAYOUT_DISCRIMINATOR,
      });

      tx.add(payoutIx);
    }

    if (tx.instructions.length > 0) {
      try {
        const sig = await sendAndConfirmTransaction(connection, tx, [admin], {
          commitment: "confirmed",
        });
        console.log(`Processed payouts ${i}-${batchEnd - 1}: ${sig}`);
        processed += tx.instructions.length;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[PAYOUT ERROR] Failed to process payouts ${i}-${batchEnd - 1}: ${errorMessage}`);
        // Don't throw - continue with remaining batches
      }
    }
  }

  console.log(`Processed ${processed}/${betCount} payouts for round ${roundId}`);
  return processed;
}

/**
 * Settle the previous round
 */
async function settlePreviousRound(
  connection: Connection,
  admin: Keypair,
  roundId: number
): Promise<string | null> {
  // Find round PDA
  const [roundPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("round"), new BN(roundId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );

  // Check if round exists
  const roundInfo = await connection.getAccountInfo(roundPda);
  if (!roundInfo) {
    console.log(`Round ${roundId} does not exist, skipping settle`);
    return null;
  }

  // Get the round's asset symbol
  const assetSymbol = await getRoundAsset(connection, roundId);
  if (!assetSymbol) {
    console.log(`Could not get asset for round ${roundId}`);
    return null;
  }

  // Find the token to get its Pyth feed
  const token = findTokenBySymbol(assetSymbol);
  if (!token) {
    console.log(`Token ${assetSymbol} not found in token list`);
    return null;
  }

  // Fetch the current price for THIS round's asset
  const endPrice = await fetchPythPrice(token.pythFeedId);
  console.log(`Settling round ${roundId} (${assetSymbol}) with price: ${endPrice}`);

  // Build settle instruction
  const settleData = Buffer.alloc(8 + 8); // discriminator + end_price
  SETTLE_ROUND_DISCRIMINATOR.copy(settleData, 0);
  new BN(endPrice).toArrayLike(Buffer, "le", 8).copy(settleData, 8);

  const settleIx = new TransactionInstruction({
    keys: [
      { pubkey: CONFIG_PDA, isSigner: false, isWritable: false },
      { pubkey: roundPda, isSigner: false, isWritable: true },
      { pubkey: admin.publicKey, isSigner: true, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: settleData,
  });

  try {
    const tx = new Transaction().add(settleIx);
    const sig = await sendAndConfirmTransaction(connection, tx, [admin], {
      commitment: "confirmed",
    });
    console.log(`Settled round ${roundId}: ${sig}`);
    return sig;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Round might already be settled or not exist
    console.log(`Could not settle round ${roundId}: ${errorMessage}`);
    return null;
  }
}

/**
 * Start a new round
 * Anchor instruction: start_round(asset_symbol: String, start_price: i64)
 */
async function startNewRound(
  connection: Connection,
  admin: Keypair,
  roundId: number,
  token: Token,
  startPrice: number
): Promise<string> {
  // Find round PDA
  const [roundPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("round"), new BN(roundId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );

  // Find vault PDA
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), new BN(roundId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );

  // Prepare asset symbol as Borsh String (4 byte length + chars)
  const assetSymbol = token.tokenSymbol.toUpperCase();
  const assetSymbolBytes = Buffer.from(assetSymbol, "utf8");

  // Build start_round instruction data (Anchor format)
  // discriminator (8) + string_length (4) + string_bytes (n) + start_price (8)
  const instructionData = Buffer.alloc(8 + 4 + assetSymbolBytes.length + 8);
  let offset = 0;

  // Discriminator
  START_ROUND_DISCRIMINATOR.copy(instructionData, offset);
  offset += 8;

  // Asset symbol as Borsh String: 4-byte length + chars
  instructionData.writeUInt32LE(assetSymbolBytes.length, offset);
  offset += 4;
  assetSymbolBytes.copy(instructionData, offset);
  offset += assetSymbolBytes.length;

  // Start price (i64)
  new BN(startPrice).toArrayLike(Buffer, "le", 8).copy(instructionData, offset);

  const startRoundIx = new TransactionInstruction({
    keys: [
      { pubkey: CONFIG_PDA, isSigner: false, isWritable: true },
      { pubkey: roundPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: false },
      { pubkey: admin.publicKey, isSigner: true, isWritable: true },
      { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: instructionData,
  });

  const tx = new Transaction().add(startRoundIx);
  const sig = await sendAndConfirmTransaction(connection, tx, [admin], {
    commitment: "confirmed",
  });

  return sig;
}

/**
 * Get the asset symbols used in recent rounds (for cooldown)
 */
async function getRecentlyUsedAssets(
  connection: Connection,
  currentRoundId: number,
  cooldownPeriod: number
): Promise<Set<string>> {
  const recentAssets = new Set<string>();

  // Look back up to cooldownPeriod rounds
  const startRound = Math.max(0, currentRoundId - cooldownPeriod);

  for (let roundId = startRound; roundId < currentRoundId; roundId++) {
    try {
      const [roundPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("round"), new BN(roundId).toArrayLike(Buffer, "le", 8)],
        PROGRAM_ID
      );

      const roundInfo = await connection.getAccountInfo(roundPda);
      if (roundInfo) {
        // Decode asset symbol from round data
        // Layout: 8 (discriminator) + 8 (round_id) + 4 (string_len) + string_bytes
        const data = roundInfo.data;
        const assetLen = data.readUInt32LE(16);
        const assetSymbol = data.slice(20, 20 + assetLen).toString("utf8");
        recentAssets.add(assetSymbol.toUpperCase());
      }
    } catch (error) {
      console.log(`Could not read round ${roundId} for cooldown check`);
    }
  }

  return recentAssets;
}

/**
 * Pick a random token from the pool, excluding recently used ones
 * Cooldown period: token can't be reused for 30 rounds after being selected
 */
async function pickRandomToken(
  connection: Connection,
  currentRoundId: number
): Promise<Token> {
  const tokens = tokensData.data as Token[];
  const COOLDOWN_PERIOD = 30;

  // Get recently used assets
  const recentlyUsed = await getRecentlyUsedAssets(connection, currentRoundId, COOLDOWN_PERIOD);
  console.log(`Recently used assets (last ${COOLDOWN_PERIOD} rounds):`, Array.from(recentlyUsed));

  // Filter out tokens on cooldown
  const availableTokens = tokens.filter(
    (t) => !recentlyUsed.has(t.tokenSymbol.toUpperCase())
  );

  // If all tokens are on cooldown (shouldn't happen with 30 cooldown and many tokens),
  // fall back to all tokens
  const tokenPool = availableTokens.length > 0 ? availableTokens : tokens;

  console.log(`Available tokens: ${tokenPool.length}/${tokens.length}`);

  const randomIndex = Math.floor(Math.random() * tokenPool.length);
  return tokenPool[randomIndex];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify cron secret to prevent unauthorized calls
  const cronSecret = req.headers["authorization"];
  if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    // Also allow in development without secret
    if (process.env.NODE_ENV === "production") {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    // Setup connection and admin keypair
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");

    // Load admin keypair from env
    const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
    if (!adminPrivateKey) {
      throw new Error("ADMIN_PRIVATE_KEY not configured");
    }
    const admin = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(adminPrivateKey))
    );

    // Get current round counter (this is the NEXT round to be created)
    const currentRoundId = await getCurrentRoundCounter(connection);
    console.log(`Current round counter: ${currentRoundId}`);

    // Check if there's an active round that hasn't ended yet
    // The most recent round is currentRoundId - 1
    if (currentRoundId > 0) {
      const lastRoundId = currentRoundId - 1;
      const lastRoundStatus = await isRoundEnded(connection, lastRoundId);

      if (lastRoundStatus && !lastRoundStatus.ended && lastRoundStatus.status !== 3) {
        // Round hasn't ended yet, nothing to do
        const timeRemaining = lastRoundStatus.endTime - Math.floor(Date.now() / 1000);
        const hoursRemaining = Math.floor(timeRemaining / 3600);
        const minsRemaining = Math.floor((timeRemaining % 3600) / 60);
        console.log(`Round ${lastRoundId} still active. Ends in ${hoursRemaining}h ${minsRemaining}m. Skipping.`);

        return res.status(200).json({
          success: true,
          message: `Round ${lastRoundId} still active`,
          endsIn: `${hoursRemaining}h ${minsRemaining}m`,
        });
      }
    }

    // Pick random token (with 30-round cooldown)
    const token = await pickRandomToken(connection, currentRoundId);
    console.log(`Selected token: ${token.tokenSymbol} (${token.tokenName})`);

    // Settle any unsettled past rounds (not just the previous one)
    // This handles cases where settlement failed in previous cron runs
    if (currentRoundId > 0) {
      // Check last 5 rounds for any that need settling
      const roundsToCheck = Math.min(currentRoundId, 5);
      for (let i = 1; i <= roundsToCheck; i++) {
        const roundIdToSettle = currentRoundId - i;
        const roundInfo = await getRoundInfo(connection, roundIdToSettle);

        // Skip if round doesn't exist or is already settled (status 3)
        if (!roundInfo || roundInfo.status === 3) {
          continue;
        }

        // Only settle if status is Open (0) or Locked (1) - not Settling (2)
        // AND the round has actually ended (past end_time)
        if (roundInfo.status === 0 || roundInfo.status === 1) {
          const endedCheck = await isRoundEnded(connection, roundIdToSettle);
          if (!endedCheck?.ended) {
            console.log(`Round ${roundIdToSettle} hasn't ended yet, skipping settlement`);
            continue;
          }
          console.log(`Found unsettled round ${roundIdToSettle} (status=${roundInfo.status}), attempting to settle...`);
          const settled = await settlePreviousRound(connection, admin, roundIdToSettle);

          // If settled successfully, process all payouts and tweet
          if (settled) {
            const payoutsProcessed = await processPayouts(connection, admin, roundIdToSettle);

            // Delay to ensure RPC has updated data after settlement
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Get full round data for settlement tweet
            const fullRoundInfo = await getFullRoundInfo(connection, roundIdToSettle);
            // Always tweet settlement, even with 0 bets - winningSide is set by settle_round
            if (fullRoundInfo) {
              const winningSide = fullRoundInfo.winningSide || (fullRoundInfo.endPrice < fullRoundInfo.startPrice ? "SHORT" : "LONG");
              // Tweet settlement - await to ensure it completes before function ends
              try {
                const tweetId = await tweetRoundSettled(
                  roundIdToSettle,
                  fullRoundInfo.assetSymbol,
                  fullRoundInfo.startPrice,
                  fullRoundInfo.endPrice,
                  winningSide,
                  fullRoundInfo.leftPool + fullRoundInfo.rightPool,
                  payoutsProcessed
                );
                if (tweetId) {
                  console.log(`[Twitter] Settlement tweet posted for round ${roundIdToSettle}: ${tweetId}`);
                }
              } catch (err) {
                console.error(`[Twitter] Failed to post settlement tweet for round ${roundIdToSettle}:`, err);
              }
            }
          }
        } else if (roundInfo.status === 2) {
          // Round is in Settling status - process remaining payouts
          console.log(`Round ${roundIdToSettle} is in Settling status, processing payouts...`);
          await processPayouts(connection, admin, roundIdToSettle);
        }
      }
    }

    // Fetch current price from Pyth for the NEW round
    const currentPrice = await fetchPythPrice(token.pythFeedId);
    console.log(`Current price: ${currentPrice} (scaled to 8 decimals)`);

    // Start new round
    const sig = await startNewRound(
      connection,
      admin,
      currentRoundId,
      token,
      currentPrice
    );

    console.log(`Started round ${currentRoundId}: ${sig}`);

    // Tweet about the new round - await to ensure it completes
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://microperps.fun";
    try {
      const tweetId = await tweetRoundStart(
        currentRoundId,
        token.tokenSymbol,
        token.tokenName,
        currentPrice,
        baseUrl
      );
      if (tweetId) {
        console.log(`[Twitter] Round start tweet posted: ${tweetId}`);
      }
    } catch (err) {
      console.error("[Twitter] Failed to post round start tweet:", err);
    }

    return res.status(200).json({
      success: true,
      roundId: currentRoundId,
      token: {
        symbol: token.tokenSymbol,
        name: token.tokenName,
        image: token.tokenImageLogo,
      },
      startPrice: currentPrice,
      signature: sig,
    });
  } catch (error) {
    console.error("Error in cron job:", error);
    return res.status(500).json({
      error: "Failed to create new round",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

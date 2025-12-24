#!/usr/bin/env npx tsx
/**
 * Master Settle Script
 * Usage: npx tsx settle-round.ts <round_id>
 *
 * This script:
 * 1. Settles the round with current Pyth price
 * 2. Processes all payouts
 * 3. Tweets the settlement
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { TwitterApi } from "twitter-api-v2";
import * as dotenv from "dotenv";
import tokensData from "./src/data/tokens.json";

// Load environment variables
dotenv.config({ path: ".env.local" });

// Program constants
const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "81K7nKnv7JiRhBCRNmagKot27Yu82eRWeeNA7dtGGaX6"
);

const SETTLE_ROUND_DISCRIMINATOR = Buffer.from([40, 101, 18, 1, 31, 129, 52, 77]);
const PROCESS_PAYOUT_DISCRIMINATOR = Buffer.from([48, 192, 129, 57, 230, 161, 233, 148]);

// Token Twitter handles
const TOKEN_TWITTER_HANDLES: Record<string, string> = {
  BONK: "@bonk_inu",
  WIF: "@dogwifcoin",
  POPCAT: "@Popcatsolana",
  PNUT: "@paborbs",
  BOME: "@darkaborbs",
  MEW: "@MewsWorld",
  PONKE: "@ponaborbs",
  MOODENG: "@Maborbs",
  NEIRO: "@Neaborbs",
  CHILLGUY: "@chaborbs",
  GOAT: "@goaborbs",
  FARTCOIN: "@faborbs",
  WEN: "@waborbs",
  WOJAK: "@wojaborbs",
  GIGA: "@gigaborbs",
  GRIFFAIN: "@griffaindotcom",
  ZEREBRO: "@0xzerebro",
  SKI: "@saborbs",
  AI16Z: "@ai16zdao",
  ACT: "@ACT_TheAIProphe",
  JUP: "@JupiterExchange",
  JTO: "@jaborbs",
  RAY: "@RaydiumProtocol",
  TNSR: "@TensorFdn",
  DRIFT: "@DriftProtocol",
  PYTH: "@PythNetwork",
  ORCA: "@orca_so",
  MNDE: "@MarinadeFinance",
  BLZE: "@SolBlaze",
  GRASS: "@getgrass_io",
  PENGU: "@pudgypenguins",
  TRUMP: "@GetTrumpMemes",
  MELANIA: "@MELANIAMEME",
};

interface Token {
  pythFeedId: string;
  tokenSymbol: string;
  tokenName: string;
}

interface RoundData {
  assetSymbol: string;
  startPrice: number;
  endPrice: number;
  status: number;
  leftPool: number;
  rightPool: number;
  betCount: number;
  winningSide: "LONG" | "SHORT" | null;
}

// Format price for display
function formatPrice(priceScaled: number): string {
  const price = priceScaled / 1e8;
  if (price < 0.0001) return price.toExponential(2);
  if (price < 0.01) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  if (price < 100) return price.toFixed(2);
  return price.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

// Fetch price from Pyth
async function fetchPythPrice(pythFeedId: string): Promise<number> {
  const feedId = pythFeedId.startsWith("0x") ? pythFeedId.slice(2) : pythFeedId;
  const response = await fetch(
    `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${feedId}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Pyth price: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.parsed || data.parsed.length === 0) {
    throw new Error("No price data returned from Pyth");
  }

  const priceData = data.parsed[0].price;
  const price = parseInt(priceData.price);
  const expo = priceData.expo;
  const scaledPrice = price * Math.pow(10, 8 + expo);

  return Math.round(scaledPrice);
}

// Find token by symbol
function findTokenBySymbol(symbol: string): Token | null {
  const tokens = tokensData.data as Token[];
  return tokens.find((t) => t.tokenSymbol.toUpperCase() === symbol.toUpperCase()) || null;
}

// Get round data from chain
async function getRoundData(connection: Connection, roundId: number): Promise<RoundData | null> {
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

  // start_time (8), betting_end_time (8), end_time (8)
  offset += 24;

  // status (1)
  const status = data.readUInt8(offset);
  offset += 1;

  // left_pool (8) - SHORT
  const leftPool = Number(data.readBigUInt64LE(offset));
  offset += 8;

  // right_pool (8) - LONG
  const rightPool = Number(data.readBigUInt64LE(offset));
  offset += 8;

  // left_weighted_pool (8), right_weighted_pool (8)
  offset += 16;

  // bet_count (4)
  const betCount = data.readUInt32LE(offset);
  offset += 4;

  // payouts_processed (4)
  offset += 4;

  // winning_side: Option<Side>
  const winningSideDiscriminant = data.readUInt8(offset);
  offset += 1;
  let winningSide: "LONG" | "SHORT" | null = null;
  if (winningSideDiscriminant === 1) {
    const sideValue = data.readUInt8(offset);
    winningSide = sideValue === 0 ? "SHORT" : "LONG";
  }

  return {
    assetSymbol: assetSymbol.toUpperCase(),
    startPrice,
    endPrice,
    status,
    leftPool,
    rightPool,
    betCount,
    winningSide,
  };
}

// Settle round
async function settleRound(
  connection: Connection,
  admin: Keypair,
  roundId: number,
  endPrice: number
): Promise<string | null> {
  const [roundPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("round"), new BN(roundId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );

  const CONFIG_PDA = new PublicKey(
    process.env.NEXT_PUBLIC_CONFIG_PDA || "DQ6T8gLKAYWhqvxMe8mHRjoY6ZMefRinZu8fkAV4ePA9"
  );

  const settleData = Buffer.alloc(16);
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
    return sig;
  } catch (error) {
    console.error("Settle error:", error);
    return null;
  }
}

// Get bet info
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

  const bettor = new PublicKey(betInfo.data.slice(16, 48));
  return { bettor, betPda };
}

// Process payouts
async function processPayouts(
  connection: Connection,
  admin: Keypair,
  roundId: number,
  betCount: number
): Promise<number> {
  if (betCount === 0) {
    console.log("No bets to process");
    return 0;
  }

  const [roundPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("round"), new BN(roundId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), new BN(roundId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );

  let processed = 0;
  const BATCH_SIZE = 5;

  for (let i = 0; i < betCount; i += BATCH_SIZE) {
    const batchEnd = Math.min(i + BATCH_SIZE, betCount);
    const tx = new Transaction();

    for (let j = i; j < batchEnd; j++) {
      const betInfo = await getBetInfo(connection, roundId, j);
      if (!betInfo) continue;

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
        console.log(`Payouts ${i}-${batchEnd - 1}: ${sig}`);
        processed += tx.instructions.length;
      } catch (error) {
        console.error(`Payout batch ${i}-${batchEnd - 1} failed:`, error);
      }
    }
  }

  return processed;
}

// Tweet settlement
async function tweetSettlement(
  roundId: number,
  tokenSymbol: string,
  startPrice: number,
  endPrice: number,
  winningSide: "LONG" | "SHORT",
  totalPool: number,
  winnerCount: number
): Promise<string | null> {
  if (process.env.TWITTER_ENABLED !== "true") {
    console.log("[Twitter] Disabled - skipping tweet");
    return null;
  }

  if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_ACCESS_TOKEN) {
    console.log("[Twitter] Missing credentials");
    return null;
  }

  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET!,
  });

  const startPriceStr = formatPrice(startPrice);
  const endPriceStr = formatPrice(endPrice);
  const change = startPrice > 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0;
  const changeStr = change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2);
  const poolSol = (totalPool / 1e9).toFixed(2);
  const outcomeEmoji = winningSide === "LONG" ? "📈 PUMPED!" : "📉 DUMPED!";
  const changeEmoji = change >= 0 ? "📈" : "📉";
  const tokenMention = TOKEN_TWITTER_HANDLES[tokenSymbol] ? ` ${TOKEN_TWITTER_HANDLES[tokenSymbol]}` : "";

  const text = `🏁 Round #${roundId} SETTLED!

$${tokenSymbol}${tokenMention} ${outcomeEmoji}

📊 Start: $${startPriceStr}
📊 End: $${endPriceStr}
${changeEmoji} Change: ${changeStr}%

🏆 ${winningSide} WINS!

💰 Total Pool: ${poolSol} SOL
👥 ${winnerCount} winner${winnerCount !== 1 ? "s" : ""} paid out

Next round starting soon... 👀`;

  try {
    const tweet = await client.v2.tweet(text);
    console.log("[Twitter] Posted:", tweet.data.id);
    return tweet.data.id;
  } catch (error) {
    console.error("[Twitter] Failed:", error);
    return null;
  }
}

// Main
async function main() {
  const roundId = parseInt(process.argv[2]);

  if (isNaN(roundId)) {
    console.log("Usage: npx tsx settle-round.ts <round_id>");
    console.log("Example: npx tsx settle-round.ts 21");
    process.exit(1);
  }

  console.log(`\n=== Settling Round ${roundId} ===\n`);

  // Setup connection
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  // Load admin keypair
  const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
  if (!adminPrivateKey) {
    console.error("ADMIN_PRIVATE_KEY not set in .env.local");
    process.exit(1);
  }
  const admin = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(adminPrivateKey)));
  console.log("Admin:", admin.publicKey.toString());

  // Get current round data
  let roundData = await getRoundData(connection, roundId);
  if (!roundData) {
    console.error(`Round ${roundId} not found`);
    process.exit(1);
  }

  console.log("Token:", roundData.assetSymbol);
  console.log("Status:", roundData.status, "(0=Open, 1=Locked, 2=Settling, 3=Settled)");
  console.log("Bets:", roundData.betCount);
  console.log("Start Price:", formatPrice(roundData.startPrice));

  // If already settled, just show info
  if (roundData.status === 3) {
    console.log("\nRound already settled!");
    console.log("End Price:", formatPrice(roundData.endPrice));
    console.log("Winner:", roundData.winningSide);
    process.exit(0);
  }

  // Find token for Pyth price
  const token = findTokenBySymbol(roundData.assetSymbol);
  if (!token) {
    console.error(`Token ${roundData.assetSymbol} not found in tokens.json`);
    process.exit(1);
  }

  // Fetch current price
  console.log("\nFetching current price from Pyth...");
  const endPrice = await fetchPythPrice(token.pythFeedId);
  console.log("End Price:", formatPrice(endPrice));

  // Settle if needed
  if (roundData.status === 0 || roundData.status === 1) {
    console.log("\nSettling round...");
    const sig = await settleRound(connection, admin, roundId, endPrice);
    if (sig) {
      console.log("Settled:", sig);
    } else {
      console.error("Settlement failed");
      process.exit(1);
    }
  }

  // Process payouts if there are bets
  let payoutsProcessed = 0;
  if (roundData.betCount > 0) {
    console.log("\nProcessing payouts...");
    payoutsProcessed = await processPayouts(connection, admin, roundId, roundData.betCount);
    console.log(`Processed ${payoutsProcessed}/${roundData.betCount} payouts`);
  }

  // Wait for chain state to update
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Refresh round data
  roundData = await getRoundData(connection, roundId);
  if (!roundData) {
    console.error("Failed to refresh round data");
    process.exit(1);
  }

  // Determine winner
  const winningSide = roundData.winningSide || (roundData.endPrice < roundData.startPrice ? "SHORT" : "LONG");
  console.log("\nWinner:", winningSide);

  // Tweet
  console.log("\nPosting settlement tweet...");
  await tweetSettlement(
    roundId,
    roundData.assetSymbol,
    roundData.startPrice,
    roundData.endPrice || endPrice,
    winningSide,
    roundData.leftPool + roundData.rightPool,
    payoutsProcessed
  );

  console.log("\n=== Done ===\n");
}

main().catch(console.error);

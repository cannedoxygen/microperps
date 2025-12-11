import type { NextApiRequest, NextApiResponse } from "next";
import { Connection, PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { tweetBettingClosed } from "@/lib/twitter";
import tokensData from "@/data/tokens.json";

// Program and config
const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "81K7nKnv7JiRhBCRNmagKot27Yu82eRWeeNA7dtGGaX6"
);
const CONFIG_PDA = new PublicKey(
  process.env.NEXT_PUBLIC_CONFIG_PDA || "DQ6T8gLKAYWhqvxMe8mHRjoY6ZMefRinZu8fkAV4ePA9"
);

interface Token {
  pythFeedId: string;
  coinGeckoId: string;
  tokenSymbol: string;
}

/**
 * Fetch current price from Pyth Hermes API
 */
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

  // Return price scaled to 8 decimals
  const scaledPrice = price * Math.pow(10, 8 + expo);
  return Math.round(scaledPrice);
}

/**
 * Get current round counter from config
 */
async function getCurrentRoundCounter(connection: Connection): Promise<number> {
  const accountInfo = await connection.getAccountInfo(CONFIG_PDA);
  if (!accountInfo) {
    throw new Error("Config account not found");
  }

  const data = accountInfo.data;
  const roundCounter = new BN(data.slice(92, 100), "le");
  return roundCounter.toNumber();
}

/**
 * Get round data including pools and status
 */
async function getRoundData(
  connection: Connection,
  roundId: number
): Promise<{
  assetSymbol: string;
  startPrice: number;
  status: number;
  leftPool: number;
  rightPool: number;
} | null> {
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

  return {
    assetSymbol: assetSymbol.toUpperCase(),
    startPrice,
    status,
    leftPool,
    rightPool,
  };
}

/**
 * Find token by symbol
 */
function findTokenBySymbol(symbol: string): Token | null {
  const tokens = tokensData.data as Token[];
  return tokens.find((t) => t.tokenSymbol.toUpperCase() === symbol.toUpperCase()) || null;
}

/**
 * Cron endpoint to tweet when betting closes
 * Should be called 12 hours after round start
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify cron secret
  const cronSecret = req.headers["authorization"];
  if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.NODE_ENV === "production") {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");

    // Get current round
    const roundCounter = await getCurrentRoundCounter(connection);
    const currentRoundId = roundCounter - 1; // Active round

    if (currentRoundId < 0) {
      return res.status(200).json({ message: "No active round" });
    }

    // Get round data
    const roundData = await getRoundData(connection, currentRoundId);
    if (!roundData) {
      return res.status(404).json({ error: "Round not found" });
    }

    // Only tweet if round is in Locked status (betting closed)
    // Status: 0=Open, 1=Locked, 2=Settling, 3=Settled
    if (roundData.status !== 1) {
      return res.status(200).json({
        message: `Round ${currentRoundId} is not in Locked status (status=${roundData.status})`,
        skipped: true,
      });
    }

    // Get current price for the token
    const token = findTokenBySymbol(roundData.assetSymbol);
    if (!token) {
      return res.status(404).json({ error: `Token ${roundData.assetSymbol} not found` });
    }

    const currentPrice = await fetchPythPrice(token.pythFeedId);

    // Tweet!
    const tweetId = await tweetBettingClosed(
      currentRoundId,
      roundData.assetSymbol,
      currentPrice,
      roundData.startPrice,
      roundData.rightPool, // LONG = right
      roundData.leftPool   // SHORT = left
    );

    return res.status(200).json({
      success: true,
      roundId: currentRoundId,
      asset: roundData.assetSymbol,
      tweetId,
    });
  } catch (error) {
    console.error("Error in betting-closed cron:", error);
    return res.status(500).json({
      error: "Failed to post betting closed tweet",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

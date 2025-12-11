import {
  ActionGetResponse,
  ActionPostRequest,
  ActionPostResponse,
  ACTIONS_CORS_HEADERS,
  LinkedAction,
} from "@solana/actions";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import type { NextApiRequest, NextApiResponse } from "next";
import tokensData from "@/data/tokens.json";

// Program constants
const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "81K7nKnv7JiRhBCRNmagKot27Yu82eRWeeNA7dtGGaX6"
);
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";

// Anchor discriminator for place_bet (sha256("global:place_bet")[0:8])
const PLACE_BET_DISCRIMINATOR = Buffer.from([222, 62, 67, 220, 63, 166, 126, 33]);

// Token metadata for display - built from tokens.json
interface TokenInfo {
  symbol: string;
  name: string;
  image: string;
  coingeckoId: string;
}

const TOKENS: Record<string, TokenInfo> = {};
(tokensData.data as any[]).forEach((token) => {
  TOKENS[token.tokenSymbol.toUpperCase()] = {
    symbol: token.tokenSymbol.toUpperCase(),
    name: token.tokenName,
    image: token.tokenImageLogo,
    coingeckoId: token.coinGeckoId,
  };
});

interface RoundData {
  asset: string;
  assetName: string;
  assetImage: string;
  currentPrice: number;
  startPrice: number;
  priceChange24h: number;
  downPool: number;
  upPool: number;
  bettingEndTime: number;
  endTime: number;
  status: string;
}

// Helper to derive PDAs - defined early so other functions can use them
function getConfigPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    PROGRAM_ID
  );
  return pda;
}

function getRoundPda(roundId: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("round"), new BN(roundId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
  return pda;
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

function getVaultPda(roundId: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), new BN(roundId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
  return pda;
}

async function fetchTokenPrice(coingeckoId: string): Promise<{ price: number; change24h: number } | null> {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd&include_24hr_change=true`
    );
    const data = await res.json();
    if (data[coingeckoId]) {
      return {
        price: data[coingeckoId].usd,
        change24h: data[coingeckoId].usd_24h_change || 0,
      };
    }
  } catch (e) {
    console.error("Failed to fetch price:", e);
  }
  return null;
}

async function getRoundData(roundId: number): Promise<RoundData | null> {
  console.log("getRoundData called with roundId:", roundId);
  console.log("RPC_URL:", RPC_URL);
  console.log("PROGRAM_ID:", PROGRAM_ID.toBase58());

  try {
    const connection = new Connection(RPC_URL, "confirmed");
    const roundPda = getRoundPda(roundId);
    console.log("Round PDA:", roundPda.toBase58());

    const roundAccount = await connection.getAccountInfo(roundPda);
    console.log("Round account exists:", !!roundAccount);

    if (!roundAccount) {
      console.log("Round account not found for ID:", roundId);
      return null;
    }

    console.log("Round account data length:", roundAccount.data.length);

    // Parse round account data (Anchor account structure)
    // Supports both old (90 bytes) and new (114 bytes) layouts
    const data = roundAccount.data;
    const isNewLayout = data.length > 100;
    let offset = 8; // Skip discriminator

    // round_id: u64
    offset += 8;

    // asset_symbol: String (borsh: 4-byte length + bytes)
    const assetLen = data.readUInt32LE(offset);
    offset += 4;
    const assetSymbol = data.slice(offset, offset + assetLen).toString("utf-8");
    offset += assetLen;

    // start_price: i64
    const startPrice = Number(data.readBigInt64LE(offset)) / 1e8;
    offset += 8;

    // end_price: i64
    offset += 8; // skip end_price

    // start_time: i64
    offset += 8; // skip start_time

    // betting_end_time: i64 (NEW - only in new layout)
    let bettingEndTime: number;
    if (isNewLayout) {
      bettingEndTime = Number(data.readBigInt64LE(offset));
      offset += 8;
    }

    // end_time: i64
    const endTime = Number(data.readBigInt64LE(offset));
    offset += 8;

    // For old layout, betting_end_time = end_time
    if (!isNewLayout) {
      bettingEndTime = endTime;
    }

    // status: enum (1 byte)
    const status = data.readUInt8(offset);
    offset += 1;
    const statusStr = status === 0 ? "Open" : status === 1 ? "Locked" : status === 2 ? "Settling" : "Settled";

    // left_pool: u64 (lamports)
    const leftPool = Number(data.readBigUInt64LE(offset)) / LAMPORTS_PER_SOL;
    offset += 8;

    // right_pool: u64 (lamports)
    const rightPool = Number(data.readBigUInt64LE(offset)) / LAMPORTS_PER_SOL;
    offset += 8;

    // Skip weighted pools in new layout
    if (isNewLayout) {
      offset += 8; // left_weighted_pool
      offset += 8; // right_weighted_pool
    }

    // Get token info
    const token = TOKENS[assetSymbol] || TOKENS.WIF;
    const priceData = await fetchTokenPrice(token.coingeckoId);

    return {
      asset: assetSymbol,
      assetName: token.name,
      assetImage: token.image,
      currentPrice: priceData?.price || startPrice,
      startPrice,
      priceChange24h: priceData?.change24h || 0,
      downPool: leftPool,  // LEFT = SHORT/DOWN
      upPool: rightPool,   // RIGHT = LONG/UP
      bettingEndTime: bettingEndTime!,
      endTime,
      status: statusStr,
    };
  } catch (error) {
    console.error("Error fetching round data:", error);
    console.error("Error stack:", (error as Error).stack);
    return null;
  }
}

function formatTimeRemaining(endTime: number): string {
  const now = Math.floor(Date.now() / 1000);
  const remaining = Math.max(0, endTime - now);
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

// Clean blink with UP/DOWN and amount input
const getActionMetadata = (
  roundId: string,
  round: RoundData,
  referrer?: string
): ActionGetResponse => {
  const refParam = referrer ? `&ref=${referrer}` : "";
  const totalPool = round.downPool + round.upPool;
  const downOdds = totalPool > 0 ? ((round.downPool / totalPool) * 100).toFixed(0) : "50";
  const upOdds = totalPool > 0 ? ((round.upPool / totalPool) * 100).toFixed(0) : "50";
  const timeLeft = formatTimeRemaining(round.bettingEndTime);
  const priceChangeIcon = round.priceChange24h >= 0 ? "📈" : "📉";
  const priceChangeColor = round.priceChange24h >= 0 ? "+" : "";

  // Base URL for this API - use stable production URL
  const baseHref = `/api/actions/bet`;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://microperps.fun";

  return {
    type: "action",
    icon: `${baseUrl}/api/og?asset=${round.asset}&price=${round.currentPrice.toFixed(4)}&change=${round.priceChange24h.toFixed(2)}&round=${roundId}&shortPct=${downOdds}&longPct=${upOdds}&shortSol=${round.downPool.toFixed(1)}&longSol=${round.upPool.toFixed(1)}&time=${encodeURIComponent(timeLeft)}`,
    title: `${round.asset} ${priceChangeIcon} $${round.currentPrice.toFixed(4)}`,
    description: `Predict if ${round.asset} goes up or down in 24 hours.`,
    label: "Place Bet",
    links: {
      actions: [
        // LONG (UP) with amount input - green/success style
        {
          type: "transaction",
          label: "🟢 LONG",
          href: `${baseHref}?round=${roundId}&side=up&amount={amount}${refParam}`,
          style: "success",
          parameters: [
            {
              name: "amount",
              label: "SOL amount",
              type: "number",
              required: true,
              min: 0.01,
              max: 10,
            },
          ],
        } as any,
        // SHORT (DOWN) with amount input - red/destructive style
        {
          type: "transaction",
          label: "🔴 SHORT",
          href: `${baseHref}?round=${roundId}&side=down&amount={amount}${refParam}`,
          style: "destructive",
          parameters: [
            {
              name: "amount",
              label: "SOL amount",
              type: "number",
              required: true,
              min: 0.01,
              max: 10,
            },
          ],
        } as any,
        // Get My Link - returns personalized referral link via post-message
        {
          type: "post",
          label: "🔗 Get My Link",
          href: `${baseHref}?round=${roundId}&action=getlink`,
        } as any,
      ],
    },
  };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Handle CORS for blinks
  if (req.method === "OPTIONS") {
    return res.status(200)
      .setHeader("Access-Control-Allow-Origin", "*")
      .setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
      .setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept-Encoding")
      .end();
  }

  // Set CORS headers
  Object.entries(ACTIONS_CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Set required action headers
  res.setHeader("X-Action-Version", "2.1.3");
  res.setHeader("X-Blockchain-Ids", "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1");

  const { round, side, amount, ref, action } = req.query;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://microperps.fun";

  // If no round specified, get the current active round from config
  let roundId: number;
  if (!round) {
    try {
      const connection = new Connection(RPC_URL, "confirmed");
      const configPda = getConfigPda();
      const configAccount = await connection.getAccountInfo(configPda);
      if (!configAccount) {
        return res.status(500).json({ error: "Config not initialized" });
      }
      // Config layout: 8 (disc) + 32 (admin) + 2 (fee_bps) + 2 (ref_fee) + 8 (min) + 8 (max) + 32 (treasury) + 8 (round_counter)
      // round_counter is at offset 92
      const roundCounter = Number(configAccount.data.readBigUInt64LE(92));
      // Current active round is roundCounter - 1 (since counter increments after starting a round)
      roundId = Math.max(0, roundCounter - 1);
    } catch (error) {
      console.error("Error getting current round:", error);
      return res.status(500).json({ error: "Failed to get current round" });
    }
  } else {
    roundId = parseInt(round as string);
  }

  // GET: Return action metadata (the blink UI)
  if (req.method === "GET") {
    try {
      console.log("GET request for round:", roundId);
      const roundData = await getRoundData(roundId);
      console.log("Round data result:", roundData ? "found" : "not found");
      if (!roundData) {
        return res.status(404).json({ error: "Round not found" });
      }

      const metadata = getActionMetadata(
        roundId.toString(),
        roundData,
        ref as string | undefined
      );
      return res.status(200).json(metadata);
    } catch (error) {
      console.error("GET handler error:", error);
      return res.status(500).json({ error: "Internal error", details: String(error) });
    }
  }

  // POST: Handle actions
  if (req.method === "POST") {
    try {
      const body: ActionPostRequest = req.body;
      const userPubkey = new PublicKey(body.account);

      // Handle "Get My Link" action - returns message with personalized referral link
      if (action === "getlink") {
        const actionUrl = `${baseUrl}/api/actions/bet?round=${roundId}&ref=${userPubkey.toBase58()}`;
        const blinkUrl = `https://dial.to/?action=solana-action:${encodeURIComponent(actionUrl)}`;

        // Return a post response with message (no transaction)
        return res.status(200).json({
          type: "post",
          message: `🔗 Your referral link:\n\n${blinkUrl}\n\nShare on Twitter/X to earn 1% of every bet placed through your link!`,
          links: {
            next: {
              type: "inline",
              action: {
                type: "completed",
                title: "Your Referral Link",
                icon: `${baseUrl}/api/og?asset=LINK&round=${roundId}`,
                description: `Share this link to earn 1% of bets:\n\n${blinkUrl}`,
                label: "Link Generated!",
              },
            },
          },
        });
      }

      // For bet POST, side and amount are required
      if (!side || !amount) {
        return res.status(400).json({ error: "Missing side or amount parameter" });
      }

      const betSide = (side as string).toLowerCase();
      // Accept both old (left/right) and new (up/down) terminology
      const normalizedSide = betSide === "up" || betSide === "long" ? "right"
                           : betSide === "down" || betSide === "short" ? "left"
                           : betSide;
      if (normalizedSide !== "left" && normalizedSide !== "right") {
        return res.status(400).json({ error: "Side must be 'up', 'down', 'long', or 'short'" });
      }

      const betAmount = parseFloat(amount as string);
      if (isNaN(betAmount) || betAmount <= 0) {
        return res.status(400).json({ error: "Invalid bet amount" });
      }

      const lamports = Math.floor(betAmount * LAMPORTS_PER_SOL);
      const sideNum = normalizedSide === "left" ? 0 : 1;

      // Connect to Solana
      const connection = new Connection(RPC_URL, "confirmed");

      // Get round data to find bet count
      const roundPda = getRoundPda(roundId);
      const configPda = getConfigPda();

      const [roundAccount, configAccount] = await Promise.all([
        connection.getAccountInfo(roundPda),
        connection.getAccountInfo(configPda),
      ]);

      if (!roundAccount) {
        return res.status(404).json({ error: "Round not found" });
      }
      if (!configAccount) {
        return res.status(500).json({ error: "Config not initialized" });
      }

      // Parse bet_count from round account
      // Structure: discriminator(8) + round_id(8) + asset_symbol(4+len) + start_price(8) + end_price(8) + start_time(8) + end_time(8) + status(1) + left_pool(8) + right_pool(8) + bet_count(4)
      const roundData = roundAccount.data;
      let offset = 8 + 8; // skip discriminator and round_id
      const assetLen = roundData.readUInt32LE(offset);
      offset += 4 + assetLen + 8 + 8 + 8 + 8 + 1 + 8 + 8; // skip to bet_count
      const betCount = roundData.readUInt32LE(offset);

      // Parse treasury from config
      // Structure: discriminator(8) + admin(32) + fee_bps(2) + referrer_fee_bps(2) + min_bet(8) + max_bet(8) + treasury(32)
      const treasuryOffset = 8 + 32 + 2 + 2 + 8 + 8;
      const treasury = new PublicKey(configAccount.data.slice(treasuryOffset, treasuryOffset + 32));

      // Build the place_bet instruction
      const betPda = getBetPda(roundId, betCount);
      const vaultPda = getVaultPda(roundId);

      // Create instruction data for place_bet
      // Discriminator (8 bytes) + side (1 byte) + amount (8 bytes)
      const instructionData = Buffer.concat([
        PLACE_BET_DISCRIMINATOR,
        Buffer.from([sideNum]),
        new BN(lamports).toArrayLike(Buffer, "le", 8),
      ]);

      // Build accounts array matching place_bet instruction order:
      // config, round, bet, vault, treasury, bettor, referrer (optional), system_program
      const accounts = [
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: roundPda, isSigner: false, isWritable: true },
        { pubkey: betPda, isSigner: false, isWritable: true },
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: treasury, isSigner: false, isWritable: true },
        { pubkey: userPubkey, isSigner: true, isWritable: true },
      ];

      // Add referrer if provided (must come before system_program)
      if (ref) {
        try {
          const referrerPubkey = new PublicKey(ref as string);
          // Only add if not self-referral
          if (!referrerPubkey.equals(userPubkey)) {
            accounts.push({ pubkey: referrerPubkey, isSigner: false, isWritable: true });
          }
        } catch {
          // Invalid referrer pubkey, skip it
        }
      }

      // System program last
      accounts.push({ pubkey: SystemProgram.programId, isSigner: false, isWritable: false });

      // Create transaction
      const transaction = new Transaction();
      transaction.add({
        programId: PROGRAM_ID,
        keys: accounts,
        data: instructionData,
      });

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = userPubkey;

      // Serialize transaction
      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });

      const sideEmoji = normalizedSide === "left" ? "🔻" : "🔺";
      const sideLabel = normalizedSide === "left" ? "SHORT" : "LONG";
      const response: ActionPostResponse = {
        type: "transaction",
        transaction: serializedTransaction.toString("base64"),
        message: `${sideEmoji} Going ${sideLabel} with ${betAmount} SOL!`,
      };

      return res.status(200).json(response);
    } catch (error) {
      console.error("Error creating transaction:", error);
      return res.status(500).json({ error: "Failed to create transaction" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

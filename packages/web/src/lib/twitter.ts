import { TwitterApi } from "twitter-api-v2";

/**
 * Twitter Bot for @microperps
 * Posts blinks for round starts and settlement results
 */

// Token Twitter handles - tag them in tweets for visibility
const TOKEN_TWITTER_HANDLES: Record<string, string> = {
  // Meme coins
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

  // AI tokens
  AI16Z: "@ai16zdao",
  ACT: "@ACT_TheAIProphe",

  // DeFi / Infrastructure
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

  // Political
  TRUMP: "@GetTrumpMemes",
  MELANIA: "@MELANIAMEME",
};

/**
 * Get Twitter handle for a token (if we have it)
 */
function getTokenTwitter(symbol: string): string | null {
  return TOKEN_TWITTER_HANDLES[symbol.toUpperCase()] || null;
}

// Initialize Twitter client (singleton)
let twitterClient: TwitterApi | null = null;

function getTwitterClient(): TwitterApi | null {
  if (process.env.TWITTER_ENABLED !== "true") {
    console.log("[Twitter] Disabled via TWITTER_ENABLED env var");
    return null;
  }

  if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_API_SECRET) {
    console.log("[Twitter] Missing API credentials");
    return null;
  }

  if (!process.env.TWITTER_ACCESS_TOKEN || !process.env.TWITTER_ACCESS_SECRET) {
    console.log("[Twitter] Missing access token credentials");
    return null;
  }

  if (!twitterClient) {
    twitterClient = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_SECRET,
    });
  }

  return twitterClient;
}

/**
 * Retry wrapper for tweet operations
 */
async function tweetWithRetry(
  client: TwitterApi,
  text: string,
  maxRetries: number = 3
): Promise<string | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const tweet = await client.v2.tweet(text);
      return tweet.data.id;
    } catch (error) {
      const err = error as { code?: number; message?: string };
      console.error(`[Twitter] Attempt ${attempt}/${maxRetries} failed:`, err.message || error);

      // Don't retry on auth errors or duplicate tweets
      if (err.code === 401 || err.code === 403 || err.code === 187) {
        console.error("[Twitter] Non-retryable error, giving up");
        return null;
      }

      if (attempt < maxRetries) {
        const delay = 2000 * attempt; // 2s, 4s, 6s
        console.log(`[Twitter] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  console.error("[Twitter] All retry attempts failed");
  return null;
}

/**
 * Format price for display
 */
function formatPrice(priceScaled: number): string {
  const price = priceScaled / 1e8; // Pyth prices are scaled by 10^8
  if (price < 0.0001) return price.toExponential(2);
  if (price < 0.01) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  if (price < 100) return price.toFixed(2);
  return price.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/**
 * Generate blink URL for a round
 */
function getBlinkUrl(roundId: number, baseUrl: string): string {
  const actionUrl = `${baseUrl}/api/actions/bet?round=${roundId}`;
  return `https://dial.to/?action=solana-action:${encodeURIComponent(actionUrl)}`;
}

/**
 * Tweet when a new round starts
 */
export async function tweetRoundStart(
  roundId: number,
  tokenSymbol: string,
  tokenName: string,
  startPrice: number,
  baseUrl: string
): Promise<string | null> {
  const client = getTwitterClient();
  if (!client) {
    console.log("[Twitter] Skipping round start tweet - client not available");
    return null;
  }

  const blinkUrl = getBlinkUrl(roundId, baseUrl);
  const priceStr = formatPrice(startPrice);
  const twitterHandle = getTokenTwitter(tokenSymbol);
  const tokenMention = twitterHandle ? ` ${twitterHandle}` : "";

  const text = `🎲 Round #${roundId} is LIVE!

$${tokenSymbol.toUpperCase()}${tokenMention} - Will it pump or dump in 24h?

📊 Starting price: $${priceStr}
⏰ Betting closes in 12 hours

🟢 LONG = price goes UP
🔴 SHORT = price goes DOWN

👇 Bet now via the blink below!

${blinkUrl}`;

  console.log("[Twitter] Posting round start tweet...");
  const tweetId = await tweetWithRetry(client, text);
  if (tweetId) {
    console.log("[Twitter] Round start tweet posted:", tweetId);
  }
  return tweetId;
}

/**
 * Tweet when a round is settled
 */
export async function tweetRoundSettled(
  roundId: number,
  tokenSymbol: string,
  startPrice: number,
  endPrice: number,
  winningSide: "LONG" | "SHORT",
  totalPoolLamports: number,
  winnerCount: number
): Promise<string | null> {
  const client = getTwitterClient();
  if (!client) {
    console.log("[Twitter] Skipping settlement tweet - client not available");
    return null;
  }

  const startPriceStr = formatPrice(startPrice);
  const endPriceStr = formatPrice(endPrice);

  // Calculate price change percentage
  const change = startPrice > 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0;
  const changeStr = change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2);

  // Convert lamports to SOL
  const poolSol = (totalPoolLamports / 1e9).toFixed(2);

  const outcomeEmoji = winningSide === "LONG" ? "📈 PUMPED!" : "📉 DUMPED!";
  const changeEmoji = change >= 0 ? "📈" : "📉";
  const twitterHandle = getTokenTwitter(tokenSymbol);
  const tokenMention = twitterHandle ? ` ${twitterHandle}` : "";

  const text = `🏁 Round #${roundId} SETTLED!

$${tokenSymbol.toUpperCase()}${tokenMention} ${outcomeEmoji}

📊 Start: $${startPriceStr}
📊 End: $${endPriceStr}
${changeEmoji} Change: ${changeStr}%

🏆 ${winningSide} WINS!

💰 Total Pool: ${poolSol} SOL
👥 ${winnerCount} winner${winnerCount !== 1 ? "s" : ""} paid out

Next round starting soon... 👀`;

  console.log("[Twitter] Posting settlement tweet...");
  const tweetId = await tweetWithRetry(client, text);
  if (tweetId) {
    console.log("[Twitter] Settlement tweet posted:", tweetId);
  }
  return tweetId;
}

/**
 * Tweet when betting closes (12 hours into round)
 */
export async function tweetBettingClosed(
  roundId: number,
  tokenSymbol: string,
  currentPrice: number,
  startPrice: number,
  longPool: number,
  shortPool: number
): Promise<string | null> {
  const client = getTwitterClient();
  if (!client) {
    console.log("[Twitter] Skipping betting closed tweet - client not available");
    return null;
  }

  // Calculate current change
  const change = startPrice > 0 ? ((currentPrice - startPrice) / startPrice) * 100 : 0;
  const changeStr = change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2);
  const changeEmoji = change >= 0 ? "📈" : "📉";

  // Calculate pool percentages
  const totalPool = longPool + shortPool;
  const longPct = totalPool > 0 ? ((longPool / totalPool) * 100).toFixed(0) : "50";
  const shortPct = totalPool > 0 ? ((shortPool / totalPool) * 100).toFixed(0) : "50";

  const longSol = (longPool / 1e9).toFixed(2);
  const shortSol = (shortPool / 1e9).toFixed(2);
  const totalSol = (totalPool / 1e9).toFixed(2);
  const twitterHandle = getTokenTwitter(tokenSymbol);
  const tokenMention = twitterHandle ? ` ${twitterHandle}` : "";

  const text = `🔒 BETTING CLOSED for Round #${roundId}!

$${tokenSymbol.toUpperCase()}${tokenMention} ${changeEmoji} ${changeStr}% since start

Final positions:
🟢 LONG: ${longSol} SOL (${longPct}%)
🔴 SHORT: ${shortSol} SOL (${shortPct}%)

💰 Total pool: ${totalSol} SOL

⏰ Settlement in 12 hours...

Who will win? 👀`;

  console.log("[Twitter] Posting betting closed tweet...");
  const tweetId = await tweetWithRetry(client, text);
  if (tweetId) {
    console.log("[Twitter] Betting closed tweet posted:", tweetId);
  }
  return tweetId;
}

/**
 * Tweet a mid-round reminder (optional - call 6 hours into betting)
 */
export async function tweetMidRoundReminder(
  roundId: number,
  tokenSymbol: string,
  currentPrice: number,
  startPrice: number,
  longPool: number,
  shortPool: number,
  baseUrl: string
): Promise<string | null> {
  const client = getTwitterClient();
  if (!client) return null;

  const blinkUrl = getBlinkUrl(roundId, baseUrl);

  // Calculate current change
  const change = startPrice > 0 ? ((currentPrice - startPrice) / startPrice) * 100 : 0;
  const direction = change >= 0 ? "UP" : "DOWN";
  const changeStr = Math.abs(change).toFixed(2);

  // Calculate pool percentages
  const totalPool = longPool + shortPool;
  const longPct = totalPool > 0 ? ((longPool / totalPool) * 100).toFixed(0) : "50";
  const shortPct = totalPool > 0 ? ((shortPool / totalPool) * 100).toFixed(0) : "50";

  const longSol = (longPool / 1e9).toFixed(2);
  const shortSol = (shortPool / 1e9).toFixed(2);

  const text = `⏰ 6 HOURS LEFT to bet on Round #${roundId}!

$${tokenSymbol.toUpperCase()} is currently ${direction} ${changeStr}% from start

🟢 LONG pool: ${longSol} SOL (${longPct}%)
🔴 SHORT pool: ${shortSol} SOL (${shortPct}%)

Early bird bonus drops to 1.15x in 3 hours!

👇 Place your bet

${blinkUrl}`;

  const tweetId = await tweetWithRetry(client, text);
  if (tweetId) {
    console.log("[Twitter] Mid-round reminder posted:", tweetId);
  }
  return tweetId;
}

/**
 * Test the Twitter connection by verifying credentials
 */
export async function testTwitterConnection(): Promise<{
  success: boolean;
  username?: string;
  error?: string;
  details?: unknown;
}> {
  const client = getTwitterClient();
  if (!client) {
    return { success: false, error: "Twitter client not configured" };
  }

  try {
    const me = await client.v2.me();
    return { success: true, username: me.data.username };
  } catch (error: unknown) {
    // Extract more details from Twitter API errors
    const err = error as { code?: number; data?: unknown; message?: string };
    console.error("[Twitter] Full error:", JSON.stringify(error, null, 2));
    return {
      success: false,
      error: err.message || String(error),
      details: err.data || err.code,
    };
  }
}

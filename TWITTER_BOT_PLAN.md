# Twitter Bot Master Plan

## Overview

The @microperps Twitter bot will automatically post blinks to announce new rounds and settlement results, driving engagement and making the game discoverable on Twitter/X.

---

## 1. Tweet Cadence & Content

### 1.1 Round Start Tweet (Every 24 hours)

**When:** Immediately after `start_round` succeeds in the cron job

**Content Template:**
```
🎲 Round #{roundId} is LIVE!

${tokenSymbol} - Will it pump or dump in 24h?

📊 Starting price: ${startPrice}
⏰ Betting closes in 12 hours

🟢 LONG if you think it goes UP
🔴 SHORT if you think it goes DOWN

👇 Bet now via the blink below!

{blink_url}
```

**Dynamic Data:**
- `roundId` - From on-chain round counter
- `tokenSymbol` - Randomly selected token (e.g., GIGA, DRIFT, AI16Z)
- `startPrice` - Price at round start (formatted nicely)
- `blink_url` - `https://dial.to/?action=solana-action:${encoded_action_url}`

**OG Image:** The blink will unfurl with the dynamic OG image showing:
- Token image as background
- LONG vs SHORT pools
- Time remaining
- Current price

---

### 1.2 Settlement Tweet (24 hours after round start)

**When:** Immediately after `settle_round` and `process_payout` complete

**Content Template:**
```
🏁 Round #{roundId} SETTLED!

${tokenSymbol} ${outcome_emoji}

📈 Start: ${startPrice}
📉 End: ${endPrice}
${change_direction} Change: ${priceChange}%

🏆 ${winningSide} WINS!

💰 Total Pool: ${totalPool} SOL
👥 Winners: ${winnerCount} players paid out

Next round starts soon... 👀
```

**Outcome Emoji Logic:**
- If LONG wins: `📈 PUMPED!`
- If SHORT wins: `📉 DUMPED!`

---

### 1.3 Optional: Mid-Round Reminder (6 hours in)

**When:** 6 hours after round start (halfway through betting window)

**Content Template:**
```
⏰ 6 HOURS LEFT to bet on Round #{roundId}!

${tokenSymbol} is currently ${direction} ${changePercent}% from start

🟢 LONG pool: ${longPool} SOL (${longPct}%)
🔴 SHORT pool: ${shortPool} SOL (${shortPct}%)

Early bird bonus drops from 1.3x to 1.15x in 3 hours!

👇 Place your bet

{blink_url}
```

---

### 1.4 Optional: Betting Closed Tweet (12 hours in)

**When:** When betting window closes

**Content Template:**
```
🔒 Betting CLOSED for Round #{roundId}!

${tokenSymbol} - The wait begins...

Current standings:
🟢 LONG: ${longPool} SOL (${longPct}%)
🔴 SHORT: ${shortPool} SOL (${shortPct}%)

⏰ Settlement in 12 hours

Who will win? 👀
```

---

## 2. Technical Architecture

### 2.1 Option A: Extend Existing Cron API (Recommended)

Modify `/api/cron/new-round.ts` to post tweets after successful on-chain operations.

**Pros:**
- Single source of truth
- No separate service to manage
- Uses existing Vercel cron infrastructure

**Cons:**
- Twitter API failures could affect round creation
- Need error handling to ensure round still works if tweet fails

**Implementation:**
```typescript
// In /api/cron/new-round.ts

import { TwitterApi } from 'twitter-api-v2';

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY!,
  appSecret: process.env.TWITTER_API_SECRET!,
  accessToken: process.env.TWITTER_ACCESS_TOKEN!,
  accessSecret: process.env.TWITTER_ACCESS_SECRET!,
});

// After startNewRound() succeeds:
try {
  await postRoundStartTweet(roundId, token, startPrice);
} catch (tweetError) {
  console.error("Tweet failed (non-fatal):", tweetError);
  // Continue - round is more important than tweet
}
```

### 2.2 Option B: Separate Bot Service

Create a standalone bot service that:
1. Polls the blockchain for new rounds
2. Posts tweets independently
3. Can be hosted anywhere (Railway, Fly.io, etc.)

**Pros:**
- Decoupled from main app
- Can add more complex logic (threading, replies, etc.)
- Won't affect round creation if it fails

**Cons:**
- Another service to manage
- Potential race conditions with round creation
- More infrastructure complexity

### 2.3 Option C: Vercel Cron + Separate Tweet Endpoint

Create a separate `/api/cron/tweet.ts` that runs on its own schedule.

**Pros:**
- Separation of concerns
- Can retry tweets independently

**Cons:**
- Need to track what's been tweeted (database/state)
- Timing coordination with round creation

---

## 3. Recommended Implementation (Option A)

### 3.1 File Structure

```
packages/web/
├── src/
│   ├── lib/
│   │   └── twitter.ts          # Twitter client & tweet formatting
│   └── pages/api/cron/
│       └── new-round.ts        # Modified to include tweeting
```

### 3.2 Environment Variables

Add to `.env` and Vercel environment:

```bash
# Twitter API v2 credentials (from developer.twitter.com)
TWITTER_API_KEY=xxx
TWITTER_API_SECRET=xxx
TWITTER_ACCESS_TOKEN=xxx
TWITTER_ACCESS_SECRET=xxx

# Optional: Enable/disable tweeting
TWITTER_ENABLED=true
```

### 3.3 Twitter Client Module

Create `packages/web/src/lib/twitter.ts`:

```typescript
import { TwitterApi } from 'twitter-api-v2';

// Initialize client
const getTwitterClient = () => {
  if (!process.env.TWITTER_ENABLED || process.env.TWITTER_ENABLED !== 'true') {
    return null;
  }

  return new TwitterApi({
    appKey: process.env.TWITTER_API_KEY!,
    appSecret: process.env.TWITTER_API_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessSecret: process.env.TWITTER_ACCESS_SECRET!,
  });
};

// Format price nicely
const formatPrice = (price: number): string => {
  if (price < 0.0001) return price.toExponential(2);
  if (price < 1) return price.toFixed(6);
  if (price < 100) return price.toFixed(4);
  return price.toFixed(2);
};

// Generate blink URL
const getBlinkUrl = (roundId: number, baseUrl: string): string => {
  const actionUrl = `${baseUrl}/api/actions/bet?round=${roundId}`;
  return `https://dial.to/?action=solana-action:${encodeURIComponent(actionUrl)}`;
};

// Tweet: Round Started
export async function tweetRoundStart(
  roundId: number,
  tokenSymbol: string,
  tokenName: string,
  startPrice: number,
  baseUrl: string
): Promise<string | null> {
  const client = getTwitterClient();
  if (!client) {
    console.log('Twitter disabled, skipping tweet');
    return null;
  }

  const blinkUrl = getBlinkUrl(roundId, baseUrl);
  const priceStr = formatPrice(startPrice / 1e8); // Convert from scaled

  const text = `🎲 Round #${roundId} is LIVE!

$${tokenSymbol} (${tokenName}) - Will it pump or dump in 24h?

📊 Starting price: $${priceStr}
⏰ Betting closes in 12 hours

🟢 LONG = price goes UP
🔴 SHORT = price goes DOWN

👇 Bet now via the blink below!

${blinkUrl}`;

  try {
    const tweet = await client.v2.tweet(text);
    console.log('Round start tweet posted:', tweet.data.id);
    return tweet.data.id;
  } catch (error) {
    console.error('Failed to post round start tweet:', error);
    return null;
  }
}

// Tweet: Round Settled
export async function tweetRoundSettled(
  roundId: number,
  tokenSymbol: string,
  startPrice: number,
  endPrice: number,
  winningSide: 'LONG' | 'SHORT',
  totalPool: number,
  winnerCount: number
): Promise<string | null> {
  const client = getTwitterClient();
  if (!client) return null;

  const startPriceStr = formatPrice(startPrice / 1e8);
  const endPriceStr = formatPrice(endPrice / 1e8);
  const change = ((endPrice - startPrice) / startPrice) * 100;
  const changeStr = change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2);
  const poolSol = (totalPool / 1e9).toFixed(2);

  const outcomeEmoji = winningSide === 'LONG' ? '📈 PUMPED!' : '📉 DUMPED!';
  const changeEmoji = change >= 0 ? '📈' : '📉';

  const text = `🏁 Round #${roundId} SETTLED!

$${tokenSymbol} ${outcomeEmoji}

📊 Start: $${startPriceStr}
📊 End: $${endPriceStr}
${changeEmoji} Change: ${changeStr}%

🏆 ${winningSide} WINS!

💰 Total Pool: ${poolSol} SOL
👥 ${winnerCount} winners paid out automatically

Next round starting soon... 👀`;

  try {
    const tweet = await client.v2.tweet(text);
    console.log('Settlement tweet posted:', tweet.data.id);
    return tweet.data.id;
  } catch (error) {
    console.error('Failed to post settlement tweet:', error);
    return null;
  }
}
```

### 3.4 Modified Cron Job

Update `packages/web/src/pages/api/cron/new-round.ts`:

```typescript
// Add imports
import { tweetRoundStart, tweetRoundSettled } from '@/lib/twitter';

// In the handler, after settling previous round:
if (settled) {
  const payoutsProcessed = await processPayouts(connection, admin, currentRoundId - 1);

  // Get previous round data for tweet
  const prevRoundAsset = await getRoundAsset(connection, currentRoundId - 1);
  const prevRoundInfo = await getRoundInfo(connection, currentRoundId - 1);

  // Tweet settlement (non-blocking)
  tweetRoundSettled(
    currentRoundId - 1,
    prevRoundAsset || 'UNKNOWN',
    /* startPrice */ 0, // TODO: fetch from round account
    /* endPrice */ 0,   // TODO: fetch from round account
    prevRoundInfo?.winningSide === 0 ? 'SHORT' : 'LONG',
    /* totalPool */ 0,  // TODO: calculate
    payoutsProcessed
  ).catch(err => console.error('Settlement tweet error:', err));
}

// After starting new round:
const sig = await startNewRound(connection, admin, currentRoundId, token, currentPrice);

// Tweet new round (non-blocking)
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://microperps.fun';
tweetRoundStart(
  currentRoundId,
  token.tokenSymbol,
  token.tokenName,
  currentPrice,
  baseUrl
).catch(err => console.error('Round start tweet error:', err));
```

---

## 4. Twitter Developer Setup

### 4.1 Create Twitter Developer Account

1. Go to https://developer.twitter.com
2. Sign in with @microperps account
3. Apply for developer access (Free tier is sufficient)
4. Create a new Project and App

### 4.2 App Permissions

Set the following permissions for your app:
- **Read and Write** (to post tweets)
- **OAuth 1.0a** enabled

### 4.3 Generate Credentials

From your app dashboard, generate:
1. API Key and Secret (Consumer Keys)
2. Access Token and Secret (with Read/Write permissions)

### 4.4 Test Credentials

```bash
# Quick test with curl
curl -X POST "https://api.twitter.com/2/tweets" \
  -H "Authorization: OAuth ..." \
  -H "Content-Type: application/json" \
  -d '{"text": "Test tweet from microperps bot!"}'
```

---

## 5. Deployment Checklist

### 5.1 Development

- [ ] Create Twitter Developer account for @microperps
- [ ] Create app and generate API credentials
- [ ] Install `twitter-api-v2` package
- [ ] Create `lib/twitter.ts` module
- [ ] Update cron job to call tweet functions
- [ ] Test locally with `TWITTER_ENABLED=false` (log only)
- [ ] Test with real credentials on devnet

### 5.2 Production

- [ ] Add environment variables to Vercel:
  - `TWITTER_API_KEY`
  - `TWITTER_API_SECRET`
  - `TWITTER_ACCESS_TOKEN`
  - `TWITTER_ACCESS_SECRET`
  - `TWITTER_ENABLED=true`
- [ ] Deploy updated cron job
- [ ] Monitor first few rounds for successful tweets
- [ ] Set up error alerting (optional)

---

## 6. Future Enhancements

### 6.1 Tweet Threading

Post settlement as a reply to the original round start tweet:
- Store tweet IDs in a simple KV store or database
- Use `reply_to` parameter when posting settlement

### 6.2 Engagement Features

- **Quote tweets** of big wins
- **Leaderboard tweets** (weekly top players)
- **Milestone tweets** (total volume, round count)

### 6.3 Media Attachments

- Upload OG image directly instead of relying on unfurl
- Create animated GIFs for settlements

### 6.4 Interaction Bot

- Reply to mentions with current round info
- DM users their referral links
- Auto-retweet community posts

---

## 7. Error Handling & Monitoring

### 7.1 Graceful Degradation

```typescript
// Never let tweet failures break round operations
try {
  await tweetRoundStart(...);
} catch (error) {
  // Log but don't throw
  console.error('Tweet failed:', error);
  // Optionally: send to error tracking (Sentry, etc.)
}
```

### 7.2 Rate Limiting

Twitter API v2 Free tier limits:
- 50 tweets per 24 hours
- 1 app-only request per second

With 1-2 tweets per day (round start + settlement), we're well within limits.

### 7.3 Retry Logic

```typescript
async function tweetWithRetry(text: string, maxRetries = 3): Promise<string | null> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await client.v2.tweet(text);
      return result.data.id;
    } catch (error: any) {
      if (error.code === 429) {
        // Rate limited - wait and retry
        await new Promise(r => setTimeout(r, 60000));
        continue;
      }
      throw error;
    }
  }
  return null;
}
```

---

## 8. Sample Tweets

### Round Start (GIGA token)
```
🎲 Round #42 is LIVE!

$GIGA (Gigachad) - Will it pump or dump in 24h?

📊 Starting price: $0.002341
⏰ Betting closes in 12 hours

🟢 LONG = price goes UP
🔴 SHORT = price goes DOWN

👇 Bet now via the blink below!

https://dial.to/?action=solana-action:https%3A%2F%2Fmicroperps.fun%2Fapi%2Factions%2Fbet%3Fround%3D42
```

### Round Settlement
```
🏁 Round #42 SETTLED!

$GIGA 📈 PUMPED!

📊 Start: $0.002341
📊 End: $0.002876
📈 Change: +22.85%

🏆 LONG WINS!

💰 Total Pool: 15.50 SOL
👥 8 winners paid out automatically

Next round starting soon... 👀
```

---

## 9. Timeline Estimate

| Phase | Tasks | Duration |
|-------|-------|----------|
| Setup | Twitter dev account, credentials | 1-2 hours |
| Development | Twitter module, cron integration | 2-3 hours |
| Testing | Local testing, devnet verification | 1-2 hours |
| Deployment | Vercel env vars, production deploy | 30 min |
| **Total** | | **5-8 hours** |

---

## 10. Dependencies

Add to `packages/web/package.json`:

```json
{
  "dependencies": {
    "twitter-api-v2": "^1.15.0"
  }
}
```

---

Ready to implement? Let me know and I'll start with the Twitter module!

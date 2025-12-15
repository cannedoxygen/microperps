const { Connection, PublicKey } = require('@solana/web3.js');
const { BN } = require('@coral-xyz/anchor');
const { TwitterApi } = require('twitter-api-v2');
require('dotenv').config({ path: '.env.local' });

const PROGRAM_ID = new PublicKey('81K7nKnv7JiRhBCRNmagKot27Yu82eRWeeNA7dtGGaX6');

function formatPrice(priceScaled) {
  const price = priceScaled / 1e8;
  if (price < 0.0001) return price.toExponential(2);
  if (price < 0.01) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  if (price < 100) return price.toFixed(2);
  return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

async function getFullRoundInfo(connection, roundId) {
  const [roundPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('round'), new BN(roundId).toArrayLike(Buffer, 'le', 8)],
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
  const assetSymbol = data.slice(offset, offset + assetLen).toString('utf8');
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
  const payoutsProcessed = data.readUInt32LE(offset);
  offset += 4;

  // winning_side: Option<Side> (1 + 1 if Some)
  const winningSideDiscriminant = data.readUInt8(offset);
  offset += 1;
  let winningSide = null;
  if (winningSideDiscriminant === 1) {
    const sideValue = data.readUInt8(offset);
    winningSide = sideValue === 0 ? 'SHORT' : 'LONG';
  }

  return {
    assetSymbol: assetSymbol.toUpperCase(),
    startPrice,
    endPrice,
    status,
    leftPool,
    rightPool,
    betCount,
    payoutsProcessed,
    winningSide,
  };
}

async function tweetSettlement(roundId) {
  const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL, 'confirmed');

  const info = await getFullRoundInfo(connection, roundId);
  if (!info) {
    console.log(`Round ${roundId} not found`);
    return;
  }

  console.log(`Round ${roundId}:`, info);

  if (!info.winningSide) {
    console.log(`Round ${roundId} has no winning side set - not settled yet`);
    return;
  }

  const startPriceStr = formatPrice(info.startPrice);
  const endPriceStr = formatPrice(info.endPrice);
  const change = info.startPrice > 0 ? ((info.endPrice - info.startPrice) / info.startPrice) * 100 : 0;
  const changeStr = change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2);
  const poolSol = ((info.leftPool + info.rightPool) / 1e9).toFixed(2);
  const outcomeEmoji = info.winningSide === 'LONG' ? '📈 PUMPED!' : '📉 DUMPED!';
  const changeEmoji = change >= 0 ? '📈' : '📉';

  const text = `🏁 Round #${roundId} SETTLED!

$${info.assetSymbol} ${outcomeEmoji}

📊 Start: $${startPriceStr}
📊 End: $${endPriceStr}
${changeEmoji} Change: ${changeStr}%

🏆 ${info.winningSide} WINS!

💰 Total Pool: ${poolSol} SOL
👥 ${info.payoutsProcessed} winner${info.payoutsProcessed !== 1 ? 's' : ''} paid out

Next round starting soon... 👀`;

  console.log('\n--- Tweet Content ---');
  console.log(text);
  console.log('--- End Tweet ---\n');

  // Check if we should actually tweet
  if (process.env.TWITTER_ENABLED !== 'true') {
    console.log('TWITTER_ENABLED is not true, skipping actual tweet');
    return;
  }

  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  });

  try {
    const tweet = await client.v2.tweet(text);
    console.log('Tweet posted:', tweet.data.id);
  } catch (error) {
    console.error('Failed to post tweet:', error);
  }
}

const roundId = parseInt(process.argv[2]);
if (!roundId) {
  console.log('Usage: node tweet-settlement.js <roundId>');
  process.exit(1);
}

tweetSettlement(roundId).catch(console.error);

const { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } = require('@solana/web3.js');
const { BN } = require('@coral-xyz/anchor');
const tokensData = require('./src/data/tokens.json');

// Load env
require('dotenv').config({ path: '.env.local' });

const PROGRAM_ID = new PublicKey('81K7nKnv7JiRhBCRNmagKot27Yu82eRWeeNA7dtGGaX6');
const CONFIG_PDA = new PublicKey(process.env.NEXT_PUBLIC_CONFIG_PDA || 'DQ6T8gLKAYWhqvxMe8mHRjoY6ZMefRinZu8fkAV4ePA9');

// Settle round discriminator (from new-round.ts)
const SETTLE_ROUND_DISCRIMINATOR = Buffer.from([40, 101, 18, 1, 31, 129, 52, 77]);

// Build Pyth feeds from tokens.json
const PYTH_FEEDS = {};
tokensData.data.forEach(token => {
  const symbol = token.tokenSymbol.toUpperCase();
  // Remove 0x prefix if present
  const feedId = token.pythFeedId.startsWith('0x') ? token.pythFeedId.slice(2) : token.pythFeedId;
  PYTH_FEEDS[symbol] = feedId;
});

async function settleRound(roundId) {
  const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');

  // Load admin keypair
  const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
  if (!adminPrivateKey) {
    throw new Error('ADMIN_PRIVATE_KEY not set');
  }
  const admin = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(adminPrivateKey)));
  console.log('Admin:', admin.publicKey.toBase58());

  // Get round PDA
  const [roundPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('round'), new BN(roundId).toArrayLike(Buffer, 'le', 8)],
    PROGRAM_ID
  );
  console.log('Round PDA:', roundPda.toBase58());

  // Get round data to find token symbol
  const roundAccount = await connection.getAccountInfo(roundPda);
  if (!roundAccount) {
    throw new Error('Round not found');
  }

  // Parse asset symbol
  const data = roundAccount.data;
  let offset = 8 + 8; // skip discriminator + round_id
  const assetLen = data.readUInt32LE(offset);
  offset += 4;
  const assetSymbol = data.slice(offset, offset + assetLen).toString('utf8').toUpperCase();
  console.log('Asset:', assetSymbol);

  // Get Pyth feed ID for this token
  const pythFeedId = PYTH_FEEDS[assetSymbol];
  if (!pythFeedId) {
    throw new Error(`No Pyth feed ID for ${assetSymbol}`);
  }

  // Get current price from Pyth
  const res = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?ids[]=${pythFeedId}`);
  const priceData = await res.json();
  const price = parseInt(priceData.parsed[0].price.price);
  console.log('End price:', price, '-> $' + (price / 1e8).toFixed(6));

  // Build settle instruction
  const settleData = Buffer.alloc(8 + 8);
  SETTLE_ROUND_DISCRIMINATOR.copy(settleData, 0);
  new BN(price).toArrayLike(Buffer, 'le', 8).copy(settleData, 8);

  const settleIx = new TransactionInstruction({
    keys: [
      { pubkey: CONFIG_PDA, isSigner: false, isWritable: false },
      { pubkey: roundPda, isSigner: false, isWritable: true },
      { pubkey: admin.publicKey, isSigner: true, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: settleData,
  });

  const tx = new Transaction().add(settleIx);
  const sig = await sendAndConfirmTransaction(connection, tx, [admin], { commitment: 'confirmed' });
  console.log(`Settled round ${roundId}:`, sig);
  return sig;
}

// Get round ID from command line or default to 12
const roundId = parseInt(process.argv[2]) || 12;
console.log(`Settling round ${roundId}...`);

settleRound(roundId).catch(console.error);

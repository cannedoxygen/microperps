const { Connection, PublicKey } = require('@solana/web3.js');
const { BN } = require('@coral-xyz/anchor');
require('dotenv').config({ path: '.env.local' });

const PROGRAM_ID = new PublicKey('81K7nKnv7JiRhBCRNmagKot27Yu82eRWeeNA7dtGGaX6');

async function checkRound(roundId) {
  const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');

  const [roundPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('round'), new BN(roundId).toArrayLike(Buffer, 'le', 8)],
    PROGRAM_ID
  );

  console.log('Round PDA:', roundPda.toBase58());

  const account = await connection.getAccountInfo(roundPda);
  if (!account) {
    console.log('Round not found');
    return;
  }

  const data = account.data;
  console.log('Raw data length:', data.length);

  let offset = 8;
  const roundIdParsed = data.readBigUInt64LE(offset);
  offset += 8;
  console.log('Round ID:', roundIdParsed.toString());

  const assetLen = data.readUInt32LE(offset);
  offset += 4;
  const asset = data.slice(offset, offset + assetLen).toString('utf8');
  offset += assetLen;
  console.log('Asset:', asset);

  const startTime = data.readBigInt64LE(offset);
  offset += 8;
  console.log('Start time:', new Date(Number(startTime) * 1000).toISOString());

  const endTime = data.readBigInt64LE(offset);
  offset += 8;
  console.log('End time:', new Date(Number(endTime) * 1000).toISOString());

  const bettingEnd = data.readBigInt64LE(offset);
  offset += 8;
  console.log('Betting end:', new Date(Number(bettingEnd) * 1000).toISOString());

  const startPrice = data.readBigInt64LE(offset);
  offset += 8;
  console.log('Start price:', startPrice.toString());

  const endPrice = data.readBigInt64LE(offset);
  offset += 8;
  console.log('End price:', endPrice.toString());

  const status = data.readUInt8(offset);
  const statusNames = ['Open', 'BettingClosed', 'Settled'];
  console.log('Status:', status, `(${statusNames[status] || 'Unknown'})`);
}

const roundId = parseInt(process.argv[2]) || 12;
console.log(`Checking round ${roundId}...\n`);
checkRound(roundId).catch(console.error);

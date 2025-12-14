const { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } = require('@solana/web3.js');
const { BN } = require('@coral-xyz/anchor');
require('dotenv').config({ path: '.env.local' });

const PROGRAM_ID = new PublicKey('81K7nKnv7JiRhBCRNmagKot27Yu82eRWeeNA7dtGGaX6');
const PROCESS_PAYOUT_DISCRIMINATOR = Buffer.from([48, 192, 129, 57, 230, 161, 233, 148]);

async function getRoundInfo(connection, roundId) {
  const [roundPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('round'), new BN(roundId).toArrayLike(Buffer, 'le', 8)],
    PROGRAM_ID
  );

  const roundInfo = await connection.getAccountInfo(roundPda);
  if (!roundInfo) return null;

  const data = roundInfo.data;
  const assetLen = data.readUInt32LE(16);
  const baseOffset = 20 + assetLen;

  const statusOffset = baseOffset + 8 + 8 + 8 + 8 + 8;
  const betCountOffset = statusOffset + 1 + 8 + 8 + 8 + 8;
  const payoutsProcessedOffset = betCountOffset + 4;

  const status = data.readUInt8(statusOffset);
  const betCount = data.readUInt32LE(betCountOffset);
  const payoutsProcessed = data.readUInt32LE(payoutsProcessedOffset);

  return { roundPda, status, betCount, payoutsProcessed };
}

async function getBetInfo(connection, roundId, betIndex) {
  const [betPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('bet'),
      new BN(roundId).toArrayLike(Buffer, 'le', 8),
      new BN(betIndex).toArrayLike(Buffer, 'le', 4),
    ],
    PROGRAM_ID
  );

  const betInfo = await connection.getAccountInfo(betPda);
  if (!betInfo) return null;

  const bettor = new PublicKey(betInfo.data.slice(16, 48));
  return { bettor, betPda };
}

async function processPayouts(roundId) {
  const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');

  const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
  if (!adminPrivateKey) {
    throw new Error('ADMIN_PRIVATE_KEY not set');
  }
  const admin = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(adminPrivateKey)));
  console.log('Admin:', admin.publicKey.toBase58());

  const roundInfo = await getRoundInfo(connection, roundId);
  if (!roundInfo) {
    console.log('Round not found');
    return;
  }

  console.log('Round PDA:', roundInfo.roundPda.toBase58());
  console.log('Status:', roundInfo.status, '(2=Settling, 3=Settled)');
  console.log('Bet count:', roundInfo.betCount);
  console.log('Payouts processed:', roundInfo.payoutsProcessed);

  if (roundInfo.status !== 2) {
    console.log('Round is not in Settling status, cannot process payouts');
    return;
  }

  if (roundInfo.payoutsProcessed >= roundInfo.betCount) {
    console.log('All payouts already processed');
    return;
  }

  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), new BN(roundId).toArrayLike(Buffer, 'le', 8)],
    PROGRAM_ID
  );

  let processed = 0;
  const startIndex = roundInfo.payoutsProcessed;

  // Process one at a time to avoid issues
  for (let i = startIndex; i < roundInfo.betCount; i++) {
    const betInfo = await getBetInfo(connection, roundId, i);
    if (!betInfo) {
      console.log(`Bet ${i} not found, skipping`);
      continue;
    }

    console.log(`Processing payout ${i} for bettor ${betInfo.bettor.toBase58().slice(0, 8)}...`);

    const payoutIx = new TransactionInstruction({
      keys: [
        { pubkey: roundInfo.roundPda, isSigner: false, isWritable: true },
        { pubkey: betInfo.betPda, isSigner: false, isWritable: true },
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: betInfo.bettor, isSigner: false, isWritable: true },
        { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: PROCESS_PAYOUT_DISCRIMINATOR,
    });

    try {
      const tx = new Transaction().add(payoutIx);
      const sig = await sendAndConfirmTransaction(connection, tx, [admin], { commitment: 'confirmed' });
      console.log(`  Payout ${i} done: ${sig}`);
      processed++;
    } catch (error) {
      console.log(`  Payout ${i} failed: ${error.message}`);
    }
  }

  console.log(`\nProcessed ${processed} payouts`);

  // Check final status
  const finalInfo = await getRoundInfo(connection, roundId);
  console.log('Final status:', finalInfo.status, '(2=Settling, 3=Settled)');
  console.log('Final payouts processed:', finalInfo.payoutsProcessed);
}

const roundId = parseInt(process.argv[2]) || 12;
console.log(`Processing payouts for round ${roundId}...\n`);
processPayouts(roundId).catch(console.error);

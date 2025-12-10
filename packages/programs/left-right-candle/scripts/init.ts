import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const PROGRAM_ID = new PublicKey("81K7nKnv7JiRhBCRNmagKot27Yu82eRWeeNA7dtGGaX6");

// Anchor discriminators (first 8 bytes of sha256("global:function_name"))
const INITIALIZE_DISCRIMINATOR = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);

async function main() {
  // Load wallet
  const walletPath = path.join(os.homedir(), ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log("Wallet:", wallet.publicKey.toBase58());

  // Connect to devnet
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // Derive config PDA
  const [configPda, configBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    PROGRAM_ID
  );
  console.log("Config PDA:", configPda.toBase58());

  // Check if already initialized
  const configAccount = await connection.getAccountInfo(configPda);
  if (configAccount) {
    console.log("Config already initialized!");
    return;
  }

  // Parameters:
  // - fee_bps: 250 (2.5%)
  // - referrer_fee_bps: 100 (1%)
  // - min_bet_lamports: 10_000_000 (0.01 SOL)
  // - max_bet_lamports: 10_000_000_000 (10 SOL)

  const feeBps = 250;
  const referrerFeeBps = 100;
  const minBetLamports = BigInt(10_000_000);
  const maxBetLamports = BigInt(10_000_000_000);

  // Serialize instruction data
  const data = Buffer.alloc(8 + 2 + 2 + 8 + 8);
  let offset = 0;

  // Discriminator
  INITIALIZE_DISCRIMINATOR.copy(data, offset);
  offset += 8;

  // fee_bps (u16 LE)
  data.writeUInt16LE(feeBps, offset);
  offset += 2;

  // referrer_fee_bps (u16 LE)
  data.writeUInt16LE(referrerFeeBps, offset);
  offset += 2;

  // min_bet_lamports (u64 LE)
  data.writeBigUInt64LE(minBetLamports, offset);
  offset += 8;

  // max_bet_lamports (u64 LE)
  data.writeBigUInt64LE(maxBetLamports, offset);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: false, isWritable: false }, // treasury = admin for now
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });

  const tx = new Transaction().add(instruction);

  console.log("Sending initialize transaction...");
  const signature = await sendAndConfirmTransaction(connection, tx, [wallet]);
  console.log("Initialized! Signature:", signature);
  console.log("Explorer:", `https://explorer.solana.com/tx/${signature}?cluster=devnet`);
}

main().catch(console.error);

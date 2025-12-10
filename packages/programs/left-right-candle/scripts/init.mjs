import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";

const PROGRAM_ID = new PublicKey("81K7nKnv7JiRhBCRNmagKot27Yu82eRWeeNA7dtGGaX6");

// Load wallet
const walletPath = `${os.homedir()}/.config/solana/id.json`;
const walletKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
);

console.log("Using wallet:", walletKeypair.publicKey.toBase58());

// Connect to devnet
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

// Derive config PDA
const [configPda, bump] = PublicKey.findProgramAddressSync(
  [Buffer.from("config")],
  PROGRAM_ID
);

console.log("Config PDA:", configPda.toBase58());

// Check if already initialized
const configAccount = await connection.getAccountInfo(configPda);
if (configAccount) {
  console.log("Config already initialized!");
  console.log("Account data length:", configAccount.data.length);
  process.exit(0);
}

// Build initialize instruction
// Discriminator for "initialize" = first 8 bytes of sha256("global:initialize")
// Actually for anchor, it's sha256("global:initialize")[0..8]
// Let's compute it - "global:initialize"
// Actually anchor uses: sha256("global:<instruction_name>") truncated to 8 bytes

// For anchor, discriminator is based on "global:initialize"
// But simpler: anchor uses sighash which is sha256("global:instruction_name")[..8]
// We can use: const discriminator = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);

// Actually let's use the anchor sighash pattern
import { createHash } from "crypto";
const hash = createHash("sha256");
hash.update("global:initialize");
const discriminator = hash.digest().slice(0, 8);

console.log("Discriminator:", discriminator.toString("hex"));

// Parameters:
// fee_bps: u16 = 250
// referrer_fee_bps: u16 = 100
// min_bet_lamports: u64 = 0.01 SOL = 10_000_000
// max_bet_lamports: u64 = 10 SOL = 10_000_000_000

const feeBps = Buffer.alloc(2);
feeBps.writeUInt16LE(250); // 2.5%

const referrerFeeBps = Buffer.alloc(2);
referrerFeeBps.writeUInt16LE(100); // 1%

const minBet = Buffer.alloc(8);
minBet.writeBigUInt64LE(BigInt(10_000_000)); // 0.01 SOL

const maxBet = Buffer.alloc(8);
maxBet.writeBigUInt64LE(BigInt(10_000_000_000)); // 10 SOL

const data = Buffer.concat([discriminator, feeBps, referrerFeeBps, minBet, maxBet]);

console.log("Instruction data:", data.toString("hex"));

const ix = new TransactionInstruction({
  keys: [
    { pubkey: configPda, isSigner: false, isWritable: true },
    { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true },
    { pubkey: walletKeypair.publicKey, isSigner: false, isWritable: false }, // treasury
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  programId: PROGRAM_ID,
  data,
});

const tx = new Transaction().add(ix);

const sig = await connection.sendTransaction(tx, [walletKeypair], {
  skipPreflight: false,
});

console.log("Transaction sent:", sig);
await connection.confirmTransaction(sig, "confirmed");
console.log("Config initialized successfully!");
console.log("Config PDA:", configPda.toBase58());

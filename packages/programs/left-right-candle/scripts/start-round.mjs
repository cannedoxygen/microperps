import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";
import { createHash } from "crypto";

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
const [configPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("config")],
  PROGRAM_ID
);

console.log("Config PDA:", configPda.toBase58());

// Read config to get round counter
const configAccount = await connection.getAccountInfo(configPda);
if (!configAccount) {
  console.log("Config not initialized!");
  process.exit(1);
}

// Parse round counter from config
// Layout: 8 discriminator + 32 admin + 2 fee_bps + 2 referrer_fee_bps + 8 min_bet + 8 max_bet + 32 treasury = 92
const roundCounter = configAccount.data.readBigUInt64LE(92);
console.log("Current round counter:", roundCounter.toString());

// Derive round PDA
const roundIdBuffer = Buffer.alloc(8);
roundIdBuffer.writeBigUInt64LE(roundCounter);

const [roundPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("round"), roundIdBuffer],
  PROGRAM_ID
);

console.log("Round PDA:", roundPda.toBase58());

// Derive vault PDA
const [vaultPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("vault"), roundIdBuffer],
  PROGRAM_ID
);

console.log("Vault PDA:", vaultPda.toBase58());

// Check if round already exists
const roundAccount = await connection.getAccountInfo(roundPda);
if (roundAccount) {
  console.log("Round already exists!");
  process.exit(0);
}

// Build start_round instruction
const hash = createHash("sha256");
hash.update("global:start_round");
const discriminator = hash.digest().slice(0, 8);

console.log("Discriminator:", discriminator.toString("hex"));

// Parameters:
// asset_symbol: String (Borsh: 4 bytes length + utf8 bytes)
// start_price: i64

const assetSymbol = "WIF";
const assetSymbolBytes = Buffer.from(assetSymbol, "utf8");
const assetSymbolLen = Buffer.alloc(4);
assetSymbolLen.writeUInt32LE(assetSymbolBytes.length);

// Fetch WIF price from CoinGecko
console.log("Fetching WIF price...");
const priceResponse = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=dogwifcoin&vs_currencies=usd");
const priceData = await priceResponse.json();
const wifPrice = priceData.dogwifcoin?.usd || 2.5;
console.log("WIF price:", wifPrice);

// Convert to i64 with 8 decimals (like Pyth)
const startPriceNum = BigInt(Math.floor(wifPrice * 1e8));
const startPrice = Buffer.alloc(8);
startPrice.writeBigInt64LE(startPriceNum);

const data = Buffer.concat([discriminator, assetSymbolLen, assetSymbolBytes, startPrice]);

console.log("Instruction data:", data.toString("hex"));

const ix = new TransactionInstruction({
  keys: [
    { pubkey: configPda, isSigner: false, isWritable: true },
    { pubkey: roundPda, isSigner: false, isWritable: true },
    { pubkey: vaultPda, isSigner: false, isWritable: false },
    { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  programId: PROGRAM_ID,
  data,
});

const tx = new Transaction().add(ix);

try {
  const sig = await connection.sendTransaction(tx, [walletKeypair], {
    skipPreflight: false,
  });

  console.log("Transaction sent:", sig);
  await connection.confirmTransaction(sig, "confirmed");
  console.log("Round created successfully!");
  console.log("Round PDA:", roundPda.toBase58());
} catch (err) {
  console.error("Error:", err.logs || err);
}

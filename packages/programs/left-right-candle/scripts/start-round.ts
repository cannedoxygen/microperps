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

// Anchor discriminator for start_round (sha256("global:start_round")[0:8])
const START_ROUND_DISCRIMINATOR = Buffer.from([144, 144, 43, 7, 193, 42, 217, 215]);

async function main() {
  const asset = process.argv[2] || "WIF";
  const priceArg = process.argv[3];

  // Load wallet
  const walletPath = path.join(os.homedir(), ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log("Wallet:", wallet.publicKey.toBase58());
  console.log("Asset:", asset);

  // Connect to devnet
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // Get current price from CoinGecko if not provided
  let startPrice: bigint;
  if (priceArg) {
    startPrice = BigInt(Math.round(parseFloat(priceArg) * 1e8));
  } else {
    const coinIds: Record<string, string> = {
      WIF: "dogwifcoin",
      BONK: "bonk",
      SOL: "solana",
      BTC: "bitcoin",
    };
    const coinId = coinIds[asset] || "dogwifcoin";

    console.log(`Fetching ${asset} price from CoinGecko...`);
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`
    );
    const data = await res.json() as Record<string, { usd?: number }>;
    const price = data[coinId]?.usd || 1.0;
    startPrice = BigInt(Math.round(price * 1e8));
    console.log(`Current price: $${price} (${startPrice} scaled)`);
  }

  // Derive config PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    PROGRAM_ID
  );

  // Read config to get round counter
  const configAccount = await connection.getAccountInfo(configPda);
  if (!configAccount) {
    console.error("Config not initialized!");
    return;
  }

  // Parse round counter from config (at offset 8 + 32 + 2 + 2 + 8 + 8 + 32 = 92)
  // Actually: discriminator(8) + admin(32) + fee_bps(2) + referrer_fee_bps(2) + min_bet(8) + max_bet(8) + treasury(32) + round_counter(8) + bump(1)
  const roundCounter = configAccount.data.readBigUInt64LE(8 + 32 + 2 + 2 + 8 + 8 + 32);
  console.log("Next round ID:", roundCounter.toString());

  // Derive round PDA
  const roundCounterBuffer = Buffer.alloc(8);
  roundCounterBuffer.writeBigUInt64LE(roundCounter);

  const [roundPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("round"), roundCounterBuffer],
    PROGRAM_ID
  );

  // Derive vault PDA
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), roundCounterBuffer],
    PROGRAM_ID
  );

  console.log("Round PDA:", roundPda.toBase58());
  console.log("Vault PDA:", vaultPda.toBase58());

  // Serialize instruction data
  // Discriminator (8) + asset_symbol as String (4 + len) + start_price (i64)
  const assetBuffer = Buffer.from(asset, "utf-8");
  const data = Buffer.alloc(8 + 4 + assetBuffer.length + 8);
  let offset = 0;

  // Discriminator
  START_ROUND_DISCRIMINATOR.copy(data, offset);
  offset += 8;

  // asset_symbol as borsh String (length prefix + bytes)
  data.writeUInt32LE(assetBuffer.length, offset);
  offset += 4;
  assetBuffer.copy(data, offset);
  offset += assetBuffer.length;

  // start_price (i64 LE)
  data.writeBigInt64LE(startPrice, offset);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: roundPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: false },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });

  const tx = new Transaction().add(instruction);

  console.log("Starting round...");
  const signature = await sendAndConfirmTransaction(connection, tx, [wallet]);
  console.log("Round started! Signature:", signature);
  console.log("Explorer:", `https://explorer.solana.com/tx/${signature}?cluster=devnet`);
  console.log("\nRound details:");
  console.log(`  Round ID: ${roundCounter}`);
  console.log(`  Asset: ${asset}`);
  console.log(`  Start Price: $${Number(startPrice) / 1e8}`);
  console.log(`  Duration: 24 hours (12h betting + 12h waiting)`);
}

main().catch(console.error);

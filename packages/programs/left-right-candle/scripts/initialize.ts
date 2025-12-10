import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";

const PROGRAM_ID = new PublicKey("81K7nKnv7JiRhBCRNmagKot27Yu82eRWeeNA7dtGGaX6");

async function main() {
  // Load wallet from default Solana CLI path
  const walletPath = `${os.homedir()}/.config/solana/id.json`;
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  console.log("Using wallet:", walletKeypair.publicKey.toBase58());

  // Connect to devnet
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // Create Anchor provider
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Load IDL
  const idl = JSON.parse(fs.readFileSync("./target/idl/left_right_candle.json", "utf-8"));
  const program = new Program(idl, provider);

  // Derive config PDA
  const [configPda] = PublicKey.findProgramAddressSync(
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

  // Initialize config
  // fee_bps: 250 (2.5%)
  // referrer_fee_bps: 100 (1%)
  // min_bet: 0.01 SOL
  // max_bet: 10 SOL
  const tx = await (program.methods as any)
    .initialize(
      250,                      // fee_bps (2.5%)
      100,                      // referrer_fee_bps (1%)
      new anchor.BN(0.01 * 1e9), // min_bet_lamports (0.01 SOL)
      new anchor.BN(10 * 1e9)    // max_bet_lamports (10 SOL)
    )
    .accounts({
      config: configPda,
      admin: walletKeypair.publicKey,
      treasury: walletKeypair.publicKey, // Use admin as treasury for now
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([walletKeypair])
    .rpc();

  console.log("Initialized config! Tx:", tx);
  console.log("Config PDA:", configPda.toBase58());
}

main().catch(console.error);

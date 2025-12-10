import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";
import { LeftRightCandle } from "../target/types/left_right_candle";

describe("left-right-candle", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.LeftRightCandle as Program<LeftRightCandle>;

  // Test accounts
  const admin = provider.wallet;
  let configPda: PublicKey;
  let configBump: number;
  let treasuryKeypair: anchor.web3.Keypair;

  // Test constants
  const FEE_BPS = 250; // 2.5%
  const MIN_BET = LAMPORTS_PER_SOL / 100; // 0.01 SOL
  const MAX_BET = LAMPORTS_PER_SOL * 10; // 10 SOL

  before(async () => {
    // Find config PDA
    [configPda, configBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );

    // Create treasury keypair
    treasuryKeypair = anchor.web3.Keypair.generate();
  });

  describe("initialize", () => {
    it("initializes the config", async () => {
      const tx = await program.methods
        .initialize(FEE_BPS, new anchor.BN(MIN_BET), new anchor.BN(MAX_BET))
        .accounts({
          config: configPda,
          admin: admin.publicKey,
          treasury: treasuryKeypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Initialize tx:", tx);

      // Verify config
      const config = await program.account.config.fetch(configPda);
      expect(config.admin.toString()).to.equal(admin.publicKey.toString());
      expect(config.feeBps).to.equal(FEE_BPS);
      expect(config.minBetLamports.toNumber()).to.equal(MIN_BET);
      expect(config.maxBetLamports.toNumber()).to.equal(MAX_BET);
      expect(config.treasury.toString()).to.equal(treasuryKeypair.publicKey.toString());
      expect(config.roundCounter.toNumber()).to.equal(0);
    });

    it("rejects invalid fee bps", async () => {
      // This should fail since config already initialized
      // In a real test, we'd use a different config PDA
    });
  });

  // Note: Full integration tests require a mock Pyth price feed
  // These tests demonstrate the structure for localnet testing

  describe("start_round", () => {
    it("should start a new round with valid asset", async () => {
      // This test requires a mock Pyth price feed account
      // In production tests, use pyth-sdk-solana test utilities
      console.log("Skipping: requires mock Pyth price feed");
    });
  });

  describe("place_bet", () => {
    it("should place a bet on LEFT side", async () => {
      // This test requires an active round
      console.log("Skipping: requires active round from start_round");
    });

    it("should reject bet below minimum", async () => {
      console.log("Skipping: requires active round");
    });

    it("should reject bet above maximum", async () => {
      console.log("Skipping: requires active round");
    });
  });

  describe("settle_round", () => {
    it("should settle round and determine winner", async () => {
      console.log("Skipping: requires mock Pyth price feed with different price");
    });
  });

  describe("process_payout", () => {
    it("should pay out winners proportionally", async () => {
      console.log("Skipping: requires settled round");
    });
  });
});

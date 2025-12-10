import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { AnchorProvider, Program, BN, Idl } from "@coral-xyz/anchor";
import { Config, Round, Bet, Side, PlaceBetParams } from "./types";
import { PROGRAM_ID, SEEDS, SIDE } from "./constants";
import {
  getConfigPda,
  getRoundPda,
  getBetPda,
  getVaultPda,
  sideToNumber,
} from "./utils";

export interface LeftRightClientConfig {
  connection: Connection;
  wallet?: {
    publicKey: PublicKey;
    signTransaction: <T extends Transaction>(tx: T) => Promise<T>;
    signAllTransactions: <T extends Transaction>(txs: T[]) => Promise<T[]>;
  };
  programId?: PublicKey;
}

export class LeftRightClient {
  private connection: Connection;
  private wallet?: LeftRightClientConfig["wallet"];
  private programId: PublicKey;
  private program: Program | null = null;

  constructor(config: LeftRightClientConfig) {
    this.connection = config.connection;
    this.wallet = config.wallet;
    this.programId = config.programId || PROGRAM_ID;
  }

  // Read methods
  async getConfig(): Promise<Config | null> {
    const [configPda] = getConfigPda();
    const accountInfo = await this.connection.getAccountInfo(configPda);
    if (!accountInfo) return null;

    // Decode account data (requires IDL in production)
    // For now, return null - implement proper deserialization with IDL
    return null;
  }

  async getRound(roundId: BN): Promise<Round | null> {
    const [roundPda] = getRoundPda(roundId);
    const accountInfo = await this.connection.getAccountInfo(roundPda);
    if (!accountInfo) return null;

    // Decode account data
    return null;
  }

  async getBet(roundId: BN, betIndex: number): Promise<Bet | null> {
    const [betPda] = getBetPda(roundId, betIndex);
    const accountInfo = await this.connection.getAccountInfo(betPda);
    if (!accountInfo) return null;

    // Decode account data
    return null;
  }

  async getActiveRounds(): Promise<Round[]> {
    // Use getProgramAccounts with filters
    // Filter by status = Open or Locked
    return [];
  }

  async getUserBets(user: PublicKey, roundId?: BN): Promise<Bet[]> {
    // Use getProgramAccounts with filters
    // Filter by bettor = user
    return [];
  }

  // Write methods (require wallet)
  async placeBet(params: PlaceBetParams): Promise<string> {
    if (!this.wallet) {
      throw new Error("Wallet not connected");
    }

    const { roundId, side, amount } = params;
    const round = await this.getRound(roundId);
    if (!round) {
      throw new Error("Round not found");
    }

    const [configPda] = getConfigPda();
    const [roundPda] = getRoundPda(roundId);
    const [betPda] = getBetPda(roundId, round.betCount);
    const [vaultPda] = getVaultPda(roundId);

    // Build transaction
    // Note: Actual implementation requires IDL and program
    const tx = new Transaction();

    // Sign and send
    const signedTx = await this.wallet.signTransaction(tx);
    const signature = await this.connection.sendRawTransaction(
      signedTx.serialize()
    );

    await this.connection.confirmTransaction(signature, "confirmed");
    return signature;
  }

  // Event subscription
  onBetPlaced(
    callback: (event: {
      roundId: BN;
      bettor: PublicKey;
      side: number;
      amount: BN;
    }) => void
  ): number {
    // Subscribe to program logs and parse events
    // Return subscription ID
    return 0;
  }

  onRoundSettled(
    callback: (event: {
      roundId: BN;
      winningSide: number;
      totalPool: BN;
    }) => void
  ): number {
    return 0;
  }

  removeListener(subscriptionId: number): void {
    this.connection.removeOnLogsListener(subscriptionId);
  }

  // Utility
  getProgramId(): PublicKey {
    return this.programId;
  }

  getConnection(): Connection {
    return this.connection;
  }
}

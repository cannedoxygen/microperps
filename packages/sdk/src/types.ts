import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

export type Side = "LEFT" | "RIGHT";
export type SideNumber = 0 | 1;

export type RoundStatus = "Open" | "Locked" | "Settling" | "Settled";

export interface Config {
  admin: PublicKey;
  feeBps: number;
  minBetLamports: BN;
  maxBetLamports: BN;
  treasury: PublicKey;
  roundCounter: BN;
  bump: number;
}

export interface Round {
  roundId: BN;
  assetSymbol: string;
  priceFeed: PublicKey;
  startPrice: BN;
  endPrice: BN;
  startTime: BN;
  endTime: BN;
  status: RoundStatus;
  leftPool: BN;
  rightPool: BN;
  betCount: number;
  payoutsProcessed: number;
  winningSide: Side | null;
  bump: number;
}

export interface Bet {
  roundId: BN;
  bettor: PublicKey;
  side: SideNumber;
  amount: BN;
  betIndex: number;
  paidOut: boolean;
  bump: number;
}

export interface PlaceBetParams {
  roundId: BN;
  side: Side;
  amount: BN;
}

export interface RoundCreatedEvent {
  roundId: BN;
  assetSymbol: string;
  startPrice: BN;
  startTime: BN;
  endTime: BN;
}

export interface BetPlacedEvent {
  roundId: BN;
  bettor: PublicKey;
  side: SideNumber;
  amount: BN;
  betIndex: number;
}

export interface RoundSettledEvent {
  roundId: BN;
  startPrice: BN;
  endPrice: BN;
  winningSide: SideNumber;
  totalPool: BN;
  winningPool: BN;
  feeCollected: BN;
}

export interface PayoutProcessedEvent {
  roundId: BN;
  bettor: PublicKey;
  amount: BN;
}

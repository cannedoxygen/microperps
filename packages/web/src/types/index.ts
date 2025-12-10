import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

export type Side = "SHORT" | "LONG";

export interface Asset {
  symbol: string;
  name: string;
  icon: string;
  pythFeedId: string;
}

export interface Round {
  roundId: BN;
  assetSymbol: string;
  priceFeed: PublicKey;
  startPrice: BN;
  endPrice: BN;
  startTime: BN;
  bettingEndTime: BN;
  endTime: BN;
  status: RoundStatus;
  shortPool: BN;
  longPool: BN;
  shortWeightedPool: BN;
  longWeightedPool: BN;
  betCount: number;
  payoutsProcessed: number;
  winningSide: Side | null;
}

export type RoundStatus = "Open" | "Locked" | "PendingSettlement" | "Settled" | "Cancelled";

export interface Bet {
  roundId: BN;
  bettor: PublicKey;
  side: number;
  amount: BN;
  originalAmount: BN;
  betTime: BN;
  weight: BN;
  betIndex: number;
  paidOut: boolean;
}

export interface UserBet extends Bet {
  publicKey: PublicKey;
  round?: Round;
  potentialPayout?: BN;
}

export interface Config {
  admin: PublicKey;
  feeBps: number;
  minBetLamports: BN;
  maxBetLamports: BN;
  treasury: PublicKey;
  roundCounter: BN;
}

export interface PriceData {
  price: number;
  confidence: number;
  expo: number;
  publishTime: number;
}

import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { PROGRAM_ID, SEEDS } from "./constants";
import { Side, SideNumber } from "./types";

export function getConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEEDS.CONFIG], PROGRAM_ID);
}

export function getRoundPda(roundId: BN): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.ROUND, roundId.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
}

export function getBetPda(roundId: BN, betIndex: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      SEEDS.BET,
      roundId.toArrayLike(Buffer, "le", 8),
      new BN(betIndex).toArrayLike(Buffer, "le", 4),
    ],
    PROGRAM_ID
  );
}

export function getVaultPda(roundId: BN): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.VAULT, roundId.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
}

export function sideToNumber(side: Side): SideNumber {
  return side === "LEFT" ? 0 : 1;
}

export function numberToSide(num: SideNumber): Side {
  return num === 0 ? "LEFT" : "RIGHT";
}

export function calculateOdds(
  leftPool: BN,
  rightPool: BN
): { left: number; right: number } {
  const total = leftPool.add(rightPool);
  if (total.isZero()) {
    return { left: 0.5, right: 0.5 };
  }
  return {
    left: leftPool.toNumber() / total.toNumber(),
    right: rightPool.toNumber() / total.toNumber(),
  };
}

export function calculatePotentialPayout(
  betAmount: BN,
  betSide: Side,
  leftPool: BN,
  rightPool: BN,
  feeBps: number
): BN {
  const totalPool = leftPool.add(rightPool).add(betAmount);
  const winningPool =
    betSide === "LEFT" ? leftPool.add(betAmount) : rightPool.add(betAmount);

  if (winningPool.isZero()) {
    return new BN(0);
  }

  const feeMultiplier = 10000 - feeBps;
  const poolAfterFees = totalPool.muln(feeMultiplier).divn(10000);

  return betAmount.mul(poolAfterFees).div(winningPool);
}

export function formatLamports(lamports: BN, decimals: number = 4): string {
  const sol = lamports.toNumber() / 1e9;
  return sol.toFixed(decimals);
}

export function parseSol(sol: number | string): BN {
  const value = typeof sol === "string" ? parseFloat(sol) : sol;
  return new BN(Math.floor(value * 1e9));
}

export function isRoundOpen(endTime: BN, lockBeforeEndSeconds: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  const lockTime = endTime.toNumber() - lockBeforeEndSeconds;
  return now < lockTime;
}

export function getRemainingTime(endTime: BN): number {
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, endTime.toNumber() - now);
}

export function formatCountdown(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

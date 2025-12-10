import { BN } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

export function formatSol(lamports: BN | number): string {
  const value = typeof lamports === "number" ? lamports : lamports.toNumber();
  return (value / LAMPORTS_PER_SOL).toFixed(4);
}

export function formatPrice(price: number, decimals: number = 4): string {
  return price.toFixed(decimals);
}

export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function calculateOdds(shortPool: BN, longPool: BN): { short: number; long: number } {
  const total = shortPool.add(longPool);
  if (total.isZero()) {
    return { short: 0.5, long: 0.5 };
  }
  return {
    short: shortPool.toNumber() / total.toNumber(),
    long: longPool.toNumber() / total.toNumber(),
  };
}

export function calculatePotentialPayout(
  betAmount: BN,
  betSide: "SHORT" | "LONG",
  shortPool: BN,
  longPool: BN,
  feeBps: number
): BN {
  const totalPool = shortPool.add(longPool).add(betAmount);
  const winningPool = betSide === "SHORT" ? shortPool.add(betAmount) : longPool.add(betAmount);

  const feeMultiplier = 10000 - feeBps;
  const poolAfterFees = totalPool.muln(feeMultiplier).divn(10000);

  return betAmount.mul(poolAfterFees).div(winningPool);
}

export function formatCountdown(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function getRoundTimeRemaining(endTime: BN): number {
  const now = Math.floor(Date.now() / 1000);
  const end = endTime.toNumber();
  return Math.max(0, end - now);
}

export function isRoundBettingOpen(endTime: BN, lockBeforeEndSeconds: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  const lockTime = endTime.toNumber() - lockBeforeEndSeconds;
  return now < lockTime;
}

export function truncateAddress(address: string, chars: number = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function classNames(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

// Weight tier constants (scaled by 100)
export const WEIGHT_TIERS = [
  { hours: 3, weight: 150, label: "1.5x" },
  { hours: 6, weight: 130, label: "1.3x" },
  { hours: 9, weight: 115, label: "1.15x" },
  { hours: 12, weight: 100, label: "1.0x" },
];

export function getWeightTier(startTime: BN): { weight: number; label: string; tierIndex: number } {
  const now = Math.floor(Date.now() / 1000);
  const start = startTime.toNumber();
  const elapsedHours = (now - start) / 3600;

  if (elapsedHours < 3) return { weight: 150, label: "1.5x", tierIndex: 0 };
  if (elapsedHours < 6) return { weight: 130, label: "1.3x", tierIndex: 1 };
  if (elapsedHours < 9) return { weight: 115, label: "1.15x", tierIndex: 2 };
  return { weight: 100, label: "1.0x", tierIndex: 3 };
}

export function getBettingTimeRemaining(bettingEndTime: BN): number {
  const now = Math.floor(Date.now() / 1000);
  const end = bettingEndTime.toNumber();
  return Math.max(0, end - now);
}

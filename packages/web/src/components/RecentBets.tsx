"use client";

import { FC } from "react";
import { BetData } from "@/hooks/useRoundBets";

interface Props {
  bets: BetData[];
  isLoading: boolean;
}

function formatAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function formatTimeAgo(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function getWeightLabel(weight: number): string {
  if (weight >= 150) return "1.5x";
  if (weight >= 130) return "1.3x";
  if (weight >= 115) return "1.15x";
  return "1x";
}

export const RecentBets: FC<Props> = ({ bets, isLoading }) => {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-background rounded-lg" />
        ))}
      </div>
    );
  }

  if (bets.length === 0) {
    return (
      <p className="text-gray-400 text-center py-8">
        No bets placed yet. Be the first!
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {bets.map((bet) => (
        <div
          key={`${bet.roundId}-${bet.betIndex}`}
          className="flex items-center justify-between p-4 bg-background rounded-lg border border-border hover:border-gray-600 transition-colors"
        >
          <div className="flex items-center gap-4">
            {/* Side indicator */}
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                bet.side === "SHORT"
                  ? "bg-short/20 text-short"
                  : "bg-long/20 text-long"
              }`}
            >
              {bet.side === "SHORT" ? "🔴" : "🟢"}
            </div>

            {/* Bet details */}
            <div>
              <div className="flex items-center gap-2">
                <a
                  href={`https://explorer.solana.com/address/${bet.bettor}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm hover:text-blue-400 transition-colors"
                >
                  {formatAddress(bet.bettor)}
                </a>
                <span className="text-gray-500">bet</span>
                <span
                  className={`font-semibold ${
                    bet.side === "SHORT" ? "text-short" : "text-long"
                  }`}
                >
                  {bet.side}
                </span>
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <span>{formatTimeAgo(bet.betTime)}</span>
                <span className="text-green-400">
                  {getWeightLabel(bet.weight)} bonus
                </span>
              </div>
            </div>
          </div>

          {/* Amount */}
          <div className="text-right">
            <p className="font-mono font-semibold">
              {bet.originalAmount.toFixed(2)} SOL
            </p>
            <p className="text-xs text-gray-500">
              Pool: {bet.amount.toFixed(3)} SOL
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

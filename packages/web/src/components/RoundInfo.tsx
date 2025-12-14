"use client";

import { FC, useEffect, useState } from "react";
import { BN } from "@coral-xyz/anchor";
import { Round } from "@/types";
import { formatSol, formatCountdown, getBettingTimeRemaining, getRoundTimeRemaining, calculateOdds, getWeightTier, WEIGHT_TIERS } from "@/lib/utils";

interface Props {
  round: Round;
  currentPrice?: number;
  tokenImage?: string;
}

export const RoundInfo: FC<Props> = ({ round, currentPrice, tokenImage }) => {
  const [mounted, setMounted] = useState(false);
  const [bettingTimeRemaining, setBettingTimeRemaining] = useState(0);
  const [settlementTimeRemaining, setSettlementTimeRemaining] = useState(0);
  const [currentWeightTier, setCurrentWeightTier] = useState({ weight: 150, label: "1.5x", tierIndex: 0 });

  useEffect(() => {
    setMounted(true);
    setBettingTimeRemaining(getBettingTimeRemaining(round.bettingEndTime));
    setSettlementTimeRemaining(getRoundTimeRemaining(round.endTime));
    setCurrentWeightTier(getWeightTier(round.startTime));

    const interval = setInterval(() => {
      setBettingTimeRemaining(getBettingTimeRemaining(round.bettingEndTime));
      setSettlementTimeRemaining(getRoundTimeRemaining(round.endTime));
      setCurrentWeightTier(getWeightTier(round.startTime));
    }, 1000);

    return () => clearInterval(interval);
  }, [round.bettingEndTime, round.endTime, round.startTime]);

  const startPrice = round.startPrice.toNumber() / 1e8; // Pyth prices have 8 decimals
  const priceChange = currentPrice ? ((currentPrice - startPrice) / startPrice) * 100 : 0;
  const isUp = priceChange >= 0;

  const odds = calculateOdds(round.shortPool, round.longPool);
  const totalPool = round.shortPool.add(round.longPool);

  const isBettingClosed = bettingTimeRemaining <= 0;
  const isEnded = settlementTimeRemaining <= 0;

  // Prevent hydration mismatch by not rendering time-sensitive content until mounted
  if (!mounted) {
    return (
      <div className="bg-card rounded-xl p-6 border border-border animate-pulse">
        <div className="h-8 bg-background rounded w-24 mb-4"></div>
        <div className="h-32 bg-background rounded"></div>
      </div>
    );
  }

  return (
    <div
      className="bg-card rounded-xl p-4 sm:p-6 border border-border relative overflow-hidden"
      style={tokenImage ? {
        backgroundImage: `url(${tokenImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : undefined}
    >
      {/* Dark overlay to ensure text readability */}
      {tokenImage && (
        <div className="absolute inset-0 bg-black/80" />
      )}
      {/* Content wrapper with relative positioning to stay above overlay */}
      <div className={tokenImage ? "relative z-10" : ""}>
      {/* Asset and Round Info */}
      <div className="flex justify-between items-start mb-4 sm:mb-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold">{round.assetSymbol}</h2>
          <p className="text-gray-400 text-sm sm:text-base">Round #{round.roundId.toString()}</p>
        </div>
        <div
          className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm ${
            isEnded
              ? "bg-gray-700 text-gray-300"
              : isBettingClosed
              ? "bg-yellow-600 text-yellow-100"
              : "bg-green-600 text-green-100"
          }`}
        >
          {isEnded ? "Settling" : isBettingClosed ? "Closed" : "Open"}
        </div>
      </div>

      {/* Price Display */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div>
          <span className="text-xs sm:text-sm text-gray-400">Start Price</span>
          <p className="text-sm sm:text-xl font-mono">${startPrice.toFixed(6)}</p>
        </div>
        <div>
          <span className="text-xs sm:text-sm text-gray-400">Current Price</span>
          <p
            className={`text-sm sm:text-xl font-mono ${
              isUp ? "text-long" : "text-short"
            }`}
          >
            ${currentPrice?.toFixed(6) ?? "—"}
            {currentPrice && (
              <span className="text-xs sm:text-sm ml-1 sm:ml-2">
                ({isUp ? "+" : ""}
                {priceChange.toFixed(2)}%)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Countdown and Weight Tier */}
      <div className="text-center mb-4 sm:mb-6">
        {!isBettingClosed ? (
          <>
            <span className="text-xs sm:text-sm text-gray-400">Betting Closes In</span>
            <p className="countdown-digit text-2xl sm:text-4xl">{formatCountdown(bettingTimeRemaining)}</p>
            {/* Current Weight Tier */}
            <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-background rounded-lg">
              <span className="text-xs sm:text-sm text-gray-400">Early Bird Bonus</span>
              <p className="text-xl sm:text-2xl font-bold text-green-400">{currentWeightTier.label}</p>
              <div className="flex justify-center gap-1 sm:gap-2 mt-2">
                {WEIGHT_TIERS.map((tier, idx) => (
                  <div
                    key={tier.hours}
                    className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs ${
                      idx === currentWeightTier.tierIndex
                        ? "bg-green-600 text-white"
                        : idx < currentWeightTier.tierIndex
                        ? "bg-gray-700 text-gray-500 line-through"
                        : "bg-gray-800 text-gray-400"
                    }`}
                  >
                    {tier.label}
                  </div>
                ))}
              </div>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-2">
                Bet earlier for a bigger share!
              </p>
            </div>
          </>
        ) : (
          <>
            <span className="text-xs sm:text-sm text-gray-400">Settlement In</span>
            <p className="countdown-digit text-2xl sm:text-4xl">{formatCountdown(settlementTimeRemaining)}</p>
            <p className="text-yellow-400 text-xs sm:text-sm mt-1">
              Waiting for price to be recorded...
            </p>
          </>
        )}
      </div>

      {/* Pool Distribution */}
      <div className="mb-3 sm:mb-4">
        <div className="flex justify-between text-xs sm:text-sm mb-2">
          <span className="text-short">🔴 SHORT ({(odds.short * 100).toFixed(0)}%)</span>
          <span className="text-long">🟢 LONG ({(odds.long * 100).toFixed(0)}%)</span>
        </div>
        <div className="h-3 sm:h-4 bg-background rounded-full overflow-hidden flex">
          <div
            className="pool-bar bg-short h-full"
            style={{ width: `${odds.short * 100}%` }}
          />
          <div
            className="pool-bar bg-long h-full"
            style={{ width: `${odds.long * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] sm:text-sm mt-1 sm:mt-2 text-gray-400">
          <span>{formatSol(round.shortPool)}</span>
          <span>{formatSol(totalPool)} SOL</span>
          <span>{formatSol(round.longPool)}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
        <div className="bg-background rounded-lg p-2 sm:p-3">
          <span className="text-gray-400">Bets</span>
          <p className="font-mono">{round.betCount}</p>
        </div>
        <div className="bg-background rounded-lg p-2 sm:p-3">
          <span className="text-gray-400">Status</span>
          <p className="capitalize">{isEnded ? "Settling" : isBettingClosed ? "Closed" : "Open"}</p>
        </div>
      </div>
      </div>
    </div>
  );
};

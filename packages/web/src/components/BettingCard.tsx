"use client";

import { FC, useState } from "react";
import { BN } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Side } from "@/types";
import { formatSol, calculatePotentialPayout, classNames } from "@/lib/utils";

interface Props {
  side: Side;
  currentPool: BN;
  oppositePool: BN;
  minBet: BN;
  maxBet: BN;
  feeBps: number;
  disabled?: boolean;
  onPlaceBet: (side: Side, amount: BN) => Promise<void>;
}

export const BettingCard: FC<Props> = ({
  side,
  currentPool,
  oppositePool,
  minBet,
  maxBet,
  feeBps,
  disabled = false,
  onPlaceBet,
}) => {
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isShort = side === "SHORT";
  const amountBN = amount ? new BN(parseFloat(amount) * LAMPORTS_PER_SOL) : new BN(0);

  const potentialPayout = amountBN.gt(new BN(0))
    ? calculatePotentialPayout(
        amountBN,
        side,
        isShort ? currentPool : oppositePool,
        isShort ? oppositePool : currentPool,
        feeBps
      )
    : new BN(0);

  const handleSubmit = async () => {
    if (!amount || disabled) return;

    setIsLoading(true);
    try {
      await onPlaceBet(side, amountBN);
      setAmount("");
    } catch (error) {
      console.error("Failed to place bet:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const presetAmounts = [0.1, 0.5, 1, 5];

  return (
    <div
      className={classNames(
        "bet-card rounded-xl border-2 p-6 bg-card",
        isShort ? "bet-card-short" : "bet-card-long"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3
          className={classNames(
            "text-2xl font-bold",
            isShort ? "text-short" : "text-long"
          )}
        >
          {isShort ? "🔴 SHORT" : "🟢 LONG"}
        </h3>
        <span className="text-sm text-gray-400">
          {isShort ? "Price goes DOWN" : "Price goes UP"}
        </span>
      </div>

      {/* Pool display */}
      <div className="mb-4">
        <span className="text-sm text-gray-400">Pool</span>
        <p className="text-xl font-mono">{formatSol(currentPool)} SOL</p>
      </div>

      {/* Amount input */}
      <div className="mb-4">
        <label className="text-sm text-gray-400 mb-2 block">Bet Amount</label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            min={formatSol(minBet)}
            max={formatSol(maxBet)}
            step="0.01"
            disabled={disabled || isLoading}
            className="w-full bg-background border border-border rounded-lg px-4 py-3 text-lg font-mono focus:outline-none focus:border-gray-500 disabled:opacity-50"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
            SOL
          </span>
        </div>
      </div>

      {/* Preset amounts */}
      <div className="flex gap-2 mb-4">
        {presetAmounts.map((preset) => (
          <button
            key={preset}
            onClick={() => setAmount(preset.toString())}
            disabled={disabled || isLoading}
            className="flex-1 py-2 text-sm border border-border rounded hover:bg-border transition-colors disabled:opacity-50"
          >
            {preset} SOL
          </button>
        ))}
      </div>

      {/* Potential payout */}
      {amountBN.gt(new BN(0)) && (
        <div className="mb-4 p-3 bg-background rounded-lg">
          <span className="text-sm text-gray-400">Potential Payout</span>
          <p className="text-lg font-mono text-green-400">
            {formatSol(potentialPayout)} SOL
          </p>
        </div>
      )}

      {/* Place bet button */}
      <button
        onClick={handleSubmit}
        disabled={disabled || isLoading || !amount}
        className={classNames(
          "w-full py-4 rounded-lg font-bold text-lg transition-all",
          isShort
            ? "bg-short hover:bg-short-dark disabled:bg-short/30"
            : "bg-long hover:bg-long-dark disabled:bg-long/30",
          "disabled:cursor-not-allowed"
        )}
      >
        {isLoading ? "Placing Bet..." : `Go ${isShort ? "SHORT" : "LONG"}`}
      </button>
    </div>
  );
};

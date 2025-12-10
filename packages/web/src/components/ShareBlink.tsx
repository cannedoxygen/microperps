"use client";

import { FC, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

interface Props {
  roundId: number;
  asset: string;
}

export const ShareBlink: FC<Props> = ({ roundId, asset }) => {
  const { publicKey } = useWallet();
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://mpm.fun";

  // Generate single blink URL with referrer
  const referrer = publicKey?.toBase58();
  const actionUrl = `${baseUrl}/api/actions/bet?round=${roundId}${referrer ? `&ref=${referrer}` : ""}`;

  // Dialect blink format for Twitter/X
  const blinkUrl = `https://dial.to/?action=solana-action:${encodeURIComponent(actionUrl)}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(blinkUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const shareToTwitter = () => {
    const text = `🟢 LONG or 🔴 SHORT on $${asset}?\n\nMeme Prediction Market - 12h arena. Will it pump or dump?\n\nShare this blink & earn 1% of all bets placed through your link.`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(blinkUrl)}`;
    window.open(twitterUrl, "_blank");
  };

  return (
    <div className="mt-8 bg-card rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Share & Earn</h2>
        <span className="px-3 py-1 bg-green-600/20 text-green-400 rounded-full text-sm">
          Earn 1% of bets
        </span>
      </div>

      <p className="text-gray-400 mb-6">
        Share this prediction on Twitter/X. When others bet through your blink, you earn 1% of their bet as a referral fee!
      </p>

      {/* Blink Preview */}
      <div className="mb-6 p-4 bg-background rounded-lg border border-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-red-500 rounded-lg flex items-center justify-center text-2xl">
            📊
          </div>
          <div>
            <h3 className="font-bold">${asset} - Round #{roundId}</h3>
            <p className="text-sm text-gray-400">Meme Prediction Market</p>
          </div>
        </div>
        <div className="flex gap-2 text-sm">
          <span className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg font-medium">🟢 LONG</span>
          <span className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg font-medium">🔴 SHORT</span>
        </div>
      </div>

      {/* Blink URL */}
      <div className="mb-4">
        <label className="text-sm text-gray-400 mb-2 block">Your Blink URL</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={blinkUrl}
            readOnly
            className="flex-1 bg-background border border-border rounded-lg px-4 py-3 text-sm font-mono truncate"
          />
          <button
            onClick={copyToClipboard}
            className="px-6 py-3 bg-border hover:bg-gray-700 rounded-lg transition-colors font-medium"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Share Button */}
      <button
        onClick={shareToTwitter}
        className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold text-lg transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        Share on Twitter/X
      </button>

      {/* How it works */}
      <div className="mt-6 pt-6 border-t border-border">
        <h3 className="font-medium mb-3">How it works</h3>
        <ol className="text-sm text-gray-400 space-y-2">
          <li className="flex gap-2">
            <span className="text-white">1.</span>
            Share your blink on Twitter/X
          </li>
          <li className="flex gap-2">
            <span className="text-white">2.</span>
            Others see an interactive card and can bet directly
          </li>
          <li className="flex gap-2">
            <span className="text-white">3.</span>
            You earn 1% of every bet placed through your link
          </li>
          <li className="flex gap-2">
            <span className="text-white">4.</span>
            Earnings are paid out automatically when the round settles
          </li>
        </ol>
      </div>

      {/* Referrer Info */}
      {publicKey && (
        <div className="mt-4 p-3 bg-background rounded-lg text-xs">
          <span className="text-gray-500">Your referrer address: </span>
          <span className="font-mono text-gray-400">{publicKey.toBase58()}</span>
        </div>
      )}
    </div>
  );
};

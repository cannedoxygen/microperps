"use client";

import { FC, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

interface Props {
  roundId: number;
  asset: string;
  tokenImage?: string;
}

export const ShareBlink: FC<Props> = ({ roundId, asset, tokenImage }) => {
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
    const text = `🟢 LONG or 🔴 SHORT on $${asset}?\n\nMeme Prediction Market - Will it pump or dump in 24h?\n\nBet via blink & earn 1% referring others 👇`;
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
        Share this prediction. When others bet through your blink, you earn 1% of their bet as a referral fee!
      </p>

      {/* Blink Preview */}
      <div
        className="mb-6 p-4 rounded-lg border border-border relative overflow-hidden"
        style={tokenImage ? {
          backgroundImage: `url(${tokenImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : undefined}
      >
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-black/80" />

        <div className="relative z-10">
          <div className="mb-3">
            <h3 className="text-lg font-bold">${asset} - Round #{roundId}</h3>
            <p className="text-sm text-gray-400">Meme Prediction Market</p>
          </div>
          <div className="flex gap-3">
            <span className="px-4 py-2 bg-long/20 text-long rounded-lg font-bold border border-long/30">LONG</span>
            <span className="px-4 py-2 bg-short/20 text-short rounded-lg font-bold border border-short/30">SHORT</span>
          </div>
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

      {/* Share Buttons */}
      <div className="flex gap-3">
        <button
          onClick={shareToTwitter}
          className="flex-1 py-4 bg-white hover:bg-gray-200 text-black rounded-lg font-bold text-lg transition-colors flex items-center justify-center gap-2"
        >
          Share on
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </button>
        <a
          href="https://x.com/microperps"
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-4 bg-border hover:bg-gray-700 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          @microperps
        </a>
      </div>

      {/* How it works */}
      <div className="mt-6 pt-6 border-t border-border">
        <h3 className="font-medium mb-3">How it works</h3>
        <ol className="text-sm text-gray-400 space-y-2">
          <li className="flex gap-2">
            <span className="text-white">1.</span>
            Share your blink on X
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

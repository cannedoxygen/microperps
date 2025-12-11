"use client";

import { FC, useState, useEffect } from "react";
import dynamic from "next/dynamic";

// Dynamically import wallet button to prevent SSR hydration issues
const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

export const Header: FC = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="border-b border-border">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <a href="/" className="text-2xl font-bold hover:opacity-80 transition-opacity">
            <span className="text-long">μ</span>perps
          </a>
        </div>

        <nav className="flex items-center gap-6">
          <a
            href="/play"
            className="text-gray-400 hover:text-white transition-colors"
          >
            Play
          </a>
          <a
            href="/history"
            className="text-gray-400 hover:text-white transition-colors"
          >
            History
          </a>
          <a
            href="/leaderboard"
            className="text-gray-400 hover:text-white transition-colors"
          >
            Leaderboard
          </a>
          {mounted && <WalletMultiButton />}
        </nav>
      </div>
    </header>
  );
};

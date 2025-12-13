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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
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

        {/* Mobile menu button */}
        <button
          className="md:hidden p-2 text-gray-400 hover:text-white"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-4">
            <a
              href="/play"
              className="text-gray-400 hover:text-white transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Play
            </a>
            <a
              href="/history"
              className="text-gray-400 hover:text-white transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              History
            </a>
            <a
              href="/leaderboard"
              className="text-gray-400 hover:text-white transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Leaderboard
            </a>
            {mounted && (
              <div className="pt-2">
                <WalletMultiButton />
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

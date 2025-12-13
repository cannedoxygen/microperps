"use client";

import { FC } from "react";

export const Footer: FC = () => {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="container mx-auto px-4 py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg sm:text-xl font-bold">
              <span className="text-long">μ</span>perps
            </span>
            <span className="text-gray-500 text-xs sm:text-sm hidden sm:inline">
              Meme Prediction Market
            </span>
          </div>

          <a
            href="https://x.com/microperps"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 text-sm"
          >
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span>@microperps</span>
          </a>
        </div>

        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border/50 text-center text-gray-500 text-xs sm:text-sm">
          <p>Solana Devnet</p>
        </div>
      </div>
    </footer>
  );
};

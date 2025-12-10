"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useWallet } from "@solana/wallet-adapter-react";
import { Blink, useAction } from "@dialectlabs/blinks";
import { useActionSolanaWalletAdapter } from "@dialectlabs/blinks/hooks/solana";
import "@dialectlabs/blinks/index.css";
import { Header } from "@/components/Header";

// Custom styles for the blink
const customStyles = {
  // Container
  container: "bg-[#0f0f23] rounded-2xl border border-[#2a2a4a] overflow-hidden shadow-2xl",

  // Image
  image: "w-full aspect-[1.91/1] object-cover",

  // Content area
  content: "p-6",

  // Title
  title: "text-2xl font-bold text-white mb-2",

  // Description
  description: "text-gray-400 whitespace-pre-line mb-6",

  // Actions container
  actionsContainer: "space-y-4",

  // Form (input + button group)
  form: "flex gap-3",

  // Input field
  input: `
    flex-1 px-4 py-3
    bg-[#1a1a2e]
    border-2 border-[#2a2a4a]
    rounded-xl
    text-white
    placeholder-gray-500
    focus:border-[#4ade80] focus:outline-none focus:ring-2 focus:ring-[#4ade80]/20
    transition-all duration-200
  `,

  // Button base
  button: `
    px-6 py-3
    font-bold
    rounded-xl
    transition-all duration-200
    transform hover:scale-105
    shadow-lg
  `,

  // Success button (LONG - green)
  "button-success": `
    bg-gradient-to-r from-[#22c55e] to-[#16a34a]
    hover:from-[#4ade80] hover:to-[#22c55e]
    text-white
    shadow-[0_0_20px_rgba(34,197,94,0.3)]
    hover:shadow-[0_0_30px_rgba(34,197,94,0.5)]
  `,

  // Destructive button (SHORT - red)
  "button-destructive": `
    bg-gradient-to-r from-[#ef4444] to-[#dc2626]
    hover:from-[#f87171] hover:to-[#ef4444]
    text-white
    shadow-[0_0_20px_rgba(239,68,68,0.3)]
    hover:shadow-[0_0_30px_rgba(239,68,68,0.5)]
  `,

  // Default button
  "button-default": `
    bg-gradient-to-r from-[#6366f1] to-[#4f46e5]
    hover:from-[#818cf8] hover:to-[#6366f1]
    text-white
  `,

  // Disabled state
  "button-disabled": "opacity-50 cursor-not-allowed transform-none",

  // Error message
  error: "text-red-400 text-sm mt-2",

  // Success message
  success: "text-green-400 text-sm mt-2",

  // Loading state
  loading: "animate-pulse",
};

export default function BlinkPage() {
  const router = useRouter();
  const { round, ref } = router.query;
  const { publicKey } = useWallet();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Build the action URL
  const actionUrl = mounted && round
    ? `${window.location.origin}/api/actions/bet?round=${round}${ref ? `&ref=${ref}` : ""}`
    : null;

  // Setup wallet adapter for signing
  const { adapter } = useActionSolanaWalletAdapter(
    process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com"
  );

  // Fetch the action (useAction renamed from useBlink only takes url)
  // @ts-expect-error - url accepts string | null but types say string | URL
  const { blink, isLoading } = useAction({ url: actionUrl });

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-16 flex justify-center">
          <div className="w-full max-w-lg animate-pulse">
            <div className="bg-card rounded-2xl h-96" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-lg mx-auto">
          {/* Custom styled blink */}
          {isLoading ? (
            <div className="bg-[#0f0f23] rounded-2xl border border-[#2a2a4a] p-8 animate-pulse">
              <div className="h-48 bg-[#1a1a2e] rounded-xl mb-4" />
              <div className="h-6 bg-[#1a1a2e] rounded w-3/4 mb-2" />
              <div className="h-4 bg-[#1a1a2e] rounded w-full mb-1" />
              <div className="h-4 bg-[#1a1a2e] rounded w-2/3" />
            </div>
          ) : blink ? (
            <div className="blink-custom">
              <Blink
                blink={blink}
                adapter={adapter}
                websiteText={new URL(window.location.origin).hostname}
                stylePreset="custom"
              />
            </div>
          ) : (
            <div className="bg-[#0f0f23] rounded-2xl border border-[#2a2a4a] p-8 text-center">
              <p className="text-gray-400">Failed to load blink</p>
            </div>
          )}

          {/* Share section */}
          <div className="mt-8 p-6 bg-[#0f0f23] rounded-2xl border border-[#2a2a4a]">
            <h3 className="text-lg font-bold text-white mb-2">Share this Blink</h3>
            <p className="text-gray-400 text-sm mb-4">
              Share on Twitter/X and earn 1% of all bets placed through your link!
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/blink/${round}${publicKey ? `?ref=${publicKey.toBase58()}` : ""}`}
                className="flex-1 px-4 py-2 bg-[#1a1a2e] border border-[#2a2a4a] rounded-lg text-sm text-gray-300 truncate"
              />
              <button
                onClick={() => {
                  const url = `${window.location.origin}/blink/${round}${publicKey ? `?ref=${publicKey.toBase58()}` : ""}`;
                  navigator.clipboard.writeText(url);
                }}
                className="px-4 py-2 bg-[#2a2a4a] hover:bg-[#3a3a5a] rounded-lg text-white font-medium transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Custom CSS for Dialect Blink */}
      <style jsx global>{`
        .blink-custom .dial-blink {
          background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%);
          border: 1px solid #2a2a4a;
          border-radius: 1rem;
          overflow: hidden;
        }

        .blink-custom .dial-blink-image {
          border-radius: 0;
        }

        .blink-custom .dial-blink-content {
          padding: 1.5rem;
        }

        .blink-custom .dial-blink-title {
          color: white;
          font-size: 1.5rem;
          font-weight: 700;
        }

        .blink-custom .dial-blink-description {
          color: #9ca3af;
          white-space: pre-line;
        }

        .blink-custom .dial-blink-actions {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-top: 1.5rem;
        }

        .blink-custom .dial-blink-action-form {
          display: flex;
          gap: 0.75rem;
        }

        .blink-custom .dial-blink-input {
          flex: 1;
          padding: 0.75rem 1rem;
          background: #1a1a2e;
          border: 2px solid #2a2a4a;
          border-radius: 0.75rem;
          color: white;
          font-size: 1rem;
          transition: all 0.2s;
        }

        .blink-custom .dial-blink-input:focus {
          border-color: #4ade80;
          outline: none;
          box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.2);
        }

        .blink-custom .dial-blink-input::placeholder {
          color: #6b7280;
        }

        /* LONG button - Green gradient */
        .blink-custom .dial-blink-button:first-of-type,
        .blink-custom .dial-blink-action-form:first-of-type .dial-blink-button {
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          color: white;
          font-weight: 700;
          padding: 0.75rem 1.5rem;
          border-radius: 0.75rem;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 0 20px rgba(34, 197, 94, 0.3);
        }

        .blink-custom .dial-blink-button:first-of-type:hover,
        .blink-custom .dial-blink-action-form:first-of-type .dial-blink-button:hover {
          background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
          transform: scale(1.02);
          box-shadow: 0 0 30px rgba(34, 197, 94, 0.5);
        }

        /* SHORT button - Red gradient */
        .blink-custom .dial-blink-button:last-of-type,
        .blink-custom .dial-blink-action-form:last-of-type .dial-blink-button {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
          font-weight: 700;
          padding: 0.75rem 1.5rem;
          border-radius: 0.75rem;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 0 20px rgba(239, 68, 68, 0.3);
        }

        .blink-custom .dial-blink-button:last-of-type:hover,
        .blink-custom .dial-blink-action-form:last-of-type .dial-blink-button:hover {
          background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
          transform: scale(1.02);
          box-shadow: 0 0 30px rgba(239, 68, 68, 0.5);
        }

        /* Disabled state */
        .blink-custom .dial-blink-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
        }

        /* Loading spinner */
        .blink-custom .dial-blink-button--loading {
          position: relative;
          color: transparent;
        }

        .blink-custom .dial-blink-button--loading::after {
          content: "";
          position: absolute;
          width: 1.25rem;
          height: 1.25rem;
          top: 50%;
          left: 50%;
          margin-left: -0.625rem;
          margin-top: -0.625rem;
          border: 2px solid transparent;
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Success/error messages */
        .blink-custom .dial-blink-message--success {
          color: #4ade80;
          margin-top: 0.5rem;
          font-size: 0.875rem;
        }

        .blink-custom .dial-blink-message--error {
          color: #f87171;
          margin-top: 0.5rem;
          font-size: 0.875rem;
        }

        /* Website text */
        .blink-custom .dial-blink-website {
          color: #6b7280;
          font-size: 0.75rem;
          padding: 0.5rem 1.5rem;
          border-top: 1px solid #2a2a4a;
        }
      `}</style>
    </div>
  );
}

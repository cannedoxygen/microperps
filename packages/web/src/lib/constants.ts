import { PublicKey } from "@solana/web3.js";
import { Asset } from "@/types";

// Use default devnet program ID if env var not set
export const PROGRAM_ID_STRING = process.env.NEXT_PUBLIC_PROGRAM_ID || "81K7nKnv7JiRhBCRNmagKot27Yu82eRWeeNA7dtGGaX6";

// Lazy initialization to avoid SSR issues
let _programId: PublicKey | null = null;
export const getProgramId = (): PublicKey => {
  if (!_programId) {
    _programId = new PublicKey(PROGRAM_ID_STRING);
  }
  return _programId;
};

// DEPRECATED: Use getProgramId() instead to avoid SSR issues
// export const PROGRAM_ID = new PublicKey(PROGRAM_ID_STRING);

export const ASSETS: Asset[] = [
  {
    symbol: "WIF",
    name: "dogwifhat",
    icon: "/icons/wif.png",
    pythFeedId: "0x4ca4beeca86f0d164160323817a4e42b10010a724c2217c6ee41b54cd4cc61fc",
  },
  {
    symbol: "BONK",
    name: "Bonk",
    icon: "/icons/bonk.png",
    pythFeedId: "0x72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419",
  },
  {
    symbol: "SOL",
    name: "Solana",
    icon: "/icons/sol.png",
    pythFeedId: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  },
  {
    symbol: "BTC",
    name: "Bitcoin",
    icon: "/icons/btc.png",
    pythFeedId: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  },
];

export const ROUND_DURATION_SECONDS = 12 * 60 * 60; // 12 hours
export const LOCK_BEFORE_END_SECONDS = 30 * 60; // 30 minutes

export const SIDE = {
  LEFT: 0,
  RIGHT: 1,
} as const;

export const SOLANA_NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet";
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";

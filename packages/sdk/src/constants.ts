import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"
);

export const SEEDS = {
  CONFIG: Buffer.from("config"),
  ROUND: Buffer.from("round"),
  BET: Buffer.from("bet"),
  VAULT: Buffer.from("vault"),
} as const;

export const SIDE = {
  LEFT: 0 as const,
  RIGHT: 1 as const,
};

export const ROUND_DURATION_SECONDS = 12 * 60 * 60; // 12 hours
export const LOCK_BEFORE_END_SECONDS = 30 * 60; // 30 minutes

export const PYTH_PRICE_FEEDS = {
  WIF: "0x4ca4beeca86f0d164160323817a4e42b10010a724c2217c6ee41b54cd4cc61fc",
  BONK: "0x72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419",
  SOL: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
} as const;

export type SupportedAsset = keyof typeof PYTH_PRICE_FEEDS;

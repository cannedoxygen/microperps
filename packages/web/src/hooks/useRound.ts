import { useQuery } from "@tanstack/react-query";
import { PublicKey } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { BN } from "@coral-xyz/anchor";
import { Round } from "@/types";
import { getProgramId } from "@/lib/constants";

export function useRound(roundId: number | null) {
  const { connection } = useConnection();

  return useQuery({
    queryKey: ["round", roundId],
    queryFn: async (): Promise<Round | null> => {
      if (roundId === null) return null;

      // Find round PDA
      const [roundPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("round"), new BN(roundId).toArrayLike(Buffer, "le", 8)],
        getProgramId()
      );

      // Fetch and decode account
      const accountInfo = await connection.getAccountInfo(roundPda);
      if (!accountInfo) return null;

      // Note: Actual deserialization requires the program IDL
      // This is a placeholder implementation
      return null;
    },
    enabled: roundId !== null,
    refetchInterval: 5000, // Refresh every 5 seconds
  });
}

export function useActiveRounds() {
  const { connection } = useConnection();

  return useQuery({
    queryKey: ["activeRounds"],
    queryFn: async (): Promise<Round[]> => {
      // Fetch all round accounts and filter for active ones
      // This requires getProgramAccounts with filters
      // Placeholder implementation
      return [];
    },
    refetchInterval: 10000,
  });
}

export function useLatestRound() {
  const { connection } = useConnection();

  return useQuery({
    queryKey: ["latestRound"],
    queryFn: async () => {
      // Get config to find latest round counter
      const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("config")],
        getProgramId()
      );

      const accountInfo = await connection.getAccountInfo(configPda);
      if (!accountInfo) return null;

      // Decode config to get round counter
      // Then fetch the latest round
      return null;
    },
    refetchInterval: 10000,
  });
}

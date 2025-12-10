import { useMemo } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program, Idl } from "@coral-xyz/anchor";
import { getProgramId } from "@/lib/constants";

// This will be generated after building the program
// For now, use a placeholder type
type LeftRightCandle = Idl;

export function useProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const provider = useMemo(() => {
    if (!wallet) return null;
    return new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
  }, [connection, wallet]);

  const program = useMemo(() => {
    if (!provider) return null;
    // Note: Replace with actual IDL after program build
    // import idl from "../idl/left_right_candle.json";
    // return new Program<LeftRightCandle>(idl as Idl, PROGRAM_ID, provider);
    return null;
  }, [provider]);

  return { program, provider };
}

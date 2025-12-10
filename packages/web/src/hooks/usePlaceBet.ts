import { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { Side } from "@/types";
import { Buffer } from "buffer";

// Program constants
const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "81K7nKnv7JiRhBCRNmagKot27Yu82eRWeeNA7dtGGaX6"
);
const CONFIG_PDA = new PublicKey(
  process.env.NEXT_PUBLIC_CONFIG_PDA || "DQ6T8gLKAYWhqvxMe8mHRjoY6ZMefRinZu8fkAV4ePA9"
);

// Anchor discriminator for place_bet (sha256("global:place_bet")[0:8])
const PLACE_BET_DISCRIMINATOR = Buffer.from([222, 62, 67, 220, 63, 166, 126, 33]);

function getRoundPda(roundId: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("round"), new BN(roundId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
  return pda;
}

function getBetPda(roundId: number, betIndex: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("bet"),
      new BN(roundId).toArrayLike(Buffer, "le", 8),
      new BN(betIndex).toArrayLike(Buffer, "le", 4),
    ],
    PROGRAM_ID
  );
  return pda;
}

function getVaultPda(roundId: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), new BN(roundId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
  return pda;
}

interface PlaceBetResult {
  signature: string;
  success: boolean;
}

export function usePlaceBet() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeBet = useCallback(
    async (roundId: number, side: Side, amount: BN): Promise<PlaceBetResult | null> => {
      console.log("placeBet called:", { roundId, side, amount: amount.toString() });

      if (!publicKey) {
        console.log("No publicKey - wallet not connected");
        setError("Wallet not connected");
        return null;
      }

      if (!sendTransaction) {
        console.log("No sendTransaction function");
        setError("Wallet does not support transactions");
        return null;
      }

      console.log("Wallet connected:", publicKey.toBase58());
      setIsLoading(true);
      setError(null);

      try {
        console.log("Building transaction...");
        const roundPda = getRoundPda(roundId);
        const vaultPda = getVaultPda(roundId);
        console.log("Round PDA:", roundPda.toBase58());
        console.log("Vault PDA:", vaultPda.toBase58());

        // Fetch round and config accounts to get bet_count and treasury
        const [roundAccount, configAccount] = await Promise.all([
          connection.getAccountInfo(roundPda),
          connection.getAccountInfo(CONFIG_PDA),
        ]);

        if (!roundAccount) {
          throw new Error("Round not found");
        }
        if (!configAccount) {
          throw new Error("Config not initialized");
        }

        // Parse bet_count from round account
        // For new layout (114 bytes): discriminator(8) + round_id(8) + asset_symbol(4+len) +
        // start_price(8) + end_price(8) + start_time(8) + betting_end_time(8) + end_time(8) +
        // status(1) + left_pool(8) + right_pool(8) + left_weighted_pool(8) + right_weighted_pool(8) + bet_count(4)
        const roundData = roundAccount.data;
        let offset = 8 + 8; // skip discriminator and round_id
        const assetLen = roundData.readUInt32LE(offset);
        offset += 4 + assetLen; // skip asset_symbol

        // Check if new layout (has betting_end_time and weighted pools)
        const isNewLayout = roundData.length > 100;

        // start_price(8) + end_price(8) + start_time(8)
        offset += 8 + 8 + 8;

        if (isNewLayout) {
          // betting_end_time(8) + end_time(8)
          offset += 8 + 8;
        } else {
          // end_time(8)
          offset += 8;
        }

        // status(1) + left_pool(8) + right_pool(8)
        offset += 1 + 8 + 8;

        if (isNewLayout) {
          // left_weighted_pool(8) + right_weighted_pool(8)
          offset += 8 + 8;
        }

        // bet_count(4)
        const betCount = roundData.readUInt32LE(offset);

        // Parse treasury from config
        // Structure: discriminator(8) + admin(32) + fee_bps(2) + referrer_fee_bps(2) + min_bet(8) + max_bet(8) + treasury(32)
        const treasuryOffset = 8 + 32 + 2 + 2 + 8 + 8;
        const treasury = new PublicKey(configAccount.data.slice(treasuryOffset, treasuryOffset + 32));

        // Build the place_bet instruction
        const betPda = getBetPda(roundId, betCount);

        // Convert side to number: LEFT=0 (SHORT), RIGHT=1 (LONG)
        const sideNum = side === "SHORT" ? 0 : 1;

        // Create instruction data for place_bet
        // Discriminator (8 bytes) + side (1 byte) + amount (8 bytes)
        const instructionData = Buffer.concat([
          PLACE_BET_DISCRIMINATOR,
          Buffer.from([sideNum]),
          amount.toArrayLike(Buffer, "le", 8),
        ]);

        // Build accounts array matching place_bet instruction order:
        // config, round, bet, vault, treasury, bettor, referrer (optional), system_program
        // For Anchor Option<Account>, pass program ID as "None" placeholder
        const accounts = [
          { pubkey: CONFIG_PDA, isSigner: false, isWritable: false },
          { pubkey: roundPda, isSigner: false, isWritable: true },
          { pubkey: betPda, isSigner: false, isWritable: true },
          { pubkey: vaultPda, isSigner: false, isWritable: true },
          { pubkey: treasury, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          // Optional referrer - pass program ID as None placeholder
          { pubkey: PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ];

        console.log("Bet PDA:", betPda.toBase58());
        console.log("Bet count from round:", betCount);
        console.log("Treasury:", treasury.toBase58());
        console.log("Accounts:", accounts.map(a => a.pubkey.toBase58()));

        // Create transaction
        const transaction = new Transaction();
        transaction.add({
          programId: PROGRAM_ID,
          keys: accounts,
          data: instructionData,
        });

        // Get recent blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;
        transaction.feePayer = publicKey;

        // Simulate transaction first to get better error messages
        console.log("Simulating transaction...");
        try {
          const simulation = await connection.simulateTransaction(transaction);
          console.log("Simulation result:", simulation);
          if (simulation.value.err) {
            console.error("Simulation error:", simulation.value.err);
            console.error("Simulation logs:", simulation.value.logs);
            throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
          }
        } catch (simErr) {
          console.error("Simulation exception:", simErr);
        }

        console.log("Sending transaction...");
        // Send transaction
        const signature = await sendTransaction(transaction, connection);
        console.log("Transaction sent, signature:", signature);

        // Wait for confirmation
        console.log("Waiting for confirmation...");
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        });

        console.log("Bet placed successfully:", signature);
        return { signature, success: true };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Error placing bet:", errorMessage);
        console.error("Full error:", err);
        setError(errorMessage);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [connection, publicKey, sendTransaction]
  );

  return { placeBet, isLoading, error };
}

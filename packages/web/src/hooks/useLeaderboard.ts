import { useQuery } from "@tanstack/react-query";
import { Connection, PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { Buffer } from "buffer";

const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "81K7nKnv7JiRhBCRNmagKot27Yu82eRWeeNA7dtGGaX6"
);
const CONFIG_PDA = new PublicKey(
  process.env.NEXT_PUBLIC_CONFIG_PDA || "DQ6T8gLKAYWhqvxMe8mHRjoY6ZMefRinZu8fkAV4ePA9"
);
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";

export interface LeaderboardEntry {
  address: string;
  totalWinnings: number; // in SOL
  totalBet: number; // in SOL
  profit: number; // winnings - bet
  wins: number;
  losses: number;
  winRate: number;
}

interface RoundInfo {
  roundId: number;
  winningSide: "SHORT" | "LONG" | null;
  shortPool: number;
  longPool: number;
  shortWeightedPool: number;
  longWeightedPool: number;
  betCount: number;
  status: number;
}

interface BetInfo {
  roundId: number;
  bettor: string;
  side: "SHORT" | "LONG";
  amount: number; // pool contribution (after fees)
  originalAmount: number;
  weight: number;
  paidOut: boolean;
}

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

function decodeRound(data: Buffer): RoundInfo | null {
  try {
    const isNewLayout = data.length > 100;
    let offset = 8; // skip discriminator

    const roundId = new BN(data.slice(offset, offset + 8), "le").toNumber();
    offset += 8;

    const assetLen = data.readUInt32LE(offset);
    offset += 4 + assetLen;

    // start_price, end_price, start_time
    offset += 8 + 8 + 8;

    if (isNewLayout) {
      offset += 8; // betting_end_time
    }

    offset += 8; // end_time

    const status = data[offset];
    offset += 1;

    const shortPool = new BN(data.slice(offset, offset + 8), "le").toNumber() / 1e9;
    offset += 8;

    const longPool = new BN(data.slice(offset, offset + 8), "le").toNumber() / 1e9;
    offset += 8;

    let shortWeightedPool = shortPool;
    let longWeightedPool = longPool;

    if (isNewLayout) {
      shortWeightedPool = new BN(data.slice(offset, offset + 8), "le").toNumber() / 1e9;
      offset += 8;
      longWeightedPool = new BN(data.slice(offset, offset + 8), "le").toNumber() / 1e9;
      offset += 8;
    }

    const betCount = data.readUInt32LE(offset);
    offset += 4;

    offset += 4; // payouts_processed

    const winningSideDiscriminant = data[offset];
    offset += 1;
    let winningSide: "SHORT" | "LONG" | null = null;
    if (winningSideDiscriminant === 1) {
      const sideValue = data[offset];
      winningSide = sideValue === 0 ? "SHORT" : "LONG";
    }

    return {
      roundId,
      winningSide,
      shortPool,
      longPool,
      shortWeightedPool,
      longWeightedPool,
      betCount,
      status,
    };
  } catch {
    return null;
  }
}

function decodeBet(data: Buffer): BetInfo | null {
  try {
    let offset = 8; // skip discriminator

    const roundId = new BN(data.slice(offset, offset + 8), "le").toNumber();
    offset += 8;

    const bettor = new PublicKey(data.slice(offset, offset + 32)).toBase58();
    offset += 32;

    const sideByte = data[offset];
    const side = sideByte === 0 ? "SHORT" : "LONG";
    offset += 1;

    const amount = new BN(data.slice(offset, offset + 8), "le").toNumber() / 1e9;
    offset += 8;

    const originalAmount = new BN(data.slice(offset, offset + 8), "le").toNumber() / 1e9;
    offset += 8;

    offset += 8; // bet_time

    const weight = new BN(data.slice(offset, offset + 8), "le").toNumber();
    offset += 8;

    offset += 4; // bet_index

    const paidOut = data[offset] === 1;

    return {
      roundId,
      bettor,
      side,
      amount,
      originalAmount,
      weight,
      paidOut,
    };
  } catch {
    return null;
  }
}

async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const connection = new Connection(RPC_URL, "confirmed");

  // Get round counter from config
  const configInfo = await connection.getAccountInfo(CONFIG_PDA);
  if (!configInfo) return [];

  const roundCounter = new BN(configInfo.data.slice(92, 100), "le").toNumber();
  if (roundCounter === 0) return [];

  // Fetch all rounds
  const roundPdas = Array.from({ length: roundCounter }, (_, i) => getRoundPda(i));
  const roundAccounts = await connection.getMultipleAccountsInfo(roundPdas);

  const rounds: RoundInfo[] = [];
  for (const account of roundAccounts) {
    if (account) {
      const round = decodeRound(account.data as Buffer);
      if (round && round.status === 3 && round.winningSide) {
        // Only settled rounds with a winner
        rounds.push(round);
      }
    }
  }

  if (rounds.length === 0) return [];

  // Fetch all bets from settled rounds
  const allBetPdas: PublicKey[] = [];
  const betRoundMap: { roundId: number; betIndex: number }[] = [];

  for (const round of rounds) {
    for (let i = 0; i < round.betCount; i++) {
      allBetPdas.push(getBetPda(round.roundId, i));
      betRoundMap.push({ roundId: round.roundId, betIndex: i });
    }
  }

  // Batch fetch bets (max 100 at a time)
  const allBets: BetInfo[] = [];
  const batchSize = 100;
  for (let i = 0; i < allBetPdas.length; i += batchSize) {
    const batch = allBetPdas.slice(i, i + batchSize);
    const accounts = await connection.getMultipleAccountsInfo(batch);
    for (const account of accounts) {
      if (account) {
        const bet = decodeBet(account.data as Buffer);
        if (bet) {
          allBets.push(bet);
        }
      }
    }
  }

  // Calculate winnings for each bettor
  const bettorStats: Map<string, { winnings: number; bet: number; wins: number; losses: number }> = new Map();

  for (const bet of allBets) {
    const round = rounds.find((r) => r.roundId === bet.roundId);
    if (!round) continue;

    const stats = bettorStats.get(bet.bettor) || { winnings: 0, bet: 0, wins: 0, losses: 0 };
    stats.bet += bet.originalAmount;

    if (bet.side === round.winningSide) {
      // Winner - calculate payout
      const losingPool = round.winningSide === "LONG" ? round.shortPool : round.longPool;
      const winningWeightedPool = round.winningSide === "LONG" ? round.longWeightedPool : round.shortWeightedPool;

      // Weighted amount for this bet
      const weightedAmount = (bet.amount * bet.weight) / 100;

      // Payout = bet back + share of losing pool
      const share = winningWeightedPool > 0 ? weightedAmount / winningWeightedPool : 0;
      const bonus = losingPool * share;
      const payout = bet.amount + bonus;

      stats.winnings += payout;
      stats.wins += 1;
    } else {
      // Loser - lost their bet (already counted in bet)
      stats.losses += 1;
    }

    bettorStats.set(bet.bettor, stats);
  }

  // Convert to leaderboard entries
  const entries: LeaderboardEntry[] = [];
  Array.from(bettorStats.entries()).forEach(([address, stats]) => {
    const profit = stats.winnings - stats.bet;
    const totalGames = stats.wins + stats.losses;
    entries.push({
      address,
      totalWinnings: stats.winnings,
      totalBet: stats.bet,
      profit,
      wins: stats.wins,
      losses: stats.losses,
      winRate: totalGames > 0 ? (stats.wins / totalGames) * 100 : 0,
    });
  });

  // Sort by profit descending
  entries.sort((a, b) => b.profit - a.profit);

  return entries;
}

export function useLeaderboard() {
  return useQuery<LeaderboardEntry[]>({
    queryKey: ["leaderboard"],
    queryFn: fetchLeaderboard,
    staleTime: 60000,
    refetchInterval: 120000,
  });
}

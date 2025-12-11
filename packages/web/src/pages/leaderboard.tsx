import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useLeaderboard, useReferralLeaderboard, LeaderboardEntry, ReferralLeaderboardEntry } from "@/hooks/useLeaderboard";

function formatAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function ReferralRow({ entry, rank }: { entry: ReferralLeaderboardEntry; rank: number }) {
  return (
    <tr className="border-b border-border hover:bg-card/50 transition-colors">
      <td className="py-4 px-4 text-center">
        <span className={`font-bold text-lg ${
          rank === 1 ? "text-yellow-400" :
          rank === 2 ? "text-gray-300" :
          rank === 3 ? "text-amber-600" : "text-gray-500"
        }`}>
          {rank === 1 && "🥇 "}
          {rank === 2 && "🥈 "}
          {rank === 3 && "🥉 "}
          #{rank}
        </span>
      </td>
      <td className="py-4 px-4">
        <a
          href={`https://solscan.io/account/${entry.address}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-blue-400 hover:text-blue-300 transition-colors"
        >
          {formatAddress(entry.address)}
        </a>
      </td>
      <td className="py-4 px-4 text-right font-mono text-gray-300">
        {entry.referralCount}
      </td>
      <td className="py-4 px-4 text-right font-mono text-gray-300">
        {entry.totalVolume.toFixed(4)} SOL
      </td>
      <td className="py-4 px-4 text-right font-mono font-bold text-long">
        +{entry.estimatedEarnings.toFixed(4)} SOL
      </td>
    </tr>
  );
}

function LeaderboardRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const isProfit = entry.profit >= 0;

  return (
    <tr className="border-b border-border hover:bg-card/50 transition-colors">
      <td className="py-4 px-4 text-center">
        <span className={`font-bold text-lg ${
          rank === 1 ? "text-yellow-400" :
          rank === 2 ? "text-gray-300" :
          rank === 3 ? "text-amber-600" : "text-gray-500"
        }`}>
          {rank === 1 && "🥇 "}
          {rank === 2 && "🥈 "}
          {rank === 3 && "🥉 "}
          #{rank}
        </span>
      </td>
      <td className="py-4 px-4">
        <a
          href={`https://solscan.io/account/${entry.address}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-blue-400 hover:text-blue-300 transition-colors"
        >
          {formatAddress(entry.address)}
        </a>
      </td>
      <td className={`py-4 px-4 text-right font-mono font-bold ${
        isProfit ? "text-long" : "text-short"
      }`}>
        {isProfit ? "+" : ""}{entry.profit.toFixed(4)} SOL
      </td>
      <td className="py-4 px-4 text-right font-mono text-gray-400">
        {entry.totalWinnings.toFixed(4)} SOL
      </td>
      <td className="py-4 px-4 text-right font-mono text-gray-400">
        {entry.totalBet.toFixed(4)} SOL
      </td>
      <td className="py-4 px-4 text-center">
        <span className="text-long">{entry.wins}W</span>
        <span className="text-gray-500"> / </span>
        <span className="text-short">{entry.losses}L</span>
      </td>
      <td className="py-4 px-4 text-right">
        <span className={`font-mono ${
          entry.winRate >= 50 ? "text-long" : "text-short"
        }`}>
          {entry.winRate.toFixed(1)}%
        </span>
      </td>
    </tr>
  );
}

export default function Leaderboard() {
  const { data: entries, isLoading, error } = useLeaderboard();
  const { data: referralEntries, isLoading: referralLoading } = useReferralLeaderboard();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Leaderboard</h1>
            <p className="text-gray-400 mt-1">Top performers by profit</p>
          </div>
          <a
            href="/play"
            className="px-4 py-2 bg-card border border-border rounded-lg hover:border-gray-500 transition-colors"
          >
            Back to Game
          </a>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-gray-400">Loading leaderboard...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <p className="text-red-400">Error loading leaderboard</p>
            <p className="text-gray-500 text-sm mt-2">{String(error)}</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && (!entries || entries.length === 0) && (
          <div className="text-center py-12 bg-card rounded-xl border border-border">
            <p className="text-4xl mb-4">🏆</p>
            <p className="text-gray-400 text-lg">No winners yet</p>
            <p className="text-gray-500 text-sm mt-2">
              The leaderboard will populate once rounds are settled
            </p>
          </div>
        )}

        {/* Leaderboard Table */}
        {entries && entries.length > 0 && (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background">
                  <tr className="text-gray-400 text-sm">
                    <th className="py-3 px-4 text-center">Rank</th>
                    <th className="py-3 px-4 text-left">Address</th>
                    <th className="py-3 px-4 text-right">Profit/Loss</th>
                    <th className="py-3 px-4 text-right">Winnings</th>
                    <th className="py-3 px-4 text-right">Total Bet</th>
                    <th className="py-3 px-4 text-center">Record</th>
                    <th className="py-3 px-4 text-right">Win Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <LeaderboardRow
                      key={entry.address}
                      entry={entry}
                      rank={index + 1}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stats Summary */}
        {entries && entries.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-gray-400 text-sm">Total Players</p>
              <p className="text-2xl font-bold">{entries.length}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-gray-400 text-sm">Total Wagered</p>
              <p className="text-2xl font-bold font-mono">
                {entries.reduce((sum, e) => sum + e.totalBet, 0).toFixed(2)} SOL
              </p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-gray-400 text-sm">Biggest Winner</p>
              <p className="text-2xl font-bold font-mono text-long">
                +{Math.max(...entries.map(e => e.profit)).toFixed(4)} SOL
              </p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-gray-400 text-sm">Avg Win Rate</p>
              <p className="text-2xl font-bold font-mono">
                {(entries.reduce((sum, e) => sum + e.winRate, 0) / entries.length).toFixed(1)}%
              </p>
            </div>
          </div>
        )}

        {/* Referral Leaderboard */}
        <div className="mt-16">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-bold">Referral Leaderboard</h2>
              <p className="text-gray-400 mt-1">Top referrers by volume</p>
            </div>
          </div>

          {/* Referral Loading State */}
          {referralLoading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-gray-400">Loading referral leaderboard...</p>
            </div>
          )}

          {/* Referral Empty State */}
          {!referralLoading && (!referralEntries || referralEntries.length === 0) && (
            <div className="text-center py-12 bg-card rounded-xl border border-border">
              <p className="text-4xl mb-4">🔗</p>
              <p className="text-gray-400 text-lg">No referrals yet</p>
              <p className="text-gray-500 text-sm mt-2">
                Share your referral link to earn 1% of every bet placed through it!
              </p>
            </div>
          )}

          {/* Referral Leaderboard Table */}
          {referralEntries && referralEntries.length > 0 && (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-background">
                    <tr className="text-gray-400 text-sm">
                      <th className="py-3 px-4 text-center">Rank</th>
                      <th className="py-3 px-4 text-left">Referrer</th>
                      <th className="py-3 px-4 text-right">Bets Referred</th>
                      <th className="py-3 px-4 text-right">Volume</th>
                      <th className="py-3 px-4 text-right">Earnings (1%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referralEntries.map((entry, index) => (
                      <ReferralRow
                        key={entry.address}
                        entry={entry}
                        rank={index + 1}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Referral Stats Summary */}
          {referralEntries && referralEntries.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-8">
              <div className="bg-card rounded-xl border border-border p-4 text-center">
                <p className="text-gray-400 text-sm">Total Referrers</p>
                <p className="text-2xl font-bold">{referralEntries.length}</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4 text-center">
                <p className="text-gray-400 text-sm">Total Referred Volume</p>
                <p className="text-2xl font-bold font-mono">
                  {referralEntries.reduce((sum, e) => sum + e.totalVolume, 0).toFixed(2)} SOL
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4 text-center">
                <p className="text-gray-400 text-sm">Total Referral Earnings</p>
                <p className="text-2xl font-bold font-mono text-long">
                  +{referralEntries.reduce((sum, e) => sum + e.estimatedEarnings, 0).toFixed(4)} SOL
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

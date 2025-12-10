import { useRouter } from "next/router";
import { Header } from "@/components/Header";
import { RecentBets } from "@/components/RecentBets";
import { useRoundBets } from "@/hooks/useRoundBets";
import { useAllRounds } from "@/hooks/useAllRounds";
import { formatSol } from "@/lib/utils";
import { Round } from "@/types";

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RoundDetail({ round }: { round: Round }) {
  const { data: bets, isLoading: betsLoading } = useRoundBets(
    round.roundId.toNumber(),
    round.betCount
  );

  const startPrice = round.startPrice.toNumber() / 1e8;
  const endPrice = round.endPrice.toNumber() / 1e8;
  const priceChange = startPrice > 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0;
  const totalPool = round.shortPool.add(round.longPool);

  const isSettled = round.status === "Settled";
  const isActive = round.status === "Open" || round.status === "Locked";

  // Filter winners and losers
  const winners = bets?.filter(
    (bet) => round.winningSide && bet.side === round.winningSide
  ) || [];
  const losers = bets?.filter(
    (bet) => round.winningSide && bet.side !== round.winningSide
  ) || [];

  return (
    <div>
      {/* Round Header Card */}
      <div className="bg-card rounded-xl border border-border p-6 mb-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-3xl font-bold">{round.assetSymbol}</h2>
              <span className="text-gray-500 text-xl">Round #{round.roundId.toString()}</span>
            </div>
            <p className="text-gray-400">
              Started: {formatDate(round.startTime.toNumber())}
            </p>
            {isSettled && (
              <p className="text-gray-400">
                Ended: {formatDate(round.endTime.toNumber())}
              </p>
            )}
          </div>
          <div
            className={`px-4 py-2 rounded-full text-sm font-semibold ${
              isActive
                ? "bg-green-600 text-green-100"
                : isSettled
                ? round.winningSide
                  ? round.winningSide === "LONG"
                    ? "bg-long text-white"
                    : "bg-short text-white"
                  : "bg-gray-600 text-gray-100"
                : "bg-yellow-600 text-yellow-100"
            }`}
          >
            {isActive
              ? "Active"
              : isSettled
              ? round.winningSide
                ? `${round.winningSide} Won!`
                : "Draw"
              : "Settling..."}
          </div>
        </div>

        {/* Price Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-background rounded-lg p-4">
            <span className="text-xs text-gray-500">Start Price</span>
            <p className="text-xl font-mono">${startPrice.toFixed(6)}</p>
          </div>
          <div className="bg-background rounded-lg p-4">
            <span className="text-xs text-gray-500">End Price</span>
            <p className="text-xl font-mono">
              {isSettled && endPrice > 0 ? `$${endPrice.toFixed(6)}` : "—"}
            </p>
          </div>
          <div className="bg-background rounded-lg p-4">
            <span className="text-xs text-gray-500">Price Change</span>
            <p
              className={`text-xl font-mono ${
                priceChange > 0
                  ? "text-long"
                  : priceChange < 0
                  ? "text-short"
                  : "text-gray-400"
              }`}
            >
              {isSettled && endPrice > 0
                ? `${priceChange >= 0 ? "+" : ""}${priceChange.toFixed(2)}%`
                : "—"}
            </p>
          </div>
          <div className="bg-background rounded-lg p-4">
            <span className="text-xs text-gray-500">Total Pool</span>
            <p className="text-xl font-mono">{formatSol(totalPool)} SOL</p>
          </div>
        </div>

        {/* Pool Distribution */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className={`${round.winningSide === "SHORT" ? "text-short font-bold" : "text-short"}`}>
              SHORT {round.winningSide === "SHORT" && "🏆"} ({round.betCount > 0 ? ((round.shortPool.toNumber() / totalPool.toNumber()) * 100).toFixed(0) : 50}%)
            </span>
            <span className={`${round.winningSide === "LONG" ? "text-long font-bold" : "text-long"}`}>
              LONG {round.winningSide === "LONG" && "🏆"} ({round.betCount > 0 ? ((round.longPool.toNumber() / totalPool.toNumber()) * 100).toFixed(0) : 50}%)
            </span>
          </div>
          <div className="h-4 bg-background rounded-full overflow-hidden flex">
            <div
              className={`h-full transition-all ${round.winningSide === "SHORT" ? "bg-short" : "bg-short/50"}`}
              style={{
                width: `${
                  round.betCount > 0
                    ? (round.shortPool.toNumber() / totalPool.toNumber()) * 100
                    : 50
                }%`,
              }}
            />
            <div
              className={`h-full transition-all ${round.winningSide === "LONG" ? "bg-long" : "bg-long/50"}`}
              style={{
                width: `${
                  round.betCount > 0
                    ? (round.longPool.toNumber() / totalPool.toNumber()) * 100
                    : 50
                }%`,
              }}
            />
          </div>
          <div className="flex justify-between text-sm mt-2 text-gray-500">
            <span>{formatSol(round.shortPool)} SOL</span>
            <span>{formatSol(round.longPool)} SOL</span>
          </div>
        </div>
      </div>

      {/* Bets Section */}
      {isSettled && round.winningSide && winners.length > 0 ? (
        <>
          {/* Winners */}
          <div className="mb-8">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-2xl">🏆</span> Winners ({winners.length})
            </h3>
            <div className="bg-card rounded-xl border border-green-600/30 p-4">
              <RecentBets bets={winners} isLoading={betsLoading} />
            </div>
          </div>

          {/* Losers */}
          {losers.length > 0 && (
            <div className="mb-8">
              <h3 className="text-xl font-bold mb-4 text-gray-400">
                Other Bets ({losers.length})
              </h3>
              <div className="bg-card rounded-xl border border-border p-4 opacity-75">
                <RecentBets bets={losers} isLoading={betsLoading} />
              </div>
            </div>
          )}
        </>
      ) : (
        <div>
          <h3 className="text-xl font-bold mb-4">
            All Bets ({round.betCount})
          </h3>
          <div className="bg-card rounded-xl border border-border p-4">
            <RecentBets bets={bets || []} isLoading={betsLoading} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function RoundPage() {
  const router = useRouter();
  const { id } = router.query;
  const roundId = typeof id === "string" ? parseInt(id) : undefined;

  const { data: rounds, isLoading, error } = useAllRounds();

  const round = rounds?.find((r) => r.roundId.toNumber() === roundId);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <a
            href="/history"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            ← Back to History
          </a>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-gray-400">Loading round...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <p className="text-red-400">Error loading round</p>
            <p className="text-gray-500 text-sm mt-2">{String(error)}</p>
          </div>
        )}

        {/* Not Found State */}
        {!isLoading && !error && !round && (
          <div className="text-center py-12 bg-card rounded-xl border border-border">
            <p className="text-gray-400">Round #{roundId} not found</p>
          </div>
        )}

        {/* Round Detail */}
        {round && <RoundDetail round={round} />}
      </main>
    </div>
  );
}

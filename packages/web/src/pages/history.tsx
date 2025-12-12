import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAllRounds } from "@/hooks/useAllRounds";
import { formatSol } from "@/lib/utils";
import { Round } from "@/types";
import tokensData from "@/data/tokens.json";

// Build token images map
const tokenImages: Record<string, string> = {};
for (const token of tokensData.data) {
  tokenImages[token.tokenSymbol.toUpperCase()] = token.tokenImageLogo;
}
// Add fallbacks
tokenImages.SOL = "https://assets.coingecko.com/coins/images/4128/large/solana.png";
tokenImages.BTC = "https://assets.coingecko.com/coins/images/1/large/bitcoin.png";

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RoundCard({ round }: { round: Round }) {
  const startPrice = round.startPrice.toNumber() / 1e8;
  const endPrice = round.endPrice.toNumber() / 1e8;
  const priceChange = startPrice > 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0;
  const totalPool = round.shortPool.add(round.longPool);

  const now = Math.floor(Date.now() / 1000);
  const bettingEnded = now > round.bettingEndTime.toNumber();
  const roundEnded = round.endTime.toNumber() > 0 && now > round.endTime.toNumber();

  const isSettled = round.status === "Settled";
  // Check if this is a legacy unsettleable round (old format with no end_time set)
  const isLegacy = round.status === "Open" && round.endTime.toNumber() === 0 && bettingEnded;
  const isActive = !isLegacy && (round.status === "Open" || round.status === "Locked") && !roundEnded;
  const hasNoBets = round.betCount === 0;

  const tokenImage = tokenImages[round.assetSymbol.toUpperCase()];

  return (
    <a
      href={`/round/${round.roundId.toString()}`}
      className="block rounded-xl border border-border p-6 hover:border-gray-500 transition-colors cursor-pointer relative overflow-hidden"
      style={tokenImage ? {
        backgroundImage: `url(${tokenImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : undefined}
    >
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/80" />

      {/* Content wrapper */}
      <div className="relative z-10">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-2xl font-bold">{round.assetSymbol}</h3>
            <span className="text-gray-500">Round #{round.roundId.toString()}</span>
          </div>
          <p className="text-sm text-gray-400">
            {formatDate(round.startTime.toNumber())}
          </p>
        </div>
        <div
          className={`px-3 py-1 rounded-full text-sm ${
            hasNoBets && !isActive
              ? "bg-gray-700 text-gray-300"
              : isLegacy
              ? "bg-gray-600 text-gray-100"
              : isActive
              ? "bg-green-600 text-green-100"
              : isSettled
              ? round.winningSide
                ? "bg-blue-600 text-blue-100"
                : "bg-gray-600 text-gray-100"
              : "bg-yellow-600 text-yellow-100"
          }`}
        >
          {hasNoBets && !isActive
            ? "No Bets"
            : isLegacy
            ? "Settled"
            : isActive
            ? "Active"
            : isSettled
            ? round.winningSide
              ? `${round.winningSide} Won`
              : "Draw"
            : "Settling"}
        </div>
      </div>

      {/* Price Info */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <span className="text-xs text-gray-500">Start Price</span>
          <p className="font-mono">${startPrice.toFixed(6)}</p>
        </div>
        <div>
          <span className="text-xs text-gray-500">End Price</span>
          <p className="font-mono">
            {isSettled && endPrice > 0 ? `$${endPrice.toFixed(6)}` : "—"}
          </p>
        </div>
        <div>
          <span className="text-xs text-gray-500">Change</span>
          <p
            className={`font-mono ${
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
      </div>

      {/* Pool Distribution */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-short">
            SHORT ({round.betCount > 0 ? ((round.shortPool.toNumber() / totalPool.toNumber()) * 100).toFixed(0) : 50}%)
          </span>
          <span className="text-long">
            LONG ({round.betCount > 0 ? ((round.longPool.toNumber() / totalPool.toNumber()) * 100).toFixed(0) : 50}%)
          </span>
        </div>
        <div className="h-3 bg-background rounded-full overflow-hidden flex">
          <div
            className={`h-full ${round.winningSide === "SHORT" ? "bg-short" : "bg-short/50"}`}
            style={{
              width: `${
                round.betCount > 0
                  ? (round.shortPool.toNumber() / totalPool.toNumber()) * 100
                  : 50
              }%`,
            }}
          />
          <div
            className={`h-full ${round.winningSide === "LONG" ? "bg-long" : "bg-long/50"}`}
            style={{
              width: `${
                round.betCount > 0
                  ? (round.longPool.toNumber() / totalPool.toNumber()) * 100
                  : 50
              }%`,
            }}
          />
        </div>
        <div className="flex justify-between text-xs mt-1 text-gray-500">
          <span>{formatSol(round.shortPool)} SOL</span>
          <span>Total: {formatSol(totalPool)} SOL</span>
          <span>{formatSol(round.longPool)} SOL</span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex justify-between text-sm text-gray-400">
        <span>{round.betCount} bets</span>
        {isSettled && round.winningSide && (
          <span className={round.winningSide === "LONG" ? "text-long" : "text-short"}>
            {round.winningSide === "LONG" ? "Price went UP" : "Price went DOWN"}
          </span>
        )}
        <span className="text-gray-500">View Details →</span>
      </div>
      </div>
    </a>
  );
}

export default function History() {
  const { data: rounds, isLoading, error } = useAllRounds();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Round History</h1>
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
            <p className="text-gray-400">Loading rounds...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <p className="text-red-400">Error loading rounds</p>
            <p className="text-gray-500 text-sm mt-2">{String(error)}</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && (!rounds || rounds.length === 0) && (
          <div className="text-center py-12 bg-card rounded-xl border border-border">
            <p className="text-gray-400">No rounds found</p>
          </div>
        )}

        {/* Rounds Grid */}
        {rounds && rounds.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rounds.map((round) => (
              <RoundCard key={round.roundId.toString()} round={round} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

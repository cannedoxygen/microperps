import { BN } from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { RoundInfo } from "@/components/RoundInfo";
import { BettingCard } from "@/components/BettingCard";
import { ShareBlink } from "@/components/ShareBlink";
import { RecentBets } from "@/components/RecentBets";
import { useCurrentRound } from "@/hooks/useCurrentRound";
import { usePlaceBet } from "@/hooks/usePlaceBet";
import { useLivePrice } from "@/hooks/useLivePrice";
import { useRoundBets } from "@/hooks/useRoundBets";
import { Side } from "@/types";
import tokensData from "@/data/tokens.json";

// Build token image lookup from tokens.json
const TOKEN_IMAGES: Record<string, string> = {};
(tokensData.data as any[]).forEach((token) => {
  TOKEN_IMAGES[token.tokenSymbol.toUpperCase()] = token.tokenImageLogo;
});

// Default config values (used when no round exists)
const defaultConfig = {
  feeBps: 250,
  minBetLamports: new BN(0.01 * 1e9),
  maxBetLamports: new BN(10 * 1e9),
};

export default function Home() {
  const { connected } = useWallet();
  const queryClient = useQueryClient();
  const { data: roundData, isLoading, error } = useCurrentRound();
  const { placeBet, isLoading: isBetting, error: betError } = usePlaceBet();

  const round = roundData?.round;
  const config = roundData?.config;

  // Fetch live price for the current token
  const { data: priceData } = useLivePrice(round?.assetSymbol);

  // Fetch bets for the current round
  const { data: bets, isLoading: betsLoading } = useRoundBets(
    round?.roundId.toNumber(),
    round?.betCount
  );

  const handlePlaceBet = async (side: Side, amount: BN) => {
    if (!round) return;

    const roundId = round.roundId.toNumber();
    console.log("Placing bet:", { roundId, side, amount: amount.toString() });

    const result = await placeBet(roundId, side, amount);

    if (result?.success) {
      // Invalidate query to refresh round data
      queryClient.invalidateQueries({ queryKey: ["currentRound"] });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="container mx-auto px-4 py-8 flex-1">
        {/* How to Play */}
        <div className="mb-8 bg-card rounded-xl border border-border p-6">
          <h2 className="text-xl font-bold mb-4 text-center">How to Play</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
            <div className="p-4">
              <div className="text-3xl mb-2">1</div>
              <h3 className="font-semibold mb-1">Random Token</h3>
              <p className="text-sm text-gray-400">Every 24 hours a random meme token is selected for prediction</p>
            </div>
            <div className="p-4">
              <div className="text-3xl mb-2">2</div>
              <h3 className="font-semibold mb-1">Bet Early</h3>
              <p className="text-sm text-gray-400">12h betting window. Earlier bets get up to 1.5x weight bonus!</p>
            </div>
            <div className="p-4">
              <div className="text-3xl mb-2">3</div>
              <h3 className="font-semibold mb-1">Wait & Watch</h3>
              <p className="text-sm text-gray-400">After betting closes, 12h wait until price is recorded</p>
            </div>
            <div className="p-4">
              <div className="text-3xl mb-2">4</div>
              <h3 className="font-semibold mb-1">Win the Pool</h3>
              <p className="text-sm text-gray-400">Winners get bet back + weighted share of losers' pool</p>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-gray-400">Loading current round...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <p className="text-red-400">Error loading round data</p>
            <p className="text-gray-500 text-sm mt-2">{String(error)}</p>
          </div>
        )}

        {/* No Round State */}
        {!isLoading && !error && !round && (
          <div className="text-center py-12 bg-card rounded-xl border border-border">
            <div className="text-4xl mb-4">🎲</div>
            <h3 className="text-xl font-bold mb-2">No Active Round</h3>
            <p className="text-gray-400 mb-4">
              A new round will start automatically. Check back soon!
            </p>
            <p className="text-sm text-gray-500">
              Rounds start every 24 hours with a randomly selected meme token.
            </p>
          </div>
        )}

        {/* Bet Error Display */}
        {betError && (
          <div className="mb-4 p-4 bg-red-900/20 border border-red-500 rounded-lg text-red-400 text-center">
            {betError}
          </div>
        )}

        {/* Main Game Area - Only show when round exists */}
        {round && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* SHORT Betting Card */}
              <BettingCard
                side="SHORT"
                currentPool={round.shortPool}
                oppositePool={round.longPool}
                minBet={config?.minBetLamports || defaultConfig.minBetLamports}
                maxBet={config?.maxBetLamports || defaultConfig.maxBetLamports}
                feeBps={config?.feeBps || defaultConfig.feeBps}
                disabled={!connected || round.status !== "Open"}
                onPlaceBet={handlePlaceBet}
              />

              {/* Round Info */}
              <RoundInfo
                round={round}
                currentPrice={priceData?.price}
                tokenImage={TOKEN_IMAGES[round.assetSymbol.toUpperCase()]}
              />

              {/* LONG Betting Card */}
              <BettingCard
                side="LONG"
                currentPool={round.longPool}
                oppositePool={round.shortPool}
                minBet={config?.minBetLamports || defaultConfig.minBetLamports}
                maxBet={config?.maxBetLamports || defaultConfig.maxBetLamports}
                feeBps={config?.feeBps || defaultConfig.feeBps}
                disabled={!connected || round.status !== "Open"}
                onPlaceBet={handlePlaceBet}
              />
            </div>

            {/* Connection prompt */}
            {!connected && (
              <div className="mt-8 text-center">
                <p className="text-gray-400">
                  Connect your wallet to place bets
                </p>
              </div>
            )}

            {/* Share Blink Section */}
            {connected && (
              <ShareBlink
                roundId={round.roundId.toNumber()}
                asset={round.assetSymbol}
              />
            )}
          </>
        )}

        {/* Recent Activity */}
        <div className="mt-12">
          <h2 className="text-xl font-bold mb-4">
            Recent Bets {round && `(${round.betCount} total)`}
          </h2>
          <div className="bg-card rounded-xl border border-border p-4">
            <RecentBets bets={bets || []} isLoading={betsLoading} />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

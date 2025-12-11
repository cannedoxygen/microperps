import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="container mx-auto px-4 py-12 flex-1">
        {/* Hero */}
        <div className="text-center mb-16 py-8">
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            <span className="text-long drop-shadow-[0_0_10px_rgba(34,197,94,0.8)]">μ</span>perps
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto mb-8">
            The simplest way to bet on meme coins.<br />
            Predict if a token goes up or down in 24 hours.
          </p>

          {/* CTA right in hero */}
          <a
            href="/play"
            className="inline-block bg-long hover:bg-long/80 text-black font-bold py-4 px-10 rounded-lg text-xl transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(34,197,94,0.5)]"
          >
            Start Playing
          </a>
        </div>

        {/* What is it */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-3xl font-bold mb-6 text-center">What is microperps?</h2>
          <div className="bg-card rounded-xl border border-border p-8">
            <p className="text-gray-300 text-lg leading-relaxed mb-4">
              microperps is a prediction market game on Solana where you bet on whether a meme token's price will go up or down over 24 hours.
            </p>
            <p className="text-gray-300 text-lg leading-relaxed mb-4">
              Every day, a random meme token is selected from a pool of 30+ tokens. Players have 12 hours to place their bets on LONG (price goes up) or SHORT (price goes down). After another 12 hours, the final price is recorded and winners take the pot.
            </p>
            <p className="text-gray-300 text-lg leading-relaxed">
              It's simple: pick a side, bet your SOL, and see if you're right.
            </p>
          </div>
        </div>

        {/* How it works */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-3xl font-bold mb-6 text-center">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="text-4xl mb-4">1</div>
              <h3 className="text-xl font-bold mb-2">Random Token Selection</h3>
              <p className="text-gray-400">
                Every 24 hours, a random meme token is selected. The starting price is recorded from Pyth oracle.
              </p>
            </div>
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="text-4xl mb-4">2</div>
              <h3 className="text-xl font-bold mb-2">Betting Window (12h)</h3>
              <p className="text-gray-400">
                Place your bet on LONG or SHORT. Earlier bets get up to 1.5x weight bonus for a bigger share of winnings!
              </p>
            </div>
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="text-4xl mb-4">3</div>
              <h3 className="text-xl font-bold mb-2">Settlement Period (12h)</h3>
              <p className="text-gray-400">
                Betting closes. Wait 12 hours for the final price to be recorded. No more bets can be placed.
              </p>
            </div>
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="text-4xl mb-4">4</div>
              <h3 className="text-xl font-bold mb-2">Winner Takes Pool</h3>
              <p className="text-gray-400">
                Winners get their original bet back plus a weighted share of the losers' pool. Early birds win more!
              </p>
            </div>
          </div>
        </div>

        {/* Early Bird Bonus */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-3xl font-bold mb-6 text-center">Early Bird Bonus</h2>
          <div className="bg-card rounded-xl border border-border p-8">
            <p className="text-gray-300 text-lg mb-6 text-center">
              Bet early to increase your share of the winning pool!
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-background rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-400">1.5x</p>
                <p className="text-sm text-gray-400">Hours 0-3</p>
              </div>
              <div className="bg-background rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-500">1.3x</p>
                <p className="text-sm text-gray-400">Hours 3-6</p>
              </div>
              <div className="bg-background rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-600">1.15x</p>
                <p className="text-sm text-gray-400">Hours 6-9</p>
              </div>
              <div className="bg-background rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-gray-400">1.0x</p>
                <p className="text-sm text-gray-400">Hours 9-12</p>
              </div>
            </div>
          </div>
        </div>

        {/* Referrals */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-3xl font-bold mb-6 text-center">Earn with Referrals</h2>
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <p className="text-gray-300 text-lg mb-4">
              Share your referral link and earn <span className="text-long font-bold">1%</span> of every bet placed through it.
            </p>
            <p className="text-gray-400">
              Generate your link by clicking "Get My Link" in the game interface or on any blink.
            </p>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center">
          <a
            href="/play"
            className="inline-block bg-long hover:bg-long/80 text-black font-bold py-4 px-10 rounded-lg text-xl transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(34,197,94,0.5)]"
          >
            Start Playing Now
          </a>
          <p className="text-gray-500 mt-4 text-sm">
            Currently on Solana Devnet
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}

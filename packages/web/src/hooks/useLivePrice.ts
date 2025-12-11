import { useQuery } from "@tanstack/react-query";
import tokensData from "@/data/tokens.json";

interface Token {
  tokenSymbol: string;
  pythFeedId: string;
  exponent: number;
}

// Build mapping from tokens.json
const PYTH_FEEDS: Record<string, { feedId: string; exponent: number }> = {};
(tokensData.data as Token[]).forEach((token) => {
  PYTH_FEEDS[token.tokenSymbol.toUpperCase()] = {
    feedId: token.pythFeedId,
    exponent: token.exponent,
  };
});

interface PriceData {
  price: number;
  change24h: number;
}

interface PythPriceResponse {
  parsed: Array<{
    price: {
      price: string;
      expo: number;
    };
  }>;
}

async function fetchPrice(symbol: string): Promise<PriceData | null> {
  const feed = PYTH_FEEDS[symbol.toUpperCase()];
  if (!feed) {
    console.warn(`No Pyth feed found for ${symbol}`);
    return null;
  }

  try {
    // Remove 0x prefix if present
    const feedId = feed.feedId.startsWith("0x") ? feed.feedId.slice(2) : feed.feedId;

    const res = await fetch(
      `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${feedId}`
    );

    if (!res.ok) {
      throw new Error(`Pyth API error: ${res.status}`);
    }

    const data: PythPriceResponse = await res.json();

    if (data.parsed && data.parsed.length > 0) {
      const priceData = data.parsed[0].price;
      const price = parseInt(priceData.price);
      const expo = priceData.expo;

      // Convert to USD price
      const usdPrice = price * Math.pow(10, expo);

      return {
        price: usdPrice,
        change24h: 0, // Pyth doesn't provide 24h change directly
      };
    }

    return null;
  } catch (error) {
    console.error("Error fetching price:", error);
    return null;
  }
}

export function useLivePrice(symbol: string | undefined) {
  return useQuery<PriceData | null>({
    queryKey: ["livePrice", symbol],
    queryFn: () => (symbol ? fetchPrice(symbol) : Promise.resolve(null)),
    enabled: !!symbol,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000, // Consider data stale after 15 seconds
  });
}

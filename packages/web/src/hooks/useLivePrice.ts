import { useQuery } from "@tanstack/react-query";

// Map token symbols to CoinGecko IDs
const COINGECKO_IDS: Record<string, string> = {
  WIF: "dogwifcoin",
  BONK: "bonk",
  SOL: "solana",
  BTC: "bitcoin",
  ETH: "ethereum",
  DOGE: "dogecoin",
  SHIB: "shiba-inu",
  PEPE: "pepe",
  FLOKI: "floki",
  HYPE: "hyperliquid",
  PUMP: "pump-fun",
  GIGA: "gigachad-2",
};

interface PriceData {
  price: number;
  change24h: number;
}

async function fetchPrice(symbol: string): Promise<PriceData | null> {
  const coinId = COINGECKO_IDS[symbol.toUpperCase()];
  if (!coinId) {
    console.warn(`No CoinGecko ID found for ${symbol}`);
    return null;
  }

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`
    );

    if (!res.ok) {
      throw new Error(`CoinGecko API error: ${res.status}`);
    }

    const data = await res.json();

    if (data[coinId]) {
      return {
        price: data[coinId].usd,
        change24h: data[coinId].usd_24h_change || 0,
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

import type { AppProps } from "next/app";
import Head from "next/head";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WalletProvider } from "@/components/WalletProvider";
import "@/styles/globals.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <title>μperps - Meme Prediction Market</title>
        <meta name="description" content="Bet on meme coins. Predict if a random token goes up or down in 24 hours." />
      </Head>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          <Component {...pageProps} />
        </WalletProvider>
      </QueryClientProvider>
    </>
  );
}

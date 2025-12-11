import { ImageResponse } from "@vercel/og";
import type { NextRequest } from "next/server";
import tokensData from "../../data/tokens.json";

export const config = {
  runtime: "edge",
};

// Build token images map from tokens.json
const tokenImages: Record<string, string> = {};
for (const token of tokensData.data) {
  tokenImages[token.tokenSymbol.toUpperCase()] = token.tokenImageLogo;
}
// Add fallbacks
tokenImages.SOL = "https://assets.coingecko.com/coins/images/4128/large/solana.png";
tokenImages.BTC = "https://assets.coingecko.com/coins/images/1/large/bitcoin.png";

export default async function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const asset = searchParams.get("asset") || "WIF";
  const price = searchParams.get("price") || "0.00";
  const change = parseFloat(searchParams.get("change") || "0");
  const round = searchParams.get("round") || "1";

  const isPositive = change >= 0;
  const changeText = `${isPositive ? "+" : ""}${change.toFixed(2)}%`;
  const tokenImage = tokenImages[asset.toUpperCase()] || tokenImages.WIF;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Full background token image */}
        <img
          src={tokenImage}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />

        {/* Dark overlay for readability */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.75)",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "32px 40px",
            position: "relative",
            zIndex: 1,
            height: "100%",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <img
                src={tokenImage}
                width={72}
                height={72}
                style={{
                  borderRadius: "50%",
                  border: "3px solid rgba(255,255,255,0.3)",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                }}
              />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{
                  color: "#fff",
                  fontSize: "42px",
                  fontWeight: "800",
                  letterSpacing: "-0.5px",
                  textShadow: "0 2px 10px rgba(0,0,0,0.5)",
                }}>
                  ${asset}
                </span>
                <span style={{
                  color: "rgba(255,255,255,0.7)",
                  fontSize: "18px",
                  fontWeight: "500",
                }}>
                  Round #{round}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{
                color: "#fff",
                fontSize: "42px",
                fontWeight: "800",
                letterSpacing: "-0.5px",
                textShadow: "0 2px 10px rgba(0,0,0,0.5)",
              }}>
                ${price}
              </span>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 16px",
                borderRadius: "20px",
                background: isPositive ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)",
              }}>
                <span
                  style={{
                    color: isPositive ? "#4ade80" : "#f87171",
                    fontSize: "20px",
                    fontWeight: "700",
                  }}
                >
                  {changeText}
                </span>
              </div>
            </div>
          </div>

          {/* Main content - LONG vs SHORT */}
          <div
            style={{
              display: "flex",
              flex: 1,
              gap: "20px",
            }}
          >
            {/* LONG side */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(34, 197, 94, 0.2)",
                borderRadius: "24px",
                border: "3px solid rgba(34, 197, 94, 0.6)",
                padding: "20px",
              }}
            >
              <svg width="72" height="72" viewBox="0 0 24 24" fill="none">
                <path d="M12 3L3 14H8V21H16V14H21L12 3Z" fill="#22c55e" stroke="#4ade80" strokeWidth="0.5"/>
              </svg>
              <span style={{
                color: "#4ade80",
                fontSize: "32px",
                fontWeight: "800",
                marginTop: "8px",
                letterSpacing: "1px",
              }}>
                LONG
              </span>
              <span style={{
                color: "rgba(255,255,255,0.7)",
                fontSize: "16px",
                marginTop: "4px",
                fontWeight: "500",
              }}>
                Price goes UP
              </span>
            </div>

            {/* VS divider */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: "60px",
              }}
            >
              <div style={{
                width: "3px",
                height: "50px",
                background: "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
              }} />
              <span style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: "20px",
                fontWeight: "700",
                margin: "10px 0",
              }}>
                VS
              </span>
              <div style={{
                width: "3px",
                height: "50px",
                background: "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
              }} />
            </div>

            {/* SHORT side */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(239, 68, 68, 0.2)",
                borderRadius: "24px",
                border: "3px solid rgba(239, 68, 68, 0.6)",
                padding: "20px",
              }}
            >
              <svg width="72" height="72" viewBox="0 0 24 24" fill="none">
                <path d="M12 21L21 10H16V3H8V10H3L12 21Z" fill="#ef4444" stroke="#f87171" strokeWidth="0.5"/>
              </svg>
              <span style={{
                color: "#f87171",
                fontSize: "32px",
                fontWeight: "800",
                marginTop: "8px",
                letterSpacing: "1px",
              }}>
                SHORT
              </span>
              <span style={{
                color: "rgba(255,255,255,0.7)",
                fontSize: "16px",
                marginTop: "4px",
                fontWeight: "500",
              }}>
                Price goes DOWN
              </span>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              marginTop: "20px",
              paddingTop: "16px",
              borderTop: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            <span style={{
              color: "rgba(255,255,255,0.8)",
              fontSize: "18px",
              fontWeight: "600",
            }}>
              microperps.fun
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: 800,
      height: 418,
    }
  );
}

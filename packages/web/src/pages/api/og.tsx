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
  const shortPct = searchParams.get("shortPct") || "50";
  const longPct = searchParams.get("longPct") || "50";
  const shortSol = searchParams.get("shortSol") || "0.0";
  const longSol = searchParams.get("longSol") || "0.0";
  const timeLeft = searchParams.get("time") || "12h 0m";

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
            background: "rgba(0, 0, 0, 0.8)",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "28px 36px",
            position: "relative",
            zIndex: 1,
            height: "100%",
          }}
        >
          {/* Header - Token info and price */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <img
                src={tokenImage}
                width={60}
                height={60}
                style={{
                  borderRadius: "50%",
                  border: "3px solid rgba(255,255,255,0.3)",
                }}
              />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{
                  color: "#fff",
                  fontSize: "36px",
                  fontWeight: "800",
                }}>
                  ${asset}
                </span>
                <span style={{
                  color: "rgba(255,255,255,0.6)",
                  fontSize: "16px",
                  fontWeight: "500",
                }}>
                  Round #{round}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{
                color: "#fff",
                fontSize: "36px",
                fontWeight: "800",
              }}>
                ${price}
              </span>
              <div style={{
                display: "flex",
                alignItems: "center",
                padding: "4px 12px",
                borderRadius: "16px",
                background: isPositive ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)",
              }}>
                <span
                  style={{
                    color: isPositive ? "#4ade80" : "#f87171",
                    fontSize: "18px",
                    fontWeight: "700",
                  }}
                >
                  {changeText}
                </span>
              </div>
            </div>
          </div>

          {/* Pool Distribution Bar */}
          <div style={{ display: "flex", flexDirection: "column", marginBottom: "16px" }}>
            <div style={{
              display: "flex",
              height: "32px",
              borderRadius: "16px",
              overflow: "hidden",
              border: "2px solid rgba(255,255,255,0.2)",
            }}>
              <div style={{
                width: `${shortPct}%`,
                background: "linear-gradient(90deg, #ef4444 0%, #dc2626 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <span style={{ color: "#fff", fontSize: "14px", fontWeight: "700" }}>
                  {shortPct}%
                </span>
              </div>
              <div style={{
                width: `${longPct}%`,
                background: "linear-gradient(90deg, #16a34a 0%, #22c55e 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <span style={{ color: "#fff", fontSize: "14px", fontWeight: "700" }}>
                  {longPct}%
                </span>
              </div>
            </div>
          </div>

          {/* LONG vs SHORT Cards */}
          <div
            style={{
              display: "flex",
              flex: 1,
              gap: "16px",
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
                background: "rgba(34, 197, 94, 0.15)",
                borderRadius: "20px",
                border: "3px solid rgba(34, 197, 94, 0.5)",
                padding: "16px",
              }}
            >
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
                <path d="M12 3L3 14H8V21H16V14H21L12 3Z" fill="#22c55e" stroke="#4ade80" strokeWidth="0.5"/>
              </svg>
              <span style={{
                color: "#4ade80",
                fontSize: "28px",
                fontWeight: "800",
                marginTop: "4px",
              }}>
                LONG
              </span>
              <span style={{
                color: "rgba(255,255,255,0.8)",
                fontSize: "18px",
                marginTop: "4px",
                fontWeight: "600",
              }}>
                {longSol} SOL
              </span>
            </div>

            {/* VS divider */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: "50px",
              }}
            >
              <div style={{
                width: "2px",
                height: "40px",
                background: "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
              }} />
              <span style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: "16px",
                fontWeight: "700",
                margin: "8px 0",
              }}>
                VS
              </span>
              <div style={{
                width: "2px",
                height: "40px",
                background: "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
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
                background: "rgba(239, 68, 68, 0.15)",
                borderRadius: "20px",
                border: "3px solid rgba(239, 68, 68, 0.5)",
                padding: "16px",
              }}
            >
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
                <path d="M12 21L21 10H16V3H8V10H3L12 21Z" fill="#ef4444" stroke="#f87171" strokeWidth="0.5"/>
              </svg>
              <span style={{
                color: "#f87171",
                fontSize: "28px",
                fontWeight: "800",
                marginTop: "4px",
              }}>
                SHORT
              </span>
              <span style={{
                color: "rgba(255,255,255,0.8)",
                fontSize: "18px",
                marginTop: "4px",
                fontWeight: "600",
              }}>
                {shortSol} SOL
              </span>
            </div>
          </div>

          {/* Footer - Time remaining and branding */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "16px",
              paddingTop: "12px",
              borderTop: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(255,255,255,0.1)",
              padding: "6px 14px",
              borderRadius: "20px",
            }}>
              <span style={{ fontSize: "16px" }}>⏱️</span>
              <span style={{
                color: "#fff",
                fontSize: "16px",
                fontWeight: "600",
              }}>
                {timeLeft} left to bet
              </span>
            </div>
            <span style={{
              color: "rgba(255,255,255,0.7)",
              fontSize: "16px",
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

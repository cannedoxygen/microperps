import { ImageResponse } from "@vercel/og";
import type { NextRequest } from "next/server";

export const config = {
  runtime: "edge",
};

export default async function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const asset = searchParams.get("asset") || "WIF";
  const price = searchParams.get("price") || "0.00";
  const change = parseFloat(searchParams.get("change") || "0");
  const round = searchParams.get("round") || "1";

  const isPositive = change >= 0;
  const changeText = `${isPositive ? "+" : ""}${change.toFixed(2)}%`;

  // Token images from CoinGecko
  const tokenImages: Record<string, string> = {
    WIF: "https://assets.coingecko.com/coins/images/33566/large/dogwifhat.jpg",
    BONK: "https://assets.coingecko.com/coins/images/28600/large/bonk.jpg",
    SOL: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
    BTC: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
  };

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)",
          padding: "32px 40px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background glow effects */}
        <div
          style={{
            position: "absolute",
            top: "-100px",
            left: "-100px",
            width: "300px",
            height: "300px",
            background: "radial-gradient(circle, rgba(34, 197, 94, 0.15) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-100px",
            right: "-100px",
            width: "300px",
            height: "300px",
            background: "radial-gradient(circle, rgba(239, 68, 68, 0.15) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "24px",
            zIndex: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <img
              src={tokenImages[asset] || tokenImages.WIF}
              width={64}
              height={64}
              style={{
                borderRadius: "50%",
                border: "3px solid rgba(255,255,255,0.2)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              }}
            />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{
                color: "#fff",
                fontSize: "36px",
                fontWeight: "800",
                letterSpacing: "-0.5px",
              }}>
                ${asset}
              </span>
              <span style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: "16px",
                fontWeight: "500",
              }}>
                Round #{round} • 12H Prediction
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{
              color: "#fff",
              fontSize: "36px",
              fontWeight: "800",
              letterSpacing: "-0.5px",
            }}>
              ${price}
            </span>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 12px",
              borderRadius: "20px",
              background: isPositive ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
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

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flex: 1,
            gap: "20px",
            zIndex: 1,
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
              background: "linear-gradient(180deg, rgba(34, 197, 94, 0.25) 0%, rgba(34, 197, 94, 0.08) 100%)",
              borderRadius: "24px",
              border: "2px solid rgba(34, 197, 94, 0.5)",
              padding: "20px",
              boxShadow: "0 0 40px rgba(34, 197, 94, 0.2)",
            }}
          >
            {/* Green up arrow */}
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
              <path d="M12 3L3 14H8V21H16V14H21L12 3Z" fill="#22c55e" stroke="#4ade80" strokeWidth="0.5"/>
            </svg>
            <span style={{
              color: "#4ade80",
              fontSize: "28px",
              fontWeight: "800",
              marginTop: "8px",
              letterSpacing: "1px",
            }}>
              LONG
            </span>
            <span style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: "14px",
              marginTop: "4px",
              fontWeight: "500",
            }}>
              Bet price goes UP
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
              color: "rgba(255,255,255,0.4)",
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
              background: "linear-gradient(180deg, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0.25) 100%)",
              borderRadius: "24px",
              border: "2px solid rgba(239, 68, 68, 0.5)",
              padding: "20px",
              boxShadow: "0 0 40px rgba(239, 68, 68, 0.2)",
            }}
          >
            {/* Red down arrow */}
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
              <path d="M12 21L21 10H16V3H8V10H3L12 21Z" fill="#ef4444" stroke="#f87171" strokeWidth="0.5"/>
            </svg>
            <span style={{
              color: "#f87171",
              fontSize: "28px",
              fontWeight: "800",
              marginTop: "8px",
              letterSpacing: "1px",
            }}>
              SHORT
            </span>
            <span style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: "14px",
              marginTop: "4px",
              fontWeight: "500",
            }}>
              Bet price goes DOWN
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "20px",
            paddingTop: "16px",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            zIndex: 1,
          }}
        >
          <span style={{
            color: "rgba(255,255,255,0.4)",
            fontSize: "14px",
            fontWeight: "500",
          }}>
            Powered by Dialect Blinks
          </span>
          <span style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: "14px",
            fontWeight: "600",
          }}>
            microperps.fun
          </span>
        </div>
      </div>
    ),
    {
      width: 800,
      height: 418,
    }
  );
}

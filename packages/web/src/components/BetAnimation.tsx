"use client";

import { FC, useEffect, useState } from "react";

interface Props {
  side: "LONG" | "SHORT";
  tokenImage?: string;
  onComplete: () => void;
}

interface Bubble {
  id: number;
  x: number;
  delay: number;
  duration: number;
  size: number;
}

export const BetAnimation: FC<Props> = ({ side, tokenImage, onComplete }) => {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);

  useEffect(() => {
    // Generate random bubbles
    const newBubbles: Bubble[] = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      x: Math.random() * 100, // Random horizontal position (%)
      delay: Math.random() * 0.5, // Staggered start
      duration: 1.5 + Math.random() * 1, // 1.5-2.5s duration
      size: 40 + Math.random() * 30, // 40-70px size
    }));
    setBubbles(newBubbles);

    // Clean up after animation
    const timeout = setTimeout(() => {
      onComplete();
    }, 3000);

    return () => clearTimeout(timeout);
  }, [onComplete]);

  const isLong = side === "LONG";
  const borderColor = isLong ? "border-green-500" : "border-red-500";
  const shadowColor = isLong ? "shadow-green-500/50" : "shadow-red-500/50";
  const glowColor = isLong ? "0 0 20px rgba(34, 197, 94, 0.6)" : "0 0 20px rgba(239, 68, 68, 0.6)";

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {bubbles.map((bubble) => (
        <div
          key={bubble.id}
          className={`absolute rounded-full border-4 ${borderColor} shadow-lg ${shadowColor} overflow-hidden`}
          style={{
            left: `${bubble.x}%`,
            width: bubble.size,
            height: bubble.size,
            boxShadow: glowColor,
            animation: isLong
              ? `floatUp ${bubble.duration}s ease-out ${bubble.delay}s forwards`
              : `floatDown ${bubble.duration}s ease-out ${bubble.delay}s forwards`,
            opacity: 0,
          }}
        >
          {tokenImage ? (
            <img
              src={tokenImage}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className={`w-full h-full ${isLong ? "bg-green-500/30" : "bg-red-500/30"}`} />
          )}
        </div>
      ))}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes floatUp {
          0% {
            bottom: -100px;
            opacity: 0;
            transform: scale(0.5) rotate(0deg);
          }
          10% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            bottom: 110%;
            opacity: 0;
            transform: scale(1) rotate(360deg);
          }
        }

        @keyframes floatDown {
          0% {
            top: -100px;
            opacity: 0;
            transform: scale(0.5) rotate(0deg);
          }
          10% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            top: 110%;
            opacity: 0;
            transform: scale(1) rotate(-360deg);
          }
        }
      `}</style>
    </div>
  );
};

"use client";

import React from "react";

const ARENA_CARD_STYLE: React.CSSProperties = {
  background: "var(--arena-card, #FAFAF8)",
  padding: "20px 24px",
  borderRadius: 16,
  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
  borderLeft: "4px solid var(--arena-accent, #7c6b9a)",
};

const shimmer =
  "linear-gradient(90deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.12) 50%, rgba(0,0,0,0.06) 100%)";
const skeletonBlock: React.CSSProperties = {
  background: shimmer,
  backgroundSize: "200% 100%",
  animation: "bty-skeleton-shimmer 1.2s ease-in-out infinite",
  borderRadius: 8,
};

export interface CardSkeletonProps {
  /** Show a label bar (like ProgressCard label). Default true. */
  showLabel?: boolean;
  /** Number of content lines. Default 2. */
  lines?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Card-style skeleton matching ProgressCard. For loading states per DESIGN_FIRST_IMPRESSION_BRIEF §2.
 */
export function CardSkeleton({
  showLabel = true,
  lines = 2,
  className = "",
  style,
}: CardSkeletonProps) {
  return (
    <div
      className={`bty-card-skeleton ${className}`.trim()}
      style={{ ...ARENA_CARD_STYLE, ...style }}
    >
      {showLabel && (
        <div
          style={{
            ...skeletonBlock,
            height: 14,
            width: "40%",
            marginBottom: 12,
          }}
        />
      )}
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          style={{
            ...skeletonBlock,
            height: i === 0 && lines > 1 ? 24 : 16,
            width: i === 0 ? "70%" : i === lines - 1 ? "50%" : "60%",
            marginTop: i === 0 ? 0 : 10,
          }}
        />
      ))}
    </div>
  );
}

export interface LeaderboardListSkeletonProps {
  /** Number of row placeholders. Default 8. */
  rows?: number;
  /** "card" = wrap in arena card style; "inner" = only the row list (parent provides card). */
  variant?: "card" | "inner";
  className?: string;
  style?: React.CSSProperties;
}

/** Skeleton for leaderboard card: same card chrome, list of row placeholders. */
export function LeaderboardListSkeleton({
  rows = 8,
  variant = "card",
  className = "",
  style,
}: LeaderboardListSkeletonProps) {
  const cardStyle: React.CSSProperties =
    variant === "card"
      ? {
          background: "var(--arena-card, #FAFAF8)",
          padding: 18,
          borderRadius: 14,
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          border: "1px solid #eee",
        }
      : {};
  return (
    <div
      className={`bty-leaderboard-skeleton ${className}`.trim()}
      style={{ ...cardStyle, ...style }}
    >
      <div style={{ display: "grid", gap: 10 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: 14,
              borderRadius: 14,
              border: "1px solid #eee",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  ...skeletonBlock,
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                }}
              />
              <div
                style={{
                  ...skeletonBlock,
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                }}
              />
              <div>
                <div
                  style={{
                    ...skeletonBlock,
                    height: 16,
                    width: 100,
                    marginBottom: 6,
                  }}
                />
                <div
                  style={{
                    ...skeletonBlock,
                    height: 12,
                    width: 60,
                  }}
                />
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  ...skeletonBlock,
                  height: 18,
                  width: 48,
                  marginBottom: 4,
                }}
              />
              <div
                style={{
                  ...skeletonBlock,
                  height: 12,
                  width: 56,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

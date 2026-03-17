"use client";

import React from "react";

/**
 * DESIGN_FIRST_IMPRESSION_BRIEF §2: 로딩 시 스피너만 두지 말고 아이콘 + 한 줄 문구.
 * Suspense fallback, route loading.tsx 등에서 사용.
 */
export interface LoadingFallbackProps {
  /** Emoji or icon (e.g. "⏳", "📋") — aria-hidden */
  icon?: string;
  /** One-line message (e.g. "잠시만 기다려 주세요.") */
  message: string;
  /** Optional: show skeleton blocks below (card-style loading) */
  withSkeleton?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function LoadingFallback({
  icon = "⏳",
  message,
  withSkeleton = false,
  className = "",
  style,
}: LoadingFallbackProps) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
        textAlign: "center",
        minHeight: withSkeleton ? undefined : 120,
        ...style,
      }}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <span
        style={{
          fontSize: 40,
          lineHeight: 1,
          marginBottom: 12,
          opacity: 0.8,
        }}
        aria-hidden
      >
        {icon}
      </span>
      <p style={{ margin: 0, fontSize: 15, color: "var(--arena-text-soft)", opacity: 0.9 }}>
        {message}
      </p>
      {withSkeleton && (
        <div style={{ display: "grid", gap: 12, marginTop: 24, width: "100%", maxWidth: 400 }}>
          <div
            style={{
              height: 72,
              borderRadius: 14,
              background: "linear-gradient(90deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.06) 100%)",
              backgroundSize: "200% 100%",
              animation: "bty-skeleton-shimmer 1.2s ease-in-out infinite",
            }}
          />
          <div
            style={{
              height: 56,
              borderRadius: 14,
              background: "linear-gradient(90deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.06) 100%)",
              backgroundSize: "200% 100%",
              animation: "bty-skeleton-shimmer 1.2s ease-in-out infinite",
            }}
          />
        </div>
      )}
    </div>
  );
}

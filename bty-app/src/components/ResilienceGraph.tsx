"use client";

import { useMemo, useState, useEffect } from "react";
import { getMessages } from "@/lib/i18n";
import { cn, getSelfEsteemHistory, type SelfEsteemHistoryEntry, type SelfEsteemLevel } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";

/**
 * 회복 탄력성 그래프
 * - 자존감 테스트 결과를 날짜별로 누적해 파도 위에 점으로 표시.
 * - high=위, mid=중간, low=아래
 */

type Theme = "dear" | "sanctuary" | "dojo";

const WAVE_PATH = "M 0 22 C 20 22 30 55 50 55 C 70 55 80 22 100 22";

function levelToY(level: SelfEsteemLevel): number {
  if (level === "high") return 18;
  if (level === "mid") return 40;
  return 55;
}

function getDots(entries: SelfEsteemHistoryEntry[]): { x: number; y: number; level: SelfEsteemLevel }[] {
  if (entries.length === 0) return [];
  if (entries.length === 1) {
    const e = entries[0];
    return [{ x: 50, y: levelToY(e.level), level: e.level }];
  }
  return entries.map((e, i) => {
    const x = (100 * i) / Math.max(1, entries.length - 1);
    return { x, y: levelToY(e.level), level: e.level };
  });
}

const levelColor: Record<SelfEsteemLevel, string> = {
  high: "#6B8E5B",
  mid: "#8A9A5B",
  low: "#9AAA7B",
};

export function ResilienceGraph({
  theme = "sanctuary",
  locale = "ko",
  className,
}: {
  theme?: Theme;
  locale?: Locale;
  className?: string;
}) {
  const t = getMessages(locale).resilience;
  const isDear = theme === "dear";
  const isSanctuary = theme === "sanctuary";
  const stroke = isDear ? "#8A9A5B" : isSanctuary ? "var(--sanctuary-flower)" : "#5B4B8A";
  const labelColor = isDear ? "text-dear-charcoal-soft" : isSanctuary ? "text-sanctuary-text-soft" : "text-dojo-ink-soft";

  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const handler = () => setRefreshKey((k) => k + 1);
    window.addEventListener("dear-self-esteem-updated", handler);
    return () => window.removeEventListener("dear-self-esteem-updated", handler);
  }, []);
  const history = useMemo(() => getSelfEsteemHistory(), [refreshKey]);
  const dots = useMemo(() => getDots(history), [history]);

  return (
    <div
      role="img"
      aria-label={`${t.title}: ${t.subtitle}`}
      className={cn("overflow-hidden", !isDear && "rounded-2xl", className)}
    >
      <div
        className={cn(
          !isDear && "rounded-2xl",
          !isDear && "p-6 sm:p-8",
          "border",
          isDear
            ? "bg-transparent border-transparent"
            : isSanctuary
              ? "bg-sanctuary-sky/30 border-sanctuary-sage/40"
              : "bg-dojo-purple-muted/20 border-dojo-purple-muted"
        )}
      >
        <h3
          className={cn(
            "text-lg font-medium mb-1",
            isDear ? "font-serif text-dear-charcoal" : isSanctuary ? "text-sanctuary-text" : "text-dojo-purple-dark"
          )}
        >
          {t.title}
        </h3>
        <p className={cn("text-sm mb-4", labelColor)}>
          {history.length > 0
            ? (locale === "ko" ? "자존감 테스트를 하면 여기에 날짜별로 쌓여요." : "Self-esteem results accumulate by date.")
            : t.subtitle}
        </p>
        <div className="w-full aspect-[2/1] min-h-[120px] flex items-end">
          <svg
            viewBox="0 0 100 60"
            preserveAspectRatio="none"
            className="w-full h-full"
            style={{ overflow: "visible" }}
          >
            <defs>
              <linearGradient id="resilience-fill" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={stroke} stopOpacity="0" />
                <stop offset="100%" stopColor={stroke} stopOpacity="0.25" />
              </linearGradient>
            </defs>
            <path
              d="M 0 22 C 20 22 30 55 50 55 C 70 55 80 22 100 22 L 100 60 L 0 60 Z"
              fill="url(#resilience-fill)"
            />
            <path
              d={WAVE_PATH}
              fill="none"
              stroke={stroke}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {dots.map((d, i) => (
              <circle
                key={i}
                cx={d.x}
                cy={d.y}
                r="4"
                fill={levelColor[d.level]}
                stroke="#fff"
                strokeWidth="1.5"
              />
            ))}
          </svg>
        </div>
        <div className={cn("flex justify-between mt-2 text-xs", labelColor)}>
          <span>{t.past}</span>
          <span>{t.now}</span>
        </div>
      </div>
    </div>
  );
}

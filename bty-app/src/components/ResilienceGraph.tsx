"use client";

import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";

/**
 * 회복 탄력성 그래프
 * - 직선이 아닌, 떨어졌다가 다시 올라가는 파도 모양 (fall → recovery).
 * - SVG path로 한 번 내려갔다 올라오는 곡선.
 */

type Theme = "dear" | "sanctuary" | "dojo";

// 시작 높음 → 중간에서 낮아짐(떨어짐) → 다시 높아짐(회복). SVG y: 작을수록 위.
const WAVE_PATH =
  "M 0 22 C 20 22 30 55 50 55 C 70 55 80 22 100 22";

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
          {t.subtitle}
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

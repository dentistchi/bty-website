"use client";

import { useMemo, useState, useEffect } from "react";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";
import type { ResilienceDayEntry, ResilienceDailyLevel } from "@/app/api/center/resilience/route";

/**
 * §4 CENTER_PAGE_IMPROVEMENT_SPEC — 일별 트렉 시각화, render-only.
 * API 계약: GET /api/center/resilience → { entries: ResilienceDayEntry[] }.
 * UI는 응답의 entries만 사용하며, 날짜·level 계산/병합 없음.
 */

export type ResilienceGraphApiResponse = { entries?: ResilienceDayEntry[] };

type Theme = "dear" | "sanctuary" | "dojo";

function formatAxisDate(dateStr: string, locale: Locale): string {
  const d = new Date(dateStr + "T12:00:00");
  if (Number.isNaN(d.getTime())) return dateStr;
  return locale === "ko"
    ? `${d.getMonth() + 1}/${d.getDate()}`
    : d.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

function levelToY(level: ResilienceDailyLevel): number {
  if (level === "high") return 18;
  if (level === "mid") return 40;
  return 55;
}

function parseDate(dateStr: string): number {
  return new Date(dateStr + "T12:00:00").getTime();
}

/** X축을 실제 날짜 범위로 배치. 같은 날만 있으면 인덱스로 균등 배치. */
function getDots(entries: ResilienceDayEntry[]): { x: number; y: number; level: ResilienceDailyLevel }[] {
  if (entries.length === 0) return [];
  if (entries.length === 1) {
    const e = entries[0];
    return [{ x: 50, y: levelToY(e.level), level: e.level }];
  }
  const times = entries.map((e) => parseDate(e.date));
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const span = tMax - tMin;
  if (span === 0) {
    return entries.map((e, i) => ({
      x: (100 * i) / (entries.length - 1),
      y: levelToY(e.level),
      level: e.level,
    }));
  }
  return entries.map((e) => {
    const t = parseDate(e.date);
    const x = Math.max(0, Math.min(100, (100 * (t - tMin)) / span));
    return { x, y: levelToY(e.level), level: e.level };
  });
}

/** 점들을 연결하는 궤적선 path (2점 이상일 때). */
function buildTrajectoryPath(dots: { x: number; y: number }[]): string | null {
  if (dots.length < 2) return null;
  const first = dots[0];
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < dots.length; i++) {
    d += ` L ${dots[i].x} ${dots[i].y}`;
  }
  return d;
}

/** 궤적선 아래 영역 채우기용 path (2점 이상일 때). */
function buildTrajectoryFillPath(dots: { x: number; y: number }[]): string | null {
  if (dots.length < 2) return null;
  let d = `M 0 60 L ${dots[0].x} ${dots[0].y}`;
  for (let i = 1; i < dots.length; i++) {
    d += ` L ${dots[i].x} ${dots[i].y}`;
  }
  d += ` L 100 60 Z`;
  return d;
}

const levelColor: Record<ResilienceDailyLevel, string> = {
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
  const labelColor = isDear ? "text-dear-charcoal-soft" : isSanctuary ? "text-sanctuary-text-soft" : "text-foundry-ink-soft";

  const [entries, setEntries] = useState<ResilienceDayEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/center/resilience", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((data: ResilienceGraphApiResponse) => {
        if (!cancelled) setEntries(data.entries ?? []);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => a.date.localeCompare(b.date)),
    [entries]
  );
  const historyDots = useMemo(() => getDots(sortedEntries), [sortedEntries]);
  const trajectoryPath = useMemo(() => buildTrajectoryPath(historyDots), [historyDots]);
  const trajectoryFillPath = useMemo(() => buildTrajectoryFillPath(historyDots), [historyDots]);

  const axisStartLabel = sortedEntries.length >= 1 ? formatAxisDate(sortedEntries[0].date, locale) : "";
  const axisEndLabel = sortedEntries.length >= 1 ? formatAxisDate(sortedEntries[sortedEntries.length - 1].date, locale) : "";

  return (
    <div
      role="img"
      aria-label={
        loading
          ? `${t.title}: ${t.subtitle}`
          : sortedEntries.length > 0
            ? `${t.title}: ${t.dailyTrajectorySubtitle}`
            : `${t.title}: ${t.emptyMessage}`
      }
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
              : "bg-foundry-purple-muted/20 border-foundry-purple-muted"
        )}
      >
        <h3
          className={cn(
            "text-lg font-medium mb-1",
            isDear ? "font-serif text-dear-charcoal" : isSanctuary ? "text-sanctuary-text" : "text-foundry-purple-dark"
          )}
        >
          {t.title}
        </h3>
        <p className={cn("text-sm mb-4", labelColor)}>
          {loading ? t.subtitle : sortedEntries.length > 0 ? t.dailyTrajectorySubtitle : t.subtitle}
        </p>
        <div className="w-full aspect-[2/1] min-h-[120px] flex items-end" aria-busy={loading}>
          {loading ? (
            <div
              className="w-full h-full flex flex-col gap-3 justify-end"
              role="status"
              aria-label={t.subtitle}
              aria-live="polite"
            >
              {/* Skeleton: graph-area shape with trajectory suggestion */}
              <div
                className="w-full flex-1 min-h-[80px] rounded-lg flex items-end justify-around gap-1 px-2 pb-2 animate-pulse"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.12) 50%, rgba(0,0,0,0.06) 100%)",
                  backgroundSize: "200% 100%",
                }}
                aria-hidden="true"
              >
                {[40, 55, 35, 48, 25].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 max-w-[14%] rounded-full bg-black/10"
                    style={{ height: `${h}%`, minHeight: 12 }}
                  />
                ))}
              </div>
            </div>
          ) : sortedEntries.length === 0 ? (
            <div
              className={cn("w-full min-h-[120px] flex items-center justify-center py-6", labelColor)}
              role="status"
              aria-live="polite"
              aria-label={t.emptyMessage}
            >
              <p className="text-sm text-center px-4">{t.emptyMessage}</p>
            </div>
          ) : (
          <svg
            viewBox="0 0 100 60"
            preserveAspectRatio="none"
            className="w-full h-full"
            style={{ overflow: "visible" }}
          >
            <defs>
              <linearGradient id={`resilience-fill-${theme}`} x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={stroke} stopOpacity="0" />
                <stop offset="100%" stopColor={stroke} stopOpacity="0.25" />
              </linearGradient>
            </defs>
            {trajectoryFillPath && (
              <path d={trajectoryFillPath} fill={`url(#resilience-fill-${theme})`} />
            )}
            {trajectoryPath && (
              <path
                d={trajectoryPath}
                fill="none"
                stroke={stroke}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {historyDots.map((d, i) => (
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
          )}
        </div>
        {(axisStartLabel || axisEndLabel) ? (
          <div className={cn("flex justify-between mt-2 text-xs", labelColor)}>
            <span>{axisStartLabel}</span>
            <span>{axisEndLabel}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState, useEffect } from "react";
import { getMessages } from "@/lib/i18n";
import { cn, getSelfEsteemHistory, type SelfEsteemHistoryEntry, type SelfEsteemLevel } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";

/**
 * 회복 탄력성 그래프 (§4 CENTER_PAGE_IMPROVEMENT_SPEC)
 * - 자존감 테스트(5문항) 결과를 날짜별로 누적해 일별 궤적로 표시.
 * - X축: 실제 날짜 범위(첫 기록일 … 최근 기록일). 일별/기간별 트렉이 시간 간격에 맞게 표시됨.
 * - 궤적선으로 점을 연결해 "매일의 5문항/활동" 흐름을 시각화. high=위, mid=중간, low=아래.
 */

type Theme = "dear" | "sanctuary" | "dojo";

function formatAxisDate(dateStr: string, locale: Locale): string {
  const d = new Date(dateStr + "T12:00:00");
  if (Number.isNaN(d.getTime())) return dateStr;
  return locale === "ko"
    ? `${d.getMonth() + 1}/${d.getDate()}`
    : d.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

function levelToY(level: SelfEsteemLevel): number {
  if (level === "high") return 18;
  if (level === "mid") return 40;
  return 55;
}

function parseDate(dateStr: string): number {
  return new Date(dateStr + "T12:00:00").getTime();
}

/** X축을 실제 날짜 범위로 배치. 같은 날만 있으면 인덱스로 균등 배치. */
function getDots(entries: SelfEsteemHistoryEntry[]): { x: number; y: number; level: SelfEsteemLevel }[] {
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
  const labelColor = isDear ? "text-dear-charcoal-soft" : isSanctuary ? "text-sanctuary-text-soft" : "text-foundry-ink-soft";

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const handler = () => setTick((k) => k + 1);
    window.addEventListener("dear-self-esteem-updated", handler);
    return () => window.removeEventListener("dear-self-esteem-updated", handler);
  }, []);
  const history = getSelfEsteemHistory();
  const historyDots = useMemo(() => getDots(history), [history]);
  const trajectoryPath = useMemo(() => buildTrajectoryPath(historyDots), [historyDots]);
  const trajectoryFillPath = useMemo(() => buildTrajectoryFillPath(historyDots), [historyDots]);

  const axisStartLabel = history.length >= 2 ? formatAxisDate(history[0].date, locale) : t.past;
  const axisEndLabel = history.length >= 2 ? formatAxisDate(history[history.length - 1].date, locale) : t.now;

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
          {history.length > 0 ? t.dailyTrajectorySubtitle : t.subtitle}
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
            {trajectoryFillPath && (
              <path d={trajectoryFillPath} fill="url(#resilience-fill)" />
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
        </div>
        <div className={cn("flex justify-between mt-2 text-xs", labelColor)}>
          <span>{axisStartLabel}</span>
          <span>{axisEndLabel}</span>
        </div>
      </div>
    </div>
  );
}

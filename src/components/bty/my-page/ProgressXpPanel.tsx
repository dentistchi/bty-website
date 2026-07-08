"use client";

import { useEffect, useState } from "react";
import type { MyPageStateResponse } from "@/features/my-page/api/getMyPageState";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Props = { locale: Locale };

type StageSummaryRes = {
  currentStage?: 1 | 2 | 3 | 4;
  stageName?: string;
  resetDueAt?: string | null;
};

type WeeklyStatsRes = {
  reflectionCount?: number;
  reflectionTarget?: number;
  reflectionQuestClaimed?: boolean;
  dailyBarSeries?: Array<{ date: string; barIntensity: number }>;
};

// Purely cosmetic barIntensity → bar-height ramp. These percentages are presentation
// only — they carry no XP/score meaning and must never be read as data. 0 preserves the
// quiet empty-day stub the previous ratio path rendered at 4%.
const BAR_INTENSITY_HEIGHT: Record<number, number> = {
  0: 4,
  1: 24,
  2: 42,
  3: 60,
  4: 80,
  5: 100,
};

const STREAK_KEY = "btyArenaStreak:v1";

function readLocalStreak(): number {
  try {
    if (typeof window === "undefined") return 0;
    const raw = window.localStorage.getItem(STREAK_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { streak?: number };
    return typeof parsed.streak === "number" ? parsed.streak : 0;
  } catch {
    return 0;
  }
}

function dayLabel(iso: string, locale: Locale): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso.slice(5);
  const ko = ["일", "월", "화", "수", "목", "금", "토"];
  const en = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const arr = locale === "ko" ? ko : en;
  return arr[d.getUTCDay()] ?? iso.slice(5);
}

export function ProgressXpPanel({ locale }: Props) {
  const m = getMessages(locale).myPageStub;
  const [stage, setStage] = useState<StageSummaryRes | null>(null);
  const [stats, setStats] = useState<WeeklyStatsRes | null>(null);
  const [serverPack, setServerPack] = useState<MyPageStateResponse | null>(null);
  const [streak, setStreak] = useState<number>(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setStreak(readLocalStreak());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const locParam = locale === "ko" ? "ko" : "en";

    const safeJson = <T,>(p: Promise<Response>): Promise<T | null> =>
      p.then((r) => (r.ok ? (r.json() as Promise<T>) : null)).catch(() => null);

    // P2 #2: raw XP exposures suppressed. The core-xp (E1/E2) and today-xp (E3) in-panel
    // fetches are removed as dead code — their only sinks were the removed XP cards. The
    // weekly-stats fetch stays (feeds the numberless E5 bar chart), stage-summary stays
    // (feeds the preserved stageName E7 / reset date E8), and my-page/state stays (feeds
    // the preserved Recent Reflections). API routes themselves are unchanged.
    Promise.all([
      safeJson<StageSummaryRes>(
        fetch("/api/arena/leadership-engine/stage-summary", { method: "GET", cache: "no-store" }),
      ),
      safeJson<WeeklyStatsRes>(
        fetch("/api/arena/weekly-stats", { method: "GET", cache: "no-store" }),
      ),
      safeJson<MyPageStateResponse>(
        fetch(`/api/bty/my-page/state?locale=${encodeURIComponent(locParam)}`, {
          method: "GET",
          cache: "no-store",
        }),
      ),
    ]).then(([stageRes, statsRes, statePack]) => {
      if (cancelled) return;
      setStage(stageRes);
      setStats(statsRes);
      setServerPack(statePack);
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [locale]);

  const series = stats?.dailyBarSeries ?? [];

  const stageNum = stage?.currentStage ?? null;
  const stageName = stage?.stageName ?? null;

  const reflections = serverPack?.reflections ?? [];

  const isKo = locale === "ko";

  return (
    <div data-testid="my-page-progress-screen" className="space-y-4">
      {/* P2 #2: raw XP summary cards (Core / Weekly / Today XP) removed — internal XP
          totals were exposed verbatim. The numberless 7-day chart below (relative bars,
          no XP labels) is the preserved safe progress-shape residue. */}

      {/* 7-day XP chart */}
      <div
        data-testid="my-page-weekly-chart"
        className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm"
      >
        <p className="text-sm font-medium text-[#1E2A38]">
          {isKo ? "최근 7일의 흔적" : "Last 7 days"}
        </p>
        <div className="mt-4 flex items-end gap-1.5 h-24" aria-hidden>
          {(loaded ? series : Array.from({ length: 7 }, () => ({ date: "", barIntensity: 0 }))).map((d, i) => {
            const heightPct = BAR_INTENSITY_HEIGHT[d.barIntensity] ?? 4;
            return (
              <div key={`${d.date}-${i}`} className="flex-1 flex flex-col items-center gap-1">
                <div className="flex-1 w-full flex items-end">
                  <div
                    className={`w-full rounded-t-md ${loaded ? "bg-[#405A74]" : "bg-[#E8E3D8] animate-pulse"}`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <p className="text-[10px] text-[#98A2B3] tabular-nums">
                  {d.date ? dayLabel(d.date, locale) : ""}
                </p>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-[#667085]">
          <span>{isKo ? "일별 합계" : "Daily total"}</span>
          {/* P2 #2: raw "Peak {n}" XP number removed; the relative bars carry the shape. */}
        </div>
      </div>

      {/* Leadership Stage */}
      <div
        data-testid="my-page-stage"
        className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-[#667085]">
          {isKo ? "리더십 단계" : "Leadership stage"}
        </p>
        {loaded && stageNum != null ? (
          <>
            {/* P2 #2: raw progression tier ("Stage N of 4") removed; the stage NAME (a
                domain-formatted label, preserved per D+) is the stage card's content. */}
            <p className="mt-2 text-base font-semibold text-[#1E2A38]">{stageName}</p>
            {stage?.resetDueAt && (
              <p className="mt-2 text-xs text-[#98A2B3]">
                {isKo ? "리셋 예정: " : "Reset due: "}
                {new Date(stage.resetDueAt).toLocaleDateString(isKo ? "ko-KR" : "en-US")}
              </p>
            )}
          </>
        ) : (
          <div className="mt-3 h-5 w-32 animate-pulse rounded bg-[#E8E3D8]" />
        )}
      </div>

      {/* Streak */}
      <div
        data-testid="my-page-streak"
        className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-[#1E2A38]">{m.streak}</p>
          <span className="font-semibold tabular-nums text-[#1E2A38]">
            {streak}
            <span className="ml-1 text-xs font-normal text-[#667085]">
              {isKo ? "일" : "d"}
            </span>
          </span>
        </div>
      </div>

      {/* P2 #2: Pattern Signatures section removed — it exposed the raw `pattern_family`
          enum (E10, same identifier suppressed in P2 #1) and the raw occurrence/repeat
          count (E11). No safe standalone residue, so the section is dropped entirely.
          `/api/bty/my-page/state` is unchanged and still feeds Recent Reflections below. */}

      {/* Recent Reflections */}
      <div
        data-testid="my-page-reflections"
        className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm"
      >
        <p className="text-sm font-medium text-[#1E2A38]">
          {isKo ? "최근 reflection" : "Recent reflections"}
        </p>
        {!loaded ? (
          <div className="mt-3 h-5 w-40 animate-pulse rounded bg-[#E8E3D8]" />
        ) : reflections.length === 0 ? (
          <p className="mt-2 text-sm text-[#667085]">
            {isKo ? "아직 작성된 reflection이 없습니다." : "No reflections yet."}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {[...reflections]
              .sort((a, b) => b.createdAt - a.createdAt)
              .slice(0, 5)
              .map((r) => {
                const dateStr = new Date(r.createdAt).toLocaleDateString(
                  isKo ? "ko-KR" : "en-US",
                );
                const body = r.commitment?.trim() || r.promptTitle?.trim() || "—";
                return (
                  <li
                    key={r.id}
                    className="rounded-lg border border-[#EEE7DA] bg-[#FAF7F0] px-3 py-2"
                  >
                    <p className="text-[10px] uppercase tracking-wide text-[#98A2B3]">
                      {dateStr}
                    </p>
                    <p className="mt-1 text-sm text-[#1E2A38] line-clamp-2">{body}</p>
                  </li>
                );
              })}
          </ul>
        )}
      </div>
    </div>
  );
}

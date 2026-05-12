"use client";

import { useEffect, useMemo, useState } from "react";
import type { MyPageStateResponse } from "@/features/my-page/api/getMyPageState";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Props = { locale: Locale };

type CoreXpRes = {
  coreXpTotal?: number;
  seasonalXpTotal?: number;
  codeName?: string;
  subName?: string;
  tier?: number;
};

type StageSummaryRes = {
  currentStage?: 1 | 2 | 3 | 4;
  stageName?: string;
  resetDueAt?: string | null;
};

type WeeklyStatsRes = {
  reflectionCount?: number;
  reflectionTarget?: number;
  reflectionQuestClaimed?: boolean;
  dailyXpSeries?: Array<{ date: string; xp: number }>;
};

type TodayXpRes = { xpToday?: number };

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
  const [coreXp, setCoreXp] = useState<number | null>(null);
  const [weeklyXp, setWeeklyXp] = useState<number | null>(null);
  const [todayXp, setTodayXp] = useState<number | null>(null);
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

    Promise.all([
      safeJson<CoreXpRes>(fetch("/api/arena/core-xp", { method: "GET", cache: "no-store" })),
      safeJson<StageSummaryRes>(
        fetch("/api/arena/leadership-engine/stage-summary", { method: "GET", cache: "no-store" }),
      ),
      safeJson<WeeklyStatsRes>(
        fetch("/api/arena/weekly-stats", { method: "GET", cache: "no-store" }),
      ),
      safeJson<TodayXpRes>(fetch("/api/arena/today-xp", { method: "GET", cache: "no-store" })),
      safeJson<MyPageStateResponse>(
        fetch(`/api/bty/my-page/state?locale=${encodeURIComponent(locParam)}`, {
          method: "GET",
          cache: "no-store",
        }),
      ),
    ]).then(([core, stageRes, statsRes, todayRes, statePack]) => {
      if (cancelled) return;
      setCoreXp(core?.coreXpTotal ?? 0);
      setWeeklyXp(core?.seasonalXpTotal ?? 0);
      setTodayXp(todayRes?.xpToday ?? 0);
      setStage(stageRes);
      setStats(statsRes);
      setServerPack(statePack);
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [locale]);

  const series = stats?.dailyXpSeries ?? [];
  const seriesMax = useMemo(
    () => series.reduce((m, d) => (d.xp > m ? d.xp : m), 0),
    [series],
  );

  const stageNum = stage?.currentStage ?? null;
  const stageName = stage?.stageName ?? null;

  const patterns = serverPack?.pattern_signatures ?? [];
  const reflections = serverPack?.reflections ?? [];

  const isKo = locale === "ko";

  return (
    <div data-testid="my-page-progress-screen" className="space-y-4">
      {/* XP Summary */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: m.coreXp, value: coreXp, testid: "my-page-core-xp" },
          { label: m.weeklyXp, value: weeklyXp, testid: "my-page-weekly-xp" },
          { label: isKo ? "오늘 XP" : "Today XP", value: todayXp, testid: "my-page-today-xp" },
        ].map((c) => (
          <div
            key={c.testid}
            data-testid={c.testid}
            className="rounded-2xl border border-[#E8E3D8] bg-white px-3 py-4 shadow-sm text-center"
          >
            <p className="text-[10px] font-medium uppercase tracking-widest text-[#667085] mb-1">
              {c.label}
            </p>
            {loaded ? (
              <p className="text-2xl font-bold tabular-nums text-[#1E2A38]">{c.value ?? 0}</p>
            ) : (
              <div className="mx-auto h-7 w-12 animate-pulse rounded-lg bg-[#E8E3D8]" />
            )}
          </div>
        ))}
      </div>

      {/* 7-day XP chart */}
      <div
        data-testid="my-page-weekly-chart"
        className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm"
      >
        <p className="text-sm font-medium text-[#1E2A38]">
          {isKo ? "최근 7일 XP" : "Last 7 days"}
        </p>
        <div className="mt-4 flex items-end gap-1.5 h-24" aria-hidden>
          {(loaded ? series : Array.from({ length: 7 }, () => ({ date: "", xp: 0 }))).map((d, i) => {
            const ratio = seriesMax > 0 ? d.xp / seriesMax : 0;
            const heightPct = Math.max(4, Math.round(ratio * 100));
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
          {loaded && (
            <span className="tabular-nums">
              {isKo ? "최고" : "Peak"} {seriesMax}
            </span>
          )}
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
            <p className="mt-2 text-base font-semibold text-[#1E2A38]">
              {isKo ? `${stageNum}단계 / 4` : `Stage ${stageNum} of 4`}
            </p>
            <p className="mt-1 text-sm text-[#667085]">{stageName}</p>
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

      {/* Pattern Signatures */}
      <div
        data-testid="my-page-patterns"
        className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm"
      >
        <p className="text-sm font-medium text-[#1E2A38]">
          {isKo ? "패턴 시그니처" : "Pattern signatures"}
        </p>
        {!loaded ? (
          <div className="mt-3 h-5 w-40 animate-pulse rounded bg-[#E8E3D8]" />
        ) : patterns.length === 0 ? (
          <p className="mt-2 text-sm text-[#667085]">
            {isKo
              ? "아직 누적된 패턴이 없습니다. Arena 런 후 표시됩니다."
              : "No patterns yet. Show up after your Arena runs."}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {patterns.slice(0, 5).map((p, idx) => {
              const family = (p as { pattern_family?: string; family?: string }).pattern_family
                ?? (p as { family?: string }).family
                ?? "—";
              const count = (p as { occurrence_count?: number; repeat_count?: number }).occurrence_count
                ?? (p as { repeat_count?: number }).repeat_count
                ?? 0;
              return (
                <li
                  key={idx}
                  className="flex items-center justify-between rounded-lg border border-[#EEE7DA] bg-[#FAF7F0] px-3 py-2 text-sm"
                >
                  <span className="text-[#1E2A38]">{String(family)}</span>
                  <span className="tabular-nums text-[#667085]">×{count}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

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

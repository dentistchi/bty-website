"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AuthGate } from "@/components/AuthGate";
import { Comeback } from "@/components/Comeback";
import { ThemeBody } from "@/components/ThemeBody";
import { LoadingFallback } from "@/components/bty-arena";
import { MissionCard } from "@/components/journey/MissionCard";
import { cn } from "@/lib/utils";
import { getMessages } from "@/lib/i18n";
import { fetchJson } from "@/lib/read-json";
import { useAuth } from "@/contexts/AuthContext";
import { JOURNEY_DAYS, type DayContent } from "@/lib/journey-content";
import type { DayEntry } from "@/lib/supabase-admin-types";

const API_BASE = "";

function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("bty_auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function JourneyBoard() {
  const pathname = usePathname() ?? "";
  const locale = pathname.startsWith("/ko") ? "ko" : "en";
  const { user } = useAuth();
  const [profile, setProfile] = useState<{
    current_day: number;
    started_at: string;
    season: number;
    bounce_back_count: number;
    last_completed_at: string | null;
  } | null>(null);
  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const currentDay = profile?.current_day ?? 1;

  const LOCK_MSG = "마음의 근육이 자라는 데는 시간이 필요해요. 내일 다시 만나요.";

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [rProfile, rEntries] = await Promise.all([
        fetchJson<{
          current_day?: number;
          started_at?: string;
          season?: number;
          bounce_back_count?: number;
          last_completed_at?: string | null;
          is_new?: boolean;
        }>(`${API_BASE}/api/journey/profile`, { headers: getAuthHeader() }),
        fetchJson<DayEntry[]>(`${API_BASE}/api/journey/entries`, { headers: getAuthHeader() }),
      ]);
      if (rProfile.ok && rProfile.json) {
        const p = rProfile.json;
        const payload = {
          current_day: p.current_day ?? 1,
          started_at: p.started_at ?? new Date().toISOString(),
          season: p.season ?? 1,
          bounce_back_count: p.bounce_back_count ?? 0,
          last_completed_at: p.last_completed_at ?? null,
        };
        setProfile(payload);
        if (p.is_new) {
          const r = await fetchJson<{ ok?: boolean; error?: string; message?: string }>(
            `${API_BASE}/api/journey/profile`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...getAuthHeader(),
              },
              body: JSON.stringify({
                current_day: payload.current_day,
                season: payload.season,
              }),
            }
          );

          if (!r.ok) {
            let msg = r.raw ?? "Request failed";
            try {
              const obj = JSON.parse(r.raw ?? "") as { error?: string; message?: string };
              msg = obj.error ?? obj.message ?? msg;
            } catch {}
            throw new Error(msg);
          }
        }
      }
      if (rEntries.ok && Array.isArray(rEntries.json)) {
        setEntries(rEntries.json);
      }
    } catch {
      setProfile({
        current_day: 1,
        started_at: new Date().toISOString(),
        season: 1,
        bounce_back_count: 0,
        last_completed_at: null,
      });
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStartSeason2 = useCallback(async () => {
    const r = await fetchJson<{ ok?: boolean; error?: string; message?: string }>(
      "/api/journey/profile",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          current_day: 1,
          season: (profile?.season ?? 1) + 1,
          last_completed_at: null,
        }),
      }
    );

    if (!r.ok) {
      let msg = r.raw ?? "Request failed";
      try {
        const obj = JSON.parse(r.raw ?? "") as { error?: string; message?: string };
        msg = obj.error ?? obj.message ?? msg;
      } catch {}
      throw new Error(msg);
    }

    await loadData();
  }, [profile?.season, loadData]);

  const handleComplete = useCallback(
    async (day: number, data: { mission_checks: number[]; reflection_text: string }) => {
      const r = await fetchJson<{ ok?: boolean; error?: string; message?: string }>(
        "/api/journey/entries",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
          body: JSON.stringify({
            day,
            completed: true,
            mission_checks: data.mission_checks,
            reflection_text: data.reflection_text,
          }),
        }
      );

      if (!r.ok) {
        let msg = r.raw ?? "Request failed";
        try {
          const obj = JSON.parse(r.raw ?? "") as { error?: string; message?: string };
          msg = obj.error ?? obj.message ?? msg;
        } catch {}
        throw new Error(msg);
      }

      // Advance to next day + 24h lock (기다림도 훈련)
      const nextDay = Math.min(28, day + 1);
      const r2 = await fetchJson<{ ok?: boolean; error?: string; message?: string }>(
        "/api/journey/profile",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
          body: JSON.stringify({
            current_day: nextDay,
            season: profile?.season ?? 1,
            last_completed_at: new Date().toISOString(),
          }),
        }
      );

      if (!r2.ok) {
        let msg = r2.raw ?? "Request failed";
        try {
          const obj = JSON.parse(r2.raw ?? "") as { error?: string; message?: string };
          msg = obj.error ?? obj.message ?? msg;
        } catch {}
        throw new Error(msg);
      }
      await loadData();
    },
    [loadData, profile?.season]
  );

  const getEntry = useCallback(
    (day: number): DayEntry | undefined =>
      entries.find((e) => e.day === day),
    [entries]
  );

  const getContent = useCallback((day: number): DayContent => {
    return JOURNEY_DAYS[day - 1] ?? JOURNEY_DAYS[0];
  }, []);

  const day28Completed = getEntry(28)?.completed ?? false;
  const seasonComplete = currentDay === 28 && day28Completed;

  const unlockAt = profile?.last_completed_at
    ? new Date(profile.last_completed_at).getTime() + 24 * 60 * 60 * 1000
    : 0;
  const isTodayLocked =
    currentDay > 1 && profile?.last_completed_at != null && Date.now() < unlockAt;

  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    if (!isTodayLocked || unlockAt <= 0) {
      setCountdown("");
      return;
    }
    const format = (ms: number) => {
      const s = Math.floor(ms / 1000) % 60;
      const m = Math.floor(ms / 60000) % 60;
      const h = Math.floor(ms / 3600000);
      return `${h}시간 ${String(m).padStart(2, "0")}분 ${String(s).padStart(2, "0")}초`;
    };
    const tick = () => {
      const left = unlockAt - Date.now();
      if (left <= 0) {
        setCountdown("");
        loadData();
        return;
      }
      setCountdown(format(left));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isTodayLocked, unlockAt, loadData]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  if (loading) {
    const tLoading = getMessages(locale === "ko" ? "ko" : "en").loading;
    return (
      <AuthGate>
        <ThemeBody theme="foundry" />
        <main className="min-h-screen bg-foundry-white flex items-center justify-center p-6">
          <LoadingFallback icon="📋" message={tLoading.message} withSkeleton />
        </main>
      </AuthGate>
    );
  }

  return (
    <AuthGate>
      <ThemeBody theme="foundry" />
      <main className="min-h-screen bg-foundry-white">
        <Comeback />
        <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
          <header className="text-center mb-10">
            <h1 className="text-2xl sm:text-3xl font-semibold text-foundry-purple-dark">
              나의 여정 (My Journey)
            </h1>
            <p className="text-foundry-ink-soft mt-1">
              28일. 어제보다 나은 오늘을 위한 연습.
            </p>
            {(profile?.bounce_back_count ?? 0) > 0 && (
              <p className="mt-3 text-sm text-foundry-purple font-medium">
                돌아온 횟수: {profile?.bounce_back_count}회
              </p>
            )}
          </header>

          {seasonComplete && (
            <div className="mb-8 rounded-2xl border border-foundry-purple/40 bg-journey-done p-6 sm:p-8 text-center">
              <h2 className="text-xl font-semibold text-foundry-purple-dark mb-2">
                첫 번째 시즌을 마치고, 더 깊은 연습으로 들어갑니다
              </h2>
              <p className="text-foundry-ink-soft text-sm mb-4">
                수료가 아니라 이제 시즌 2로 넘어갈 차례예요.
              </p>
              <button
                type="button"
                onClick={handleStartSeason2}
                className="rounded-xl px-6 py-3 font-medium bg-foundry-purple text-white hover:bg-foundry-purple-dark transition-colors"
                aria-label={locale === "ko" ? "시즌 2 시작하기" : "Start season 2"}
              >
                시즌 2 시작하기
              </button>
            </div>
          )}

          {/* 28-day path: 4 weeks × 7 days */}
          <div className="grid grid-cols-7 gap-2 sm:gap-3">
            {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => {
              const entry = getEntry(day);
              const isPast = day < currentDay;
              const isToday = day === currentDay;
              const isFuture = day > currentDay;
              const isCompleted = entry?.completed ?? false;
              const isTodayWaiting24h = isToday && isTodayLocked;
              const isClickable = isPast || (isToday && !isTodayLocked);
              const isLocked = isFuture || isTodayWaiting24h;

              return (
                <motion.button
                  key={day}
                  type="button"
                  onClick={() => {
                    if (isFuture) return;
                    if (isTodayWaiting24h) {
                      setToast(LOCK_MSG);
                      return;
                    }
                    setOpenDay(day);
                  }}
                  disabled={isFuture}
                  aria-label={
                    locale === "ko"
                      ? isFuture
                        ? `Day ${day}, 잠금`
                        : isTodayWaiting24h
                          ? `Day ${day}, 대기 중`
                          : isPast && isCompleted
                            ? `Day ${day}, 완료`
                            : isToday
                              ? `Day ${day}, 오늘`
                              : `Day ${day}`
                      : isFuture
                        ? `Day ${day}, locked`
                        : isTodayWaiting24h
                          ? `Day ${day}, waiting`
                          : isPast && isCompleted
                            ? `Day ${day}, completed`
                            : isToday
                              ? `Day ${day}, today`
                              : `Day ${day}`
                  }
                  className={cn(
                    "aspect-square rounded-xl border-2 flex flex-col items-center justify-center text-sm font-medium transition-all duration-300",
                    isLocked && "cursor-not-allowed opacity-75",
                    isToday &&
                      !isTodayLocked &&
                      "border-foundry-purple bg-journey-today text-foundry-purple-dark shadow-md",
                    isTodayWaiting24h &&
                      "border-foundry-purple-muted bg-journey-locked text-foundry-ink-soft",
                    isPast &&
                      isCompleted &&
                      "border-journey-done-strong bg-journey-done text-foundry-purple-dark",
                    isPast &&
                      !isCompleted &&
                      "border-foundry-purple-muted bg-foundry-purple-muted/30 text-foundry-ink-soft",
                    isFuture && "border-foundry-purple-muted bg-journey-locked text-foundry-ink-soft"
                  )}
                  whileHover={isClickable ? { scale: 1.02 } : undefined}
                  whileTap={isClickable ? { scale: 0.98 } : undefined}
                  initial={false}
                >
                  <span className="text-xs text-foundry-ink-soft">Day</span>
                  <span className="font-semibold">{day}</span>
                  {isTodayWaiting24h && (
                    <span className="text-[9px] mt-1 text-foundry-ink-soft/90 leading-tight text-center px-0.5 truncate max-w-full">
                      {countdown ? countdown.replace(/\s*초$/, "") : "🔒"}
                    </span>
                  )}
                  {isFuture && (
                    <span className="text-[10px] mt-0.5 text-foundry-ink-soft/80 leading-tight">
                      🔒
                    </span>
                  )}
                  {isTodayWaiting24h && !countdown && (
                    <span className="text-[10px] mt-0.5 text-foundry-ink-soft/80 leading-tight">
                      🔒
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>

          {isTodayLocked && countdown && (
            <div className="mt-6 rounded-xl border border-foundry-purple-muted bg-foundry-purple-muted/20 px-4 py-3 text-center">
              <p className="text-sm text-foundry-ink-soft">
                다음 훈련까지 남은 시간: <strong className="text-foundry-purple-dark">{countdown}</strong>
              </p>
              <p className="text-xs text-foundry-ink-soft/80 mt-1">
                기다림도 훈련이에요.
              </p>
            </div>
          )}

          {currentDay <= 28 && !seasonComplete && !isTodayLocked && (
            <p className="mt-6 text-center text-sm text-foundry-ink-soft">
              {profile?.current_day === 1
                ? "Day 1을 눌러 오늘의 미션을 시작하세요."
                : `Day ${currentDay}을 눌러 오늘의 미션을 진행하세요.`}
            </p>
          )}

          {/* Future lock + failure-is-ok message */}
          <div className="mt-8 rounded-2xl border border-foundry-purple-muted bg-foundry-purple-muted/20 p-6 text-center space-y-2">
            <p className="text-foundry-ink-soft text-sm">
              내일의 나를 위해 남겨두세요. 순서대로 하나씩 걸어가요.
            </p>
            <p className="text-foundry-ink-soft/80 text-xs">
              지나간 날을 건너뛰어도 괜찮아요. 돌아온 것이 중요해요.
            </p>
          </div>

          <footer className="mt-12 pt-6 border-t border-foundry-purple-muted text-center text-sm text-foundry-ink-soft space-x-4">
            <Link href="/bty/mentor" className="text-foundry-purple hover:underline" aria-label={locale === "ko" ? "Dr. Chi 멘토로 가기" : "Go to Dr. Chi Mentor"}>
              Dr. Chi Mentor
            </Link>
            <span>·</span>
            <Link href="/bty/integrity" className="text-foundry-purple hover:underline" aria-label={locale === "ko" ? "역지사지 시뮬레이터로 가기" : "Go to Integrity simulator"}>
              역지사지 시뮬레이터
            </Link>
            <span>·</span>
            <Link href={`/${locale}/center`} className="text-foundry-purple hover:underline" aria-label={locale === "ko" ? "Center로 가기" : "Go to Center"}>
              Center로 가기
            </Link>
          </footer>
        </div>

        {/* Toast: 잠금 클릭 시 */}
        {toast && (
          <div
            role="alert"
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md px-5 py-4 rounded-xl bg-foundry-purple-dark text-white text-sm shadow-lg animate-fadeIn"
          >
            {toast}
          </div>
        )}

        <AnimatePresence>
          {openDay !== null && (
            <MissionCard
              key={openDay}
              open={true}
              onOpenChange={(open) => !open && setOpenDay(null)}
              day={openDay}
              content={getContent(openDay)}
              mode={openDay < currentDay ? "view" : "edit"}
              initialChecks={getEntry(openDay)?.mission_checks ?? []}
              initialReflection={
                getEntry(openDay)?.reflection_text ?? undefined
              }
              onComplete={
                openDay === currentDay
                  ? (data) => handleComplete(openDay, data)
                  : undefined
              }
            />
          )}
        </AnimatePresence>
      </main>
    </AuthGate>
  );
}

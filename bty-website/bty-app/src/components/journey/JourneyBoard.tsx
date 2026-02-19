"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AuthGate } from "@/components/AuthGate";
import { Comeback } from "@/components/Comeback";
import { Nav } from "@/components/Nav";
import { ThemeBody } from "@/components/ThemeBody";
import { MissionCard } from "@/components/journey/MissionCard";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/read-json";
import { useAuth } from "@/contexts/AuthContext";
import { JOURNEY_DAYS, type DayContent } from "@/lib/journey-content";
import type { DayEntry } from "@/lib/supabase";

const API_BASE = "";

function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("bty_auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function JourneyBoard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{
    current_day: number;
    started_at: string;
    season: number;
    bounce_back_count: number;
  } | null>(null);
  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDay, setOpenDay] = useState<number | null>(null);

  const currentDay = profile?.current_day ?? 1;

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
        };
        setProfile(payload);
        // Create profile on first visit
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

      // Advance to next day
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

  if (loading) {
    return (
      <AuthGate>
        <ThemeBody theme="dojo" />
        <main className="min-h-screen bg-dojo-white flex items-center justify-center">
          <p className="text-dojo-ink-soft">로딩 중…</p>
        </main>
      </AuthGate>
    );
  }

  return (
    <AuthGate>
      <ThemeBody theme="dojo" />
      <main className="min-h-screen bg-dojo-white">
        <Comeback />
        <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
          <Nav locale="ko" pathname="/bty" />
          <header className="text-center mb-10">
            <h1 className="text-2xl sm:text-3xl font-semibold text-dojo-purple-dark">
              나의 여정 (My Journey)
            </h1>
            <p className="text-dojo-ink-soft mt-1">
              28일. 어제보다 나은 오늘을 위한 연습.
            </p>
            {(profile?.bounce_back_count ?? 0) > 0 && (
              <p className="mt-3 text-sm text-dojo-purple font-medium">
                돌아온 횟수: {profile?.bounce_back_count}회
              </p>
            )}
          </header>

          {seasonComplete && (
            <div className="mb-8 rounded-2xl border border-dojo-purple/40 bg-journey-done p-6 sm:p-8 text-center">
              <h2 className="text-xl font-semibold text-dojo-purple-dark mb-2">
                첫 번째 시즌을 마치고, 더 깊은 연습으로 들어갑니다
              </h2>
              <p className="text-dojo-ink-soft text-sm mb-4">
                수료가 아니라 이제 시즌 2로 넘어갈 차례예요.
              </p>
              <button
                type="button"
                onClick={handleStartSeason2}
                className="rounded-xl px-6 py-3 font-medium bg-dojo-purple text-white hover:bg-dojo-purple-dark transition-colors"
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

              return (
                <motion.button
                  key={day}
                  type="button"
                  onClick={() => {
                    if (isFuture) return;
                    setOpenDay(day);
                  }}
                  disabled={isFuture}
                  className={cn(
                    "aspect-square rounded-xl border-2 flex flex-col items-center justify-center text-sm font-medium transition-all duration-300",
                    isFuture && "cursor-not-allowed opacity-60",
                    isToday &&
                      "border-dojo-purple bg-journey-today text-dojo-purple-dark shadow-md",
                    isPast &&
                      isCompleted &&
                      "border-journey-done-strong bg-journey-done text-dojo-purple-dark",
                    isPast &&
                      !isCompleted &&
                      "border-dojo-purple-muted bg-dojo-purple-muted/30 text-dojo-ink-soft",
                    isFuture && "border-dojo-purple-muted bg-journey-locked text-dojo-ink-soft"
                  )}
                  whileHover={!isFuture ? { scale: 1.02 } : undefined}
                  whileTap={!isFuture ? { scale: 0.98 } : undefined}
                  initial={false}
                >
                  <span className="text-xs text-dojo-ink-soft">Day</span>
                  <span className="font-semibold">{day}</span>
                  {isFuture && (
                    <span className="text-[10px] mt-0.5 text-dojo-ink-soft/80 leading-tight">
                      🔒
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>

          {currentDay <= 28 && !seasonComplete && (
            <p className="mt-6 text-center text-sm text-dojo-ink-soft">
              {profile?.current_day === 1
                ? "Day 1을 눌러 오늘의 미션을 시작하세요."
                : `Day ${currentDay}을 눌러 오늘의 미션을 진행하세요.`}
            </p>
          )}

          {/* Future lock + failure-is-ok message */}
          <div className="mt-8 rounded-2xl border border-dojo-purple-muted bg-dojo-purple-muted/20 p-6 text-center space-y-2">
            <p className="text-dojo-ink-soft text-sm">
              내일의 나를 위해 남겨두세요. 순서대로 하나씩 걸어가요.
            </p>
            <p className="text-dojo-ink-soft/80 text-xs">
              지나간 날을 건너뛰어도 괜찮아요. 돌아온 것이 중요해요.
            </p>
          </div>

          <footer className="mt-12 pt-6 border-t border-dojo-purple-muted text-center text-sm text-dojo-ink-soft space-x-4">
            <a href="/bty/mentor" className="text-dojo-purple hover:underline">
              Dr. Chi Mentor
            </a>
            <span>·</span>
            <a href="/bty/integrity" className="text-dojo-purple hover:underline">
              역지사지 시뮬레이터
            </a>
            <span>·</span>
            <a href="/" className="text-dojo-purple hover:underline">
              Dear Me로 가기
            </a>
          </footer>
        </div>

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

/**
 * Journey day step — content + completion (no XP; uses existing journey APIs).
 * @see POST /api/journey/entries · POST /api/journey/profile
 */

import { JOURNEY_DAYS } from "@/lib/journey-content";
import { getJourneyProfile } from "@/lib/bty/journey/api";

export type JourneyDayContent = {
  day: number;
  title: string;
  body: string;
};

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("bty_auth_token");
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function clampDay(day: number): number {
  return Math.min(28, Math.max(1, Math.floor(day)));
}

/** Local + deterministic copy (KO from JOURNEY_DAYS; EN calm fallback). */
export function getJourneyDayContent(day: number, locale: string): JourneyDayContent {
  const d = clampDay(day);
  const c = JOURNEY_DAYS[d - 1];
  if (locale === "ko" && c) {
    return {
      day: d,
      title: c.reading,
      body: c.missions.length ? c.missions.join("\n") : c.reading,
    };
  }
  return {
    day: d,
    title: "Restore internal alignment",
    body: "Take one action that re-establishes your internal consistency today.",
  };
}

/** Async hook for future GET /api/journey/day/[n] if added. */
export async function getJourneyDay(day: number, locale: string): Promise<JourneyDayContent> {
  return getJourneyDayContent(day, locale);
}

export type JourneyDayAccess =
  | { kind: "active" }
  | { kind: "locked"; message: string }
  | { kind: "past" }
  | { kind: "future" };

export function getDayAccess(
  requestedDay: number,
  currentDay: number,
  lastCompletedAt: string | null,
  locale = "en"
): JourneyDayAccess {
  const d = clampDay(requestedDay);
  const cur = clampDay(currentDay);
  if (d < cur) return { kind: "past" };
  if (d > cur) return { kind: "future" };
  const unlockAt =
    cur > 1 && lastCompletedAt
      ? new Date(lastCompletedAt).getTime() + 24 * 60 * 60 * 1000
      : 0;
  if (unlockAt > 0 && Date.now() < unlockAt) {
    return {
      kind: "locked",
      message:
        locale === "ko"
          ? "다음 단계는 잠시 쉬어가며 이어갈 수 있어요. 기다림도 회복의 일부입니다."
          : "The next step opens after a short pause. Recovery includes rest.",
    };
  }
  return { kind: "active" };
}

/**
 * Marks day complete and advances profile (same contract as legacy JourneyBoard).
 * Does not touch Arena XP / leaderboard.
 */
export async function completeJourneyDay(day: number): Promise<void> {
  const profile = await getJourneyProfile();
  const season = profile.season ?? 1;
  const d = clampDay(day);

  const r1 = await fetch("/api/journey/entries", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      day: d,
      completed: true,
      mission_checks: [],
      reflection_text: "—",
    }),
  });

  if (!r1.ok) {
    let msg = "Failed to save day";
    try {
      const j = (await r1.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  const nextDay = Math.min(28, d + 1);
  const r2 = await fetch("/api/journey/profile", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      current_day: nextDay,
      season,
      last_completed_at: new Date().toISOString(),
    }),
  });

  if (!r2.ok) {
    let msg = "Failed to update journey progress";
    try {
      const j = (await r2.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
}

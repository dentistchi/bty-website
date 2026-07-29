"use client";

import type { WeeklySummary } from "@/lib/bty/daily/weeklyActivity.server";

/**
 * Stale-while-refresh cache for the Me weekly SUMMARY (Slice 3.2C-B3A.2D-R3). A per-session client
 * singleton: `me-home` unmounts when a nested Me view opens, so component-local state is lost on
 * bottom-Me reselect (remount) — which previously blanked Forge Stage / weekly values and flashed
 * "A quiet week so far." before the refetch. Seeding initial state from here keeps the last
 * successful values visible while a background refresh runs, and retains them on refresh failure.
 *
 * Session-scoped is correct: account switch / sign-out reload the document, resetting the module.
 *
 * R4 (3.2F-EVENT-PARTICIPANT-R4): the weekly DETAIL cache was removed with the redundant weekly
 * popup — only the summary (consumed by the static This Week card) is cached now.
 */

let cachedSummary: WeeklySummary | null = null;

export function getCachedSummary(): WeeklySummary | null {
  return cachedSummary;
}
export function setCachedSummary(s: WeeklySummary): void {
  cachedSummary = s;
}
/** Test-only reset (module singleton persists across tests otherwise). */
export function clearWeeklyActivityCache(): void {
  cachedSummary = null;
}

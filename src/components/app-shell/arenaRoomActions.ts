import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";
import { validateArenaScenarioDraft } from "@/domain/foundry/arena-draft/validate";

/**
 * Native in-shell Arena Practice — network orchestration (Slice 3.0C-1).
 *
 * Pure w.r.t. an injected `fetchFn`, so the start/complete CONTRACT is testable in
 * the Node test env without a DOM. `ArenaRoom` (the React component) owns view
 * state and calls these; there is NO router / navigation / window.location here or
 * in ArenaRoom — every transition is local React state.
 *
 * Only the published-practice endpoints are called. No /api/arena/run, no XP, no
 * canonical Arena run, no user_scenario_history.
 */

export type FetchFn = typeof fetch;

export type PlayablePractice = {
  id: string;
  practice_title: string;
  source_training_title: string;
  source_module_version: number;
  scenario: ArenaScenarioDraft;
};

export type AvailablePractice = {
  id: string;
  practice_title: string;
  source_training_title: string;
  completed: boolean;
};

const PRACTICE_LIST_URL = "/api/arena/practice";
const practiceUrl = (id: string) => `/api/arena/practice/${encodeURIComponent(id)}`;

/** Bounded list fetch. Distinguishes ok(list) from error so the UI never shows an error as empty. */
export async function fetchPracticeList(
  fetchFn: FetchFn,
  signal?: AbortSignal,
): Promise<{ ok: true; practices: AvailablePractice[] } | { ok: false }> {
  try {
    const res = await fetchFn(PRACTICE_LIST_URL, { credentials: "include", cache: "no-store", signal });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { practices?: AvailablePractice[] };
    return { ok: true, practices: Array.isArray(data.practices) ? data.practices : [] };
  } catch {
    return { ok: false };
  }
}

export type StartResult =
  | { ok: true; practice: PlayablePractice; runId: string }
  | { ok: false; reason: "snapshot_unavailable" | "snapshot_invalid" | "start_failed" };

/**
 * START CONTRACT (not best-effort): load + validate the immutable snapshot, then
 * POST start and require a valid run id. Playing begins ONLY on full success.
 * Duplicate taps resolve idempotently through the start endpoint (an in-progress
 * run resumes and returns its id).
 */
export async function startPractice(
  fetchFn: FetchFn,
  practiceId: string,
  signal?: AbortSignal,
): Promise<StartResult> {
  // 1. snapshot
  let practice: PlayablePractice;
  try {
    const res = await fetchFn(practiceUrl(practiceId), { credentials: "include", cache: "no-store", signal });
    if (!res.ok) return { ok: false, reason: "snapshot_unavailable" };
    const data = (await res.json()) as { practice?: PlayablePractice };
    if (!data.practice?.scenario) return { ok: false, reason: "snapshot_unavailable" };
    practice = data.practice;
  } catch {
    return { ok: false, reason: "snapshot_unavailable" };
  }

  // 2. validate the playable snapshot (server already validated at publish; this is
  //    a client integrity gate so a malformed snapshot never enters the player).
  if (!validateArenaScenarioDraft(practice.scenario).ok) return { ok: false, reason: "snapshot_invalid" };

  // 3. start — must succeed AND return a run id before playing.
  try {
    const res = await fetchFn(`${practiceUrl(practiceId)}/start`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, reason: "start_failed" };
    const data = (await res.json()) as { run_id?: string };
    if (!data.run_id) return { ok: false, reason: "start_failed" };
    return { ok: true, practice, runId: data.run_id };
  } catch {
    return { ok: false, reason: "start_failed" };
  }
}

/** Persist completion. Idempotent server-side. Returns ok only on an honest success response. */
export async function completePractice(
  fetchFn: FetchFn,
  practiceId: string,
  runId: string,
): Promise<{ ok: boolean }> {
  try {
    const res = await fetchFn(`${practiceUrl(practiceId)}/complete`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

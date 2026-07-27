"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import AppTabBar, { type AppTabKey } from "@/components/app-shell/AppTabBar";
import AccountBlock from "@/components/app-shell/AccountBlock";
import { resolveInitialAppTab } from "@/components/app-shell/initialTab";
import { parseHostDeepLink, type HostFocusSection } from "@/components/app-shell/hostDeepLink";
import FoundryEventRooms from "@/components/foundry/event-rooms/FoundryEventRooms";
import FoundryCompletionReview from "@/components/foundry/event-rooms/FoundryCompletionReview";
import FoundryMyLearning from "@/components/foundry/event-rooms/FoundryMyLearning";
import FoundryFollowUpResponse from "@/components/foundry/event-rooms/FoundryFollowUpResponse";
import CenterRealityFeed from "@/components/center/CenterRealityFeed";
import TodayHome from "@/components/app-shell/TodayHome";
import LearnHeader from "@/components/app-shell/LearnHeader";
import PracticeLanding from "@/components/app-shell/PracticeLanding";
import HostActionReviewDetail from "@/components/app-shell/HostActionReviewDetail";
import FieldActionForm from "@/components/app-shell/FieldActionForm";
import MeOrbDoor from "@/components/app-shell/MeOrbDoor";
import MeThisWeek from "@/components/app-shell/MeThisWeek";
import MeThisWeekDetail from "@/components/app-shell/MeThisWeekDetail";
import { fetchMeWeeklyRhythm, type MeWeeklyRhythm } from "@/components/app-shell/meWeeklyRhythm";
import type { TodayConfidence, TodayIntelligence, TodayUserState } from "@/domain/daily/todayIntelligence";
import {
  focusFromRelationship,
  relationshipFromFocus,
  type RelationshipValue,
  type TodayCommitment,
} from "@/domain/daily/todayRelationshipCommitment";

/**
 * New BTY Daily App Shell — v1 (Phase 3 Today wire + A/A+ ritual beat).
 *
 * Mobile-first, full-height, app-native (no desktop top nav, no legacy
 * HubTopNav / ArenaLayoutShell / CenterLayoutShell / ScreenShell). FOUR visible
 * tabs (App Shell + Today Simplification V1) — Today · Learn · Practice · Me —
 * switch locally (in-component state), no navigation to legacy routes, no iframes.
 * The prior five developer-facing domains map beneath them: Learn = Foundry,
 * Practice = Arena + Field Actions, and Center/Recovery folds into Me. Canonical
 * internal names/routes/engines are unchanged; translated only at this UI layer.
 *
 * Today consumes REAL deterministic data from GET /api/me/today-intelligence
 * (bands / narrative only — never confidence numerics or reason-code tokens).
 * Choosing a relationship reveals an in-shell confirmation: the user's own open
 * promise (action_text from /api/bty/my-page/state, or a calm fallback line) plus a
 * "Carry this into today" CTA that settles the choice — no navigation, no persistence.
 * The other four tabs are locked rooms: prepared, not broken (content = P4).
 *
 * Layout is a flex column so the tab bar is a real child,
 * never floating — content can never be occluded. Safe-area insets are handled
 * top (status bar) and bottom (home indicator).
 */

type Locale = "en" | "ko";

/** The three relationship cards on Today map onto the derived relationshipFocus. */
export type TodayFocusKey = "Self" | "Others" | "World";

type RoomCopy = { tag: string; body: string };

type Copy = {
  appAria: string;
  today: {
    /** SSR-safe default greeting (morning). The rendered greeting is resolved to a local-time
     *  band after mount (see {@link pickGreeting}); this stays the server/first-paint value. */
    title: string;
    /** Time-aware greeting bands (Today Arrival Warmth STEP 1) — client-local hour → band. */
    greetings: { morning: string; afternoon: string; evening: string; lateNight: string };
    sub: string;
    /** Each door: `noun` = the BTY ontology label (quiet eyebrow) · `action` = the lived daily
     *  choice (primary, visually strongest). `focus` (self/others/world) is the unchanged internal
     *  key. `select`/benediction are protected interior copy. */
    // `tab` here is RETIRED reserved copy for the removed three-door relationship surface
    // (TodaySurface, preserved for isolated tests, not rendered). It intentionally keeps the
    // legacy relationship-door keys and is decoupled from the live 4-tab AppTabKey.
    cards: { noun: string; action: string; tab: "center" | "arena" | "foundry"; focus: TodayFocusKey; select: string }[];
    /** Confirmation-card sublabels — reuse the locked-room eyebrow tone (no new style). */
    pathLabel: string;
    promiseLabel: string;
    /** In-shell settle CTA: pre-press (cta, strong) → settled (ctaDone, sunk). */
    cta: string;
    ctaDone: string;
    /** Chosen Path Rest State (STEP 3): present-tense benediction that REPLACES the
     *  select-line after confirmation. Per-focus; fallback guarantees it never renders blank. */
    benediction: { Self: string; Others: string; World: string; fallback: string };
    /** Center Promise Loop STEP 1B: the quiet self-owned keep surfaced (read-only) below the
     *  relationship section. Deliberately distinct from the Arena promise (promiseLabel). */
    centerKeep: { label: string; support: string };
  };
  center: RoomCopy;
  arena: RoomCopy;
  foundry: RoomCopy;
  me: RoomCopy;
};

export type TodayCopy = Copy["today"];

export const COPY: Record<Locale, Copy> = {
  en: {
    appAria: "BTY Daily app",
    today: {
      title: "Good morning.",
      greetings: {
        morning: "Good morning.",
        afternoon: "Good afternoon.",
        evening: "Good evening.",
        lateNight: "Still awake?",
      },
      sub: "Where will you show up today?",
      cards: [
        { noun: "SELF", action: "Return to myself", tab: "center", focus: "Self", select: "Self — Return to yourself with honesty." },
        { noun: "OTHERS", action: "Be there for someone", tab: "arena", focus: "Others", select: "Others — Carry care into one relationship." },
        { noun: "WORLD", action: "Move what matters forward", tab: "foundry", focus: "World", select: "World — Build with stewardship today." },
      ],
      pathLabel: "TODAY'S PATH",
      promiseLabel: "PROMISE TO CARRY",
      cta: "I’ll live this relationship today",
      ctaDone: "I’m living this relationship today",
      benediction: {
        Self: "You have entered the relationship with yourself today.",
        Others: "You have entered the relationship with others today.",
        World: "You have entered the relationship with the world today.",
        fallback: "You have entered this relationship for today.",
      },
      centerKeep: { label: "Held in Center", support: "Carry it quietly today." },
    },
    // Locked rooms (Commander-authored). Tone: prepared, not broken. No "Soon".
    center: { tag: "Relationship with Self", body: "A quiet space for recovery is being prepared." },
    arena: { tag: "Relationship with Others", body: "Your decision training space is being prepared." },
    foundry: { tag: "Relationship with the World", body: "Your craft and creation space is being prepared." },
    me: { tag: "Your leadership identity", body: "Your current path will gather here." },
  },
  ko: {
    appAria: "BTY Daily 앱",
    today: {
      title: "좋은 아침입니다.",
      greetings: {
        morning: "좋은 아침입니다.",
        afternoon: "좋은 오후입니다.",
        evening: "좋은 저녁입니다.",
        lateNight: "아직 깨어 계시군요.",
      },
      sub: "오늘, 어디에 마음을 둘까요?",
      cards: [
        { noun: "나", action: "나에게 돌아오기", tab: "center", focus: "Self", select: "나와의 관계 — 정직하게 자신에게 돌아갑니다." },
        { noun: "이웃", action: "누군가의 곁에 서기", tab: "arena", focus: "Others", select: "이웃과의 관계 — 한 관계 안으로 조심스럽게 들어갑니다." },
        { noun: "세상", action: "중요한 일을 한 걸음 앞으로", tab: "foundry", focus: "World", select: "세상과의 관계 — 맡겨진 것을 오늘도 빚어갑니다." },
      ],
      pathLabel: "오늘의 길",
      promiseLabel: "오늘로 가져갈 약속",
      cta: "오늘 이 관계로 살아갑니다",
      ctaDone: "오늘 이 관계 안에 있습니다",
      benediction: {
        Self: "오늘 당신은 나와의 관계 안으로 들어갔습니다.",
        Others: "오늘 당신은 이웃과의 관계 안으로 들어갔습니다.",
        World: "오늘 당신은 세상과의 관계 안으로 들어갔습니다.",
        fallback: "오늘 당신은 이 관계 안에 머뭅니다.",
      },
      centerKeep: { label: "센터에 붙잡은 한 줄", support: "오늘 조용히 가지고 갑니다." },
    },
    center: { tag: "나와의 관계", body: "회복을 위한 고요한 공간을 준비하고 있습니다." },
    arena: { tag: "이웃과의 관계", body: "당신의 결정 훈련 공간을 준비하고 있습니다." },
    foundry: { tag: "세상과의 관계", body: "당신의 창작과 만듦의 공간을 준비하고 있습니다." },
    me: { tag: "당신의 리더십 정체성", body: "당신이 지금 걷고 있는 길이 이곳에 모입니다." },
  },
};

/**
 * userState → calm, human status line for Today. Narrative only (no scores, no
 * reason codes, no verdicts). Every TodayUserState the server can emit is covered so
 * the line never falls through to a blank.
 */
const TODAY_STATUS: Record<Locale, Record<TodayUserState, string>> = {
  en: {
    new_user: "Welcome. Today begins with a clean page.",
    clean_start: "A clean start. Choose where today begins.",
    returning_no_yesterday_activity: "Welcome back. Today is open.",
    pending_action: "Something you began is still waiting. Continue when you are ready.",
    missed_action: "Yesterday passed quietly. Today is open.",
    verified_action: "You followed through. Carry it into today.",
    scenario_signal: "Yesterday left a trace worth noticing.",
    safe_fallback: "Today is open. Choose the relationship you will live.",
  },
  ko: {
    new_user: "환영합니다. 오늘은 깨끗한 한 페이지에서 시작합니다.",
    clean_start: "깨끗한 시작입니다. 오늘을 어디에서 시작할지 고르세요.",
    returning_no_yesterday_activity: "다시 오셨네요. 오늘이 열려 있습니다.",
    pending_action: "시작해 둔 것이 아직 기다리고 있습니다. 준비되면 이어가세요.",
    missed_action: "어제는 조용히 지나갔습니다. 오늘은 열려 있습니다.",
    verified_action: "끝까지 해내셨습니다. 오늘로 이어가세요.",
    scenario_signal: "어제가 살펴볼 만한 흔적을 남겼습니다.",
    safe_fallback: "오늘이 열려 있습니다. 오늘 살아낼 관계를 고르세요.",
  },
};

/** Calm clean-open brief used when the read fails or the user is not yet resolved. */
export const FALLBACK_INTEL: TodayIntelligence = {
  userState: "safe_fallback",
  relationshipFocus: "CleanStart",
  confidence: "none",
  reasonCodes: [],
  fallbackMode: "read_error",
};

/**
 * Narrow read of GET /api/bty/my-page/state — ONLY the user's open promise text. The
 * banned fields (metrics.*, signals[], pattern_signatures[], stageName verdict, counts)
 * are deliberately NOT typed here so they cannot be destructured, read, or rendered.
 */
type MyPageStateNarrow = {
  open_action_contract: { action_text: string | null } | null;
};

/**
 * Read GET /api/me/today-intelligence as JSON, fail-soft to {@link FALLBACK_INTEL}.
 * Uses RAW fetch (same-origin, cookie credentials) — NOT arenaFetch, which is
 * path-guarded to /api/arena/* and would throw on /api/me/* before any request
 * (Today Intelligence v1 lesson: that throw is a total silent failure). Every
 * fallback path emits a developer-visible console.warn (browser + Capacitor→Xcode)
 * so a transport failure can never masquerade as a legitimate quiet day.
 */
export async function fetchTodayIntelligence(): Promise<TodayIntelligence> {
  try {
    const res = await fetch("/api/me/today-intelligence", { credentials: "include" });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    return (await res.json()) as TodayIntelligence;
  } catch (e) {
    console.warn(
      "[app-shell/today] /api/me/today-intelligence fell back:",
      e instanceof Error ? e.message : e,
    );
    return FALLBACK_INTEL;
  }
}

/**
 * Read the user's open promise (action_text) from GET /api/bty/my-page/state. RAW fetch —
 * /api/bty/* is ALSO path-guarded out of arenaFetch (same trap). Narrow-typed: only
 * open_action_contract.action_text is read; every other field of the payload is ignored.
 * Returns null (→ fallback ritual line) on any failure, empty text, or no open contract,
 * with a developer-visible warn. Never invents a promise.
 */
export async function fetchOpenPromise(locale: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/bty/my-page/state?locale=${encodeURIComponent(locale)}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const data = (await res.json()) as MyPageStateNarrow;
    const text = data.open_action_contract?.action_text;
    return typeof text === "string" && text.trim().length > 0 ? text.trim() : null;
  } catch (e) {
    console.warn(
      "[app-shell/today] /api/bty/my-page/state promise fell back:",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * Read the user's Center daily keep (Center Promise Loop STEP 1B) from GET /api/bty/center/keep.
 * Surfaced on Today READ-ONLY — Today never writes/edits the keep (Center owns the write flow).
 * Returns the saved line ONLY when keptToday is true (else null → nothing renders). The device tz
 * is sent for server-side day-boundary resolution (capture-only; NO client day-key, NO localStorage).
 * This is NOT the Arena promise (that is action_text via {@link fetchOpenPromise}) and NOT
 * bty_action_contracts. Fail-soft: any failure → null, with a developer-visible warn.
 */
export async function fetchTodayCenterKeep(): Promise<string | null> {
  let tz: string | null = null;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    tz = null;
  }
  try {
    const res = await fetch(`/api/bty/center/keep${tz ? `?tz=${encodeURIComponent(tz)}` : ""}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const data = (await res.json()) as { line?: string | null; keptToday?: boolean };
    return data.keptToday && typeof data.line === "string" && data.line.trim().length > 0
      ? data.line.trim()
      : null;
  } catch (e) {
    console.warn(
      "[app-shell/today] /api/bty/center/keep fell back:",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * Read the user's Yesterday → Today memory line (Memory Bridge V1) from GET
 * /api/me/today/yesterday-memory. Returns the one remembered line ONLY when yesterday held a real
 * commitment (else null → the existing arrival trace renders unchanged). The device tz is sent for
 * server-side day-boundary resolution (05:00-local, capture-only; NO client day-key). Read-only,
 * evidence-backed — the server is the sole source of truth. Fail-soft: any failure → null.
 */
export async function fetchYesterdayMemory(): Promise<string | null> {
  let tz: string | null = null;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    tz = null;
  }
  try {
    const res = await fetch(
      `/api/me/today/yesterday-memory${tz ? `?tz=${encodeURIComponent(tz)}` : ""}`,
      { credentials: "include" },
    );
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const data = (await res.json()) as { memory?: { line?: string | null } | null };
    const line = data.memory?.line;
    return typeof line === "string" && line.trim().length > 0 ? line.trim() : null;
  } catch (e) {
    console.warn(
      "[app-shell/today] /api/me/today/yesterday-memory fell back:",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * The Me-tab weekly rhythm read now lives behind an explicit PROVENANCE BOUNDARY
 * ({@link fetchMeWeeklyRhythm} in ./meWeeklyRhythm) — the single, named, swappable seam where the
 * (temporary) Arena weekly-stats coupling is isolated. The Me tab depends on MeWeeklyRhythm, never
 * on Arena, so re-sourcing to a Center/self daily-trace source is a one-place change there.
 * `fetchWeeklyRhythm` is kept as a thin re-export for the existing call site / any importer.
 */
export const fetchWeeklyRhythm = fetchMeWeeklyRhythm;

/**
 * Native Today self-return capture (Center Daily Trace STEP 1A).
 *
 * Fire-and-forget POST to the EXISTING /api/me/day/open flow (server-side {@link ensureUserDay})
 * when the native app Today surface is reached, so a quiet self-RETURN is recorded server-side in
 * `user_day` — the future Center/self-owned WeeklyOrb source. This is the native counterpart of the
 * legacy /today day-open call; native Today did not previously populate user_day.
 *
 * Contract:
 *  - Sends the device IANA tz for capture ONLY. The canonical day-key, UTC fallback, and
 *    idempotency (one row per user/day, ON CONFLICT DO NOTHING) are ALL resolved server-side —
 *    NO client day-key logic, NO localStorage.
 *  - Best-effort: unauthenticated (route returns 200 {ok:false}) or any transport failure is
 *    swallowed and never blocks, alters, or is visible on Today.
 *  - Records only — renders nothing, changes no UI, and is not tied to Orb timing (the Orb lives
 *    on /start). Does NOT re-source WeeklyOrb (that still reads the meWeeklyRhythm temporary carrier).
 */
export function recordNativeSelfReturn(): void {
  let tz: string | null = null;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    tz = null;
  }
  void fetch("/api/me/day/open", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ tz }),
  }).catch(() => {});
}

function deviceTz(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/**
 * Today Relationship Commitment (V1) — outcome of a CTA confirm POST.
 *  - "committed": BTY durably holds this relationship for today (fresh insert OR an existing row
 *    with the SAME relationship). `focus` = the canonical committed door.
 *  - "locked": a DIFFERENT relationship was already committed today; `focus` = the server's canonical
 *    door, so the client restores truth instead of the just-tapped door.
 *  - "failed": no server acknowledgement (transport/persistence). The CTA must stay retryable and
 *    NEVER fabricate a confirmation.
 */
export type TodayCommitOutcome =
  | { status: "committed"; focus: TodayFocusKey }
  | { status: "locked"; focus: TodayFocusKey }
  | { status: "failed" };

/**
 * POST the confirmed relationship to /api/me/today/commit. Server-authoritative + insert-only;
 * this never calls any AI/generation surface. Maps HTTP → {@link TodayCommitOutcome}:
 *   201 / 200 → committed · 409 COMMITMENT_LOCKED → locked (canonical from server) · else → failed.
 */
export async function postTodayCommitment(
  focus: TodayFocusKey,
  suggestedFocus: TodayFocusKey | null,
  locale: string,
): Promise<TodayCommitOutcome> {
  try {
    const res = await fetch("/api/me/today/commit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        relationship: relationshipFromFocus(focus),
        suggestedRelationship: suggestedFocus ? relationshipFromFocus(suggestedFocus) : null,
        locale,
        timeZone: deviceTz(),
      }),
    });
    const data = (await res.json().catch(() => null)) as
      | { commitment?: TodayCommitment | null }
      | null;
    const canonical = data?.commitment?.relationship as RelationshipValue | undefined;
    if (res.status === 409) {
      // Locked to a different relationship — restore the server's canonical door.
      return canonical
        ? { status: "locked", focus: focusFromRelationship(canonical) }
        : { status: "failed" };
    }
    if (res.ok && canonical) return { status: "committed", focus: focusFromRelationship(canonical) };
    return { status: "failed" };
  } catch (e) {
    console.warn(
      "[app-shell/today] /api/me/today/commit POST failed:",
      e instanceof Error ? e.message : e,
    );
    return { status: "failed" };
  }
}

/**
 * Read the user's commitment for today's canonical BTY day (GET /api/me/today/commit). Used to
 * REHYDRATE the confirmed terminal state on mount so a refresh / route re-entry / native cold launch
 * restores truth. Fail-soft → null (→ the normal uncommitted arrival). Never calls generation.
 */
export async function fetchTodayCommitment(): Promise<TodayCommitment | null> {
  try {
    const tz = deviceTz();
    const res = await fetch(`/api/me/today/commit${tz ? `?tz=${encodeURIComponent(tz)}` : ""}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const data = (await res.json()) as { commitment?: TodayCommitment | null };
    return data.commitment ?? null;
  } catch (e) {
    console.warn(
      "[app-shell/today] /api/me/today/commit GET fell back:",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * Today Living Response (V1) — one short perspective for today's committed relationship. The client
 * NEVER generates; it only reads the server's settled/pending view. `status` ∈ pending|ready|fallback;
 * only ready/fallback carry a `perspective` line (pending renders nothing). No provider call here.
 */
export type LivingResponseView = {
  status: "pending" | "ready" | "fallback";
  relationship: "self" | "others" | "world";
  perspective: string | null;
  source: "generated" | "fallback" | null;
  confidence: "grounded" | "limited" | null;
};

/** Fire the Living Response POST AFTER commitment confirmation (never blocks/undoes the commit). */
export async function postLivingResponse(): Promise<LivingResponseView | null> {
  try {
    const res = await fetch("/api/me/today/living-response", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ timeZone: deviceTz() }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { response?: LivingResponseView | null };
    return data.response ?? null;
  } catch (e) {
    console.warn("[app-shell/today] living-response POST failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Restore today's settled/pending Living Response on mount (same-day re-entry). No generation. */
export async function fetchLivingResponse(): Promise<LivingResponseView | null> {
  try {
    const tz = deviceTz();
    const res = await fetch(`/api/me/today/living-response${tz ? `?tz=${encodeURIComponent(tz)}` : ""}`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { response?: LivingResponseView | null };
    return data.response ?? null;
  } catch (e) {
    console.warn("[app-shell/today] living-response GET fell back:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * relationshipFocus is a CLAIM only when confidence !== "none" (domain lock). At "none"
 * — or for the non-relationship focuses (CleanStart / ContinuePending) — no card is
 * suggested and Today reads neutral.
 */
export function resolveActiveFocus(intel: TodayIntelligence): TodayFocusKey | null {
  if (intel.confidence === "none") return null;
  const f = intel.relationshipFocus;
  return f === "Self" || f === "Others" || f === "World" ? f : null;
}

/**
 * Invitation-strength gate (Invitation Strength Alignment STEP 1). A derived relationshipFocus is
 * only strong enough to earn the VISUAL AUTHORITY of the invited door (gold ring + "begin here"
 * heartbeat) at MEDIUM or HIGH confidence. At NONE/LOW the focus stays present in the intelligence
 * payload (never mutated) but Today shows three equal, open doors — the app does not project
 * certainty it has not earned. Same evidence→authority principle as generation admission (LOW is
 * diagnostic-only, never a claim the user is nudged to act on).
 */
export function isEvidenceStrongEnoughForInvitation(confidence: TodayConfidence): boolean {
  return confidence === "medium" || confidence === "high";
}

/**
 * The relationship to VISUALLY INVITE (invited-door treatment), or null. Combines the derived focus
 * claim (resolveActiveFocus) with the invitation-strength gate: NONE/LOW → null (no invited door,
 * no heartbeat), MEDIUM/HIGH → the derived focus. Never touches relationshipFocus or the payload.
 */
export function resolveInvitedFocus(intel: TodayIntelligence): TodayFocusKey | null {
  return isEvidenceStrongEnoughForInvitation(intel.confidence) ? resolveActiveFocus(intel) : null;
}

/** Pick the calm status line for the derived userState. */
export function selectTodayStatus(loc: Locale, userState: TodayUserState): string {
  return TODAY_STATUS[loc][userState];
}

/**
 * Local-hour → greeting band. Bands (client-local time): morning 05:00–11:59,
 * afternoon 12:00–16:59, evening 17:00–22:59, late night 23:00–04:59. Pure.
 */
export type GreetingBand = "morning" | "afternoon" | "evening" | "lateNight";
export function greetingBand(hour: number): GreetingBand {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 23) return "evening";
  return "lateNight";
}

/** Resolve the time-aware greeting from a locale's greeting record + a local hour. Pure. */
export function pickGreeting(greetings: TodayCopy["greetings"], hour: number): string {
  return greetings[greetingBand(hour)];
}

/**
 * Three-door affordance timing. One restrained FULL-DOOR bloom per door, staggered in DOM order,
 * one pass only: ~500ms per door, 250ms between → ~1000ms total (AFFORDANCE_TOTAL_MS).
 *
 * VISIBILITY CORRECTION: the bloom must not start at mount — the doors are still fading/rising in
 * (btyFadeIn 700ms + per-door btyRise: last door riseDelay 500ms + 800ms duration ≈ 1300ms settle),
 * so a mount-anchored bloom plays UNDERNEATH the arrival and finishes before the cards are still —
 * invisible on device. The sequence now starts only AFTER the arrival has settled (≈1300ms) plus a
 * short still breath (~350ms) → AFFORDANCE_START_MS, so the user sees: Today arrives → still →
 * Self → Others → World bloom on already-settled cards.
 */
// SENSORY OVERREACH V1: three readable moments. Each active door is a full ~700ms illumination,
// staggered ~480ms so Self → Others → World are individually identifiable (traveling light).
export const AFFORDANCE_DOOR_MS = 700;
export const AFFORDANCE_GAP_MS = 480;
export const AFFORDANCE_TOTAL_MS = AFFORDANCE_GAP_MS * 2 + AFFORDANCE_DOOR_MS; // 3 doors → 1660ms
/** When the last door has finished its arrival rise (last riseDelay 500ms + btyRise 800ms). */
export const AFFORDANCE_ARRIVAL_SETTLE_MS = 1300;
/** A brief still moment after the cards settle, so the map is perceived before the bloom begins. */
export const AFFORDANCE_STILL_BREATH_MS = 350;
/** Delay from TodaySurface mount to the first door's bloom (arrival settle + still breath). */
export const AFFORDANCE_START_MS = AFFORDANCE_ARRIVAL_SETTLE_MS + AFFORDANCE_STILL_BREATH_MS; // 1650ms

/** ARRIVAL ORDER PATCH V1 — bounded backstop for the yesterday-memory read. The Today arrival waits
 *  for memory so the remembered line is present when the cascade plays (Greeting → Memory → doors);
 *  a normal read (a couple indexed point-lookups, parallel with the commitment read) clears well
 *  before this. If the read is pathologically slow, Today still arrives at the cap (memory simply
 *  absent this arrival) so the greeting is never held longer than this. */
export const MEMORY_ARRIVAL_CAP_MS = 900;

function SurfaceHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    // Greeting + sub read as ONE identity unit: the sub is demoted (smaller + quieter, tucked
    // close under the greeting) so it no longer competes with the day's status whisper below.
    // Copy unchanged.
    <header className="btyRise mb-5 space-y-1.5" style={{ animationDelay: "40ms" }}>
      <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-white">{title}</h1>
      {sub ? <p className="text-sm leading-5 text-white/45">{sub}</p> : null}
    </header>
  );
}

/**
 * A locked room — prepared, not broken. Relationship tag (eyebrow) + a single calm
 * "being prepared" line, centered. No badge, no links, no explanation.
 */
function LockedRoom({ tag, body }: { tag: string; body: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-2 text-center">
      <span className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">{tag}</span>
      <p className="max-w-[18rem] text-[0.95rem] leading-6 text-white/60">{body}</p>
    </div>
  );
}

// THE HELD ARC V0.1 — minimalism A/B. A narrow, reversible PROTOTYPE switch: NOT a
// feature-flag framework, NO env var, NO DB field, NO user preference, NO exposed UI
// toggle. Default is "anchor-only" — the secondary release line is removed from the DOM
// entirely (never hidden behind reserved height). Flip this one constant to restore
// Variant B (the comparison baseline) with no other change. Production ships anchor-only.
type HeldInCenterVariant = "anchor-only" | "anchor-with-release";
const HELD_IN_CENTER_VARIANT: HeldInCenterVariant = "anchor-only";

export function TodaySurface({
  copy,
  statusLine,
  yesterdayMemory = null,
  activeFocus,
  loading,
  promiseText,
  centerKeepLine,
  selected: selectedProp,
  setSelected: setSelectedProp,
  confirmed: confirmedProp,
  setConfirmed: setConfirmedProp,
  onConfirm,
  livingResponse,
  animateLivingArrival = false,
  onLivingArrivalEnd,
  firstArrival = false,
  onArrivalConsumed,
  heldVariant = HELD_IN_CENTER_VARIANT,
}: {
  copy: TodayCopy;
  /** Calm narrative status line derived from userState (already localized). */
  statusLine: string;
  /** Yesterday → Today Memory Bridge V1: the one evidence-backed remembered line (from yesterday's
   *  real commitment), or null → the existing statusLine renders unchanged. When present it OCCUPIES
   *  the SAME arrival-trace slot as statusLine (single line, same typography) — a promotion of the
   *  existing trace, never a second trace. English-only (V1 scope).
   *
   *  ARRIVAL ORDER PATCH V1: the shell resolves memory BEFORE this surface mounts (its existing
   *  hydration hold now also awaits the memory read, bounded), so when a memory exists it is present
   *  at first paint and rides the trace's own arrival beat (btyRise @200ms) — ahead of the doors
   *  (@300ms+) — instead of arriving late after a separate fetch. The trace therefore no longer waits
   *  on the intel read when a memory exists: memory shows immediately in its beat; only the generic
   *  status line still waits for intel (unchanged for no-memory users). */
  yesterdayMemory?: string | null;
  /** The relationship to SUGGEST (derived), or null when there is no confident claim. */
  activeFocus: TodayFocusKey | null;
  loading: boolean;
  /** The user's own open promise sentence to carry into today, or null (→ fallback line). */
  promiseText: string | null;
  /** STEP 1B: the self-owned Center keep for today (read-only), or null → nothing renders. */
  centerKeepLine: string | null;
  /** Post-confirm settling (STEP 1) — selection + confirmation LIFTED to the shell so they
   *  survive a same-session tab switch (BtyDailyAppShell owns them; in-memory only — no storage,
   *  no API, no cold-launch persistence). CONTROLLED when provided; when absent (isolated render /
   *  unit tests) TodaySurface falls back to owning the state locally, so it still works standalone. */
  selected?: TodayFocusKey | null;
  setSelected?: (focus: TodayFocusKey | null) => void;
  confirmed?: boolean;
  setConfirmed?: (confirmed: boolean) => void;
  /** Durable commit hook (Today Relationship Commitment V1). When provided, the CTA POSTs the
   *  confirmed relationship and enters the terminal state ONLY on server acknowledgement (resolving
   *  true); the shell owns the canonical selected/confirmed flip. Absent in isolated/unit renders,
   *  where the CTA falls back to the in-memory setConfirmed(true) so standalone tests still pass. */
  onConfirm?: (focus: TodayFocusKey) => Promise<boolean>;
  /** Today Living Response (V1): the settled/pending perspective for the committed relationship.
   *  Only status ready|fallback carries a `perspective` line; pending (or null) renders nothing. */
  livingResponse?: LivingResponseView | null;
  /** Presence V1.1: true ONLY when this line is a FIRST-generation arrival (user committed this
   *  session and the perspective just resolved) → play the pause+rise reveal once. Restore /
   *  tab-return / cold-launch / re-render leave it false → the line renders immediately at rest. */
  animateLivingArrival?: boolean;
  /** Called on the arrival animation end so the shell consumes the one-shot (no replay on remount). */
  onLivingArrivalEnd?: () => void;
  /** True only on the FIRST Today mount of a shell session — plays the one-time three-door
   *  affordance sequence and defers the evidence invitation until after it. Default false
   *  (isolated renders / tab-returns paint at rest with the invitation immediate). */
  firstArrival?: boolean;
  /** Called once on mount so the shell can mark the session affordance consumed (no replay). */
  onArrivalConsumed?: () => void;
  /** THE HELD ARC V0.1 minimalism A/B. Defaults to the module const (anchor-only in
   *  production). Overridable only so the comparison baseline (Variant B) stays testable —
   *  not exposed in the UI, not persisted, not a user preference. */
  heldVariant?: HeldInCenterVariant;
}) {
  // Controlled (shell-owned) ↔ uncontrolled (local) resolution. In production the shell lifts the
  // state up so a brief tab visit no longer discards the accepted day; a cold launch / full remount
  // still resets it (intentional). The local fallback exists ONLY for isolated rendering.
  const [selectedLocal, setSelectedLocal] = useState<TodayFocusKey | null>(null);
  const [confirmedLocal, setConfirmedLocal] = useState(false);
  const selected = selectedProp !== undefined ? selectedProp : selectedLocal;
  const setSelected: (focus: TodayFocusKey | null) => void = setSelectedProp ?? setSelectedLocal;
  const confirmed = confirmedProp !== undefined ? confirmedProp : confirmedLocal;
  const setConfirmed: (confirmed: boolean) => void = setConfirmedProp ?? setConfirmedLocal;

  // `justOpened` is a TRANSIENT, component-local signal (NOT product state, NOT lifted): true only
  // after a fresh in-session selection so the interior open-animation (btyOpenRoom) plays once. On a
  // tab-return REMOUNT it starts false, so a RESTORED selection paints at rest — no open-animation
  // replay. It dies with the component; it is animation bookkeeping only, never persisted or lifted.
  const [justOpened, setJustOpened] = useState(false);

  // `committing` — a TRANSIENT, component-local pending flag while the durable commit POST is
  // in flight. Gates against double-submission and lets the CTA show a quiet inline pending
  // treatment (dim + disabled), never a spinner/toast. Not lifted, not persisted.
  const [committing, setCommitting] = useState(false);

  // Relationship selection is a deliberate ritual choice (A): tapping reveals the
  // confirmation + CTA in-shell. It does NOT navigate — the bottom tabs own room entry.
  const select = (focus: TodayFocusKey) => {
    setSelected(focus);
    setConfirmed(false);
    setJustOpened(true);
  };

  // Three-door affordance sequence (nonblocking arrival). `playArrival` is captured at MOUNT so a
  // later prop flip (the shell marks the session consumed) never interrupts a running sequence; a
  // tab-return remount reads firstArrival=false → paints at rest. reduced-motion is resolved
  // synchronously (lazy init) so the first paint is already correct — no one-frame animate→still.
  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [playArrival] = useState(firstArrival);
  const animateArrival = playArrival && !reducedMotion;

  // The bloom starts only AFTER Today has visibly arrived (arrival settle + still breath), never at
  // mount — otherwise it plays under the arrival fade/rise and is invisible on device. reduced-
  // motion / tab-return (animateArrival=false) never arm the timer, so no bloom ever appears there.
  const [affordanceStarted, setAffordanceStarted] = useState(false);
  useEffect(() => {
    if (!animateArrival) return;
    const id = setTimeout(() => setAffordanceStarted(true), AFFORDANCE_START_MS);
    return () => clearTimeout(id);
  }, [animateArrival]);

  // The evidence-backed invitation (gold ring / heartbeat) must not appear BEFORE the neutral
  // affordance is legible. On first animated arrival it is deferred until the sequence has both
  // STARTED and completed; otherwise (tab-return / reduced-motion) it is immediate. NONE/LOW have
  // no invited focus anyway.
  const [showInvitation, setShowInvitation] = useState(!animateArrival);
  useEffect(() => {
    if (!animateArrival) {
      setShowInvitation(true);
      return;
    }
    const id = setTimeout(() => setShowInvitation(true), AFFORDANCE_START_MS + AFFORDANCE_TOTAL_MS);
    return () => clearTimeout(id);
  }, [animateArrival]);

  // Mark the session affordance consumed on first mount so a tab-return does not replay it.
  useEffect(() => {
    onArrivalConsumed?.();
  }, [onArrivalConsumed]);

  // The invited door: the user's pick once made, else the softly-suggested derived focus — but the
  // system suggestion is withheld until the affordance sequence has played (showInvitation).
  const highlight = selected ?? (showInvitation ? activeFocus : null);
  // The one-time affordance illumination plays only during an animated first arrival, AFTER the
  // arrival has settled (affordanceStarted), and only before any selection. A tap before the start
  // (selected set first) means it never plays; a tap during it suppresses the remaining doors.
  const showAffordance = animateArrival && selected === null && affordanceStarted;

  // Time-aware greeting (Today Arrival Warmth STEP 1). SSR-safe: the server + first client
  // paint render the default morning greeting (copy.title) so hydration matches; after mount we
  // resolve the real local-time band from the device clock (client-local Date only — no API, no
  // timezone service, no storage). The 0.7s shell mount-fade masks the one-frame swap.
  const [greeting, setGreeting] = useState(copy.title);
  useEffect(() => {
    setGreeting(pickGreeting(copy.greetings, new Date().getHours()));
  }, [copy]);

  return (
    <>
      <SurfaceHeader title={greeting} sub={copy.sub} />
      {/* The yesterday-trace sentence — the arrival beat (STEP 4/5). It is the emotional bridge
          between the greeting and the doors, so it is ELEVATED: a touch larger + brighter than
          body copy and given its own breathing room (an "arrival zone" above the doors), yet
          still quiet — no gold, no number, no verdict. It is the SECOND beat of the cascade —
          it AND the doors both key their btyRise off content-ready (the moment loading clears),
          so the trace ALWAYS rises before the doors regardless of fetch latency (STEP 5 fixes
          the STEP-4 inversion where the doors' mount-clock could beat the fetch-gated trace).
          Delay 260ms lands it just after the greeting; the doors follow at 720ms. While loading
          we reserve one line's height SILENTLY (no pulse/shimmer) so nothing jumps; when it
          resolves the sentence rises into the reserved space.

          MEMORY BRIDGE V1 + ARRIVAL ORDER PATCH V1: the shell has already resolved memory before
          this surface mounts, so a remembered line is present at first paint and rides THIS beat
          (btyRise @200ms) ahead of the doors — the emotional order Greeting → Memory → doors. The
          trace no longer waits on the intel read when a memory exists (memory shows in its beat);
          only the generic status line still reserves the line's height until intel settles
          (unchanged for no-memory users). Never a second trace, never a status→memory swap. */}
      {loading && !yesterdayMemory ? (
        <div aria-hidden className="mb-8 mt-0.5 h-7" />
      ) : (
        <p
          data-today-status
          data-today-memory={yesterdayMemory ? "" : undefined}
          className="btyRise mb-8 mt-0.5 text-[1.05rem] font-normal leading-7 text-white/85"
          style={{ animationDelay: "200ms" }}
        >
          {yesterdayMemory ?? statusLine}
        </p>
      )}
      {/* Three ritual doors — thresholds, not selector rows. Each has a luminous opening
          seam and an interior warmth that leans in when invited. Selecting a door "opens"
          it: the confirmation settles beneath as that door's interior (a sibling, never a
          nested button). Before confirm the other two dim; AFTER confirm (Chosen Path Rest
          State, STEP 3) they fade + collapse away entirely (grid-rows 1fr→0fr), leaving only
          the held door — the day now holds one relationship. Session-only: no persistence. */}
      {/* NONBLOCKING ARRIVAL (Three-Door Affordance STEP 1): the doors render IMMEDIATELY on mount
          and are fully interactive — they no longer wait for /api/me/today-intelligence. While the
          read is unresolved the state is the fail-soft neutral one (activeFocus null → no invited
          door, no ring, no heartbeat); the invited treatment can only appear later, after the
          neutral affordance, for a MEDIUM/HIGH result. No skeleton, spinner, or placeholder — the
          doors ARE the ritual, present from the first frame. */}
      {(
        <div className="relative isolate">
          {/* SCREEN-SPACE AURORA (V3.3 TRANSLATING LIGHT BLOBS): the V2/V3.1/V3.2 single-carrier
              design produced a TRAVELING rectangle on device — a sized `background-size` tile moved
              by `background-position` and rasterized by a carrier-level `filter: blur`. Replaced by a
              fully TRANSPARENT wrapper (positioning/stacking only — no bg, no filter, no mask, no
              overflow) holding two real light BLOBS. Each blob owns a full-element radial that fades
              to zero BEFORE its bounds via a transparent outer plateau (84%→100%), and TRAVELS by
              transform:translateY (Self→Others→World). No background tile, so no rectangle can appear.
              V3.3.2: the wrapper is inset-x-5 (20px each side) — a dedicated expansion RUNWAY so the
              oversized blobs' last visible alpha lands inside the viewport instead of at the screen
              edge. The cards keep their full page-aligned width; only this decorative field is inset. */}
          {showAffordance ? (
            <div data-aurora-wrapper aria-hidden className="pointer-events-none absolute inset-y-0 inset-x-5 z-0">
              {/* V3.3.1: NO filter anywhere. Softness comes entirely from a multi-stop radial with a
                  long alpha tail + a fully TRANSPARENT OUTER PLATEAU (84%→100%), so alpha is exactly
                  zero at every element boundary — four-sided safety by construction, no blur spread to
                  reason about. Both blobs share top-1/2 + h-full + the same btyAuroraTravel keyframe →
                  identical center-Y at Self/Others/World; only widths differ (cool is wider). */}
              <div
                data-aurora-gold
                className="btyAuroraTravel absolute inset-x-[-12.5%] top-1/2 h-full rounded-full"
                style={{
                  background:
                    "radial-gradient(closest-side, rgba(201,166,107,0.46) 0%, rgba(201,166,107,0.20) 40%, rgba(201,166,107,0.12) 54%, rgba(201,166,107,0.05) 66%, rgba(201,166,107,0.015) 76%, transparent 84%)",
                }}
              />
              <div
                data-aurora-cool
                className="btyAuroraTravel absolute inset-x-[-18%] top-1/2 h-full rounded-full"
                style={{
                  background:
                    "radial-gradient(closest-side, rgba(150,180,220,0.10) 0%, rgba(150,180,220,0.055) 38%, rgba(150,180,220,0.025) 56%, rgba(150,180,220,0.008) 72%, transparent 84%)",
                }}
              />
            </div>
          ) : null}
          {/* The descending left-edge "spine + spark" rail was REMOVED (Intuitive Door Language
              STEP 2): on device it read as a gold rail sliding down the left edge and MASKED the
              intended affordance while communicating nothing about choosing a door. The affordance
              is now a full-door bloom on each card (below); door identity is carried by the base
              threshold seam, which remains. */}
          {copy.cards.map((c, i) => {
          // Each door rises once on the animated first arrival; the affordance bloom (full-card
          // warmth + border + action-text lift) then blooms per door in DOM order.
          const riseDelay = 300 + i * 100;
          const affordDelay = i * AFFORDANCE_GAP_MS;
          const isHighlight = c.focus === highlight;
          const isSelected = c.focus === selected;
          // Before confirm: unselected doors quiet to 40%. After confirm: they are GONE.
          const isDimmed = selected !== null && !isSelected && !confirmed;
          const isGone = confirmed && !isSelected;
          return (
            <div
              key={c.focus}
              aria-hidden={isGone || undefined}
              // OUTER HALO lives on the grid cell (not the overflow-hidden card) so the glow can
              // extend OUTSIDE the door. Gated on showAffordance with the per-door stagger; ends at
              // no-shadow (settled state is calm). data-door-halo lets tests assert the layer.
              {...(showAffordance ? { "data-door-halo": "" } : {})}
              // relative z-10 → doors sit explicitly ABOVE the z-0 traveling atmosphere (V3 STEP 1).
              // A permanent soft float shadow (drop-shadow filter, not the clipped box-shadow) gives
              // the resting card material separation from the page — touchable before any animation.
              className={`relative z-10 grid transition-all duration-500 ease-out drop-shadow-[0_5px_14px_rgba(0,0,0,0.5)] ${showAffordance ? "btyHalo " : ""}${
                isGone ? "grid-rows-[0fr] mb-0 opacity-0" : "grid-rows-[1fr] mb-3 opacity-100"
              }`}
              style={showAffordance ? { animationDelay: `${affordDelay}ms` } : undefined}
            >
              {/* overflow-hidden lets the grid-rows 0fr collapse the door's height to zero.
                  btyRise (staggered per door) lives HERE — not on the grid parent (which toggles
                  opacity for dim/gone) nor the dim child — so its opacity:1 `both`-fill never
                  fights those states; dim/gone are carried by ancestor/child opacity instead. */}
              <div
                className={`${animateArrival ? "btyRise " : ""}overflow-hidden ${isGone ? "pointer-events-none" : ""}`}
                style={animateArrival ? { animationDelay: `${riseDelay}ms` } : undefined}
              >
                <div
                  // FOCUS phase — unselected doors recede (dim + slight shrink) but stay legible as
                  // the rest of the life map; the selected door stays at full size (dominant).
                  className={`origin-center transition-all duration-300 ${isDimmed ? "opacity-40 scale-[0.97]" : "opacity-100 scale-100"}`}
                >
                  <button
                    type="button"
                    // No undo: once confirmed, tapping the held door does nothing (it must not
                    // re-open). Pre-confirm it selects/opens as before.
                    onClick={() => {
                      if (!confirmed) select(c.focus);
                    }}
                    // Magnetic warmth (Experiment A): track the pointer/finger as CSS vars set
                    // DIRECTLY on the node (no React state → no re-render on move) so the interior
                    // light can GATHER wherever the finger is about to press. Touch fires pointer
                    // events, so this works on device. On leave the light settles back to the seam.
                    onPointerMove={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      e.currentTarget.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
                      e.currentTarget.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
                    }}
                    onPointerLeave={(e) => {
                      e.currentTarget.style.setProperty("--mx", "0%");
                      e.currentTarget.style.setProperty("--my", "-10%");
                    }}
                    aria-pressed={isSelected}
                    tabIndex={isGone ? -1 : undefined}
                    data-focus={c.focus}
                    // btyAffordScale — V3.4 BOUNDED: the door settles in from 0.985→1.0 (never wider
                    // than its layout box) with a subtle -1px forward-lift, so its outer material can
                    // no longer expand past the viewport edge. Scale is supportive, not the signature.
                    // btySelectAck — a one-time warm scale acknowledge on the tap. Both are transient
                    // (settle back to scale 1); neither loops.
                    style={
                      showAffordance ? { animationDelay: `${affordDelay}ms` } : undefined
                    }
                    className={`group relative flex w-full flex-col items-start gap-1.5 overflow-hidden border px-6 py-6 text-left transition duration-300 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A66B]/40 ${
                      showAffordance ? "btyAffordScale " : ""
                    }${isSelected && justOpened ? "btySelectAck " : ""}${
                      isSelected
                        ? "rounded-2xl rounded-b-none border-b-0 border-[#C9A66B]/70 bg-gradient-to-b from-[#C9A66B]/[0.12] to-[#C9A66B]/[0.05]"
                        : isHighlight
                          ? "rounded-2xl border-[#C9A66B]/30 bg-gradient-to-b from-[#C9A66B]/[0.06] to-white/[0.02] ring-1 ring-[#C9A66B]/15"
                          : "rounded-2xl border-white/[0.14] bg-gradient-to-b from-white/[0.085] via-white/[0.03] to-white/[0.012] shadow-[inset_0_1px_0_rgba(255,255,255,0.10),inset_0_-18px_30px_-22px_rgba(0,0,0,0.6)] hover:border-[#C9A66B]/25 hover:from-white/[0.11]"
                    }`}
                  >
                    {/* Threshold seam — a soft luminous vertical edge: the door's opening. Glow
                        eases over 700ms (STEP 3) so the invited door leans in gently, matched to the
                        arrival fade, rather than snapping in at 300ms. motion-reduce stills it. The
                        parent button keeps its crisp 300ms (hover/press/active) — untouched. */}
                    <span
                      aria-hidden
                      className={`pointer-events-none absolute inset-y-4 left-0 w-px bg-gradient-to-b from-transparent via-[#C9A66B]/60 to-transparent transition-opacity duration-700 ease-out motion-reduce:transition-none ${
                        isHighlight ? "opacity-100" : "opacity-35 group-hover:opacity-70"
                      }`}
                    />
                    {/* THREE-DOOR AFFORDANCE (Intuitive Door Language STEP 2): a restrained, EQUAL,
                        one-time FULL-DOOR bloom — a warm radial surface fill (peak 0.20, legible on a
                        WKWebView navy display, not a left-edge smear) PLUS a brief warm inset border,
                        blooming once per door in DOM order (Self → Others → World) staggered by
                        AFFORDANCE_GAP_MS. Identical intensity/duration/easing on all three; its sole
                        meaning is "choose one of these." Ends at opacity 0 (no residue), plays only on
                        an animated first arrival, and is suppressed the instant a door is selected.
                        The old left-seam ignite was removed — it competed with this full-door cue. */}
                    {showAffordance ? (
                      <span
                        data-afford
                        aria-hidden
                        className="btyAfford pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-inset ring-[#C9A66B]/80"
                        style={{
                          // V2 "lit from within": a tight central IGNITION core (0.66) over a broad
                          // full-surface warm wash — the whole card shifts toward warm deep gold, not
                          // just the border.
                          background:
                            "radial-gradient(60% 52% at 50% 42%, rgba(201,166,107,0.66), rgba(201,166,107,0.30) 55%, transparent 100%), radial-gradient(130% 110% at 50% 50%, rgba(201,166,107,0.22), rgba(201,166,107,0.10) 60%, transparent 100%)",
                          animationDelay: `${affordDelay}ms`,
                        }}
                      />
                    ) : null}
                    {/* FULL-PERIMETER IGNITION (V3 STEP 3): a warm-white→gold arc travels ONCE around
                        the COMPLETE rounded boundary (conic gradient masked to a 2px border ring; the
                        --btyAngle custom property spins it). Not a static ring, not a single edge —
                        the whole perimeter is energized as the light circles it. Identical on every
                        door, staggered by affordDelay; ends fully faded. */}
                    {showAffordance ? (
                      <span
                        data-perimeter
                        aria-hidden
                        className="btyPerimeter pointer-events-none absolute inset-0 rounded-2xl"
                        style={{
                          background:
                            "conic-gradient(from var(--btyAngle,0deg), transparent 0deg, rgba(255,236,190,0.98) 40deg, rgba(201,166,107,0.72) 92deg, transparent 150deg)",
                          padding: "2px",
                          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                          WebkitMaskComposite: "xor",
                          maskComposite: "exclude",
                          animationDelay: `${affordDelay}ms`,
                        }}
                      />
                    ) : null}
                    {/* COLLECTIVE MAP REVEAL (V2 STEP 4, V3 stronger): after the wave completes, all
                        three door outlines glow together, once — "these three belong to one life
                        map," never "all selected." Same delay on every door (not staggered) so they
                        resolve as one; ends fully faded. */}
                    {showAffordance ? (
                      <span
                        data-map-reveal
                        aria-hidden
                        className="btyMapReveal pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-[#C9A66B]/45"
                        style={{ animationDelay: `${AFFORDANCE_TOTAL_MS - 120}ms` }}
                      />
                    ) : null}
                    {/* Interior depth — a warmth leaning in from the seam, STRONGER when invited.
                        When this is the SUGGESTED door and nothing is chosen yet, it keeps a slow
                        heartbeat (btyHeart) — "begin here" — which stops the instant a choice is
                        made. reduced-motion stills the pulse (holds lit). */}
                    <span
                      aria-hidden
                      className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${
                        isHighlight ? "from-[#C9A66B]/[0.16]" : "from-[#C9A66B]/[0.08]"
                      } via-transparent to-transparent transition-opacity duration-700 ease-out motion-reduce:transition-none ${
                        isHighlight
                          ? selected === null
                            ? "btyHeart opacity-100"
                            : "opacity-100"
                          : "opacity-0 group-hover:opacity-60"
                      }`}
                    />
                    {/* Magnetic warmth — an interior light that GATHERS under the finger/cursor,
                        tracking the pointer via the --mx/--my vars set on move. This is the
                        "touchable" pull: the door lights up exactly where you are about to press.
                        Shown on hover (desktop) and while pressed (touch). pointer-events-none. */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100 group-active:opacity-100"
                      style={{
                        background:
                          "radial-gradient(220px circle at var(--mx,0%) var(--my,-10%), rgba(201,166,107,0.24), transparent 55%)",
                      }}
                    />
                    {/* Meaning hierarchy (Intuitive Door Language STEP 1): the ontology noun is a
                        QUIET eyebrow; the lived ACTION is the primary, visually strongest decision
                        label — the daily choice must be understood as an action, the BTY noun is
                        learned through repetition. */}
                    <span className="relative text-[0.7rem] font-medium uppercase tracking-[0.18em] text-white/45">
                      {c.noun}
                    </span>
                    <span
                      className={`relative text-lg font-semibold leading-snug text-white ${showAffordance ? "btyAffordLift" : ""}`}
                      style={showAffordance ? { animationDelay: `${affordDelay}ms` } : undefined}
                    >
                      {c.action}
                    </span>
                  </button>

                  {/* The opened interior — a sibling of the door (valid HTML: no nested button),
                      merged flush beneath it (shared border, no top edge) so door + interior read
                      as one opened whole. After confirm this is the held REST state — its EXISTING
                      gold tint deepens one restrained step (0.05 → 0.08) via a ONE-TIME background-
                      color transition (no scale/transform). On a tab-return remount it mounts already
                      at the confirmed tint (transitions never run on initial mount) and btyOpenRoom is
                      gated on justOpened, so a RESTORED selection paints at rest — no warmth replay, no
                      open-animation replay. motion-reduce stills the warmth (immediate, no breathing). */}
                  {isSelected ? (
                    <div
                      data-today-confirm
                      className={`relative overflow-hidden rounded-b-2xl border border-t-0 border-[#C9A66B]/45 px-6 pb-6 pt-5 transition-colors duration-200 ease-out motion-reduce:transition-none ${
                        justOpened ? "btyOpenRoom " : ""
                      }${confirmed ? "bg-[#C9A66B]/[0.08]" : "bg-[#C9A66B]/[0.05]"}`}
                    >
                      {/* Seam continues down into the interior — one continuous opening. */}
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-[#C9A66B]/40 via-[#C9A66B]/15 to-transparent"
                      />
                      {/* Answer BLOOM (Experiment A) — the world REPLIES to the choice: a warm burst
                          blooms once from the chosen seam when the relationship is confirmed. It
                          mounts only when confirmed, so it fires on the press; the room's overflow-
                          hidden clips it into the interior, like light filling the room. */}
                      {confirmed ? (
                        <span
                          aria-hidden
                          className="btyBloom pointer-events-none absolute left-0 top-0 h-44 w-44 -translate-x-1/3 -translate-y-1/4 rounded-full"
                          style={{ background: "radial-gradient(circle, rgba(201,166,107,0.5), transparent 62%)" }}
                        />
                      ) : null}
                      {/* LIVING SELECTED-DOOR TRANSITION (Intuitive Door Language STEP 3): on a fresh
                          selection the interior content settles in ORDER — path/benediction (0ms) →
                          promise (70ms) → CTA (140ms) — a restrained opacity + vertical settle so the
                          commitment feels intentional, never a menu opening. Gated on justOpened, so a
                          tab-return RESTORE paints at rest (no replay). reduced-motion stills it. */}
                      {/* Layer 1 — path sublabel (reuses the locked-room eyebrow tone). */}
                      <span
                        data-path-label
                        className={`relative block text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90 ${justOpened ? "btySettle" : ""}`}
                      >
                        {copy.pathLabel}
                      </span>
                      {/* Layer 2 — the chosen-path line. Before confirm: the selection line
                          (doubles as the fallback when no promise). After confirm: it BECOMES the
                          present-tense benediction (STEP 3) — one sentence, never two. */}
                      <p data-select-line className={`relative mt-2 text-[0.95rem] leading-6 text-white/85 ${justOpened ? "btySettle" : ""}`}>
                        {confirmed ? copy.benediction[c.focus] ?? copy.benediction.fallback : c.select}
                      </p>
                      {/* Layers 3 + 4 — the promise to carry, ONLY when a real open promise exists.
                          action_text is rendered verbatim (unchanged); no fabrication on fallback. */}
                      {promiseText ? (
                        <div className={justOpened ? "btySettle" : ""} style={justOpened ? { animationDelay: "70ms" } : undefined}>
                          <span
                            data-promise-label
                            className="relative mt-4 block text-[11px] font-normal tracking-normal text-white/40"
                          >
                            {copy.promiseLabel}
                          </span>
                          <p data-carry-line className="relative mt-2 text-[0.95rem] leading-6 text-white/80">
                            {promiseText}
                          </p>
                        </div>
                      ) : null}
                      {/* Living Response (V1.1) — STABLE reserved slot. The slot's footprint is
                          reserved from the moment the confirmed terminal renders (bounded min-height
                          for the canonical max line count), so the CTA never moves and the card never
                          jumps when the perspective arrives. No placeholder / skeleton / loading text.
                          The line fades in by OPACITY ONLY inside the slot ("already part of the card
                          and quietly became legible"). Held one register below the benediction so it
                          never competes with the chosen path or the commitment. */}
                      {confirmed && isSelected ? (
                        <div data-living-response-slot className="relative mt-4 min-h-[3rem]">
                          {livingResponse?.perspective && livingResponse.status !== "pending" ? (
                            <p
                              data-living-response
                              data-living-response-source={livingResponse.source ?? undefined}
                              data-living-response-arrival={animateLivingArrival ? "1" : undefined}
                              // Presence V1.1: the ARRIVAL reveal (pause → rise-in) plays ONLY for a
                              // first-generation line. Restore / tab-return / re-render render at rest
                              // (no class → immediately legible, no replayed animation). onAnimationEnd
                              // consumes the one-shot so a later remount never re-plays it. No italic /
                              // quotes / emphasis; one register below the Promise (/70 vs Promise /80).
                              className={`${animateLivingArrival ? "btyLivingArrival " : ""}line-clamp-2 text-[0.9rem] leading-6 text-white/70`}
                              onAnimationEnd={animateLivingArrival ? onLivingArrivalEnd : undefined}
                            >
                              {livingResponse.perspective}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {/* CTA — pre-press is the strong filled-gold action; the settled state SINKS to
                          an outline + ✓ (the quiet action-mark). No undo: it does not toggle back, and
                          once confirmed the press is idempotently inert (guarded) — aria-pressed, the
                          accessible name, and focus are unchanged, so repeat activation is harmless. */}
                      <button
                        type="button"
                        onClick={() => {
                          if (confirmed || committing) return;
                          // Isolated/unit render (no server hook): keep the in-memory settle.
                          if (!onConfirm) {
                            setConfirmed(true);
                            return;
                          }
                          // Durable commit: enter the terminal state ONLY on server acknowledgement
                          // (the shell flips `confirmed`). On failure, stay retryable — no fabrication.
                          setCommitting(true);
                          void onConfirm(c.focus).finally(() => setCommitting(false));
                        }}
                        disabled={committing}
                        aria-pressed={confirmed}
                        aria-busy={committing}
                        data-today-cta
                        style={justOpened ? { animationDelay: "140ms" } : undefined}
                        className={`relative mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A66B]/40 ${justOpened ? "btySettle " : ""}${committing ? "opacity-70 " : ""}${
                          confirmed
                            ? "border border-[#C9A66B]/40 bg-transparent text-[#C9A66B]/80"
                            : "bg-[#C9A66B] text-[#0B1F3A] hover:bg-[#C9A66B]/90 active:scale-[0.985]"
                        }`}
                      >
                        {confirmed ? <span aria-hidden>✓</span> : null}
                        {confirmed ? copy.ctaDone : copy.cta}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
          })}
        </div>
      )}
      {/* Center Promise Loop STEP 1B — the self-owned Center keep, surfaced READ-ONLY beneath the
          relationship section (after the doors, never before the arrival sentence). Today only
          reflects it; the write/edit flow stays in Center. Deliberately SEPARATE from the Arena
          "Promise to Carry" (promiseLabel, action_text) rendered inside a chosen door — its own
          muted eyebrow ("Held in Center") + the anchor line + a quiet release line. No number, no
          streak, no verdict, no CTA. Renders only when a keep exists for today (keptToday).
          THE HELD ARC V0: read-only projection of the user's canonical Center keep (Center owns the
          meaning; Today only reflects it — no mutation, no reinterpretation). Separated from the
          action card by breathing room (no card/box/divider/footer), a de-golded eyebrow, an anchor
          no heavier than the Promise, no quotation marks, and opacity-only entry. */}
      {!loading && centerKeepLine ? (
        <section
          data-today-center-keep
          data-held-variant={heldVariant}
          // Anchor-only closes with a deliberate breath of open space (an existing token,
          // pb-6) so the last line reads as intentional silence before the bottom nav — not
          // leftover copy. Variant B keeps its own terminal line, so no extra bottom space.
          className={`btyFadeIn mt-14${heldVariant === "anchor-only" ? " pb-6" : ""}`}
        >
          <span className="block text-xs font-medium uppercase tracking-[0.18em] text-white/40">
            {copy.centerKeep.label}
          </span>
          <p data-center-keep-line className="mt-3 text-[0.95rem] leading-7 text-white/80">
            {centerKeepLine}
          </p>
          {/* Variant B (comparison baseline) only — the release line is absent from the DOM in
              anchor-only, not hidden with reserved height. Flip HELD_IN_CENTER_VARIANT to restore. */}
          {heldVariant === "anchor-with-release" ? (
            <p className="mt-1.5 text-sm leading-6 text-white/45">{copy.centerKeep.support}</p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

/**
 * Today greeting header (Slice 3.1B-3J.1) — the time-aware greeting that OPENS the Today screen.
 * Lifted out of the retired relationship surface so Today now reads: greeting → Personal Brief
 * (understand yesterday · what not to miss). SSR-safe: the server + first client paint render the
 * morning default (copy.title) so hydration matches; the real local-time band resolves after mount
 * from the device clock (no API, no timezone service, no storage). No sub-line, no door framing.
 */
function TodayGreeting({ greetings, ssrDefault }: { greetings: TodayCopy["greetings"]; ssrDefault: string }) {
  const [greeting, setGreeting] = useState(ssrDefault);
  useEffect(() => {
    setGreeting(pickGreeting(greetings, new Date().getHours()));
  }, [greetings]);
  return (
    <header data-today-greeting className="btyRise mb-6" style={{ animationDelay: "40ms" }}>
      <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-white">{greeting}</h1>
    </header>
  );
}

export default function BtyDailyAppShell({ locale }: { locale: Locale }) {
  const [tab, setTab] = useState<AppTabKey>("today");
  // Deep-linked completion review (Slice 3.1B-3E.1): `?review=<assignmentId>` opens the
  // authenticated read-only review inside the Foundry tab. Null = normal Foundry surface.
  const [reviewId, setReviewId] = useState<string | null>(null);
  // Foundry sub-view (Slice 3.1B-3H): "rooms" (Required Learning + Host rooms) or "my-learning"
  // (the learner-owned private reflection history). Opened via `?tab=foundry&view=my-learning`
  // — e.g. the open-link post-claim "Continue to BTY" handoff.
  const [foundryView, setFoundryView] = useState<"rooms" | "my-learning">("rooms");
  // Follow-up response surface (Slice 3.1B-3K): `?tab=foundry&followup=<id>` opens the focused
  // learner follow-up outcome surface inside the Foundry tab (from the Today FOLLOW_UP_DUE reminder).
  const [followupId, setFollowupId] = useState<string | null>(null);
  // Center is ONE canonical Personal Reality Feed (Slice 3.1B-3J) — no subview. `centerFocusEntry`
  // deep-links a specific reflection on that same first screen (?tab=center&entry=<progressId>);
  // legacy ?view=reflections links normalize to the feed. The server still owner-scopes every read.
  const [centerFocusEntry, setCenterFocusEntry] = useState<string | null>(null);
  // Me sub-view (App Shell + Today Simplification V1): Center folds into Me. "home" = the Me landing
  // (account + mirror + entries); "center" = the voluntary Center/Recovery surface (CenterRealityFeed);
  // "my-learning" = the learner's own private reflection history. The deterministic forced-reset
  // middleware redirect to /{locale}/center is UNCHANGED — this state is only the in-shell voluntary path.
  const [meView, setMeView] = useState<"home" | "center" | "my-learning" | "account" | "this-week">("home");
  // Weekly-activity refresh signal (B3A.2D-R1): bumped on every Me-tab reselect so the root summary
  // and the This Week detail re-fetch the canonical projection once per reselect.
  const [weeklyRefreshKey, setWeeklyRefreshKey] = useState(0);
  // The app-shell scroll owner is the <main> below (flex-1 overflow-y-auto), NOT window — a Me-tab
  // reselect scrolls THIS container to the top.
  const mainScrollRef = useRef<HTMLElement | null>(null);

  // Bottom-tab reselect (B3A.2D-R1): every press resolves to the canonical Me ROOT. Selecting Me
  // (from another tab, a nested Me subview, or Me-root-while-scrolled) clears any nested meView,
  // re-fetches the weekly projection once, and scrolls the real scroll owner to the top. Idempotent:
  // repeated Me taps just re-assert root + scroll-top (no duplicate navigation, no unrelated reset).
  const handleTabSelect = useCallback((key: AppTabKey) => {
    if (key === "me") {
      setMeView("home");
      setWeeklyRefreshKey((k) => k + 1);
    }
    setTab(key);
    // Scroll after the (possibly root-reset) view paints. rAF avoids scrolling stale nested content.
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => mainScrollRef.current?.scrollTo?.({ top: 0 }));
    }
  }, []);
  // Host Leadership Attention deep link (Slice 3.1B-3L): `?tab=foundry&event=<id>&section=<s>&focus=<id>`
  // opens the EXACT owned Event Control Room + section, with the focused learner row highlighted. These
  // feed FoundryEventRooms' initial view once; `onInitialConsumed` clears them so a later tab re-entry
  // returns to the Foundry home list (never a stuck re-open). Distinct from the learner `?followup=` path.
  const [hostEventId, setHostEventId] = useState<string | null>(null);
  const [hostSection, setHostSection] = useState<HostFocusSection | null>(null);
  const [hostFocusId, setHostFocusId] = useState<string | null>(null);
  // Host Action Review detail deep link (Slice 3.1B-3N Phase 5B): `?tab=today&actionReview=<contractId>`
  // opens the read-only in-shell review detail; onBack clears it (returns to the Today queue). The
  // detail route re-runs the authority resolver — a queue appearance never grants authority.
  const [actionReviewId, setActionReviewId] = useState<string | null>(null);

  // Field Action producer deep links (Slice 3.1B-3N-5C.3), both Today-owned + in-shell:
  //   `?tab=today&fieldActionAssignment=<assignmentId>` → create/open the Field Action for a completed assignment
  //   `?tab=today&fieldActionContract=<contractId>`      → edit + resubmit a rejected Field Action
  const [fieldActionAssignmentId, setFieldActionAssignmentId] = useState<string | null>(null);
  const [fieldActionContractId, setFieldActionContractId] = useState<string | null>(null);
  // Field Actions Focused Surface V1: `?tab=practice&fieldAction=<contractId>` opens the focused
  // Field Actions surface under Practice, scrolled to that action. Cleared once consumed.
  const [practiceFieldActionId, setPracticeFieldActionId] = useState<string | null>(null);

  // Return contract: open a specific tab from `?tab=` (and/or a `?review=`/`?view=` deep-link) ONCE
  // on mount — used after an account switch returns to `/app?tab=foundry`. Only known tab values
  // are honored (unknown → no-op, default stays Today); a review id is accepted only in
  // UUID-ish shape (the server does the real authz). Params are consumed via replaceState
  // so a re-render / back never re-triggers them and no navigation loop forms.
  useEffect(() => {
    const search = window.location.search;
    const requestedTab = resolveInitialAppTab(search);
    // Raw (pre-alias) tab value — lets legacy `?tab=center` open the Center feed inside Me.
    let rawTab: string | null = null;
    try {
      rawTab = new URLSearchParams(search).get("tab");
    } catch {
      rawTab = null;
    }
    let reviewParam: string | null = null;
    let viewParam: string | null = null;
    try {
      const sp = new URLSearchParams(search);
      reviewParam = sp.get("review");
      viewParam = sp.get("view");
    } catch {
      reviewParam = null;
      viewParam = null;
    }
    let entryParam: string | null = null;
    try {
      entryParam = new URLSearchParams(search).get("entry");
    } catch {
      entryParam = null;
    }
    let followupParam: string | null = null;
    try {
      followupParam = new URLSearchParams(search).get("followup");
    } catch {
      followupParam = null;
    }
    let actionReviewParam: string | null = null;
    try {
      actionReviewParam = new URLSearchParams(search).get("actionReview");
    } catch {
      actionReviewParam = null;
    }
    let fieldActionAssignmentParam: string | null = null;
    let fieldActionContractParam: string | null = null;
    let fieldActionParam: string | null = null;
    try {
      const sp = new URLSearchParams(search);
      fieldActionAssignmentParam = sp.get("fieldActionAssignment");
      fieldActionContractParam = sp.get("fieldActionContract");
      fieldActionParam = sp.get("fieldAction");
    } catch {
      fieldActionAssignmentParam = null;
      fieldActionContractParam = null;
      fieldActionParam = null;
    }
    const validReview = reviewParam && /^[0-9a-fA-F-]{16,}$/.test(reviewParam) ? reviewParam : null;
    const wantsMyLearning = viewParam === "my-learning";
    const wantsReflections = viewParam === "reflections";
    const validEntry = entryParam && /^[0-9a-fA-F-]{16,}$/.test(entryParam) ? entryParam : null;
    const validFollowup = followupParam && /^[0-9a-fA-F-]{16,}$/.test(followupParam) ? followupParam : null;
    const validActionReview =
      actionReviewParam && /^[0-9a-fA-F-]{16,}$/.test(actionReviewParam) ? actionReviewParam : null;
    const validFieldActionAssignment =
      fieldActionAssignmentParam && /^[0-9a-fA-F-]{16,}$/.test(fieldActionAssignmentParam) ? fieldActionAssignmentParam : null;
    const validFieldActionContract =
      fieldActionContractParam && /^[0-9a-fA-F-]{16,}$/.test(fieldActionContractParam) ? fieldActionContractParam : null;
    const validFieldAction =
      fieldActionParam && /^[0-9a-fA-F-]{16,}$/.test(fieldActionParam) ? fieldActionParam : null;
    // Host Leadership Attention deep link (tab=foundry + event + section + focus). Validated/sanitized
    // in one pure helper; a malformed/foreign link parses to null (falls through, never a dead-end).
    const hostLink = parseHostDeepLink(search);
    if (
      !requestedTab &&
      !validReview &&
      !wantsMyLearning &&
      !wantsReflections &&
      !validFollowup &&
      !validActionReview &&
      !validFieldActionAssignment &&
      !validFieldActionContract &&
      !validFieldAction &&
      !hostLink
    )
      return;
    if (validFieldAction) {
      // Field Actions Focused Surface V1: open the focused Field Actions surface under Practice,
      // scrolled to this specific action (never generic Today).
      setTab("practice");
      setPracticeFieldActionId(validFieldAction);
    } else if (validFieldActionAssignment) {
      // Foundry completion "Apply this in real life" → open the Today-owned Field Action producer.
      setTab("today");
      setFieldActionAssignmentId(validFieldActionAssignment);
    } else if (validFieldActionContract) {
      // Backward-compat: a legacy ?tab=today&fieldActionContract= link still opens the focused form.
      setTab("today");
      setFieldActionContractId(validFieldActionContract);
    } else if (validActionReview) {
      // Canonical Today Action-review deep link → open the read-only in-shell review detail.
      setTab("today");
      setActionReviewId(validActionReview);
    } else if (validFollowup) {
      // Canonical Today FOLLOW_UP_DUE deep link (?tab=foundry&followup=) → Learn (=Foundry) follow-up.
      setTab("learn");
      setFollowupId(validFollowup);
    } else if (hostLink) {
      // Canonical Host attention deep link → Learn (=Foundry) control room + section + focused row.
      setTab("learn");
      setHostEventId(hostLink.eventId);
      setHostSection(hostLink.section);
      setHostFocusId(hostLink.focusId);
    } else if (validReview) {
      setTab("learn");
      setReviewId(validReview);
    } else if (wantsMyLearning) {
      setTab("learn");
      setFoundryView("my-learning");
    } else if (wantsReflections) {
      // Legacy ?view=reflections normalizes to the single Center feed — now inside Me (Center folded in).
      setTab("me");
      setMeView("center");
      setCenterFocusEntry(validEntry);
    } else if (requestedTab) {
      setTab(requestedTab);
      // Legacy ?tab=center[&entry=<id>] resolves to Me → open the Center feed (focused when entry present).
      if (rawTab === "center") {
        setMeView("center");
        if (validEntry) setCenterFocusEntry(validEntry);
      }
    }
    try {
      const params = new URLSearchParams(search);
      params.delete("tab");
      params.delete("review");
      params.delete("view");
      params.delete("entry");
      params.delete("followup");
      params.delete("actionReview");
      params.delete("fieldActionAssignment");
      params.delete("fieldActionContract");
      params.delete("fieldAction");
      params.delete("event");
      params.delete("section");
      params.delete("focus");
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash,
      );
    } catch {
      /* history unavailable — the tab still opened; nothing else to do */
    }
  }, []);
  const t = COPY[locale];

  // Today Simplification (Slice 3.1B-3J.1): the retired relationship/commitment surface took its
  // intelligence / open-promise / Center-keep / yesterday-memory / commitment / living-response reads
  // with it. Today now has exactly two jobs — understand yesterday · show what must not be missed —
  // both served SERVER-SIDE by TodayPersonalBrief (/api/me/today/brief). The engines behind the
  // removed reads (commit, living-response, today-intelligence, …) are UNCHANGED and still reachable;
  // the shell simply no longer drives them from Today. The only Today-mount read left here is the
  // Me-tab Weekly Orb rhythm (numberless barIntensity[]). Fail-soft: [] → resting orb.
  const [weeklyRhythm, setWeeklyRhythm] = useState<MeWeeklyRhythm>([]);
  useEffect(() => {
    let alive = true;
    void fetchWeeklyRhythm().then((rhythm) => {
      if (alive) setWeeklyRhythm(rhythm);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Center Daily Trace STEP 1A — record a quiet self-return the first time the native app is
  // reached (Today is the default surface, so shell mount == native Today arrival). Fire-and-forget,
  // once per mount; server-side idempotency (one user_day row per day) makes repeat tab visits and
  // cold relaunches safe. Records only — no visible UI, not tied to Orb timing, and WeeklyOrb is NOT
  // re-sourced here (it still reads the meWeeklyRhythm temporary Arena carrier).
  useEffect(() => {
    recordNativeSelfReturn();
  }, []);

  // Native cold-reopen white-screen P0 is CLOSED; the temporary [BTYAppBoot] boot
  // diagnostics (mount marker + global error/rejection console capture) were removed.
  // Genuine fatal-render logging still lives in app/global-error.tsx.
  //
  // No shell-level threshold: /start is the canonical (and only) Threshold Door (B2). After
  // the /start Orb hold routes to /{locale}/app, Today renders IMMEDIATELY — the earlier
  // direct-/en/app-era OrbThreshold gate was removed to fix the B2 double-door defect.

  return (
    <div className="btyFadeIn relative flex h-[100dvh] flex-col overflow-hidden bg-[#0B1F3A] text-white antialiased">
      {/* Entry fade only (mount). The sole Orb now lives at /start.
          prefers-reduced-motion stills the fade. */}
      <style>{`
        @keyframes btyEnter{from{opacity:0}to{opacity:1}}
        .btyFadeIn{animation:btyEnter .7s ease both}
        /* Registered angle for the full-perimeter ignition (V3). Enables smooth conic rotation on
           WKWebView (iOS 16.4+); where unsupported it degrades to a static bright perimeter arc. */
        @property --btyAngle{syntax:'<angle>';initial-value:0deg;inherits:false}
        /* Arrival cascade (Today Arrival Warmth STEP 4): a calm rise+fade used to stagger
           the Today reveal — greeting, then the yesterday-trace sentence, then the doors —
           so arrival is felt as a short sequence, not a single flat paint. Each element sets
           its own animation-delay inline. reduced-motion stills it (elements show at rest). */
        @keyframes btyRise{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:translateY(0)}}
        .btyRise{animation:btyRise .8s cubic-bezier(0.22,1,0.36,1) both}
        /* Selected-door interior reveal (Alive Room STEP 1): a soft, non-bouncy open so the
           chosen relationship interior feels ENTERED (a room opening) rather than a card popping
           in. Gentle rise + a barely-there settle-in scale; no glow burst, no pulse loop. Keyed
           off the interior's mount (isSelected). reduced-motion stills it (interior at rest). */
        @keyframes btyOpenRoom{from{opacity:0;transform:translateY(12px) scale(0.985)}to{opacity:1;transform:translateY(0) scale(1)}}
        .btyOpenRoom{animation:btyOpenRoom .5s cubic-bezier(0.22,1,0.36,1) both}
        /* ───────────────────────────────────────────────────────────────────────
           TODAY WOW LAB — Experiment A · "DAYBREAK" (bold pass). Today does not load,
           it IGNITES: a seed of light blooms, a living aurora drifts behind everything,
           a single spine of gold draws down the left edge and the three doors ignite
           along it, the invited door keeps a warm heartbeat, and the world answers the
           finger that touches it. Loud in LIGHT, never in colour — gold (#C9A66B) on
           navy only, no second hue, no neon.
           ─────────────────────────────────────────────────────────────────────── */
        /* Aurora field entrance — the living light fades up as Today is entered. */
        @keyframes btyWake{from{opacity:0}to{opacity:1}}
        .btyWake{animation:btyWake 1.4s ease-out both}
        /* Living aurora — two warm gold fields drifting on their own slow loops, never
           still: the space BREATHES on its own, not a frozen gradient. */
        @keyframes btyDriftA{0%{transform:translate3d(-4%,2%,0) scale(1.05)}50%{transform:translate3d(5%,-3%,0) scale(1.2)}100%{transform:translate3d(-4%,2%,0) scale(1.05)}}
        @keyframes btyDriftB{0%{transform:translate3d(3%,-2%,0) scale(1.12)}50%{transform:translate3d(-5%,4%,0) scale(1)}100%{transform:translate3d(3%,-2%,0) scale(1.12)}}
        .btyDriftA{animation:btyDriftA 17s ease-in-out infinite}
        .btyDriftB{animation:btyDriftB 23s ease-in-out infinite}
        /* Ignition seed — a single point of light blooms outward once as Today opens
           (the Orb handing its light to the day), then dissolves into the aurora. */
        @keyframes btySeed{0%{opacity:0;transform:translate(-50%,-50%) scale(0.12)}22%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(2.7)}}
        .btySeed{animation:btySeed 1.5s cubic-bezier(0.22,1,0.36,1) both}
        /* Spine of light — one continuous gold line DRAWING down the doors' left edge,
           stitching the three worlds into a single opening. */
        @keyframes btySpine{0%{transform:scaleY(0);opacity:0}12%{opacity:1}100%{transform:scaleY(1);opacity:1}}
        .btySpine{transform-origin:top;animation:btySpine .95s cubic-bezier(0.22,1,0.36,1) both}
        /* …with a bright spark riding the head of the line as it draws. */
        @keyframes btySpark{0%{top:-2%;opacity:0}12%{opacity:1}86%{opacity:1}100%{top:100%;opacity:0}}
        .btySpark{animation:btySpark .95s cubic-bezier(0.22,1,0.36,1) both}
        /* Per-door seam IGNITE — the lamp coming on as the spine passes each door.
           Ends at opacity 0, so at rest only the door's base seam remains. */
        @keyframes btyIgnite{0%{opacity:0;transform:translateY(-45%) scaleY(0.35)}45%{opacity:1}100%{opacity:0;transform:translateY(0) scaleY(1)}}
        .btyIgnite{animation:btyIgnite .8s cubic-bezier(0.22,1,0.36,1) both}
        /* Invited-door HEARTBEAT — the suggested door pulses a slow warm breath:
           "begin here." Stops the instant a choice is made. */
        @keyframes btyHeart{0%,100%{opacity:0.4}50%{opacity:1}}
        .btyHeart{animation:btyHeart 3.4s ease-in-out infinite}
        /* Answer BLOOM — the world replies when a relationship is confirmed: a warm
           burst blooms from the chosen seam, once. */
        @keyframes btyBloom{0%{opacity:0;transform:scale(0.5)}28%{opacity:0.9}100%{opacity:0;transform:scale(2.2)}}
        .btyBloom{animation:btyBloom 1.1s cubic-bezier(0.22,1,0.36,1) both}
        /* Living Response ARRIVAL (Presence V1.1) — the received-presence rhythm, applied ONLY to a
           FIRST-generation line (never to a tab/cold restore or a re-render). The both-fill + delay
           gives Phase B: the line is held invisible in its already-reserved slot for the pause, then
           Phase C eases it in with a restrained 4px rise. Timing over spectacle: opacity 0→1 +
           translateY(4px)→0, calm ease-out, no bounce/scale/glow/blur. The 4px transform is
           compositor-only inside the fixed min-h slot, so nothing reflows (zero layout shift). */
        @keyframes btyLivingArrival{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        .btyLivingArrival{animation:btyLivingArrival 420ms cubic-bezier(0.22,0.61,0.36,1) 320ms both}
        /* Reduced-motion arrival — opacity only, ≤150ms, no translate, no pause (hierarchy still reads). */
        @keyframes btyLivingArrivalRM{from{opacity:0}to{opacity:1}}
        /* THREE-DOOR AFFORDANCE (Sensory Overreach V1) — four coordinated layers per active door,
           each staggered by the per-door delay: (A) INNER LIGHT — the full-card radial surface
           warmth; (B) RIM — the whole rounded border goes gold (ring on the same overlay); (A+B
           share this opacity keyframe). Ends at opacity 0 (settled state is calm, no residue). */
        @keyframes btyAfford{0%{opacity:0}42%{opacity:1}100%{opacity:0}}
        .btyAfford{animation:btyAfford .7s ease-in-out both}
        /* (D) PRIMARY ACTION — the action label lifts in luminance (gold-white glow), briefly. */
        @keyframes btyAffordLift{0%,100%{text-shadow:none}42%{text-shadow:0 0 18px rgba(201,166,107,0.9),0 0 4px rgba(255,255,255,0.5)}}
        .btyAffordLift{animation:btyAffordLift .7s ease-in-out both}
        /* (C) CARD-LOCAL DEPTH (V3.1 clip correction) — a warm depth glow on the grid cell, now
           HORIZONTALLY SAFE: blur 30 with a strong negative spread keeps its horizontal reach ~12px
           (inside the ~15px gutter after scale) so it fades before the viewport edge, while a small
           downward offset retains the vertical spatial depth. The WIDE spatial reach moved to the
           group atmosphere (below), which fades to navy before both edges. Ends at no-shadow. */
        @keyframes btyHalo{0%{box-shadow:0 0 0 0 rgba(201,166,107,0)}42%{box-shadow:0 13px 30px -18px rgba(201,166,107,0.62)}100%{box-shadow:0 0 0 0 rgba(201,166,107,0)}}
        .btyHalo{animation:btyHalo .7s ease-in-out both}
        /* Active-door breath — a restrained ~3% scale lift during the bloom (no bounce, settles to 1). */
        @keyframes btyAffordScale{0%{transform:scale(0.985)}42%{transform:scale(1) translateY(-1px)}100%{transform:scale(1)}}
        .btyAffordScale{animation:btyAffordScale .7s ease-in-out both}
        /* FULL-PERIMETER IGNITION — a warm-white→gold arc travels once around the whole rounded
           boundary via the --btyAngle custom property (registered below for smooth animation). */
        @keyframes btyPerimeter{0%{opacity:0}14%{opacity:1}86%{opacity:1}100%{opacity:0}}
        .btyPerimeter{animation:btyPerimeter .8s ease-in-out both, btyPerimeterSpin .8s linear both}
        @keyframes btyPerimeterSpin{to{--btyAngle:360deg}}
        /* SCREEN-SPACE AURORA (V3.3) — real light blobs TRAVEL Self(top)→Others(mid)→World(bottom)
           via transform:translateY inside a transparent wrapper (NO background-position, NO carrier
           filter/mask). translateY(-50%) keeps the blob vertically centred; the second translateY is
           the travel (±38% of blob height). Opacity fades up then fully out (no residue). Gold + cool
           share this single keyframe so they stay synchronized. */
        @keyframes btyAuroraTravel{0%{opacity:0;transform:translateY(-50%) translateY(-38%)}12%{opacity:1;transform:translateY(-50%) translateY(-38%)}40%{transform:translateY(-50%) translateY(0%)}68%{transform:translateY(-50%) translateY(38%)}88%{opacity:1;transform:translateY(-50%) translateY(38%)}100%{opacity:0;transform:translateY(-50%) translateY(38%)}}
        .btyAuroraTravel{animation:btyAuroraTravel 1.66s ease-in-out both}
        /* COLLECTIVE MAP REVEAL — all three outlines glow together, once (V3 stronger), then gone. */
        @keyframes btyMapReveal{0%,100%{opacity:0}50%{opacity:1}}
        .btyMapReveal{animation:btyMapReveal .42s ease-in-out both}
        /* SELECTION ACKNOWLEDGE — a one-time warm scale-pop on tap (no overshoot, settles to 1). */
        @keyframes btySelectAck{0%{transform:scale(0.994)}45%{transform:scale(1.02)}100%{transform:scale(1)}}
        .btySelectAck{animation:btySelectAck .3s cubic-bezier(0.22,1,0.36,1) both}
        /* LIVING SELECTED-DOOR — interior content settles in with a restrained opacity + rise. */
        @keyframes btySettle{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .btySettle{animation:btySettle .3s ease-out both}
        @media (prefers-reduced-motion: reduce){.btyFadeIn,.btyRise,.btyOpenRoom,.btyWake,.btyDriftA,.btyDriftB,.btySeed,.btySpine,.btySpark,.btyIgnite,.btyHeart,.btyBloom,.btyAfford,.btyAffordLift,.btyHalo,.btyAffordScale,.btySelectAck,.btySettle,.btyAuroraTravel,.btyMapReveal,.btyPerimeter{animation:none!important}}
        @media (prefers-reduced-motion: reduce){.btyLivingArrival{animation:btyLivingArrivalRM 150ms ease-out both!important}}
      `}</style>
      {/* TODAY WOW LAB — Experiment A "Daybreak" LIVING FIELD. A full-bleed light stage behind
          all content: two warm gold aurora currents drifting on independent slow loops (the space
          is never still), a cool depth wash at the crown for top-to-bottom pull, and a single
          ignition SEED that blooms outward once as Today opens — the Orb handing its light to the
          day. z-0, behind the z-10 content; pointer-transparent. reduced-motion → all still, lit. */}
      <div aria-hidden className="btyWake pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Aurora current A — the warm dawn rising from below. */}
        <div
          className="btyDriftA absolute inset-0"
          style={{
            background:
              "radial-gradient(68% 54% at 50% 116%, rgba(201,166,107,0.22), rgba(201,166,107,0.05) 44%, transparent 68%)",
          }}
        />
        {/* Aurora current B — a second warm current, offset, drifting the other way. */}
        <div
          className="btyDriftB absolute inset-0"
          style={{
            background:
              "radial-gradient(52% 44% at 20% 90%, rgba(201,166,107,0.13), transparent 60%), radial-gradient(48% 40% at 84% 98%, rgba(201,166,107,0.11), transparent 58%)",
          }}
        />
        {/* Cool depth wash at the crown — a faint blue pull so the field has a sky-to-ground axis. */}
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(95% 55% at 50% -12%, rgba(120,150,210,0.09), transparent 60%)" }}
        />
        {/* Ignition seed — one point of light blooming outward as Today opens, then gone. */}
        <div
          className="btySeed absolute left-1/2 top-[40%] h-72 w-72 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(201,166,107,0.55), rgba(201,166,107,0.14) 38%, transparent 70%)" }}
        />
      </div>
      {/* iOS status-bar safe area — reserved so app content never underlaps the notch/clock. */}
      <div style={{ height: "env(safe-area-inset-top)" }} aria-hidden className="relative z-10" />

      <main ref={mainScrollRef} className="relative z-10 flex-1 overflow-y-auto px-5 pb-4 pt-8" aria-label={t.appAria}>
        {tab === "today" && (
          <>
            {fieldActionAssignmentId || fieldActionContractId ? (
              // Slice 3.1B-3N-5C.3: Today-owned Field Action producer (author / resubmit). Back → Today.
              <FieldActionForm
                locale={locale}
                assignmentId={fieldActionAssignmentId}
                contractId={fieldActionContractId}
                onBack={() => {
                  setFieldActionAssignmentId(null);
                  setFieldActionContractId(null);
                }}
              />
            ) : actionReviewId ? (
              // Slice 3.1B-3N Phase 5B: read-only Host review detail, in-shell. Back returns to Today.
              <HostActionReviewDetail
                locale={locale}
                actionContractId={actionReviewId}
                onBack={() => setActionReviewId(null)}
              />
            ) : (
              <>
                {/* TODAY SIMPLIFICATION V1: greeting OPENS the screen, then the calm Today hierarchy —
                    Better Than Yesterday header · measured yesterday summary · exactly ONE primary next
                    action (deterministic domain selector) · a compact "needs your attention" summary ·
                    and "Show everything", under which the FULL, unchanged detailed projections render
                    (Action Hygiene, Leadership Attention, Field Action plans, Action Reviews, reminders,
                    AI brief). No detailed list renders in the first viewport by default. */}
                <TodayGreeting greetings={t.today.greetings} ssrDefault={t.today.title} />
                <TodayHome locale={locale} onNavigate={(dest) => setTab(dest)} />
              </>
            )}
          </>
        )}
        {/* Practice (= Arena + Field Actions). Landing surface with calm doors; "Arena practice"
            opens the UNCHANGED in-shell Arena runtime in place, "Field Actions" opens the focused
            in-shell Field Actions surface (never generic Today), Live Experiences / Scan QR are
            gated placeholders. `?tab=practice&fieldAction=<id>` deep-links straight to that action. */}
        {tab === "practice" && (
          <PracticeLanding
            locale={locale}
            lockedTag={t.arena.tag}
            lockedBody={t.arena.body}
            initialView={practiceFieldActionId ? "fieldActions" : "landing"}
            initialFieldActionId={practiceFieldActionId}
            onFieldActionConsumed={() => setPracticeFieldActionId(null)}
          />
        )}
        {/* Learn (= Foundry). A learner-facing identity header sits above the UNCHANGED Foundry
            surface: Event Rooms, Required Learning, program discovery/progress, and — for authorized
            hosts — the creation tools. All existing Foundry sub-views / deep links are preserved. */}
        {tab === "learn" &&
          (followupId ? (
            <FoundryFollowUpResponse
              followupId={followupId}
              locale={locale}
              onBack={() => setFollowupId(null)}
            />
          ) : reviewId ? (
            <FoundryCompletionReview
              assignmentId={reviewId}
              locale={locale}
              onBack={() => setReviewId(null)}
            />
          ) : foundryView === "my-learning" ? (
            <FoundryMyLearning locale={locale} onBack={() => setFoundryView("rooms")} />
          ) : (
            <>
              {/* Learn identity header — a learner can continue/open training without first
                  understanding "Foundry"; Foundry appears only as a quiet secondary attribution. */}
              <LearnHeader locale={locale} onOpenMyLearning={() => setFoundryView("my-learning")} />
              <FoundryEventRooms
                locale={locale}
                onOpenReview={setReviewId}
                onOpenMyLearning={() => setFoundryView("my-learning")}
                initialEventId={hostEventId}
                initialFocusSection={hostSection}
                initialFocusId={hostFocusId}
                onInitialConsumed={() => {
                  setHostEventId(null);
                  setHostSection(null);
                  setHostFocusId(null);
                }}
              />
            </>
          ))}
        {/* Me = Center/self-owned mirror rendered inside Today. Today supplies the
            render slot + locale ONLY; the card reads its own Center/self-safe
            derived value (leadershipState stage). The prepared-room copy (t.me)
            is retained on COPY as the reserved fallback identity.

            Below the mirror, a quiet Weekly Orb reflects the week's numberless rhythm as
            light (not a chart/link/control). The Arena read + composition happen HERE at
            the shell (the composition layer) — CenterMeCard stays Center-pure and never
            reads /api/arena/*. Framed as a self "weekly trace," not competition. */}
        {tab === "me" &&
          (meView === "center" ? (
            // Voluntary Center / Recovery surface (folded into Me). The deterministic forced-reset
            // middleware redirect to /{locale}/center is UNCHANGED — this is the in-shell voluntary path.
            <div className="flex flex-col gap-4" data-testid="me-center">
              <button
                type="button"
                data-testid="me-center-back"
                onClick={() => {
                  setMeView("home");
                  setCenterFocusEntry(null);
                }}
                className="self-start text-xs font-medium text-white/55 hover:text-white/85"
              >
                ‹ {locale === "ko" ? "뒤로" : "Back"}
              </button>
              <CenterRealityFeed locale={locale} focusEntryId={centerFocusEntry} />
            </div>
          ) : meView === "my-learning" ? (
            // Opened FROM Me → the back label is "Me" and it returns to the Me root (B3A.2D-R1);
            // it must never present "Required learning" as its parent. Origin is explicit, never
            // inferred from tab/history. (The Learn-tab entry below keeps its own default label.)
            <FoundryMyLearning
              locale={locale}
              onBack={() => setMeView("home")}
              backLabel={locale === "ko" ? "나" : "Me"}
            />
          ) : meView === "this-week" ? (
            // This Week detail — opened by a SHORT TAP on the Me Orb. Back label "‹ Me" → Me root.
            <MeThisWeekDetail locale={locale} refreshKey={weeklyRefreshKey} onBack={() => setMeView("home")} />
          ) : meView === "account" ? (
            // Account detail (B3A.2C-R1): the canonical account-management surface — current
            // email + Switch account + Sign out — behind one calm "Account" row, not a
            // first-screen card. AccountBlock (switch/sign-out capability) is UNCHANGED.
            <div className="flex flex-col gap-4" data-testid="me-account">
              <button
                type="button"
                data-testid="me-account-back"
                onClick={() => setMeView("home")}
                className="self-start text-xs font-medium text-white/55 hover:text-white/85"
              >
                ‹ {locale === "ko" ? "뒤로" : "Back"}
              </button>
              <AccountBlock locale={locale} />
            </div>
          ) : (
            // Me root hierarchy (B3A.2D): identity + Forge stage + THIS WEEK first
            // (visible without scrolling), then the Orb in NORMAL flow (no viewport-height
            // lift / dead space), then compact nav rows ending with Account. Nothing is
            // absolute/fixed; safe-area padding keeps content clear of the bottom dock.
            <div className="flex flex-col gap-4 pb-6" data-testid="me-home">
              <MeThisWeek locale={locale} weeklyRhythm={weeklyRhythm} refreshKey={weeklyRefreshKey} />
              {/* The Me Orb is the ONE canonical Orb runtime (OrbLiving) with dual interaction:
                  short tap → This Week detail; long hold → canonical entry (switch to Today).
                  Entering in-shell keeps the session, origin, and Me state (no second shell). */}
              <MeOrbDoor
                locale={locale}
                onOpenWeek={() => setMeView("this-week")}
                onEnter={() => handleTabSelect("today")}
              />
              <nav className="flex flex-col gap-2" aria-label={locale === "ko" ? "나의 기록" : "My records"}>
                {[
                  { id: "me-row-learned", label: locale === "ko" ? "내가 배운 것" : "What I learned", go: () => setMeView("my-learning") },
                  { id: "me-row-achieved", label: locale === "ko" ? "내가 이룬 것" : "What I achieved", go: () => setMeView("my-learning") },
                  { id: "me-row-center", label: locale === "ko" ? "센터" : "Center", go: () => setMeView("center") },
                  { id: "me-account-row", label: locale === "ko" ? "계정" : "Account", go: () => setMeView("account") },
                ].map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    data-testid={r.id}
                    onClick={r.go}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-left"
                  >
                    <span className="text-sm font-medium text-white/75">{r.label}</span>
                    <span aria-hidden="true" className="text-white/40">›</span>
                  </button>
                ))}
              </nav>
            </div>
          ))}
      </main>

      {/* Bottom dock lifted above the wake layer (z-10) so the ambient glow stays behind it. */}
      <div className="relative z-10 flex shrink-0 flex-col">
        <AppTabBar active={tab} onSelect={handleTabSelect} locale={locale} />
      </div>
    </div>
  );
}

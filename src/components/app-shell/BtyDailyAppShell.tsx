"use client";

import { useState, useEffect, useRef } from "react";
import AppTabBar, { type AppTabKey } from "@/components/app-shell/AppTabBar";
import AccountBlock from "@/components/app-shell/AccountBlock";
import { resolveInitialAppTab } from "@/components/app-shell/initialTab";
import CenterMeCard from "@/components/center/CenterMeCard";
import CenterKeepRoom from "@/components/center/CenterKeepRoom";
import FoundryEventRooms from "@/components/foundry/event-rooms/FoundryEventRooms";
import { ArenaRoom } from "@/components/app-shell/ArenaRoom";
import WeeklyOrb from "@/components/app-shell/WeeklyOrb";
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
 * HubTopNav / ArenaLayoutShell / CenterLayoutShell / ScreenShell). Five tabs
 * switch locally (in-component state) — no navigation to legacy routes, no
 * iframes. Relationship model: Today (the day's door) · Center=Self · Arena=
 * Others · Foundry=World · Me=identity.
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
    cards: { noun: string; action: string; tab: AppTabKey; focus: TodayFocusKey; select: string }[];
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

export default function BtyDailyAppShell({ locale }: { locale: Locale }) {
  const [tab, setTab] = useState<AppTabKey>("today");

  // Return contract (Slice 3.1B-3E): open a specific tab from `?tab=` once on mount — used
  // after an account switch returns to `/app?tab=foundry`. Only known tab values are honored
  // (unknown → no-op, default stays Today); the param is consumed via replaceState so a
  // re-render / back never re-triggers it and no navigation loop forms.
  useEffect(() => {
    const requested = resolveInitialAppTab(window.location.search);
    if (!requested) return;
    setTab(requested);
    try {
      const params = new URLSearchParams(window.location.search);
      params.delete("tab");
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

  // Post-confirm settling (STEP 1): the Today selection + confirmation are OWNED here at the shell —
  // LIFTED out of TodaySurface — so a same-session tab switch no longer discards the accepted day
  // (TodaySurface unmounts on tab change; the shell does not). In-memory ONLY: no storage, no cookie,
  // no API, no DB — a cold launch / full shell remount resets them (intentional).
  const [todaySelected, setTodaySelected] = useState<TodayFocusKey | null>(null);
  const [todayConfirmed, setTodayConfirmed] = useState(false);

  // Today Relationship Commitment (V1): the confirmed relationship is a DURABLE, server-recognized
  // decision for the canonical BTY day. `todayHydrated` gates the Today doors until the mount GET
  // resolves, so a committed day restores its terminal state with NO uncommitted-door flash and NO
  // arrival replay; an uncommitted day plays the normal arrival. Flips true exactly once per shell
  // session (the shell does not remount on tab switch), so tab-return never re-holds.
  const [todayHydrated, setTodayHydrated] = useState(false);

  // Today Living Response (V1): the one grounded perspective for today's commitment. Read-only on the
  // client — settled/pending view only; only ready/fallback carry a line (pending renders nothing).
  const [livingResponse, setLivingResponse] = useState<LivingResponseView | null>(null);
  // Presence V1.1 — arms the ONE-TIME arrival reveal. Set true ONLY when a first-generation line
  // resolves from this session's own commit (handleTodayConfirm); the hydration/restore path never
  // arms it, and onLivingArrivalEnd disarms it after the reveal so a tab-return remount paints at rest.
  const [animateLivingArrival, setAnimateLivingArrival] = useState(false);
  // Commitment-scoped one-shot guard for hydration MATERIALIZATION: at most one POST per commitment
  // (keyed by BTY day_key — one commitment per user/day) per mounted session. Marked BEFORE the await
  // and held in a ref so it survives React Strict-Mode effect replay, rerenders, and tab-return.
  const materializeKeyRef = useRef<string | null>(null);

  // Three-door affordance is a ONCE-PER-SESSION cue. TodaySurface unmounts on tab switch; this ref
  // (held at the shell, which does NOT unmount) makes the sequence play on the first Today mount of
  // the session only — never on a tab-return or an intelligence refresh. In-memory; no persistence.
  const arrivalPlayedRef = useRef(false);

  // Today Intelligence (Phase 3): deterministic bands/narrative, read-only. Plus the user's
  // open promise (A+), read-only. Both fetched once on mount so Today is ready immediately.
  // Fail-soft — the shell always renders (FALLBACK_INTEL / null promise).
  const [intel, setIntel] = useState<TodayIntelligence>(FALLBACK_INTEL);
  const [intelLoading, setIntelLoading] = useState(true);
  const [promiseText, setPromiseText] = useState<string | null>(null);
  // Center Promise Loop STEP 1B: the self-owned Center keep, surfaced read-only on Today.
  // null unless a keep exists for today (keptToday). Fail-soft → null (nothing renders).
  const [centerKeepLine, setCenterKeepLine] = useState<string | null>(null);
  // Yesterday → Today Memory Bridge V1: the one evidence-backed remembered line from yesterday's real
  // commitment (null unless yesterday held one). memoryPending holds the arrival trace's reserved
  // height until the read settles, so the line appears once (no status→memory swap, no layout jump).
  const [yesterdayMemory, setYesterdayMemory] = useState<string | null>(null);
  // ARRIVAL ORDER PATCH V1: the Today arrival is held (via the existing hydration gate) until the
  // memory read settles, so a remembered line is present when the cascade plays. `memoryPending`
  // clears on the read settling OR the bounded cap firing (whichever first); the cap ref then
  // prevents a late read from swapping a line into an already-arrived Today.
  const [memoryPending, setMemoryPending] = useState(true);
  const memoryCappedRef = useRef(false);
  // Me-tab Weekly Orb rhythm (numberless barIntensity[]). Fail-soft: [] → resting orb.
  const [weeklyRhythm, setWeeklyRhythm] = useState<MeWeeklyRhythm>([]);

  useEffect(() => {
    let alive = true;
    void fetchTodayIntelligence().then((data) => {
      if (!alive) return;
      setIntel(data);
      setIntelLoading(false);
    });
    void fetchOpenPromise(locale).then((text) => {
      if (!alive) return;
      setPromiseText(text);
    });
    void fetchTodayCenterKeep().then((line) => {
      if (!alive) return;
      setCenterKeepLine(line);
    });
    void fetchYesterdayMemory().then((line) => {
      // If the cap already released the arrival (pathologically slow read), do NOT inject a late
      // line — that would be a status→memory swap on an already-arrived Today. Normal reads win the
      // race and set the line before the cap, so memory is present when the cascade plays.
      if (!alive || memoryCappedRef.current) return;
      setYesterdayMemory(line);
      setMemoryPending(false);
    });
    void fetchWeeklyRhythm().then((rhythm) => {
      if (!alive) return;
      setWeeklyRhythm(rhythm);
    });
    return () => {
      alive = false;
    };
  }, [locale]);

  // ARRIVAL ORDER PATCH V1 — bounded backstop so a pathologically slow memory read can never hold
  // the Today arrival longer than MEMORY_ARRIVAL_CAP_MS. On cap, release the arrival (memory absent
  // this time) and lock out a late read so it cannot swap in after the cascade has played.
  useEffect(() => {
    const id = setTimeout(() => {
      memoryCappedRef.current = true;
      setMemoryPending(false);
    }, MEMORY_ARRIVAL_CAP_MS);
    return () => clearTimeout(id);
  }, []);

  // Center Daily Trace STEP 1A — record a quiet self-return the first time the native app is
  // reached (Today is the default surface, so shell mount == native Today arrival). Fire-and-forget,
  // once per mount; server-side idempotency (one user_day row per day) makes repeat tab visits and
  // cold relaunches safe. Records only — no visible UI, not tied to Orb timing, and WeeklyOrb is NOT
  // re-sourced here (it still reads the meWeeklyRhythm temporary Arena carrier).
  useEffect(() => {
    recordNativeSelfReturn();
  }, []);

  // Rehydrate today's commitment before showing an interactive (uncommitted) Today. If a commitment
  // exists, restore the confirmed terminal state and mark the arrival consumed so it does NOT replay.
  // Always release the hydration gate (fail-soft) so an uncommitted / degraded day still arrives.
  useEffect(() => {
    let alive = true;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    const POLL_MAX = 5;
    const POLL_INTERVAL_MS = 1500;

    // Bounded, quiet GET recheck while a generation attempt is IN_PROGRESS (never POSTs, never loops
    // forever, cancels on unmount / commitment change). Settled result renders when it arrives.
    const pollPending = (attempt: number) => {
      if (!alive || attempt >= POLL_MAX) return;
      pollTimer = setTimeout(() => {
        void fetchLivingResponse().then((r) => {
          if (!alive) return;
          if (r && r.status !== "pending") setLivingResponse(r);
          else pollPending(attempt + 1);
        });
      }, POLL_INTERVAL_MS);
    };

    // Materialize the Living Response for an already-committed day. GET first: settled → render;
    // pending → bounded recheck; NULL (no row ever created) → one idempotent POST to generate. The
    // per-commitment guard makes the POST at most once. Any failure stays visually quiet.
    const materialize = async (dayKey: string) => {
      const first = await fetchLivingResponse();
      if (!alive) return;
      if (first && first.status !== "pending") return void setLivingResponse(first);
      if (first && first.status === "pending") return pollPending(0);
      // first === null (no row): POST once per commitment (guard marked BEFORE the await).
      if (materializeKeyRef.current === dayKey) return pollPending(0);
      materializeKeyRef.current = dayKey;
      const posted = await postLivingResponse();
      if (!alive) return;
      if (posted && posted.status !== "pending") return void setLivingResponse(posted);
      if (posted && posted.status === "pending") return pollPending(0);
      // posted === null → quiet failure: no toast/spinner/error; confirmed Today stays intact.
    };

    void fetchTodayCommitment()
      .then((commitment) => {
        if (!alive) return;
        if (commitment) {
          setTodaySelected(focusFromRelationship(commitment.relationship));
          setTodayConfirmed(true);
          arrivalPlayedRef.current = true; // committed day paints at rest — no arrival animation
          void materialize(commitment.dayKey);
        }
      })
      .finally(() => {
        if (alive) setTodayHydrated(true);
      });
    return () => {
      alive = false;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, []);

  // CTA confirm → durable commitment. On committed/locked, adopt the SERVER's canonical relationship
  // (locked restores a different, already-committed door) and enter the confirmed terminal state.
  // On failure, return false so the CTA stays retryable — never fabricate a confirmation.
  const handleTodayConfirm = async (focus: TodayFocusKey): Promise<boolean> => {
    const outcome = await postTodayCommitment(focus, resolveInvitedFocus(intel), locale);
    if (outcome.status === "committed" || outcome.status === "locked") {
      setTodaySelected(outcome.focus);
      setTodayConfirmed(true);
      // Fire the Living Response POST AFTER confirmation — never awaited, never blocks the CTA. The
      // perspective (ready/fallback) arrives when it resolves; failure leaves the terminal intact.
      // FIRST GENERATION: arm the one-time arrival reveal only when a real line resolves (never for a
      // pending view, and never on the restore path).
      void postLivingResponse().then((r) => {
        if (!r) return;
        setLivingResponse(r);
        if (r.status !== "pending" && r.perspective) setAnimateLivingArrival(true);
      });
      return true;
    }
    return false;
  };

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

      <main className="relative z-10 flex-1 overflow-y-auto px-5 pb-4 pt-8" aria-label={t.appAria}>
        {tab === "today" &&
          // ARRIVAL ORDER PATCH V1: hold the surface behind the EXISTING hydration gate until the
          // memory read has also settled (bounded by MEMORY_ARRIVAL_CAP_MS), so a remembered line is
          // present at first paint and rides its arrival beat ahead of the doors — never a late,
          // post-doors pop. No-memory users clear this in the same fast read; the greeting is never
          // held beyond the cap.
          (todayHydrated && !memoryPending ? (
            <TodaySurface
              copy={t.today}
              statusLine={selectTodayStatus(locale, intel.userState)}
              yesterdayMemory={yesterdayMemory}
              activeFocus={resolveInvitedFocus(intel)}
              loading={intelLoading}
              promiseText={promiseText}
              centerKeepLine={centerKeepLine}
              selected={todaySelected}
              setSelected={setTodaySelected}
              confirmed={todayConfirmed}
              setConfirmed={setTodayConfirmed}
              onConfirm={handleTodayConfirm}
              livingResponse={livingResponse}
              animateLivingArrival={animateLivingArrival}
              onLivingArrivalEnd={() => setAnimateLivingArrival(false)}
              firstArrival={!arrivalPlayedRef.current}
              onArrivalConsumed={() => {
                arrivalPlayedRef.current = true;
              }}
            />
          ) : (
            // Bounded hydration hold — a calm, empty Today surface (never the uncommitted doors)
            // while the commitment GET resolves. No spinner, no copy; the dark shell is enough.
            <div data-today-hydrating aria-hidden className="min-h-full" />
          ))}
        {/* Center = the self-owned Daily Keep room (Center Promise Loop STEP 1A): write and
            save ONE honest line for today. Server-persisted (Center-owned dear_me_letters,
            marker prompt='center_daily_keep') — NO Arena action contract, NO LLM reply, NO
            localStorage. The prepared-room copy (t.center) is retained on COPY as a reserved
            fallback identity. arena/foundry stay LockedRoom until their own steps. */}
        {tab === "center" && <CenterKeepRoom locale={locale} />}
        {/* Arena = relationship with others. In-shell published-practice player
            (Slice 3.0C-1): list → start → play → complete → list, ALL local state,
            NO router/navigation. t.arena copy reused only for the empty state. */}
        {tab === "arena" && <ArenaRoom locale={locale} lockedTag={t.arena.tag} lockedBody={t.arena.body} />}
        {/* Foundry = relationship with the world. V1 is Event Rooms: a manager
            opens one real shared room and brings the team in by QR. Replaces the
            LockedRoom placeholder (t.foundry retained as reserved fallback copy). */}
        {tab === "foundry" && <FoundryEventRooms locale={locale} />}
        {/* Me = Center/self-owned mirror rendered inside Today. Today supplies the
            render slot + locale ONLY; the card reads its own Center/self-safe
            derived value (leadershipState stage). The prepared-room copy (t.me)
            is retained on COPY as the reserved fallback identity.

            Below the mirror, a quiet Weekly Orb reflects the week's numberless rhythm as
            light (not a chart/link/control). The Arena read + composition happen HERE at
            the shell (the composition layer) — CenterMeCard stays Center-pure and never
            reads /api/arena/*. Framed as a self "weekly trace," not competition. */}
        {tab === "me" && (
          <div className="flex flex-col">
            {/* Canonical account-management surface: current email + Use another account +
                Sign out (Slice 3.1B-3E). Uses the shared switchAccount/signOutAccount actions. */}
            <div className="mb-5">
              <AccountBlock locale={locale} />
            </div>
            <CenterMeCard locale={locale} />
            {/* Lift the weekly light up into the open space below the mirror so it is the
                emotional centre of the Me tab (not a bottom decoration) and its caption
                clears the bottom tab dock. vh-relative so the lift scales across devices. */}
            <div className="-mt-[24vh]">
              <WeeklyOrb intensities={weeklyRhythm} locale={locale} />
            </div>
          </div>
        )}
      </main>

      {/* Bottom dock lifted above the wake layer (z-10) so the ambient glow stays behind it. */}
      <div className="relative z-10 flex shrink-0 flex-col">
        <AppTabBar active={tab} onSelect={setTab} />
      </div>
    </div>
  );
}

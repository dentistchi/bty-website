"use client";

import { useState, useEffect, useRef } from "react";
import AppTabBar, { type AppTabKey } from "@/components/app-shell/AppTabBar";
import CenterMeCard from "@/components/center/CenterMeCard";
import CenterKeepRoom from "@/components/center/CenterKeepRoom";
import WeeklyOrb from "@/components/app-shell/WeeklyOrb";
import { fetchMeWeeklyRhythm, type MeWeeklyRhythm } from "@/components/app-shell/meWeeklyRhythm";
import type { TodayConfidence, TodayIntelligence, TodayUserState } from "@/domain/daily/todayIntelligence";

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
 * Layout is a flex column so the tab bar and companion dock are real children,
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
    cards: { t: string; d: string; tab: AppTabKey; focus: TodayFocusKey; select: string }[];
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
  companion: string;
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
      sub: "Choose the relationship you will live today.",
      cards: [
        { t: "Self", d: "Return to yourself.", tab: "center", focus: "Self", select: "Self — Return to yourself with honesty." },
        { t: "Others", d: "Meet others with care.", tab: "arena", focus: "Others", select: "Others — Carry care into one relationship." },
        { t: "World", d: "Build what you are here to steward.", tab: "foundry", focus: "World", select: "World — Build with stewardship today." },
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
    companion: "Dr. Chi is with you today.",
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
      sub: "오늘 어떤 관계를 살아내시겠습니까?",
      cards: [
        { t: "나와의 관계", d: "나에게 돌아옵니다.", tab: "center", focus: "Self", select: "나와의 관계 — 정직하게 자신에게 돌아갑니다." },
        { t: "이웃과의 관계", d: "이웃을 정성으로 마주합니다.", tab: "arena", focus: "Others", select: "이웃과의 관계 — 한 관계 안으로 조심스럽게 들어갑니다." },
        { t: "세상과의 관계", d: "오늘 맡겨진 것을 빚어갑니다.", tab: "foundry", focus: "World", select: "세상과의 관계 — 맡겨진 것을 오늘도 빚어갑니다." },
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
    companion: "Dr. Chi가 오늘 함께합니다.",
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
 * Three-door affordance timing (Three-Door Affordance STEP 2). One restrained surface-warmth bloom
 * per door, staggered in DOM order, one pass only. Envelope: ~440ms per door, ~120ms between →
 * total ≈ 680ms (well under the 1.8s ceiling). AFFORDANCE_TOTAL_MS also gates when the deferred
 * evidence invitation may appear (never before the neutral sequence is legible).
 */
export const AFFORDANCE_DOOR_MS = 440;
export const AFFORDANCE_GAP_MS = 120;
export const AFFORDANCE_TOTAL_MS = AFFORDANCE_GAP_MS * 2 + AFFORDANCE_DOOR_MS; // 3 doors → 680ms

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

export function TodaySurface({
  copy,
  statusLine,
  activeFocus,
  loading,
  promiseText,
  centerKeepLine,
  selected: selectedProp,
  setSelected: setSelectedProp,
  confirmed: confirmedProp,
  setConfirmed: setConfirmedProp,
  firstArrival = false,
  onArrivalConsumed,
}: {
  copy: TodayCopy;
  /** Calm narrative status line derived from userState (already localized). */
  statusLine: string;
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
  /** True only on the FIRST Today mount of a shell session — plays the one-time three-door
   *  affordance sequence and defers the evidence invitation until after it. Default false
   *  (isolated renders / tab-returns paint at rest with the invitation immediate). */
  firstArrival?: boolean;
  /** Called once on mount so the shell can mark the session affordance consumed (no replay). */
  onArrivalConsumed?: () => void;
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

  // The evidence-backed invitation (gold ring / heartbeat) must not appear BEFORE the neutral
  // affordance is legible. On first animated arrival it is deferred until the sequence completes;
  // otherwise (tab-return / reduced-motion) it is immediate. NONE/LOW have no invited focus anyway.
  const [showInvitation, setShowInvitation] = useState(!animateArrival);
  useEffect(() => {
    if (!animateArrival) {
      setShowInvitation(true);
      return;
    }
    const id = setTimeout(() => setShowInvitation(true), AFFORDANCE_TOTAL_MS);
    return () => clearTimeout(id);
  }, [animateArrival]);

  // Mark the session affordance consumed on first mount so a tab-return does not replay it.
  useEffect(() => {
    onArrivalConsumed?.();
  }, [onArrivalConsumed]);

  // The invited door: the user's pick once made, else the softly-suggested derived focus — but the
  // system suggestion is withheld until the affordance sequence has played (showInvitation).
  const highlight = selected ?? (showInvitation ? activeFocus : null);
  // The one-time affordance illumination plays only during an animated first arrival, before any
  // selection. A tap immediately suppresses the remaining sequence (selected !== null).
  const showAffordance = animateArrival && selected === null;

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
          resolves the sentence rises into the reserved space. */}
      {loading ? (
        <div aria-hidden className="mb-8 mt-0.5 h-7" />
      ) : (
        <p
          data-today-status
          className="btyRise mb-8 mt-0.5 text-[1.05rem] font-normal leading-7 text-white/85"
          style={{ animationDelay: "200ms" }}
        >
          {statusLine}
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
        <div className="relative">
          {/* Spine of light — drawn only during an animated first arrival (session-once), riding
              the head of the door-illumination sequence. On a tab-return / reduced-motion the doors
              simply appear at rest with no spine draw. */}
          {animateArrival ? (
          <span
            aria-hidden
            className="btySpine pointer-events-none absolute bottom-1 left-0 top-1 z-10 w-px bg-gradient-to-b from-transparent via-[#C9A66B]/50 to-transparent"
            style={{ animationDelay: "150ms" }}
          >
            <span
              className="btySpark absolute left-0 h-12 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#C9A66B] blur-[2px]"
              style={{ animationDelay: "150ms" }}
            />
          </span>
          ) : null}
          {copy.cards.map((c, i) => {
          // Experiment A "Daybreak": the three doors no longer rise as one block — each rises
          // in sequence (three lamps coming on), 100ms apart after the trace has landed, and its
          // threshold seam ignites a beat later AS THE SPINE'S SPARK REACHES IT. The staggered
          // ignition IS the "worlds awakening"; the eye follows the spark down to a door, and the
          // finger follows the eye.
          const riseDelay = 300 + i * 100;
          const igniteDelay = riseDelay + 70;
          const isHighlight = c.focus === highlight;
          const isSelected = c.focus === selected;
          // Before confirm: unselected doors quiet to 40%. After confirm: they are GONE.
          const isDimmed = selected !== null && !isSelected && !confirmed;
          const isGone = confirmed && !isSelected;
          return (
            <div
              key={c.t}
              aria-hidden={isGone || undefined}
              className={`grid transition-all duration-500 ease-out ${
                isGone ? "grid-rows-[0fr] mb-0 opacity-0" : "grid-rows-[1fr] mb-3 opacity-100"
              }`}
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
                  className={`transition-opacity duration-300 ${isDimmed ? "opacity-40" : "opacity-100"}`}
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
                    className={`group relative flex w-full flex-col items-start gap-1.5 overflow-hidden border px-6 py-6 text-left transition duration-300 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A66B]/40 ${
                      isSelected
                        ? "rounded-2xl rounded-b-none border-b-0 border-[#C9A66B]/45 bg-gradient-to-b from-[#C9A66B]/[0.08] to-[#C9A66B]/[0.04]"
                        : isHighlight
                          ? "rounded-2xl border-[#C9A66B]/30 bg-gradient-to-b from-[#C9A66B]/[0.06] to-white/[0.02] ring-1 ring-[#C9A66B]/15"
                          : "rounded-2xl border-white/10 bg-gradient-to-b from-white/[0.055] to-white/[0.02] hover:border-[#C9A66B]/25 hover:from-white/[0.08]"
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
                    {/* Experiment A — the seam IGNITE: a brighter core that sweeps down the seam
                        once as this door arrives (staggered per door), then fades to nothing. It is
                        the "lamp coming on" beat; at rest only the base seam above remains. Sits at
                        opacity 0 by default so reduced-motion (animation:none) shows nothing extra. */}
                    <span
                      aria-hidden
                      className={`${animateArrival ? "btyIgnite " : ""}pointer-events-none absolute inset-y-4 left-0 w-0.5 origin-top bg-gradient-to-b from-[#C9A66B]/0 via-[#C9A66B] to-[#C9A66B]/0 opacity-0 blur-[0.5px]`}
                      style={animateArrival ? { animationDelay: `${igniteDelay}ms` } : undefined}
                    />
                    {/* THREE-DOOR AFFORDANCE (Three-Door Affordance STEP 2): a restrained, EQUAL,
                        one-time surface warmth that blooms once on each door in DOM order (Self →
                        Others → World), staggered by AFFORDANCE_GAP_MS. Its sole meaning is "choose
                        one of these three" — identical on all doors, never a recommendation. It is
                        capped below the invited-door interior warmth (0.14 < 0.16), ends at opacity
                        0 (no residue), plays only on an animated first arrival, and is suppressed the
                        instant a door is selected. reduced-motion removes it entirely. */}
                    {showAffordance ? (
                      <span
                        data-afford
                        aria-hidden
                        className="btyAfford pointer-events-none absolute inset-0 bg-gradient-to-r from-[#C9A66B]/[0.14] via-transparent to-transparent"
                        style={{ animationDelay: `${i * AFFORDANCE_GAP_MS}ms` }}
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
                    <span className="relative text-lg font-semibold text-white">{c.t}</span>
                    <span className="relative text-sm leading-6 text-white/55">{c.d}</span>
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
                      {/* Layer 1 — path sublabel (reuses the locked-room eyebrow tone). */}
                      <span
                        data-path-label
                        className="relative block text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90"
                      >
                        {copy.pathLabel}
                      </span>
                      {/* Layer 2 — the chosen-path line. Before confirm: the selection line
                          (doubles as the fallback when no promise). After confirm: it BECOMES the
                          present-tense benediction (STEP 3) — one sentence, never two. */}
                      <p data-select-line className="relative mt-2 text-[0.95rem] leading-6 text-white/85">
                        {confirmed ? copy.benediction[c.focus] ?? copy.benediction.fallback : c.select}
                      </p>
                      {/* Layers 3 + 4 — the promise to carry, ONLY when a real open promise exists.
                          action_text is rendered verbatim (unchanged); no fabrication on fallback. */}
                      {promiseText ? (
                        <>
                          <span
                            data-promise-label
                            className="relative mt-4 block text-[11px] font-normal tracking-normal text-white/40"
                          >
                            {copy.promiseLabel}
                          </span>
                          <p data-carry-line className="relative mt-2 text-[0.95rem] leading-6 text-white/80">
                            {promiseText}
                          </p>
                        </>
                      ) : null}
                      {/* CTA — pre-press is the strong filled-gold action; the settled state SINKS to
                          an outline + ✓ (the quiet action-mark). No undo: it does not toggle back, and
                          once confirmed the press is idempotently inert (guarded) — aria-pressed, the
                          accessible name, and focus are unchanged, so repeat activation is harmless. */}
                      <button
                        type="button"
                        onClick={() => {
                          if (!confirmed) setConfirmed(true);
                        }}
                        aria-pressed={confirmed}
                        data-today-cta
                        className={`relative mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A66B]/40 ${
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
          eyebrow ("Held in Center") + the quoted line + a quiet support line. No number, no
          streak, no verdict, no CTA. Renders only when a keep exists for today (keptToday). */}
      {!loading && centerKeepLine ? (
        <div data-today-center-keep className="btyRise mt-10 border-t border-white/5 pt-6">
          <span className="block text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">
            {copy.centerKeep.label}
          </span>
          <p data-center-keep-line className="mt-2 text-[1.05rem] leading-7 text-white/85">
            “{centerKeepLine}”
          </p>
          <p className="mt-1.5 text-sm leading-6 text-white/45">{copy.centerKeep.support}</p>
        </div>
      ) : null}
    </>
  );
}

/**
 * Companion dock (v0) — STATUS-ONLY. A reserved, non-floating flex child that can never
 * cover cards/buttons/nav. It states presence and nothing more: no chat launch, no AI
 * call, no route. The earlier ambiguous gold "alive" pulse dot is removed — presence is
 * carried by the avatar + the plain status line.
 */
export function CompanionBar({ label }: { label: string }) {
  return (
    <div className="shrink-0 px-5 pb-2">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.06] to-white/[0.03] px-4 py-2.5 backdrop-blur-sm">
        <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#C9A66B]/20 text-sm font-semibold text-[#C9A66B] ring-1 ring-[#C9A66B]/25">
          치
        </span>
        <span className="truncate text-xs text-white/60">{label}</span>
      </div>
    </div>
  );
}

export default function BtyDailyAppShell({ locale }: { locale: Locale }) {
  const [tab, setTab] = useState<AppTabKey>("today");
  const t = COPY[locale];

  // Post-confirm settling (STEP 1): the Today selection + confirmation are OWNED here at the shell —
  // LIFTED out of TodaySurface — so a same-session tab switch no longer discards the accepted day
  // (TodaySurface unmounts on tab change; the shell does not). In-memory ONLY: no storage, no cookie,
  // no API, no DB — a cold launch / full shell remount resets them (intentional).
  const [todaySelected, setTodaySelected] = useState<TodayFocusKey | null>(null);
  const [todayConfirmed, setTodayConfirmed] = useState(false);

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
    void fetchWeeklyRhythm().then((rhythm) => {
      if (!alive) return;
      setWeeklyRhythm(rhythm);
    });
    return () => {
      alive = false;
    };
  }, [locale]);

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
      {/* Entry fade only (mount). The companion dock is status-only (no pulse); the sole Orb
          now lives at /start. prefers-reduced-motion stills the fade. */}
      <style>{`
        @keyframes btyEnter{from{opacity:0}to{opacity:1}}
        .btyFadeIn{animation:btyEnter .7s ease both}
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
        @keyframes btyOpenRoom{from{opacity:0;transform:translateY(8px) scale(0.992)}to{opacity:1;transform:translateY(0) scale(1)}}
        .btyOpenRoom{animation:btyOpenRoom .48s cubic-bezier(0.22,1,0.36,1) both}
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
        /* THREE-DOOR AFFORDANCE — an equal, restrained surface warmth that blooms once on each door
           in sequence ("choose one of these three"). One pass, ends at opacity 0 (no residue). */
        @keyframes btyAfford{0%{opacity:0}45%{opacity:1}100%{opacity:0}}
        .btyAfford{animation:btyAfford .44s ease-in-out both}
        @media (prefers-reduced-motion: reduce){.btyFadeIn,.btyRise,.btyOpenRoom,.btyWake,.btyDriftA,.btyDriftB,.btySeed,.btySpine,.btySpark,.btyIgnite,.btyHeart,.btyBloom,.btyAfford{animation:none!important}}
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
        {tab === "today" && (
          <TodaySurface
            copy={t.today}
            statusLine={selectTodayStatus(locale, intel.userState)}
            activeFocus={resolveInvitedFocus(intel)}
            loading={intelLoading}
            promiseText={promiseText}
            centerKeepLine={centerKeepLine}
            selected={todaySelected}
            setSelected={setTodaySelected}
            confirmed={todayConfirmed}
            setConfirmed={setTodayConfirmed}
            firstArrival={!arrivalPlayedRef.current}
            onArrivalConsumed={() => {
              arrivalPlayedRef.current = true;
            }}
          />
        )}
        {/* Center = the self-owned Daily Keep room (Center Promise Loop STEP 1A): write and
            save ONE honest line for today. Server-persisted (Center-owned dear_me_letters,
            marker prompt='center_daily_keep') — NO Arena action contract, NO LLM reply, NO
            localStorage. The prepared-room copy (t.center) is retained on COPY as a reserved
            fallback identity. arena/foundry stay LockedRoom until their own steps. */}
        {tab === "center" && <CenterKeepRoom locale={locale} />}
        {tab === "arena" && <LockedRoom tag={t.arena.tag} body={t.arena.body} />}
        {tab === "foundry" && <LockedRoom tag={t.foundry.tag} body={t.foundry.body} />}
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
            <CenterMeCard locale={locale} />
            {/* Lift the weekly light up into the open space below the mirror so it is the
                emotional centre of the Me tab (not a bottom decoration) and its caption
                clears the companion dock. vh-relative so the lift scales across devices. */}
            <div className="-mt-[24vh]">
              <WeeklyOrb intensities={weeklyRhythm} locale={locale} />
            </div>
          </div>
        )}
      </main>

      {/* Bottom dock lifted above the wake layer (z-10) so the ambient glow stays behind it. */}
      <div className="relative z-10 flex shrink-0 flex-col">
        <CompanionBar label={t.companion} />
        <AppTabBar active={tab} onSelect={setTab} />
      </div>
    </div>
  );
}

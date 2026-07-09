"use client";

import { useState, useEffect } from "react";
import AppTabBar, { type AppTabKey } from "@/components/app-shell/AppTabBar";
import CenterMeCard from "@/components/center/CenterMeCard";
import CenterKeepRoom from "@/components/center/CenterKeepRoom";
import WeeklyOrb from "@/components/app-shell/WeeklyOrb";
import { fetchMeWeeklyRhythm, type MeWeeklyRhythm } from "@/components/app-shell/meWeeklyRhythm";
import type { TodayIntelligence, TodayUserState } from "@/domain/daily/todayIntelligence";

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
      cta: "Carry this into today",
      ctaDone: "Carried into today",
      benediction: {
        Self: "You have entered the relationship with yourself today.",
        Others: "You have entered the relationship with others today.",
        World: "You have entered the relationship with the world today.",
        fallback: "You have entered this relationship for today.",
      },
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
      cta: "오늘로 가져오기",
      ctaDone: "오늘로 가져왔습니다",
      benediction: {
        Self: "오늘 당신은 나와의 관계 안으로 들어갔습니다.",
        Others: "오늘 당신은 이웃과의 관계 안으로 들어갔습니다.",
        World: "오늘 당신은 세상과의 관계 안으로 들어갔습니다.",
        fallback: "오늘 당신은 이 관계 안에 머뭅니다.",
      },
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
}: {
  copy: TodayCopy;
  /** Calm narrative status line derived from userState (already localized). */
  statusLine: string;
  /** The relationship to SUGGEST (derived), or null when there is no confident claim. */
  activeFocus: TodayFocusKey | null;
  loading: boolean;
  /** The user's own open promise sentence to carry into today, or null (→ fallback line). */
  promiseText: string | null;
}) {
  // Relationship selection is a deliberate ritual choice (A): tapping reveals the
  // confirmation + CTA in-shell. It does NOT navigate — the bottom tabs own room entry.
  const [selected, setSelected] = useState<TodayFocusKey | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const select = (focus: TodayFocusKey) => {
    setSelected(focus);
    setConfirmed(false);
  };

  // The invited door: the user's pick once made, else the softly-suggested derived focus.
  const highlight = selected ?? activeFocus;

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
          style={{ animationDelay: "260ms" }}
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
      {/* Third beat of the arrival cascade (STEP 5): the doors are GATED on content-ready — they
          mount only once loading clears, so their btyRise clock starts at the SAME moment as the
          trace's and they can never precede it (this is the STEP-4 inversion fix). Delay 720ms
          gives a ~460ms read window after the trace before the doors become visually dominant.
          Gating on !loading also means the "invited" (gold) door appears once, already settled —
          no early gold-pop from FALLBACK→resolved highlight flicker competing with the text.
          reduced-motion: btyRise is inert, so the doors simply appear at rest on content-ready. */}
      {!loading && (
        <div className="btyRise" style={{ animationDelay: "720ms" }}>
          {copy.cards.map((c) => {
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
              {/* overflow-hidden lets the grid-rows 0fr collapse the door's height to zero. */}
              <div className={`overflow-hidden ${isGone ? "pointer-events-none" : ""}`}>
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
                    {/* Interior depth — a quiet warmth leaning in from the seam, growing when invited.
                        Same gentle 700ms ease-out warm-in (STEP 3), reduced-motion-guarded. */}
                    <span
                      aria-hidden
                      className={`pointer-events-none absolute inset-0 bg-gradient-to-r from-[#C9A66B]/[0.08] via-transparent to-transparent transition-opacity duration-700 ease-out motion-reduce:transition-none ${
                        isHighlight ? "opacity-100" : "opacity-0 group-hover:opacity-60"
                      }`}
                    />
                    <span className="relative text-lg font-semibold text-white">{c.t}</span>
                    <span className="relative text-sm leading-6 text-white/55">{c.d}</span>
                  </button>

                  {/* The opened interior — a sibling of the door (valid HTML: no nested button),
                      merged flush beneath it (shared border, no top edge) so door + interior read
                      as one opened whole. After confirm this is the held REST state. */}
                  {isSelected ? (
                    <div
                      data-today-confirm
                      className="relative overflow-hidden rounded-b-2xl border border-t-0 border-[#C9A66B]/45 bg-[#C9A66B]/[0.05] px-6 pb-6 pt-5"
                    >
                      {/* Seam continues down into the interior — one continuous opening. */}
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-[#C9A66B]/40 via-[#C9A66B]/15 to-transparent"
                      />
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
                            className="relative mt-4 block text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90"
                          >
                            {copy.promiseLabel}
                          </span>
                          <p data-carry-line className="relative mt-2 text-[0.95rem] leading-6 text-white/70">
                            {promiseText}
                          </p>
                        </>
                      ) : null}
                      {/* CTA — pre-press is the strong filled-gold action; the settled state SINKS to
                          an outline + ✓ (the quiet action-mark). No undo: it does not toggle back. */}
                      <button
                        type="button"
                        onClick={() => setConfirmed(true)}
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

  // Today Intelligence (Phase 3): deterministic bands/narrative, read-only. Plus the user's
  // open promise (A+), read-only. Both fetched once on mount so Today is ready immediately.
  // Fail-soft — the shell always renders (FALLBACK_INTEL / null promise).
  const [intel, setIntel] = useState<TodayIntelligence>(FALLBACK_INTEL);
  const [intelLoading, setIntelLoading] = useState(true);
  const [promiseText, setPromiseText] = useState<string | null>(null);
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
    <div className="btyFadeIn flex h-[100dvh] flex-col bg-[#0B1F3A] text-white antialiased">
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
        @media (prefers-reduced-motion: reduce){.btyFadeIn,.btyRise{animation:none!important}}
      `}</style>
      {/* iOS status-bar safe area — reserved so app content never underlaps the notch/clock. */}
      <div style={{ height: "env(safe-area-inset-top)" }} aria-hidden />

      <main className="flex-1 overflow-y-auto px-5 pb-4 pt-8" aria-label={t.appAria}>
        {tab === "today" && (
          <TodaySurface
            copy={t.today}
            statusLine={selectTodayStatus(locale, intel.userState)}
            activeFocus={resolveActiveFocus(intel)}
            loading={intelLoading}
            promiseText={promiseText}
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

      <CompanionBar label={t.companion} />

      <AppTabBar active={tab} onSelect={setTab} />
    </div>
  );
}

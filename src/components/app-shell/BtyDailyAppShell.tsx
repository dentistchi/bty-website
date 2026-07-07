"use client";

import { useState, useCallback, useEffect } from "react";
import AppTabBar, { type AppTabKey } from "@/components/app-shell/AppTabBar";
import OrbLiving from "@/components/orb/OrbLiving";
import type { TodayIntelligence, TodayUserState } from "@/domain/daily/todayIntelligence";

/**
 * Canonical hold-to-enter duration — mirrors the production /start Threshold Door
 * (start/page.client.tsx: HOLD_MS = 3000, "누르고 있으면 문이 열린다"). The hold is part
 * of the Orb's Touch Language, not a free parameter; reused here via OrbLiving.onCommit.
 */
const HOLD_MS = 3000;

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
    title: string;
    sub: string;
    cards: { t: string; d: string; tab: AppTabKey; focus: TodayFocusKey; select: string }[];
    /** Confirmation-card sublabels — reuse the locked-room eyebrow tone (no new style). */
    pathLabel: string;
    promiseLabel: string;
    /** In-shell settle CTA: pre-press (cta, strong) → settled (ctaDone, sunk). */
    cta: string;
    ctaDone: string;
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
      sub: "Choose the relationship you will live today.",
      cards: [
        { t: "Self", d: "Return to yourself.", tab: "center", focus: "Self", select: "Self — Return to yourself with honesty." },
        { t: "Others", d: "Enter the Arena with care.", tab: "arena", focus: "Others", select: "Others — Carry care into one relationship." },
        { t: "World", d: "Build what you are here to steward.", tab: "foundry", focus: "World", select: "World — Build with stewardship today." },
      ],
      pathLabel: "TODAY'S PATH",
      promiseLabel: "PROMISE TO CARRY",
      cta: "Carry this into today",
      ctaDone: "Carried into today",
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
      sub: "오늘 어떤 관계를 살아내시겠습니까?",
      cards: [
        { t: "나와의 관계", d: "나에게 돌아옵니다.", tab: "center", focus: "Self", select: "나와의 관계 — 정직하게 자신에게 돌아갑니다." },
        { t: "이웃과의 관계", d: "조심스럽게 Arena로 들어갑니다.", tab: "arena", focus: "Others", select: "이웃과의 관계 — 한 관계 안으로 조심스럽게 들어갑니다." },
        { t: "세상과의 관계", d: "오늘 맡겨진 것을 빚어갑니다.", tab: "foundry", focus: "World", select: "세상과의 관계 — 맡겨진 것을 오늘도 빚어갑니다." },
      ],
      pathLabel: "오늘의 길",
      promiseLabel: "오늘로 가져갈 약속",
      cta: "오늘로 가져오기",
      ctaDone: "오늘로 가져왔습니다",
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

function SurfaceHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <header className="mb-5 space-y-2">
      <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-white">{title}</h1>
      {sub ? <p className="text-[0.95rem] leading-6 text-white/60">{sub}</p> : null}
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

  // Gold ring: the user's pick once made, else the derived suggestion.
  const highlight = selected ?? activeFocus;
  const selectedCard = selected ? copy.cards.find((c) => c.focus === selected) : null;

  return (
    <>
      <SurfaceHeader title={copy.title} sub={copy.sub} />
      {loading ? (
        <div aria-hidden className="mb-6 h-4 w-2/3 animate-pulse rounded bg-white/10" />
      ) : (
        <p data-today-status className="mb-6 text-[0.95rem] leading-6 text-white/70">
          {statusLine}
        </p>
      )}
      <div className="space-y-3">
        {copy.cards.map((c) => {
          const isHighlight = c.focus === highlight;
          const isSelected = c.focus === selected;
          return (
            <button
              key={c.t}
              type="button"
              onClick={() => select(c.focus)}
              aria-pressed={isSelected}
              data-focus={c.focus}
              className={`group flex w-full items-center gap-4 rounded-2xl border p-5 text-left transition duration-200 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A66B]/40 ${
                isHighlight
                  ? "border-[#C9A66B]/50 bg-[#C9A66B]/[0.07] ring-1 ring-[#C9A66B]/25"
                  : "border-white/10 bg-white/[0.04] hover:border-[#C9A66B]/25 hover:bg-white/[0.07] active:bg-white/[0.09]"
              }`}
            >
              <span
                aria-hidden
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg font-semibold text-[#C9A66B] transition ${
                  isHighlight
                    ? "bg-[#C9A66B]/30 ring-1 ring-[#C9A66B]/40"
                    : "bg-[#C9A66B]/15 ring-1 ring-[#C9A66B]/20 group-hover:bg-[#C9A66B]/25"
                }`}
              >
                {c.t.slice(0, 1)}
              </span>
              <span className="min-w-0">
                <span className="block text-base font-semibold text-white">{c.t}</span>
                <span className="block text-sm text-white/55">{c.d}</span>
              </span>
            </button>
          );
        })}
      </div>

      {selected ? (
        <div
          data-today-confirm
          className="mt-6 rounded-2xl border border-[#C9A66B]/25 bg-[#C9A66B]/[0.05] p-5"
        >
          {/* Layer 1 — path sublabel (reuses the locked-room eyebrow tone). */}
          <span
            data-path-label
            className="block text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90"
          >
            {copy.pathLabel}
          </span>
          {/* Layer 2 — selection confirmation. Doubles as the fallback line when no promise. */}
          <p data-select-line className="mt-2 text-[0.95rem] leading-6 text-white/85">
            {selectedCard?.select}
          </p>
          {/* Layers 3 + 4 — the promise to carry, ONLY when a real open promise exists.
              action_text is rendered verbatim (unchanged); no fabrication on fallback. */}
          {promiseText ? (
            <>
              <span
                data-promise-label
                className="mt-4 block text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90"
              >
                {copy.promiseLabel}
              </span>
              <p data-carry-line className="mt-2 text-[0.95rem] leading-6 text-white/70">
                {promiseText}
              </p>
            </>
          ) : null}
          {/* CTA — pre-press is the strong filled-gold action; the settled state SINKS to
              an outline + ✓ (reverses the earlier direction). */}
          <button
            type="button"
            onClick={() => setConfirmed(true)}
            aria-pressed={confirmed}
            data-today-cta
            className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A66B]/40 ${
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

/**
 * OrbThreshold — the living doorway BEFORE Today. An Orb-only surface (no cards, no
 * companion dock, no tabs): the first moment is "entering the day", not "choosing a
 * menu". Holding the canonical Orb fires its onCommit (the canonical hold-to-enter; the
 * contact→ramp→MEDIUM-commit haptic Touch Language and warm-golden entry light are
 * OrbLiving's own) → the parent transitions into Today, mounted under the receding light.
 */
function OrbThreshold({
  locale,
  entering,
  onEnter,
}: {
  locale: Locale;
  entering: boolean;
  onEnter: () => void;
}) {
  // Microcopy kept a whisper — the Orb is the hero, this only affords the hold-to-enter.
  const hint = locale === "ko" ? "누르고 있으면 열립니다." : "Hold to begin.";
  return (
    <div
      className={`flex h-[100dvh] flex-col items-center justify-center bg-[#0B1F3A] text-white antialiased transition-opacity duration-700 ${
        entering ? "opacity-0" : "opacity-100"
      }`}
      aria-label="BTY Daily — enter the day"
    >
      <div style={{ height: "env(safe-area-inset-top)" }} aria-hidden />
      <div className="flex flex-1 flex-col items-center justify-center gap-10">
        {/* Canonical hold-to-enter: OrbLiving.onCommit IS the door trigger (no separate
            onClick/tap wrapper). holdMs mirrors /start; the contact + progressive + MEDIUM
            commit haptics and the golden entry light are OrbLiving's own Touch Language. */}
        <OrbLiving size={220} holdMs={HOLD_MS} onCommit={onEnter} />
        <p className="text-[11px] font-medium tracking-wide text-white/35">{hint}</p>
      </div>
      <div style={{ height: "env(safe-area-inset-bottom)" }} aria-hidden />
    </div>
  );
}

export default function BtyDailyAppShell({ locale }: { locale: Locale }) {
  const [tab, setTab] = useState<AppTabKey>("today");
  const [todayEntered, setTodayEntered] = useState(false);
  const [entering, setEntering] = useState(false);
  const t = COPY[locale];

  // Today Intelligence (Phase 3): deterministic bands/narrative, read-only. Plus the user's
  // open promise (A+), read-only. Both fetched once on mount so Today is ready by the time
  // the Orb threshold opens. Fail-soft — the shell always renders (FALLBACK_INTEL / null promise).
  const [intel, setIntel] = useState<TodayIntelligence>(FALLBACK_INTEL);
  const [intelLoading, setIntelLoading] = useState(true);
  const [promiseText, setPromiseText] = useState<string | null>(null);

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
    return () => {
      alive = false;
    };
  }, [locale]);

  // Native cold-reopen white-screen P0 is CLOSED; the temporary [BTYAppBoot] boot
  // diagnostics (mount marker + global error/rejection console capture) were removed.
  // Genuine fatal-render logging still lives in app/global-error.tsx.

  const enterToday = useCallback(() => {
    if (entering) return;
    setEntering(true); // cross-fade the threshold out (reduced-motion path: no gold)
    const reduce =
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Normal motion: OrbLiving's golden entry light is at peak on commit and recedes over
    // Today (orbGoldenOverlay, /app arrival) — so mount Today quickly UNDER the light
    // ("from inside the light"). Reduced-motion has no gold → near-instant. Local state
    // only — no persistence, so a reload shows the threshold again (acceptable for v1).
    window.setTimeout(() => setTodayEntered(true), reduce ? 120 : 200);
  }, [entering]);

  // Threshold door: the Orb is the doorway INTO the day. Until entry the app is
  // Orb-only (no cards/companion/tabs). Session-local (STEP 5): switching tabs and
  // returning keeps Today entered; only a reload re-shows the threshold.
  if (!todayEntered) {
    return <OrbThreshold locale={locale} entering={entering} onEnter={enterToday} />;
  }

  return (
    <div className="btyFadeIn flex h-[100dvh] flex-col bg-[#0B1F3A] text-white antialiased">
      {/* Entry fade only — the canonical Orb (OrbLiving) owns its own canvas animation, and
          the companion dock is now status-only (no pulse). prefers-reduced-motion stills it. */}
      <style>{`
        @keyframes btyEnter{from{opacity:0}to{opacity:1}}
        .btyFadeIn{animation:btyEnter .7s ease both}
        @media (prefers-reduced-motion: reduce){.btyFadeIn{animation:none!important}}
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
        {tab === "center" && <LockedRoom tag={t.center.tag} body={t.center.body} />}
        {tab === "arena" && <LockedRoom tag={t.arena.tag} body={t.arena.body} />}
        {tab === "foundry" && <LockedRoom tag={t.foundry.tag} body={t.foundry.body} />}
        {tab === "me" && <LockedRoom tag={t.me.tag} body={t.me.body} />}
      </main>

      <CompanionBar label={t.companion} />

      <AppTabBar active={tab} onSelect={setTab} />
    </div>
  );
}

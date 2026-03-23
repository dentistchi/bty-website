"use client";

/**
 * Top-level Arena session: next scenario via `GET /api/arena/session/next` ({@link getNextScenarioForSession}) + {@link buildArenaContext} through `GET /api/arena/session/context`,
 * {@link ScenarioCard} (catalog or synthetic mirror), choice → POST `/api/arena/session/choice`, toast + summary overlay.
 * Shell locale preference: `localStorage` key {@link ARENA_SHELL_LOCALE_KEY}.
 */

import { useRouter } from "next/navigation";
import React from "react";
import type { SessionFlagBadgeVariant } from "@/domain/arena/sessionSummary";
import type { XPAwardResult } from "@/engine/integration/xp-integrity-bridge";
import type { Scenario as CatalogScenario } from "@/lib/bty/scenario/types";
import { ARENA_EJECTED_WINDOW_EVENT } from "@/components/arena/arenaClientEvents";
import { DelayedOutcomeBanner } from "@/components/arena/DelayedOutcomeBanner";
import { FeedbackPromptModal, FEEDBACK_SUBMITTED_EVENT } from "@/components/arena/FeedbackPromptModal";
import { ScenarioCard } from "@/components/arena/ScenarioCard";
import type { ChoiceConfirmedDetail } from "@/components/arena/ScenarioCard";
import { SessionSummaryOverlay } from "@/components/arena/SessionSummaryOverlay";

export const ARENA_SHELL_LOCALE_KEY = "bty_arena_shell_locale_v1" as const;

export type ScenarioSessionShellProps = {
  className?: string;
  /**
   * Parent ({@link ArenaShellLayout}) renders {@link FeedbackPromptModal} + {@link DelayedOutcomeBanner} and passes locale.
   */
  embeddedInArenaShell?: boolean;
  locale?: "ko" | "en";
  feedbackRefetchKey?: number;
  onBumpFeedbackPrompt?: () => void;
  onActiveScenarioChange?: (scenario: CatalogScenario | null) => void;
  onArenaEjected?: () => void;
  /** Bump to force reload via `GET /api/arena/session/next` (e.g. `detail.reloadSession` on `next_scenario_requested`). */
  sessionReloadKey?: number;
  /** When set to a string, skips `/api/arena/profile`. Omit or `undefined` while unknown so shell can fetch. */
  parentUserId?: string;
};

type NextApi = { ok?: boolean; scenario?: CatalogScenario; error?: string; code?: string };
type ContextApi = {
  ok?: boolean;
  patternNarrative?: string;
  pendingOutcomeIds?: string[];
  error?: string;
};
type ChoiceApi = {
  ok?: boolean;
  xpEarned?: number;
  airDelta?: number;
  previousAir?: number;
  newAir?: number;
  xpAwardCore?: XPAwardResult;
  xpAwardWeekly?: XPAwardResult;
  sessionFlagBadge?: SessionFlagBadgeVariant;
  patternNarrativeLine?: string | null;
  foundryUnlockFired?: boolean;
  avatarTierUpgradedFired?: boolean;
  persisted?: boolean;
  flagType?: string;
  error?: string;
};

type PostSessionApi = {
  ok?: boolean;
  prefetchProgramId?: string | null;
  queueAvatarUnlockToast?: boolean;
  recoveryBiasApplied?: boolean;
  airTrendWarningActive?: boolean;
  forcedDifficultyOneApplied?: boolean;
  nextScenario?: CatalogScenario | null;
  error?: string;
};

const defaultXp = (amount: number): XPAwardResult => ({
  allowed: true,
  allowedAmount: Math.max(0, amount),
  blockedReason: "none",
});

function readSavedLocale(): "ko" | "en" {
  try {
    const raw = localStorage.getItem(ARENA_SHELL_LOCALE_KEY);
    return raw === "ko" ? "ko" : "en";
  } catch {
    return "en";
  }
}

function writeSavedLocale(loc: "ko" | "en") {
  try {
    localStorage.setItem(ARENA_SHELL_LOCALE_KEY, loc);
  } catch {
    /* ignore */
  }
}

export function ScenarioSessionShell({
  className,
  embeddedInArenaShell,
  locale: localeProp,
  feedbackRefetchKey: parentFeedbackKey,
  onBumpFeedbackPrompt,
  onActiveScenarioChange,
  onArenaEjected,
  sessionReloadKey,
  parentUserId,
}: ScenarioSessionShellProps) {
  const router = useRouter();
  const [shellLocale, setShellLocale] = React.useState<"ko" | "en">(() => {
    if (typeof window === "undefined") return "en";
    if (embeddedInArenaShell && localeProp) return localeProp;
    return readSavedLocale();
  });
  const [hydrated, setHydrated] = React.useState(false);
  const [userId, setUserId] = React.useState<string | null>(() =>
    parentUserId !== undefined ? parentUserId : null,
  );
  const [scenario, setScenario] = React.useState<CatalogScenario | null>(null);
  const [patternNarrative, setPatternNarrative] = React.useState("");
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [toast, setToast] = React.useState<{ xp: number; airDelta: number } | null>(null);
  const [summary, setSummary] = React.useState<{
    scenarioId: string;
    title: string;
    chosenOptionText: string;
    xpAwardCore: XPAwardResult;
    xpAwardWeekly: XPAwardResult;
    previousAir: number;
    newAir: number;
    patternNarrativeLine: string | null;
    sessionFlagBadge: SessionFlagBadgeVariant;
    foundryUnlockFired: boolean;
    airDelta: number;
    avatarTierUpgradedFired: boolean;
  } | null>(null);
  const summaryRef = React.useRef(summary);
  React.useEffect(() => {
    summaryRef.current = summary;
  }, [summary]);
  const [avatarUnlockToast, setAvatarUnlockToast] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [internalFeedbackRefetchKey, setInternalFeedbackRefetchKey] = React.useState(0);

  const feedbackRefetchKey = embeddedInArenaShell ? (parentFeedbackKey ?? 0) : internalFeedbackRefetchKey;

  React.useEffect(() => {
    if (embeddedInArenaShell && localeProp) {
      setShellLocale(localeProp);
    } else {
      setShellLocale(readSavedLocale());
    }
    setHydrated(true);
  }, [embeddedInArenaShell, localeProp]);

  React.useEffect(() => {
    if (!embeddedInArenaShell || !localeProp) return;
    setShellLocale(localeProp);
    writeSavedLocale(localeProp);
  }, [embeddedInArenaShell, localeProp]);

  React.useEffect(() => {
    if (parentUserId !== undefined) {
      setUserId(parentUserId);
      return;
    }
    let alive = true;
    fetch("/api/arena/profile", { credentials: "include" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { profile?: { user_id?: string } };
        if (!alive) return;
        setUserId(typeof j.profile?.user_id === "string" ? j.profile.user_id : null);
      })
      .catch(() => {
        if (alive) setUserId(null);
      });
    return () => {
      alive = false;
    };
  }, [parentUserId]);

  const bumpFeedbackPrompt = React.useCallback(() => {
    if (embeddedInArenaShell && onBumpFeedbackPrompt) {
      onBumpFeedbackPrompt();
    } else {
      setInternalFeedbackRefetchKey((k) => k + 1);
    }
  }, [embeddedInArenaShell, onBumpFeedbackPrompt]);

  const refreshPatternAfterFeedback = React.useCallback(async () => {
    try {
      const ctxRes = await fetch("/api/arena/session/context", { credentials: "include" });
      const ctxJson = (await ctxRes.json().catch(() => ({}))) as ContextApi;
      if (ctxJson.ok && typeof ctxJson.patternNarrative === "string") {
        setPatternNarrative(ctxJson.patternNarrative);
      }
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    if (embeddedInArenaShell) return;
    const handler = () => {
      void refreshPatternAfterFeedback();
    };
    window.addEventListener(FEEDBACK_SUBMITTED_EVENT, handler);
    return () => window.removeEventListener(FEEDBACK_SUBMITTED_EVENT, handler);
  }, [embeddedInArenaShell, refreshPatternAfterFeedback]);

  const loadSession = React.useCallback(async () => {
    if (!userId || !hydrated) return;
    setLoading(true);
    setLoadError(null);
    const loc = shellLocale;
    try {
      const [nextRes, ctxRes] = await Promise.all([
        fetch(`/api/arena/session/next?locale=${encodeURIComponent(loc)}`, { credentials: "include" }),
        fetch("/api/arena/session/context", { credentials: "include" }),
      ]);
      const nextJson = (await nextRes.json().catch(() => ({}))) as NextApi;
      const ctxJson = (await ctxRes.json().catch(() => ({}))) as ContextApi;

      if (
        nextRes.status === 403 &&
        nextJson.code === "user_ejected_from_arena"
      ) {
        onArenaEjected?.();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(ARENA_EJECTED_WINDOW_EVENT));
        }
        setLoadError(nextJson.error ?? "Arena access suspended.");
        setScenario(null);
        return;
      }

      if (!nextRes.ok || !nextJson.ok || !nextJson.scenario) {
        setLoadError(nextJson.error ?? "Failed to load scenario.");
        setScenario(null);
        return;
      }
      setScenario(nextJson.scenario);
      if (ctxJson.ok && typeof ctxJson.patternNarrative === "string") {
        setPatternNarrative(ctxJson.patternNarrative);
      } else {
        setPatternNarrative("");
      }
      bumpFeedbackPrompt();
    } catch {
      setLoadError("Network error.");
      setScenario(null);
    } finally {
      setLoading(false);
    }
  }, [userId, hydrated, bumpFeedbackPrompt, shellLocale, onArenaEjected]);

  const reloadEpoch = sessionReloadKey ?? 0;

  React.useEffect(() => {
    void loadSession();
  }, [loadSession, reloadEpoch]);

  React.useEffect(() => {
    onActiveScenarioChange?.(scenario);
  }, [scenario, onActiveScenarioChange]);

  type SummarySnapshot = NonNullable<typeof summary>;

  const maybeEnqueueFeedbackFromSnapshot = React.useCallback(
    (snap: SummarySnapshot | null) => {
      if (!snap?.scenarioId || !userId) return;
      if (snap.sessionFlagBadge !== "hero_trap" && snap.sessionFlagBadge !== "integrity_slip") return;
      void (async () => {
        try {
          await fetch("/api/arena/session/feedback-queue", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scenarioId: snap.scenarioId,
              sessionFlagBadge: snap.sessionFlagBadge,
            }),
          });
        } catch {
          /* ignore */
        }
        bumpFeedbackPrompt();
      })();
    },
    [userId, bumpFeedbackPrompt],
  );

  const runPostSession = React.useCallback(
    async (dismissal: "next_scenario" | "foundry_redirect", snapshot: SummarySnapshot) => {
      if (!userId) return;
      try {
        const res = await fetch("/api/arena/session/post-session", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dismissal,
            locale: shellLocale,
            foundryUnlockFired: snapshot.foundryUnlockFired,
            avatarTierUpgradedFired: snapshot.avatarTierUpgradedFired,
            airDelta: snapshot.airDelta,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as PostSessionApi;
        if (!res.ok || !data.ok) {
          setLoadError(data.error ?? "Post-session failed.");
          if (dismissal === "next_scenario") void loadSession();
          return;
        }
        if (data.prefetchProgramId) {
          router.prefetch(`/${shellLocale}/bty/foundry/program/${data.prefetchProgramId}`);
        }
        if (data.queueAvatarUnlockToast) {
          setAvatarUnlockToast(true);
          window.setTimeout(() => setAvatarUnlockToast(false), 4500);
        }
        if (dismissal === "next_scenario" && data.nextScenario) {
          setLoading(false);
          setScenario(data.nextScenario);
          setLoadError(null);
          try {
            const ctxRes = await fetch("/api/arena/session/context", { credentials: "include" });
            const ctxJson = (await ctxRes.json().catch(() => ({}))) as ContextApi;
            if (ctxJson.ok && typeof ctxJson.patternNarrative === "string") {
              setPatternNarrative(ctxJson.patternNarrative);
            } else {
              setPatternNarrative("");
            }
          } catch {
            setPatternNarrative("");
          }
        } else if (dismissal === "next_scenario") {
          void loadSession();
        }
      } catch {
        setLoadError("Network error.");
        if (dismissal === "next_scenario") void loadSession();
      }
    },
    [userId, shellLocale, router, loadSession],
  );

  const handleNextScenario = React.useCallback(async () => {
    const snap = summaryRef.current;
    if (!snap || !userId) return;
    maybeEnqueueFeedbackFromSnapshot(snap);
    setSummary(null);
    await runPostSession("next_scenario", snap);
  }, [userId, runPostSession, maybeEnqueueFeedbackFromSnapshot]);

  const handleFoundryBeforeNavigate = React.useCallback(async () => {
    const snap = summaryRef.current;
    if (!snap || !userId) return;
    maybeEnqueueFeedbackFromSnapshot(snap);
    setSummary(null);
    await runPostSession("foundry_redirect", snap);
  }, [userId, runPostSession, maybeEnqueueFeedbackFromSnapshot]);

  const onShellLocale = React.useCallback((loc: "ko" | "en") => {
    setShellLocale(loc);
    writeSavedLocale(loc);
  }, []);

  const handleSummaryDismiss = React.useCallback(() => {
    const snap = summaryRef.current;
    setSummary(null);
    maybeEnqueueFeedbackFromSnapshot(snap);
  }, [maybeEnqueueFeedbackFromSnapshot]);

  const onChoiceConfirmed = React.useCallback(
    async (detail: ChoiceConfirmedDetail) => {
      if (submitting) return;
      setSubmitting(true);
      try {
        const res = await fetch("/api/arena/session/choice", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenarioId: detail.scenarioId,
            choiceId: detail.choiceId,
            locale: shellLocale,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as ChoiceApi;
        if (!res.ok || !data.ok) {
          setLoadError(data.error ?? "Choice failed.");
          return;
        }
        const xp = typeof data.xpEarned === "number" ? data.xpEarned : 0;
        const airDelta = typeof data.airDelta === "number" ? data.airDelta : 0;
        setToast({ xp, airDelta });
        window.setTimeout(() => setToast(null), 4500);

        const sc = scenario;
        const ch = sc?.choices.find((c) => c.choiceId === detail.choiceId);
        const choiceLbl =
          shellLocale === "ko" && ch?.labelKo ? ch.labelKo : ch?.label ?? detail.choiceId;
        const chosenOptionText = ch ? `${choiceLbl} — ${ch.intent}` : detail.choiceId;
        const title =
          sc && shellLocale === "ko" && sc.titleKo ? sc.titleKo : sc?.title ?? detail.scenarioId;

        const xpAwardCore = data.xpAwardCore ?? defaultXp(xp);
        const xpAwardWeekly = data.xpAwardWeekly ?? defaultXp(xp);
        const previousAir = typeof data.previousAir === "number" ? data.previousAir : 0.72;
        const newAir = typeof data.newAir === "number" ? data.newAir : previousAir + airDelta;
        const sessionFlagBadge: SessionFlagBadgeVariant = data.sessionFlagBadge ?? "clean";

        setSummary({
          scenarioId: detail.scenarioId,
          title,
          chosenOptionText,
          xpAwardCore,
          xpAwardWeekly,
          previousAir,
          newAir,
          patternNarrativeLine:
            typeof data.patternNarrativeLine === "string" ? data.patternNarrativeLine : null,
          sessionFlagBadge,
          foundryUnlockFired: data.foundryUnlockFired === true,
          airDelta,
          avatarTierUpgradedFired: data.avatarTierUpgradedFired === true,
        });
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, scenario, shellLocale],
  );

  if (!hydrated || !userId) {
    return (
      <div className={className} role="status" aria-busy="true">
        <p className="text-sm text-[var(--arena-text-soft)]">…</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--arena-text-soft)]">
          Arena
        </span>
        <div className="flex items-center gap-1 rounded-lg border border-[var(--arena-text-soft)]/30 p-0.5">
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              shellLocale === "ko"
                ? "bg-[var(--arena-accent)]/15 text-[var(--arena-accent)]"
                : "text-[var(--arena-text-soft)]"
            }`}
            aria-pressed={shellLocale === "ko"}
            onClick={() => onShellLocale("ko")}
          >
            KO
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              shellLocale === "en"
                ? "bg-[var(--arena-accent)]/15 text-[var(--arena-accent)]"
                : "text-[var(--arena-text-soft)]"
            }`}
            aria-pressed={shellLocale === "en"}
            onClick={() => onShellLocale("en")}
          >
            EN
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--arena-text-soft)]">Loading scenario…</p>
      ) : loadError ? (
        <p className="text-sm text-red-700" role="alert">
          {loadError}
        </p>
      ) : scenario ? (
        <>
          {!embeddedInArenaShell ? (
            <FeedbackPromptModal userId={userId} locale={shellLocale} refetchKey={feedbackRefetchKey} />
          ) : null}
          {!embeddedInArenaShell ? <DelayedOutcomeBanner locale={shellLocale} /> : null}
          <ScenarioCard
            scenarioId={scenario.scenarioId}
            catalogScenario={scenario}
            showLocaleToggle={false}
            contentLocale={shellLocale}
            patternNarrative={patternNarrative}
            scenarioType={scenario.scenarioId}
            previousFlagType={null}
            scenarioTypeForEvent={scenario.scenarioId}
            flagType={scenario.coachNotes?.whatThisTrains?.[0] ?? null}
            onChoiceConfirmed={onChoiceConfirmed}
          />
        </>
      ) : null}

      {toast ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl border border-[var(--arena-text-soft)]/30 bg-[var(--arena-card,#0f172a)] px-4 py-3 text-sm text-white shadow-lg"
        >
          <span className="font-semibold text-emerald-300">+{toast.xp} XP</span>
          <span className="mx-2 text-[var(--arena-text-soft)]">·</span>
          <span className="text-sky-300">AIR Δ {toast.airDelta >= 0 ? "+" : ""}{toast.airDelta.toFixed(3)}</span>
        </div>
      ) : null}

      {avatarUnlockToast ? (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 rounded-xl border border-violet-400/40 bg-violet-950/95 px-4 py-3 text-sm text-white shadow-lg"
        >
          {shellLocale === "ko" ? "새 아바타 해금 — 프로필에서 확인하세요." : "New avatar unlock — check your profile."}
        </div>
      ) : null}

      {summary ? (
        <SessionSummaryOverlay
          open
          locale={shellLocale}
          scenarioTitle={summary.title}
          chosenOptionText={summary.chosenOptionText}
          sessionFlagBadge={summary.sessionFlagBadge}
          xpAwardCore={summary.xpAwardCore}
          xpAwardWeekly={summary.xpAwardWeekly}
          previousAir={summary.previousAir}
          newAir={summary.newAir}
          patternNarrativeLine={summary.patternNarrativeLine}
          foundryUnlockFired={summary.foundryUnlockFired}
          foundryHref={`/${shellLocale}/bty/foundry`}
          onDismiss={handleSummaryDismiss}
          onNextScenario={handleNextScenario}
          onFoundryBeforeNavigate={handleFoundryBeforeNavigate}
        />
      ) : null}

      {submitting ? (
        <p className="mt-2 text-xs text-[var(--arena-text-soft)]" aria-live="polite">
          …
        </p>
      ) : null}
    </div>
  );
}

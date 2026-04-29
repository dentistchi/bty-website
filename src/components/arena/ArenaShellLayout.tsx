"use client";

/**
 * Top-level Arena session page: stacked banners + {@link ScenarioSessionShell}.
 * - `next_scenario_requested` — after overlay completes next flow, refresh session context (and optional forced reload via `detail.reloadSession`).
 * - `foundry_exit_ready` — navigate to Foundry home.
 * - `arena_ejected` — replace shell with Center return CTA.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { DelayedOutcomeBanner } from "@/components/arena/DelayedOutcomeBanner";
import { FeedbackPromptModal, FEEDBACK_SUBMITTED_EVENT } from "@/components/arena/FeedbackPromptModal";
import { PatternNarrativeBanner } from "@/components/arena/PatternNarrativeBanner";
import { ScenarioSessionShell } from "@/components/arena/ScenarioSessionShell";
import {
  NEXT_SCENARIO_REQUESTED_EVENT,
} from "@/components/arena/SessionSummaryOverlay";
import { ARENA_EJECTED_WINDOW_EVENT } from "@/components/arena/arenaClientEvents";
import { FOUNDRY_EXIT_READY_EVENT, type FoundryExitReadyDetail } from "@/lib/bty/foundry/foundryExitEvents";

export type ArenaShellLayoutProps = {
  locale: "ko" | "en";
  className?: string;
};

type ContextApi = {
  ok?: boolean;
  patternNarrative?: string;
  error?: string;
};

export default function ArenaShellLayout({ locale, className }: ArenaShellLayoutProps) {
  const router = useRouter();
  const [userId, setUserId] = React.useState<string | null>(null);
  const [ejected, setEjected] = React.useState(false);
  const [patternNarrativeKo, setPatternNarrativeKo] = React.useState("");
  const [activeScenarioType, setActiveScenarioType] = React.useState<string | null>(null);
  const [feedbackRefetchKey, setFeedbackRefetchKey] = React.useState(0);
  const [sessionReloadKey, setSessionReloadKey] = React.useState(0);

  const bumpFeedbackPrompt = React.useCallback(() => {
    setFeedbackRefetchKey((k) => k + 1);
  }, []);

  const refreshContext = React.useCallback(async () => {
    try {
      const ctxRes = await fetch("/api/arena/session/context", { credentials: "include" });
      const ctxJson = (await ctxRes.json().catch(() => ({}))) as ContextApi;
      if (ctxJson.ok && typeof ctxJson.patternNarrative === "string") {
        setPatternNarrativeKo(ctxJson.patternNarrative);
      } else {
        setPatternNarrativeKo("");
      }
    } catch {
      setPatternNarrativeKo("");
    }
  }, []);

  React.useEffect(() => {
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
  }, []);

  React.useEffect(() => {
    if (!userId) return;
    void refreshContext();
  }, [userId, refreshContext]);

  React.useEffect(() => {
    const onNextScenario = (ev: Event) => {
      const ce = ev as CustomEvent<{ reloadSession?: boolean }>;
      if (ce.detail?.reloadSession) {
        setSessionReloadKey((k) => k + 1);
      }
      void refreshContext();
    };
    window.addEventListener(NEXT_SCENARIO_REQUESTED_EVENT, onNextScenario);
    return () => window.removeEventListener(NEXT_SCENARIO_REQUESTED_EVENT, onNextScenario);
  }, [refreshContext]);

  React.useEffect(() => {
    const onFeedbackSubmitted = () => {
      void refreshContext();
    };
    window.addEventListener(FEEDBACK_SUBMITTED_EVENT, onFeedbackSubmitted);
    return () => window.removeEventListener(FEEDBACK_SUBMITTED_EVENT, onFeedbackSubmitted);
  }, [refreshContext]);

  React.useEffect(() => {
    const onFoundryExit = (ev: Event) => {
      const ce = ev as CustomEvent<FoundryExitReadyDetail>;
      if (!ce.detail?.userId || !userId || ce.detail.userId !== userId) return;
      router.push(`/${locale}/bty/foundry`);
    };
    window.addEventListener(FOUNDRY_EXIT_READY_EVENT, onFoundryExit);
    return () => window.removeEventListener(FOUNDRY_EXIT_READY_EVENT, onFoundryExit);
  }, [locale, router, userId]);

  React.useEffect(() => {
    const onEjected = () => {
      setEjected(true);
    };
    window.addEventListener(ARENA_EJECTED_WINDOW_EVENT, onEjected);
    return () => window.removeEventListener(ARENA_EJECTED_WINDOW_EVENT, onEjected);
  }, []);

  const handleArenaEjectedFromShell = React.useCallback(() => {
    setEjected(true);
  }, []);

  const narrativeTrimmed = patternNarrativeKo.trim();
  const showPatternBanner = narrativeTrimmed.length > 0;

  if (ejected) {
    const title = locale === "ko" ? "Arena에서 일시적으로 제외되었습니다" : "You’ve been paused from Arena";
    const body =
      locale === "ko"
        ? "Center 요건을 완료하면 다시 입장할 수 있습니다."
        : "Complete Center requirements to return.";
    const cta = locale === "ko" ? "Center로 이동" : "Go to Center";
    return (
      <div className={className} role="alert">
        <div className="mx-auto max-w-lg rounded-2xl border border-[var(--arena-text-soft)]/25 bg-[var(--arena-card,#0f172a)] p-6 text-[var(--arena-text-soft)] shadow-lg">
          <h1 className="m-0 text-lg font-semibold text-[var(--arena-text)]">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed">{body}</p>
          <Link
            href={`/${locale}/dear-me`}
            className="mt-4 inline-flex rounded-lg border border-[var(--arena-accent)]/40 bg-[var(--arena-accent)]/15 px-4 py-2.5 text-sm font-semibold text-[var(--arena-accent)]"
          >
            {cta}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className ?? ""}`}>
      {showPatternBanner ? (
        <PatternNarrativeBanner
          patternNarrativeKo={narrativeTrimmed}
          scenarioType={activeScenarioType}
          previousFlagType={null}
        />
      ) : null}

      {userId ? <DelayedOutcomeBanner locale={locale} /> : null}

      {userId ? (
        <FeedbackPromptModal userId={userId} locale={locale} refetchKey={feedbackRefetchKey} />
      ) : null}

      <ScenarioSessionShell
        embeddedInArenaShell
        locale={locale}
        parentUserId={userId ?? undefined}
        feedbackRefetchKey={feedbackRefetchKey}
        onBumpFeedbackPrompt={bumpFeedbackPrompt}
        onActiveScenarioChange={(s) => {
          setActiveScenarioType(s?.scenarioId ?? null);
        }}
        onArenaEjected={handleArenaEjectedFromShell}
        sessionReloadKey={sessionReloadKey}
      />
    </div>
  );
}

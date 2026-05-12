"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Scenario } from "@/lib/bty/scenario/types";

type FlowState =
  | { stage: "loading" }
  | { stage: "scenario"; scenario: Scenario; intentId: string }
  | { stage: "done"; xpAwarded: number };

const ONBOARDING_KEY = "bty_quick_mode_onboarding_seen";

const copy = {
  ko: {
    loading: "시나리오 불러오는 중…",
    onboardingTitle: "Quick Decision 모드",
    onboardingDesc:
      "빠른 행동 결정을 위한 모드입니다. 행동을 완료하지 않으면 보상이 적용되지 않습니다. 깊은 리더십 성장과 정식 XP는 Full Arena에서 반영됩니다.",
    onboardingDismiss: "알겠어요",
    scenarioLabel: "시나리오",
    actionPlaceholder: "이 상황에서 내가 취할 구체적인 행동을 적어주세요…",
    actionLabel: "내 행동 계획",
    completeBtn: "행동 완료 기록",
    skipBtn: "이 시나리오 건너뛰기",
    doneTitle: "완료!",
    xpEarned: (xp: number) => xp > 0 ? `+${xp} XP 획득` : "XP 없음 (한도 초과)",
    newRound: "다시 시작",
    toFullArena: "Full Arena 가기",
    toArena: "훈련장으로",
    error: "시나리오를 불러오지 못했습니다. 다시 시도해주세요.",
    retry: "다시 시도",
  },
  en: {
    loading: "Loading scenario…",
    onboardingTitle: "Quick Decision Mode",
    onboardingDesc:
      "A lightweight mode for fast action decisions. No reward is applied unless you complete the action. For deep leadership growth and full XP, use Full Arena.",
    onboardingDismiss: "Got it",
    scenarioLabel: "Scenario",
    actionPlaceholder: "Describe the specific action you will take in this situation…",
    actionLabel: "My Action Plan",
    completeBtn: "Record Action Complete",
    skipBtn: "Skip this scenario",
    doneTitle: "Done!",
    xpEarned: (xp: number) => xp > 0 ? `+${xp} XP earned` : "No XP (daily limit reached)",
    newRound: "Start again",
    toFullArena: "Go to Full Arena",
    toArena: "Back to Arena",
    error: "Failed to load scenario. Please refresh.",
    retry: "Refresh",
  },
};

interface Props {
  locale: string;
}

export default function QuickModePageClient({ locale }: Props) {
  const isKo = locale !== "en";
  const t = isKo ? copy.ko : copy.en;

  const [flow, setFlow] = useState<FlowState>({ stage: "loading" });
  const [actionText, setActionText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const didFetch = useRef(false);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;

    const seen = typeof window !== "undefined" && localStorage.getItem(ONBOARDING_KEY);
    if (!seen) setShowOnboarding(true);

    fetchScenario();
  }, []);

  async function fetchScenario() {
    setFlow({ stage: "loading" });
    setLoadError(null);
    setActionText("");

    try {
      const res = await fetch("/api/arena/quick/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: isKo ? "ko" : "en" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setLoadError(t.error);
        return;
      }
      setFlow({ stage: "scenario", scenario: data.scenario, intentId: data.intentId });
    } catch {
      setLoadError(t.error);
    }
  }

  function dismissOnboarding() {
    if (typeof window !== "undefined") localStorage.setItem(ONBOARDING_KEY, "1");
    setShowOnboarding(false);
  }

  async function handleComplete() {
    if (flow.stage !== "scenario") return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/arena/quick/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId: flow.scenario.dbScenarioId ?? flow.scenario.scenarioId,
          actionCompleted: true,
        }),
      });
      const data = await res.json();
      setFlow({ stage: "done", xpAwarded: data.xpAwarded ?? 0 });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSkip() {
    if (flow.stage !== "scenario") return;
    await fetch("/api/arena/quick/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenarioId: flow.scenario.dbScenarioId ?? flow.scenario.scenarioId,
        actionCompleted: false,
      }),
    }).catch(() => undefined);
    didFetch.current = false;
    fetchScenario();
  }

  const arenaHref = `/${locale}/bty-arena`;

  return (
    <div className="min-h-screen bg-[var(--arena-bg)] text-[var(--arena-text)] flex flex-col">
      <div className="flex-1 flex flex-col max-w-xl mx-auto w-full px-4 py-8 gap-6">
        {/* Onboarding overlay */}
        {showOnboarding && (
          <div className="rounded-2xl border border-[var(--arena-accent)]/30 bg-[var(--arena-accent)]/5 p-5 space-y-3">
            <p className="text-sm font-semibold text-[var(--arena-accent)]">{t.onboardingTitle}</p>
            <p className="text-sm text-[var(--arena-text)]/80 leading-relaxed">{t.onboardingDesc}</p>
            <button
              onClick={dismissOnboarding}
              className="text-sm font-medium text-[var(--arena-accent)] underline underline-offset-2"
            >
              {t.onboardingDismiss}
            </button>
          </div>
        )}

        {/* Loading */}
        {flow.stage === "loading" && !loadError && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-[var(--arena-text)]/50 animate-pulse">{t.loading}</p>
          </div>
        )}

        {/* Load error */}
        {loadError && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <p className="text-sm text-red-400">{loadError}</p>
            <button
              onClick={() => { didFetch.current = false; fetchScenario(); }}
              className="text-sm font-medium text-[var(--arena-accent)] underline"
            >
              {t.retry}
            </button>
          </div>
        )}

        {/* Scenario + action */}
        {flow.stage === "scenario" && (
          <div className="flex flex-col gap-5">
            <div className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--arena-accent)]/70">
                {t.scenarioLabel}
              </span>
              <h2 className="text-lg font-semibold leading-snug">
                {isKo && flow.scenario.titleKo ? flow.scenario.titleKo : flow.scenario.title}
              </h2>
              <p className="text-sm leading-relaxed text-[var(--arena-text)]/80">
                {isKo && flow.scenario.contextKo ? flow.scenario.contextKo : flow.scenario.context}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-[var(--arena-text)]/60">
                {t.actionLabel}
              </label>
              <textarea
                className="w-full rounded-xl border border-[var(--arena-accent)]/20 bg-[var(--arena-surface,#1a1a2e)] px-4 py-3 text-sm text-[var(--arena-text)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--arena-accent)]/40 placeholder:text-[var(--arena-text)]/30"
                rows={4}
                placeholder={t.actionPlaceholder}
                value={actionText}
                onChange={(e) => setActionText(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleComplete}
                disabled={submitting || actionText.trim().length === 0}
                className="flex-1 rounded-xl bg-[var(--arena-accent)] text-white font-semibold py-3 text-sm disabled:opacity-40 transition-opacity"
              >
                {submitting ? "…" : t.completeBtn}
              </button>
              <button
                onClick={handleSkip}
                disabled={submitting}
                className="px-4 rounded-xl border border-[var(--arena-text)]/20 text-sm text-[var(--arena-text)]/60 hover:text-[var(--arena-text)] transition-colors disabled:opacity-40"
              >
                {t.skipBtn}
              </button>
            </div>
          </div>
        )}

        {/* Done */}
        {flow.stage === "done" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
            <div className="space-y-2">
              <p className="text-2xl font-bold">{t.doneTitle}</p>
              <p className="text-sm text-[var(--arena-accent)] font-medium">
                {t.xpEarned(flow.xpAwarded)}
              </p>
            </div>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                onClick={() => { didFetch.current = false; fetchScenario(); }}
                className="w-full rounded-xl bg-[var(--arena-accent)] text-white font-semibold py-3 text-sm"
              >
                {t.newRound}
              </button>
              <Link
                href={arenaHref}
                className="w-full rounded-xl border border-[var(--arena-accent)]/30 text-[var(--arena-accent)] font-medium py-3 text-sm text-center"
              >
                {t.toFullArena}
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Footer nav */}
      {flow.stage !== "done" && (
        <div className="border-t border-[var(--arena-text)]/10 px-4 py-3 flex justify-center">
          <Link href={arenaHref} className="text-xs text-[var(--arena-text)]/40 hover:text-[var(--arena-text)]/70 transition-colors">
            {t.toArena}
          </Link>
        </div>
      )}
    </div>
  );
}

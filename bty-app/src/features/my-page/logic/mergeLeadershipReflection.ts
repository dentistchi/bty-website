import { computeGrowthHistory } from "@/features/growth/logic/computeGrowthHistory";
import { loadReflections } from "@/features/growth/logic/reflectionStorage";
import { shouldShowCompoundRecovery } from "@/features/growth/logic/recoveryCompoundSignal";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import type { ReflectionEntry } from "@/features/growth/logic/types";
import type { ArenaSignal, LeadershipMetrics, LeadershipState } from "./types";

/**
 * Augments Arena-derived leadership copy with accumulated reflection language (read-only merge).
 */
export function mergeLeadershipReflectionLayer(
  base: LeadershipState,
  metrics: LeadershipMetrics,
  signals: ArenaSignal[],
  locale: Locale,
  reflections?: ReflectionEntry[],
): LeadershipState {
  const list = reflections ?? loadReflections();
  if (list.length === 0) {
    // Derive fallback labels from arena signals when no Growth reflections exist yet.
    if (signals.length === 0) return base;
    const t = getMessages(locale).myPageStub;
    const ux = getMessages(locale).uxPhase1Stub;
    const depthLabel =
      signals.length < 3
        ? t.leadershipReflectionDepthEarly
        : signals.length < 8
          ? t.leadershipReflectionDepthActive
          : t.leadershipReflectionDepthDeepening;
    const { relationalBias, operationalBias, emotionalRegulation } = metrics;
    const maxBias = Math.max(relationalBias, operationalBias, emotionalRegulation);
    const recentFocusLabel =
      maxBias === relationalBias
        ? ux.growthReflectionFocusTrust
        : maxBias === operationalBias
          ? ux.growthReflectionFocusClarity
          : maxBias === emotionalRegulation
            ? ux.growthReflectionFocusRegulation
            : ux.growthReflectionFocusAlignment;
    return {
      ...base,
      reflectionDepthLabel: depthLabel,
      reflectionIntegrationLabel: t.leadershipReflectionIntegrationForming,
      recentFocusLabel,
    };
  }

  const t = getMessages(locale).myPageStub;
  const gh = computeGrowthHistory(list);
  const compoundRecovery = shouldShowCompoundRecovery(signals, list);

  const depthLabel =
    gh.total < 3
      ? t.leadershipReflectionDepthEarly
      : gh.total < 8
        ? t.leadershipReflectionDepthActive
        : t.leadershipReflectionDepthDeepening;

  const uniqueFocuses = new Set(gh.recent.map((r) => r.focus));
  const integrationLabel =
    uniqueFocuses.size >= 2
      ? t.leadershipReflectionIntegrationImproving
      : t.leadershipReflectionIntegrationForming;

  const recoveryLabel = compoundRecovery
    ? t.leadershipRecoveryAwarenessDetected
    : t.leadershipRecoveryAwarenessStable;

  const ux = getMessages(locale).uxPhase1Stub;
  const latest = list.reduce((a, b) => (a.createdAt >= b.createdAt ? a : b));
  const recentFocusLabel =
    latest.focus === "clarity"
      ? ux.growthReflectionFocusClarity
      : latest.focus === "trust"
        ? ux.growthReflectionFocusTrust
        : latest.focus === "regulation"
          ? ux.growthReflectionFocusRegulation
          : ux.growthReflectionFocusAlignment;

  let nextFocus = base.nextFocus;
  if (
    gh.focusCounts.regulation >= 2 &&
    metrics.relationalBias > metrics.operationalBias
  ) {
    nextFocus = t.leadershipNextFocusWithReflectionRegulation;
  }

  return {
    ...base,
    nextFocus,
    reflectionDepthLabel: depthLabel,
    reflectionIntegrationLabel: integrationLabel,
    recoveryAwarenessLabel: recoveryLabel,
    recentFocusLabel,
  };
}

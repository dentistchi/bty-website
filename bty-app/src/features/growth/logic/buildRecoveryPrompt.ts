import type { ArenaSignal } from "@/features/my-page/logic/types";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { checkArenaLowRegulation } from "./checkRecoveryTrigger";
import { shouldShowCompoundRecovery } from "./recoveryCompoundSignal";
import type { ReflectionEntry } from "./types";
import type { RecoveryPrompt } from "./recoveryTypes";

/**
 * Builds an active recovery prompt when Arena or Growth patterns warrant re-entry framing.
 * Aligns with Growth History recovery strip (`shouldShowCompoundRecovery`) plus a borderline pressure band.
 * Priority: Arena low regulation → repeated regulation reflections → pressure accumulation.
 */
export function buildRecoveryPrompt(
  signals: ArenaSignal[],
  reflections: ReflectionEntry[],
  locale: Locale,
): RecoveryPrompt | null {
  const t = getMessages(locale).uxPhase1Stub;
  const arenaLowReg = checkArenaLowRegulation(signals);

  const chronological = [...reflections].sort((a, b) => a.createdAt - b.createdAt);
  const tail = chronological.slice(-5);
  const regulationReflections = tail.filter((r) => r.focus === "regulation");
  const repeatedRegulationFriction = regulationReflections.length >= 2;

  const n = Math.min(5, signals.length);
  const recent = signals.slice(-n);
  const avgReg =
    recent.length > 0
      ? recent.reduce((sum, s) => sum + s.meta.emotionalRegulation, 0) / recent.length
      : 1;

  const compound = shouldShowCompoundRecovery(signals, reflections);

  const pressureAccumulation =
    signals.length >= 4 &&
    !arenaLowReg &&
    !repeatedRegulationFriction &&
    avgReg < 0.55 &&
    avgReg >= 0.45;

  if (!compound && !pressureAccumulation) {
    return null;
  }

  const createdAt = Date.now();

  if (arenaLowReg) {
    return {
      source: "arena",
      reason: "low-regulation",
      title: t.recoveryPromptLowRegulationTitle,
      body: t.recoveryPromptLowRegulationBody,
      cue: t.recoveryPromptLowRegulationCue,
      createdAt,
    };
  }

  if (repeatedRegulationFriction) {
    return {
      source: "growth",
      reason: "repeated-friction",
      title: t.recoveryPromptRepeatedFrictionTitle,
      body: t.recoveryPromptRepeatedFrictionBody,
      cue: t.recoveryPromptRepeatedFrictionCue,
      createdAt,
    };
  }

  return {
    source: "arena",
    reason: "pressure-accumulation",
    title: t.recoveryPromptPressureAccumulationTitle,
    body: t.recoveryPromptPressureAccumulationBody,
    cue: t.recoveryPromptPressureAccumulationCue,
    createdAt,
  };
}

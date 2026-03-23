/**
 * Server-side completion for lib {@link Scenario} choice — {@link computeResult} + optional {@link handleChoiceConfirmed}.
 */

import { handleChoiceConfirmed, type ChoiceConfirmedEvent } from "@/engine/integration/scenario-outcome-bridge";
import type { XPAwardResult } from "@/engine/integration/xp-integrity-bridge";
import { validateXPAward } from "@/engine/integration/xp-integrity-bridge";
import { getPatternNarrative } from "@/engine/memory/pattern-history.service";
import type { SessionFlagBadgeVariant } from "@/domain/arena/sessionSummary";
import { computeResultFromScenario } from "@/lib/bty/scenario/engine";
import type { Scenario, ScenarioSubmitPayload } from "@/lib/bty/scenario/types";
import { resolveArenaScenarioForUser } from "@/lib/bty/arena/arenaScenarioResolve.server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

async function resolveScenarioForSubmit(userId: string, payload: ScenarioSubmitPayload): Promise<Scenario> {
  const locale = payload.locale === "ko" ? "ko" : "en";
  const resolved = await resolveArenaScenarioForUser(userId, payload.scenarioId, locale);
  if (!resolved) throw new Error("Scenario not found");
  return resolved;
}

export type ScenarioChoiceSubmitResult = {
  ok: true;
  xpEarned: number;
  airDelta: number;
  previousAir: number;
  newAir: number;
  xpAwardCore: XPAwardResult;
  xpAwardWeekly: XPAwardResult;
  sessionFlagBadge: SessionFlagBadgeVariant;
  /** True when AIR improved (same branch as Foundry unlock in arena-foundry-bridge). */
  foundryUnlockFired: boolean;
  /** When Core XP tier crossed an avatar band; drives post-session unlock toast (`post-session-router`). */
  avatarTierUpgradedFired: boolean;
  /** `getPatternNarrative` when XP gate fired (lockout or slip). */
  patternNarrativeLine: string | null;
  /** True when service role persisted the full pipeline. */
  persisted: boolean;
  microInsight: string;
  result: string;
  flagType: string;
};

function buildSyntheticAir(xpEarned: number): { previousAir: number; newAir: number } {
  const previousAir = 0.72;
  const bump = Math.min(0.08, Math.max(0, xpEarned / 1200));
  const newAir = Math.min(1, Math.max(0, previousAir + bump));
  return { previousAir, newAir };
}

function badgeVariantFromFlags(flagType: string, xpWeekly: XPAwardResult): SessionFlagBadgeVariant {
  if (xpWeekly.blockedReason === "integrity_slip_weekly_xp") return "integrity_slip";
  const ft = flagType.toLowerCase();
  if (ft.includes("hero")) return "hero_trap";
  if (ft.includes("integrity") || ft === "integrity_slip") return "integrity_slip";
  return "clean";
}

function xpGateTriggered(xpCore: XPAwardResult, xpWeekly: XPAwardResult): boolean {
  return xpCore.blockedReason !== "none" || xpWeekly.blockedReason !== "none";
}

/**
 * Computes XP/microInsight from scenario engine; attempts full CHOICE_CONFIRMED pipeline when admin client exists.
 */
export async function submitScenarioSessionChoice(
  userId: string,
  payload: ScenarioSubmitPayload,
): Promise<ScenarioChoiceSubmitResult> {
  const scenario = await resolveScenarioForSubmit(userId, payload);
  const computed = computeResultFromScenario(scenario, payload);
  const flagType =
    scenario.coachNotes?.whatThisTrains?.[0] != null
      ? String(scenario.coachNotes.whatThisTrains[0])
      : "general";

  const { previousAir, newAir } = buildSyntheticAir(computed.xpEarned);
  const airDelta = newAir - previousAir;
  const foundryUnlockFired = newAir > previousAir;

  const admin = getSupabaseAdmin();
  if (!admin) {
    const xpAwardCore = await validateXPAward(userId, "core", computed.xpEarned);
    const xpAwardWeekly = await validateXPAward(userId, "weekly", computed.xpEarned);
    const sessionFlagBadge = badgeVariantFromFlags(flagType, xpAwardWeekly);
    let patternNarrativeLine: string | null = null;
    if (xpGateTriggered(xpAwardCore, xpAwardWeekly)) {
      try {
        const client = await getSupabaseServerClient();
        patternNarrativeLine = (await getPatternNarrative(userId, client)).trim() || null;
      } catch {
        patternNarrativeLine = null;
      }
    }
    return {
      ok: true,
      xpEarned: computed.xpEarned,
      airDelta,
      previousAir,
      newAir,
      xpAwardCore,
      xpAwardWeekly,
      sessionFlagBadge,
      foundryUnlockFired,
      avatarTierUpgradedFired: false,
      patternNarrativeLine,
      persisted: false,
      microInsight: computed.microInsight,
      result: computed.result,
      flagType,
    };
  }

  const event: ChoiceConfirmedEvent = {
    scenarioId: payload.scenarioId,
    choiceId: payload.choiceId,
    flagType,
    playedAt: new Date(),
    xp: { core: computed.xpEarned, weekly: computed.xpEarned },
    sessionResult: {
      scenarioType: payload.scenarioId,
      previousAir,
      newAir,
      occurredAt: new Date(),
    },
    air: {
      newAir,
      previousAir,
      previousAirRecordedAt: null,
    },
  };

  try {
    const { xpAwardCore, xpAwardWeekly } = await handleChoiceConfirmed(userId, event);
    const sessionFlagBadge = badgeVariantFromFlags(flagType, xpAwardWeekly);
    let patternNarrativeLine: string | null = null;
    if (xpGateTriggered(xpAwardCore, xpAwardWeekly)) {
      try {
        patternNarrativeLine = (await getPatternNarrative(userId, admin)).trim() || null;
      } catch {
        patternNarrativeLine = null;
      }
    }
    return {
      ok: true,
      xpEarned: computed.xpEarned,
      airDelta,
      previousAir,
      newAir,
      xpAwardCore,
      xpAwardWeekly,
      sessionFlagBadge,
      foundryUnlockFired,
      avatarTierUpgradedFired: false,
      patternNarrativeLine,
      persisted: true,
      microInsight: computed.microInsight,
      result: computed.result,
      flagType,
    };
  } catch {
    const xpAwardCore = await validateXPAward(userId, "core", computed.xpEarned);
    const xpAwardWeekly = await validateXPAward(userId, "weekly", computed.xpEarned);
    const sessionFlagBadge = badgeVariantFromFlags(flagType, xpAwardWeekly);
    return {
      ok: true,
      xpEarned: computed.xpEarned,
      airDelta,
      previousAir,
      newAir,
      xpAwardCore,
      xpAwardWeekly,
      sessionFlagBadge,
      foundryUnlockFired,
      avatarTierUpgradedFired: false,
      patternNarrativeLine: null,
      persisted: false,
      microInsight: computed.microInsight,
      result: computed.result,
      flagType,
    };
  }
}

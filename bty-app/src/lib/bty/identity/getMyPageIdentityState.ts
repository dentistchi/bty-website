import type { SupabaseClient } from "@supabase/supabase-js";
import { computeMetrics } from "@/features/arena/logic";
import { shouldShowCompoundRecovery } from "@/features/growth/logic";
import type { ReflectionEntry } from "@/features/growth/logic/types";
import { computeLeadershipState, mergeLeadershipReflectionLayer } from "@/features/my-page/logic";
import type { ArenaSignal, LeadershipMetrics, LeadershipState } from "@/features/my-page/logic/types";
import type { Locale } from "@/lib/i18n";
import {
  fetchOpenActionContractForMyPage,
  type MyPageOpenActionContractUi,
} from "@/lib/bty/my-page/openActionContractForMyPage";
import { fetchUserPatternSignaturesForMyPage } from "@/lib/bty/arena/fetchUserPatternSignatures.server";
import type { UserPatternSignaturePublic } from "@/lib/bty/arena/patternSignature.types";
import { buildFingerprintInput, resolveArchetypeForUser } from "@/lib/bty/archetype";
import { fetchSignalsAndReflections } from "./fetchIdentityRows";

export type MyPageIdentityPayload = {
  metrics: LeadershipMetrics;
  leadershipState: LeadershipState;
  /** Same compound signal as Growth history (Arena pressure + regulation pattern). */
  recoveryTriggered: boolean;
  recoveryEntryCount: number;
  /** For premium UI + client-side recovery prompt; identity metrics already derived from these. */
  signals: ArenaSignal[];
  reflections: ReflectionEntry[];
  /** Open or latest terminal action contract for Action Contract Hub (server-derived). */
  open_action_contract: MyPageOpenActionContractUi | null;
  /** Arena Phase B — aggregated pattern signatures (re-exposure / reinforcement), newest first. */
  pattern_signatures: UserPatternSignaturePublic[];
  /** Permanent lifetime XP from arena_memberships. */
  core_xp: number;
};

/**
 * Loads Arena signals + reflection entries from Supabase, runs domain compute + merge (server-side).
 * Does not duplicate XP/season/leaderboard rules — identity metrics only.
 */
export async function getMyPageIdentityState(
  supabase: SupabaseClient,
  userId: string,
  locale: Locale,
): Promise<{ ok: true; data: MyPageIdentityPayload } | { ok: false; message: string }> {
  const bundle = await fetchSignalsAndReflections(supabase, userId);
  if (!bundle.ok) return bundle;

  const { signals, reflections } = bundle;

  const [recoveryRes, sigBundle, openContract, membershipRes] = await Promise.all([
    supabase
      .from("bty_recovery_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    fetchUserPatternSignaturesForMyPage(supabase, userId),
    fetchOpenActionContractForMyPage(supabase, userId),
    supabase
      .from("arena_memberships")
      .select("core_xp")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (recoveryRes.error) return { ok: false, message: recoveryRes.error.message };
  if (!sigBundle.ok) return { ok: false, message: sigBundle.message };

  const coreXp = (membershipRes.data as { core_xp?: number } | null)?.core_xp ?? 0;

  const [scenariosRes, contractsRes] = await Promise.all([
    supabase
      .from("user_scenario_choice_history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("bty_action_contracts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "approved"),
  ]);

  const fingerprintInput = buildFingerprintInput(
    signals,
    sigBundle.rows,
    scenariosRes.count ?? 0,
    contractsRes.count ?? 0,
  );

  const archetypeResult = await resolveArchetypeForUser(supabase, userId, fingerprintInput);
  const codeNameOverride =
    archetypeResult.ok && archetypeResult.source !== "pattern_forming"
      ? archetypeResult.archetypeName
      : undefined;

  const metrics = computeMetrics(signals);
  const base = computeLeadershipState(metrics, locale, reflections, { codeNameOverride, coreXp });
  const leadershipState = mergeLeadershipReflectionLayer(base, metrics, signals, locale, reflections);
  const recoveryTriggered = shouldShowCompoundRecovery(signals, reflections);

  return {
    ok: true,
    data: {
      metrics,
      leadershipState,
      recoveryTriggered,
      recoveryEntryCount: recoveryRes.count ?? 0,
      signals,
      reflections,
      open_action_contract: openContract,
      pattern_signatures: sigBundle.rows,
      core_xp: coreXp,
    },
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeMetrics } from "@/features/arena/logic";
import { shouldShowCompoundRecovery } from "@/features/growth/logic";
import type { ReflectionEntry } from "@/features/growth/logic/types";
import { computeLeadershipState, mergeLeadershipReflectionLayer } from "@/features/my-page/logic";
import type { ArenaSignal, LeadershipMetrics, LeadershipState } from "@/features/my-page/logic/types";
import type { Locale } from "@/lib/i18n";
import {
  fetchAwaitingVerificationContractsForMyPage,
  fetchOpenActionContractForMyPage,
  type MyPageOpenActionContractUi,
} from "@/lib/bty/my-page/openActionContractForMyPage";
import { fetchUserPatternSignaturesForMyPage } from "@/lib/bty/arena/fetchUserPatternSignatures.server";
import type { UserPatternSignaturePublic } from "@/lib/bty/arena/patternSignature.types";
import { buildFingerprintInput, resolveArchetypeForUser } from "@/lib/bty/archetype";
import { CODE_NAMES } from "@/domain/constants";
import { tierFromCoreXp, codeIndexFromTier } from "@/domain/rules/level-tier";
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
  /** 안2-B: all awaiting-verification contracts (plural owner QR list). */
  awaiting_verification_contracts: MyPageOpenActionContractUi[];
  /** Arena Phase B — aggregated pattern signatures (re-exposure / reinforcement), newest first. */
  pattern_signatures: UserPatternSignaturePublic[];
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

  const [recoveryRes, sigBundle, openContract, awaitingContracts, profileRes] = await Promise.all([
    supabase
      .from("bty_recovery_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    fetchUserPatternSignaturesForMyPage(supabase, userId),
    fetchOpenActionContractForMyPage(supabase, userId),
    fetchAwaitingVerificationContractsForMyPage(supabase, userId),
    supabase
      .from("arena_profiles")
      .select("core_xp_total, code_index")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (recoveryRes.error) return { ok: false, message: recoveryRes.error.message };
  if (!sigBundle.ok) return { ok: false, message: sigBundle.message };

  const profileRow = profileRes.data as { core_xp_total?: number; code_index?: number } | null;
  const coreXp = profileRow?.core_xp_total ?? 0;

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

  // Archetype computation + naming-lock persistence preserved (State pipeline; surfaced via #2/#4
  // tracks, not the Identity slot). Result intentionally not consumed for the Identity code name.
  await resolveArchetypeForUser(supabase, userId, fingerprintInput);

  // Identity slot renders the user's Code (FORGE-series), single source = arena_profiles.code_index
  // (identical truth source to /api/arena/core-xp). BTY_AVATAR_IDENTITY_LOCK §1: Identity Anchor = Code.
  const codeIndex =
    typeof profileRow?.code_index === "number"
      ? profileRow.code_index
      : codeIndexFromTier(tierFromCoreXp(coreXp));
  const codeName = CODE_NAMES[Math.min(6, Math.max(0, codeIndex))];

  const metrics = computeMetrics(signals);
  const base = computeLeadershipState(metrics, locale, reflections, { codeNameOverride: codeName, coreXp });
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
      awaiting_verification_contracts: awaitingContracts,
      pattern_signatures: sigBundle.rows,
    },
  };
}

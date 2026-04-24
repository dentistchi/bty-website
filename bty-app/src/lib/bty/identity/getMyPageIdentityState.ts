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

  const { count: recoveryCount, error: recErr } = await supabase
    .from("bty_recovery_entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (recErr) return { ok: false, message: recErr.message };

  const metrics = computeMetrics(signals);
  const base = computeLeadershipState(metrics, locale, reflections);
  const leadershipState = mergeLeadershipReflectionLayer(base, metrics, signals, locale, reflections);
  const recoveryTriggered = shouldShowCompoundRecovery(signals, reflections);

  const open_action_contract = await fetchOpenActionContractForMyPage(supabase, userId);

  const sigBundle = await fetchUserPatternSignaturesForMyPage(supabase, userId);
  if (!sigBundle.ok) return { ok: false, message: sigBundle.message };

  return {
    ok: true,
    data: {
      metrics,
      leadershipState,
      recoveryTriggered,
      recoveryEntryCount: recoveryCount ?? 0,
      signals,
      reflections,
      open_action_contract,
      pattern_signatures: sigBundle.rows,
    },
  };
}

/**
 * Second Awakening (30-day ritual) — eligibility and ritual payload.
 * Ref: docs/specs/healing-coaching-spec-v3.json second_awakening_event.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { CORE_STATS } from "./coreStats";
import type { CoreStatId } from "./coreStats";
import { getUnlockedAdvancedStats } from "./unlock";
import type { UserCoreValues } from "./unlock";

const REQUIRED_DAY = 30;
const REQUIRED_MIN_SESSIONS = 10;

export interface SecondAwakeningRitual {
  act1: {
    name: string;
    sessionCount: number;
    repairLoopCount: number;
    oFnRCount: number;
    coreHighlight: { statId: CoreStatId; name: string; value: number }[];
    patternNote: string;
  };
  act2: {
    name: string;
    identityStatement: string;
    phaseIiIntro: string;
  };
  act3: {
    name: string;
    unlockGranted: "PRM" | "SAG" | null;
    unlockLabel: string;
  };
}

export interface SecondAwakeningResult {
  eligible: boolean;
  completed: boolean;
  userDay: number;
  sessionCount: number;
  ritual?: SecondAwakeningRitual;
}

export async function getSecondAwakening(
  supabase: SupabaseClient,
  userId: string
): Promise<SecondAwakeningResult> {
  const { data: firstSession } = await supabase
    .from("emotional_sessions")
    .select("started_at")
    .eq("user_id", userId)
    .order("started_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const firstStartedAt = firstSession?.started_at
    ? new Date((firstSession as { started_at: string }).started_at).getTime()
    : null;
  const userDay = firstStartedAt
    ? Math.max(1, Math.floor((Date.now() - firstStartedAt) / (24 * 60 * 60 * 1000)) + 1)
    : 0;

  const { count: sessionCount } = await supabase
    .from("emotional_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const completedCount = sessionCount ?? 0;

  const { data: milestone } = await supabase
    .from("user_healing_milestones")
    .select("second_awakening_completed_at, starter_unlock_granted")
    .eq("user_id", userId)
    .maybeSingle();

  const completed = !!(milestone as { second_awakening_completed_at: string | null } | null)
    ?.second_awakening_completed_at;
  const eligible =
    !completed && userDay >= REQUIRED_DAY && completedCount >= REQUIRED_MIN_SESSIONS;

  if (!eligible || completed) {
    return {
      eligible: !!(!completed && userDay >= REQUIRED_DAY && completedCount >= REQUIRED_MIN_SESSIONS),
      completed,
      userDay,
      sessionCount: completedCount,
    };
  }

  const { data: coreRows } = await supabase
    .from("user_emotional_stats")
    .select("stat_id, value")
    .eq("user_id", userId);
  const userCoreValues: UserCoreValues = {};
  for (const r of coreRows ?? []) {
    const row = r as { stat_id: string; value: number };
    if (["EA", "RS", "BS", "TI", "RC", "RD"].includes(row.stat_id)) {
      userCoreValues[row.stat_id as CoreStatId] = Number(row.value) || 0;
    }
  }

  const { data: eventRows } = await supabase
    .from("emotional_events")
    .select("event_id")
    .eq("user_id", userId);
  const eventCounts: Record<string, number> = {};
  for (const r of eventRows ?? []) {
    const id = (r as { event_id: string }).event_id;
    eventCounts[id] = (eventCounts[id] ?? 0) + 1;
  }

  const repairLoopCount =
    (eventCounts.REPAIR_ATTEMPT ?? 0) + (eventCounts.POST_CONFLICT_RETURN ?? 0);
  const oFnRCount = eventCounts.O_F_N_R_COMPLETED ?? 0;

  const coreEntries = (CORE_STATS as readonly { id: CoreStatId; name: string }[])
    .map((s) => ({ statId: s.id, name: s.name, value: userCoreValues[s.id] ?? 0 }))
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value);
  const coreHighlight = coreEntries.slice(0, 2);

  const unlocked = getUnlockedAdvancedStats(userCoreValues, eventCounts);
  const starterUnlock =
    unlocked.length > 0 ? null : ("PRM" as const); // PRM as default Starter Unlock per spec

  const ritual: SecondAwakeningRitual = {
    act1: {
      name: "Reflection Chamber",
      sessionCount: completedCount,
      repairLoopCount,
      oFnRCount,
      coreHighlight,
      patternNote: "반복 패턴은 훈련을 이어가며 스스로 발견해 나가면 좋아요.",
    },
    act2: {
      name: "Transition",
      identityStatement: "당신은 자동 반응에서 벗어나기 시작했습니다.",
      phaseIiIntro: "이제 일반 루틴으로 돌아가지만, 훈련은 더 정교해집니다.",
    },
    act3: {
      name: "Awakening",
      unlockGranted: starterUnlock,
      unlockLabel: starterUnlock
        ? starterUnlock === "PRM"
          ? "Pattern Recognition Mastery"
          : "Secure Attachment Growth"
        : "이미 해금된 역량이 있어요.",
    },
  };

  return {
    eligible: true,
    completed: false,
    userDay,
    sessionCount: completedCount,
    ritual,
  };
}

/**
 * Mark Second Awakening complete and grant starter unlock (PRM or SAG) if none.
 */
export async function completeSecondAwakening(
  supabase: SupabaseClient,
  userId: string
): Promise<{ ok: boolean; starterUnlockGranted?: "PRM" | "SAG" }> {
  const result = await getSecondAwakening(supabase, userId);
  if (!result.eligible || result.completed || !result.ritual)
    return { ok: false };

  const starter = result.ritual.act3.unlockGranted;
  const now = new Date().toISOString();

  const { error: upsertErr } = await supabase.from("user_healing_milestones").upsert(
    {
      user_id: userId,
      second_awakening_completed_at: now,
      starter_unlock_granted: starter ?? null,
    },
    { onConflict: "user_id" }
  );
  if (upsertErr) return { ok: false };

  if (starter) {
    await supabase.from("user_advanced_unlocks").upsert(
      { user_id: userId, advanced_stat_name: starter, unlocked_at: now },
      { onConflict: "user_id,advanced_stat_name" }
    );
  }

  return { ok: true, starterUnlockGranted: starter ?? undefined };
}

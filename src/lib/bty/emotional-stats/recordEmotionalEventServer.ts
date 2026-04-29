/**
 * Server-side record of one emotional event. Used by POST /api/emotional-stats/record-event and by chat/mentor.
 * Supabase client must be authenticated as the user (RLS).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getQualityWeight,
  CORE_STAT_IDS,
  type EmotionalEventId,
  type CoreStatId,
} from "./coreStats";
import { computeSessionGains } from "./formula";
import { shouldApplyReward, computeNovelty, computeConsistency } from "./antiExploit";
import { getUnlockedAdvancedStats } from "./unlock";
import type { UserCoreValues } from "./unlock";

export interface RecordEmotionalEventResult {
  ok: boolean;
  message_key?: "stat_increased" | "no_reward";
}

export async function recordEmotionalEventServer(
  supabase: SupabaseClient,
  userId: string,
  eventId: EmotionalEventId,
  sessionId: string | null
): Promise<RecordEmotionalEventResult> {
  let resolvedSessionId: string;
  let sessionStartedAt: string;

  if (sessionId) {
    const { data: session } = await supabase
      .from("emotional_sessions")
      .select("id, started_at")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .single();
    if (!session) return { ok: false };
    resolvedSessionId = session.id;
    sessionStartedAt = (session as { started_at: string }).started_at;
  } else {
    const { data: newSession, error: insErr } = await supabase
      .from("emotional_sessions")
      .insert({ user_id: userId })
      .select("id, started_at")
      .single();
    if (insErr || !newSession) return { ok: false };
    resolvedSessionId = (newSession as { id: string }).id;
    sessionStartedAt = (newSession as { started_at: string }).started_at;
  }

  const { data: sessionEvents } = await supabase
    .from("emotional_events")
    .select("event_id")
    .eq("session_id", resolvedSessionId)
    .order("created_at", { ascending: true });
  const eventIdsInSession: EmotionalEventId[] = (sessionEvents ?? []).map(
    (r: { event_id: string }) => r.event_id as EmotionalEventId
  );
  const withNew = [...eventIdsInSession, eventId];

  const { data: lastSession } = await supabase
    .from("emotional_sessions")
    .select("ended_at")
    .eq("user_id", userId)
    .lt("started_at", sessionStartedAt)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastEndedAt =
    lastSession && (lastSession as { ended_at: string | null }).ended_at
      ? new Date((lastSession as { ended_at: string }).ended_at).getTime()
      : null;

  const context = {
    eventIdsInSession: withNew,
    lastSessionEndedAt: lastEndedAt,
    sessionStartedAt: new Date(sessionStartedAt).getTime(),
    rapidWindowMinutes: 10,
    duplicatePatternThreshold: 3,
  };

  if (!shouldApplyReward(context)) return { ok: true, message_key: "no_reward" };

  const qualityWeight = getQualityWeight(eventId);
  const { error: evErr } = await supabase.from("emotional_events").insert({
    user_id: userId,
    event_id: eventId,
    session_id: resolvedSessionId,
    quality_weight: qualityWeight,
  });
  if (evErr) return { ok: false };

  const novelty = computeNovelty(withNew);
  const { data: sessionsLast7 } = await supabase
    .from("emotional_sessions")
    .select("started_at")
    .eq("user_id", userId)
    .gte("started_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
  const activityDaysLast7 = new Set(
    (sessionsLast7 ?? []).map((s: { started_at: string }) => (s.started_at as string).slice(0, 10))
  ).size;
  const consistency = computeConsistency(activityDaysLast7);

  const { data: firstSession } = await supabase
    .from("emotional_sessions")
    .select("started_at")
    .eq("user_id", userId)
    .order("started_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const firstStartedAt = firstSession && (firstSession as { started_at: string }).started_at
    ? new Date((firstSession as { started_at: string }).started_at).getTime()
    : Date.now();
  const userDay = Math.max(1, Math.floor((Date.now() - firstStartedAt) / (24 * 60 * 60 * 1000)) + 1);

  const gains = computeSessionGains(withNew, novelty, consistency, userDay);

  const { data: currentRows } = await supabase
    .from("user_emotional_stats")
    .select("stat_id, value")
    .eq("user_id", userId);
  const current: Record<CoreStatId, number> = {} as Record<CoreStatId, number>;
  for (const id of CORE_STAT_IDS) current[id] = 0;
  for (const r of currentRows ?? []) {
    const row = r as { stat_id: string; value: number };
    if (CORE_STAT_IDS.includes(row.stat_id as CoreStatId)) {
      current[row.stat_id as CoreStatId] = Number(row.value) || 0;
    }
  }

  const { data: allEventRows } = await supabase
    .from("emotional_events")
    .select("event_id")
    .eq("user_id", userId);
  const eventCountsForUnlock: Record<string, number> = {};
  for (const r of allEventRows ?? []) {
    const id = (r as { event_id: string }).event_id;
    eventCountsForUnlock[id] = (eventCountsForUnlock[id] ?? 0) + 1;
  }

  const now = new Date().toISOString();
  for (const statId of CORE_STAT_IDS) {
    const g = gains[statId];
    if (g <= 0) continue;
    const next = Math.min(100, current[statId] + g);
    current[statId] = next;
    await supabase.from("user_emotional_stats").upsert(
      {
        user_id: userId,
        stat_id: statId,
        value: next,
        updated_at: now,
      },
      { onConflict: "user_id,stat_id" }
    );
  }

  const unlockedIds = getUnlockedAdvancedStats(current as UserCoreValues, eventCountsForUnlock);
  for (const name of unlockedIds) {
    await supabase.from("user_advanced_unlocks").upsert(
      { user_id: userId, advanced_stat_name: name, unlocked_at: now },
      { onConflict: "user_id,advanced_stat_name" }
    );
  }

  return { ok: true, message_key: "stat_increased" };
}

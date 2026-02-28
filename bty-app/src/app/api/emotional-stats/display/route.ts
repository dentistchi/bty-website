import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { ADVANCED_STATS, CORE_STATS, type CoreStatId } from "@/lib/bty/emotional-stats/coreStats";
import { getUnlockedAdvancedStats } from "@/lib/bty/emotional-stats/unlock";
import type { UserCoreValues } from "@/lib/bty/emotional-stats/unlock";

/** Build display phrases only (no numbers). Includes phase_status for Phase II ring (visibility: no numbers). */
export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const phrases: string[] = [];
  let phase: "II" | null = null;

  const { data: milestone } = await supabase
    .from("user_healing_milestones")
    .select("second_awakening_completed_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (milestone && (milestone as { second_awakening_completed_at: string | null }).second_awakening_completed_at)
    phase = "II";

  const { data: coreRows } = await supabase
    .from("user_emotional_stats")
    .select("stat_id, value")
    .eq("user_id", user.id);
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
    .eq("user_id", user.id);
  const eventCounts: Record<string, number> = {};
  for (const r of eventRows ?? []) {
    const id = (r as { event_id: string }).event_id;
    eventCounts[id] = (eventCounts[id] ?? 0) + 1;
  }

  const unlockedIds = getUnlockedAdvancedStats(userCoreValues, eventCounts);

  const shortToLongId: Record<string, string> = {
    PRM: "PATTERN_RECOGNITION_MASTERY",
    SAG: "SECURE_ATTACHMENT_GROWTH",
    EL: "EMOTIONAL_LEADERSHIP",
    CNS: "CONFLICT_NAVIGATION_SKILL",
    CD: "COMPASSION_DEPTH",
    IS: "IDENTITY_STABILITY",
  };
  for (const id of unlockedIds) {
    const longId = shortToLongId[id];
    const def = longId ? ADVANCED_STATS.find((s) => s.id === longId) : undefined;
    const name = def?.name ?? id;
    phrases.push(`${name} 잠금 해제됨`);
  }

  const hasAnyCore = Object.values(userCoreValues).some((v) => v > 0);
  if (hasAnyCore) {
    for (const stat of CORE_STATS) {
      const v = userCoreValues[stat.id];
      if (v != null && v > 0) phrases.push(`${stat.name} 강화됨`);
    }
  } else if (eventRows && eventRows.length > 0) {
    phrases.push("오늘의 성장이 기록되었어요");
  }

  const out = NextResponse.json({ phrases, phase });
  copyCookiesAndDebug(base, out, req, true);
  return out;
}

/**
 * GET /api/arena/unlocked-scenarios
 * Returns track, maxUnlockedLevel, previewLevel, and scenario levels/items the user may access.
 * L4 (Partner) is admin-granted only (arena_profiles.l4_access); not unlocked by tenure.
 */

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getEffectiveTrack, loadProgramConfig, loadL4Level } from "@/lib/bty/arena/program";
import type { LevelWithTenure } from "@/lib/bty/arena/program";
import { getUnlockedContentWindow } from "@/lib/bty/arena/unlock";
import type { Track } from "@/lib/bty/arena/tenure";

const STAFF_ORDER = ["S1", "S2", "S3"];
const LEADER_ORDER = ["L1", "L2", "L3", "L4"];

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  // joinedAt: membership or auth user creation date. leaderStartedAt: not in DB yet, null.
  let joinedAt = user.created_at ?? new Date().toISOString();
  let jobFunction: string | null = null;
  let membershipRole: string | null = null;

  const { data: membership } = await supabase
    .from("memberships")
    .select("created_at, role, job_function")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membership?.created_at) joinedAt = membership.created_at;
  if (membership?.role) membershipRole = membership.role;
  if (membership?.job_function) jobFunction = membership.job_function;

  const track = getEffectiveTrack({
    jobFunction: jobFunction ?? undefined,
    membershipRole: membershipRole as "staff" | "doctor" | "office_manager" | "regional_manager" | undefined,
    joinedAt,
  }) as Track;

  let l4Granted = false;
  const { data: profile } = await supabase
    .from("arena_profiles")
    .select("l4_access")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profile && typeof (profile as { l4_access?: boolean }).l4_access === "boolean") {
    l4Granted = (profile as { l4_access: boolean }).l4_access;
  }

  const { maxUnlockedLevel, previewLevel } = getUnlockedContentWindow({
    track,
    user: { joinedAt, leaderStartedAt: null },
    now: new Date(),
    l4Granted,
  });

  const program = loadProgramConfig();
  const trackConfig = program.tracks.find((t) => t.track === track);
  const ordering = track === "staff" ? STAFF_ORDER : LEADER_ORDER;
  const maxIndex = ordering.indexOf(maxUnlockedLevel);

  let levels: Array<{ level: string; title: string; title_ko?: string; structure: string[]; items: unknown[] }>;
  if (!trackConfig?.levels?.length) {
    levels = [];
  } else {
    levels = trackConfig.levels
      .filter((lvl) => {
        const i = ordering.indexOf(lvl.level);
        return i >= 0 && i <= maxIndex;
      })
      .map((lvl) => {
        const { items, human_model: _hm, ...rest } = lvl as LevelWithTenure;
        return { ...rest, items };
      });
  }

  if (track === "leader" && maxUnlockedLevel === "L4") {
    const l4Level = loadL4Level();
    const { items, human_model: _hm, ...rest } = l4Level;
    levels = [...levels, { ...rest, items }];
  }

  return NextResponse.json({
    ok: true,
    track,
    maxUnlockedLevel,
    previewLevel,
    levels,
  });
}

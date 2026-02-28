/**
 * GET /api/arena/unlocked-scenarios
 * Returns track, maxUnlockedLevel, previewLevel, and scenario levels/items the user may access.
 * Gated by Arena membership approval: only approved arena_membership_requests row is used for tenure.
 * Pending or no request → membershipPending, empty levels.
 * Leader with L1+ → staff levels S1–S3 also included (아랫단계 오픈).
 */

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getEffectiveTrack } from "@/lib/bty/arena/program";
import { loadProgramConfig } from "@/lib/bty/arena/program";
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

  const { data: membershipRequest } = await supabase
    .from("arena_membership_requests")
    .select("id, job_function, joined_at, leader_started_at, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membershipRequest || membershipRequest.status !== "approved") {
    return NextResponse.json({
      ok: true,
      membershipPending: true,
      track: "staff",
      maxUnlockedLevel: null,
      previewLevel: null,
      levels: [],
      l4_access: false,
    });
  }

  const joinedAt = membershipRequest.joined_at
    ? new Date(membershipRequest.joined_at).toISOString()
    : new Date().toISOString();
  const leaderStartedAt = membershipRequest.leader_started_at
    ? new Date(membershipRequest.leader_started_at).toISOString()
    : null;
  const jobFunction = membershipRequest.job_function ?? null;

  const track = getEffectiveTrack({
    jobFunction: jobFunction ?? undefined,
    membershipRole: undefined,
    joinedAt,
  }) as Track;

  let l4_access = false;
  const { data: profile } = await supabase
    .from("arena_profiles")
    .select("l4_access")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profile?.l4_access === true) l4_access = true;

  const { maxUnlockedLevel, previewLevel } = getUnlockedContentWindow({
    track,
    user: { joinedAt, leaderStartedAt },
    now: new Date(),
    l4Granted: l4_access,
    jobFunction: jobFunction ?? undefined,
  });

  const program = loadProgramConfig();
  const trackConfig = program.tracks.find((t) => t.track === track);
  if (!trackConfig?.levels?.length) {
    return NextResponse.json({
      ok: true,
      membershipPending: false,
      track,
      maxUnlockedLevel,
      previewLevel,
      levels: [],
      l4_access,
    });
  }

  const ordering = track === "staff" ? STAFF_ORDER : LEADER_ORDER;
  const maxIndex = ordering.indexOf(maxUnlockedLevel);
  const levels = trackConfig.levels
    .filter((lvl) => {
      const i = ordering.indexOf(lvl.level);
      return i >= 0 && i <= maxIndex;
    })
    .map((lvl) => {
      const { items, human_model: _hm, ...rest } = lvl as LevelWithTenure;
      return { ...rest, items };
    });

  let finalLevels = levels;
  if (track === "leader" && STAFF_ORDER.indexOf(maxUnlockedLevel) < 0) {
    const leaderMaxIndex = LEADER_ORDER.indexOf(maxUnlockedLevel);
    if (leaderMaxIndex >= 0) {
      const staffConfig = program.tracks.find((t) => t.track === "staff");
      if (staffConfig?.levels?.length) {
        const staffLevels = staffConfig.levels
          .filter((lvl) => STAFF_ORDER.includes(lvl.level))
          .map((lvl) => {
            const { items, human_model: _hm, ...rest } = lvl as LevelWithTenure;
            return { ...rest, items };
          });
        finalLevels = [...staffLevels, ...levels];
      }
    }
  }

  return NextResponse.json({
    ok: true,
    membershipPending: false,
    track,
    maxUnlockedLevel,
    previewLevel,
    levels: finalLevels,
    l4_access,
  });
}

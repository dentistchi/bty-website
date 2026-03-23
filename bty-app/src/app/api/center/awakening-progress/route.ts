/**
 * GET /api/center/awakening-progress?userId=
 * RENEWAL awakening milestones — {@link getAwakeningProgress} + card copy (KO/EN).
 */
import { NextRequest, NextResponse } from "next/server";
import {
  AWAKENING_MENTOR_MILESTONE_ID,
  AWAKENING_MILESTONES,
  describeMilestoneCondition,
  getAwakeningProgress,
} from "@/engine/healing/awakening-phase.service";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const userId = req.nextUrl.searchParams.get("userId")?.trim() ?? user.id;
  if (userId !== user.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const progress = await getAwakeningProgress(userId, supabase);
    const milestones = AWAKENING_MILESTONES.map((m) => ({
      id: m.id,
      titleKo: m.titleKo,
      titleEn: m.titleEn,
      conditionKo: describeMilestoneCondition(m, "ko"),
      conditionEn: describeMilestoneCondition(m, "en"),
      completed: progress.completedIds.includes(m.id),
    }));

    const mentorMilestonePending = !progress.completedIds.includes(AWAKENING_MENTOR_MILESTONE_ID);

    const res = NextResponse.json({
      ...progress,
      milestones,
      mentorMilestonePending,
    });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    const res = NextResponse.json({ error: msg }, { status: 500 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}

/**
 * POST /api/arena/reflect
 * Reflection Deepening Engine – server-only. Uses Arena Human Model.
 * Requires auth. levelId is resolved from user tenure when not provided.
 */

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getEffectiveTrack } from "@/lib/bty/arena/program";
import { getUnlockedContentWindow } from "@/lib/bty/arena/unlock";
import { buildReflection, type LevelId, type HumanModelConfig } from "@/lib/bty/arena/reflection-engine";
import humanModelJson from "@/lib/bty/arena/arena_human_model.json";

export const runtime = "nodejs";

const VALID_LEVEL_IDS: LevelId[] = ["S1", "S2", "S3", "L1", "L2", "L3", "L4"];
const HUMAN_MODEL = humanModelJson as HumanModelConfig;

export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body: { levelId?: string; userText?: string; scenario?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userText = String(body.userText ?? "").trim();
  if (!userText) {
    return NextResponse.json({ error: "userText is required" }, { status: 400 });
  }

  let levelId: LevelId;
  const bodyLevel = body.levelId ? String(body.levelId).trim().toUpperCase() : "";
  if (bodyLevel && VALID_LEVEL_IDS.includes(bodyLevel as LevelId) && HUMAN_MODEL.levels[bodyLevel as LevelId]) {
    levelId = bodyLevel as LevelId;
  } else {
    // Resolve from user tenure (same as GET /api/arena/unlocked-scenarios).
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
    });
    const { maxUnlockedLevel } = getUnlockedContentWindow({
      track,
      user: { joinedAt, leaderStartedAt: null },
      now: new Date(),
    });
    // Human model has S1..L4; tenure returns S1..L3. Use maxUnlockedLevel (valid in model).
    levelId = HUMAN_MODEL.levels[maxUnlockedLevel] ? maxUnlockedLevel as LevelId : "S1";
  }

  const scenario = body.scenario ?? undefined;
  const result = buildReflection(levelId, userText, HUMAN_MODEL, scenario);

  return NextResponse.json({
    ok: true,
    summary: result.summary,
    questions: result.questions,
    next_action: result.next_action,
    detected: {
      tags: result.detected.tags,
      topTag: result.detected.topTag,
    },
  });
}

/**
 * GET /api/bty/foundry/dojo/assign — assign Foundry micro Dojo assessment (weakest skill or `skill_area`).
 */
import { NextRequest, NextResponse } from "next/server";
import {
  assignDojoAssessmentAsUser,
  type DojoSkillArea,
} from "@/engine/foundry/dojo-assessment.service";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

const SKILLS: readonly DojoSkillArea[] = [
  "communication",
  "decision",
  "resilience",
  "integrity",
  "leadership",
  "empathy",
];

export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  try {
    const lang = req.nextUrl.searchParams.get("lang") === "en" ? "en" : "ko";
    const raw = req.nextUrl.searchParams.get("skill_area");
    const skill_area =
      raw && (SKILLS as readonly string[]).includes(raw) ? (raw as DojoSkillArea) : undefined;

    const { attemptId, assessment } = await assignDojoAssessmentAsUser(user.id, skill_area, lang);

    const { data: pending } = await supabase
      .from("slip_recovery_tasks")
      .select("id")
      .eq("user_id", user.id)
      .eq("task_type", "dojo_assessment")
      .is("completed_at", null)
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const pendingRecoveryTaskId =
      pending && typeof (pending as { id?: unknown }).id === "string"
        ? (pending as { id: string }).id
        : null;

    const res = NextResponse.json({
      ok: true as const,
      attemptId,
      assessment,
      pendingRecoveryTaskId,
    });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    const res = NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}

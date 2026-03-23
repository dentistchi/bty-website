/**
 * POST /api/bty/foundry/dojo/submit — submit Likert answers for open `user_dojo_attempts` row.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDojoAssessmentById, submitDojoResultAsUser } from "@/engine/foundry/dojo-assessment.service";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  try {
    const body = (await req.json().catch(() => ({}))) as {
      assessmentId?: unknown;
      answers?: unknown;
    };
    const assessmentId = typeof body.assessmentId === "string" ? body.assessmentId.trim() : "";
    const answersRaw = body.answers;

    if (!assessmentId) {
      const res = NextResponse.json({ ok: false as const, error: "assessment_id_required" }, { status: 400 });
      copyCookiesAndDebug(base, res, req, true);
      return res;
    }

    const def = getDojoAssessmentById(assessmentId);
    if (!def) {
      const res = NextResponse.json({ ok: false as const, error: "unknown_assessment" }, { status: 400 });
      copyCookiesAndDebug(base, res, req, true);
      return res;
    }

    let answers: Record<string, number>;
    if (Array.isArray(answersRaw)) {
      if (
        !answersRaw.every((x) => typeof x === "number" && Number.isInteger(x)) ||
        answersRaw.length !== def.questions.length
      ) {
        const res = NextResponse.json(
          { ok: false as const, error: "answers_array_invalid" },
          { status: 400 },
        );
        copyCookiesAndDebug(base, res, req, true);
        return res;
      }
      answers = Object.fromEntries(def.questions.map((q, i) => [q.id, answersRaw[i] as number]));
    } else if (answersRaw && typeof answersRaw === "object" && !Array.isArray(answersRaw)) {
      answers = answersRaw as Record<string, number>;
    } else {
      const res = NextResponse.json(
        { ok: false as const, error: "answers_required" },
        { status: 400 },
      );
      copyCookiesAndDebug(base, res, req, true);
      return res;
    }

    const result = await submitDojoResultAsUser(user.id, assessmentId, answers);
    const res = NextResponse.json({ ok: true as const, result });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    const status =
      msg.includes("no open attempt") || msg.includes("invalid_answer") ? 409 : 500;
    const res = NextResponse.json({ ok: false as const, error: msg }, { status });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}

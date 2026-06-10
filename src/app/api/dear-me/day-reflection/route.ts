/**
 * POST /api/dear-me/day-reflection — DECISION6 C2: Train Day reflection set upsert.
 * Body: { day, locale, responses:{ title, questions:[{q,a}...], finalReflection } }.
 * Response (200): { letterId }. Errors: 401 { error:"Unauthorized" };
 * 400 validation (invalid_day, empty_reflection, text_too_long, missing_body);
 * 500 { error:"Something went wrong" }.
 *
 * Independent of submitLetter / /api/dear-me/letter (clean separation). Record-only:
 * does NOT touch markTodayComplete / train completion (기록 ≠ 완료).
 */
import { NextRequest, NextResponse } from "next/server";
import { getLetterAuth, submitDayReflection, type DayReflectionResponses } from "@/lib/bty/center";
import { logApiError } from "@/lib/log-api-error";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const auth = await getLetterAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { day?: unknown; locale?: string; responses?: unknown };
    try {
      body = (await req.json()) as { day?: unknown; locale?: string; responses?: unknown };
    } catch {
      return NextResponse.json({ error: "missing_body" }, { status: 400 });
    }

    const day = typeof body.day === "number" ? body.day : Number(body.day);
    const responses = body.responses as DayReflectionResponses | undefined;
    if (!responses || typeof responses !== "object") {
      return NextResponse.json({ error: "missing_body" }, { status: 400 });
    }

    const result = await submitDayReflection(auth.supabase, {
      userId: auth.userId,
      day,
      locale: body.locale,
      responses,
      source: "train",
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ letterId: result.letterId });
  } catch (e) {
    logApiError("dear-me/day-reflection", 500, e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

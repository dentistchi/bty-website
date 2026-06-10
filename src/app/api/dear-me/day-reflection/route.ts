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
import {
  getLetterAuth,
  submitDayReflection,
  getDayReflection,
  type DayReflectionResponses,
} from "@/lib/bty/center";
import { logApiError } from "@/lib/log-api-error";

export const runtime = "nodejs";

/**
 * GET /api/dear-me/day-reflection?day=N — existing Train Day reflection set (for
 * form prefill on re-edit). Response (200): { responses } | { responses: null }.
 * Errors: 401 Unauthorized; 400 invalid_day; 500.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getLetterAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const day = Number(req.nextUrl.searchParams.get("day"));
    const result = await getDayReflection(auth.supabase, {
      userId: auth.userId,
      day,
      source: "train",
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ responses: result.responses });
  } catch (e) {
    logApiError("dear-me/day-reflection GET", 500, e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

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

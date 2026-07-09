/**
 * Center Daily Keep API — Center Promise Loop STEP 1A.
 *
 * POST /api/bty/center/keep  body: { line, locale? } → { ok, keptId, keptToday:true }
 *   Saves ONE self-authored line for today into the Center-owned dear_me_letters
 *   table (marker prompt='center_daily_keep'). NO LLM, NO reply. Fail-soft.
 * GET  /api/bty/center/keep?tz=...  → { line, keptToday }
 *   The user's latest keep + whether it was written today (caller tz, UTC fallback).
 *
 * This is NOT the Arena action contract (a training commitment) and NOT the Dear Me
 * letter flow (a reply). Thin handler → delegates to centerKeepService. Auth via
 * getLetterAuth (same pattern as the other Center letter/reflection routes).
 */
import { NextRequest, NextResponse } from "next/server";
import { getLetterAuth, saveCenterKeep, getTodayCenterKeep } from "@/lib/bty/center";
import { logApiError } from "@/lib/log-api-error";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const auth = await getLetterAuth();
    if (!auth) {
      return NextResponse.json({ line: null, keptToday: false }, { status: 401 });
    }
    const tz = req.nextUrl.searchParams.get("tz");
    const keep = await getTodayCenterKeep(auth.supabase, auth.userId, tz);
    return NextResponse.json(keep);
  } catch (e) {
    logApiError("bty/center/keep GET", 500, e);
    // Fail-soft: never blocks the quiet room — client falls back to the writing surface.
    return NextResponse.json({ line: null, keptToday: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getLetterAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { line?: unknown; locale?: string };
    try {
      body = (await req.json()) as { line?: unknown; locale?: string };
    } catch {
      return NextResponse.json({ error: "missing_body" }, { status: 400 });
    }

    const line = typeof body.line === "string" ? body.line : "";
    const result = await saveCenterKeep(auth.supabase, {
      userId: auth.userId,
      line,
      locale: body.locale,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, keptId: result.keptId, keptToday: true });
  } catch (e) {
    logApiError("bty/center/keep", 500, e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

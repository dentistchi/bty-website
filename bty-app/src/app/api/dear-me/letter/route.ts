/**
 * POST /api/dear-me/letter — Dear Me 편지 제출·답장 반환.
 * Thin handler: auth → validation → service call → response.
 */
import { NextRequest, NextResponse } from "next/server";
import { getLetterAuth, submitLetter } from "@/lib/bty/center";
import { logApiError } from "@/lib/log-api-error";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const auth = await getLetterAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { letterText?: unknown; lang?: string; useLlm?: boolean };
    try {
      body = (await req.json()) as { letterText?: unknown; lang?: string; useLlm?: boolean };
    } catch {
      return NextResponse.json({ error: "missing_text" }, { status: 400 });
    }

    const letterText =
      typeof body.letterText === "string" ? body.letterText.trim() : "";

    const result = await submitLetter(auth.supabase, {
      userId: auth.userId,
      body: letterText,
      locale: body.lang,
      useLlm: body.useLlm === true,
    });

    if (!result.ok) {
      const status =
        result.error === "text_too_long" || result.error === "body_too_long" ? 400 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({
      letterId: result.letterId,
      replyMessage: result.reply,
    });
  } catch (e) {
    logApiError("dear-me/letter", 500, e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

/**
 * POST /api/dear-me/letter — Dear Me 편지 제출·답장 반환.
 * Response (200): { letterId, replyMessage }.
 * Errors: 401 { error: "Unauthorized" }; 400 validation (missing_text, text_too_long, body_too_long, etc.); 500 { error: "Something went wrong" } (catch/JSON parse failure).
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

    let body: {
      letterText?: unknown;
      lang?: string;
      useLlm?: boolean;
      type?: string;
      seedId?: unknown;
      source?: string;
      day?: unknown;
      prompt?: unknown;
    };
    try {
      body = (await req.json()) as {
        letterText?: unknown;
        lang?: string;
        useLlm?: boolean;
        type?: string;
        seedId?: unknown;
        source?: string;
        day?: unknown;
        prompt?: unknown;
      };
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
      // IA-B4c: 'reflection' only when explicitly requested; otherwise 'letter' (non-breaking).
      type: body.type === "reflection" ? "reflection" : "letter",
      seedId: typeof body.seedId === "string" ? body.seedId : undefined,
      // DECISION6: source-aware capture; default 'center' when unspecified (non-breaking).
      source:
        body.source === "train" || body.source === "arena" ? body.source : undefined,
      day: typeof body.day === "number" && Number.isFinite(body.day) ? body.day : undefined,
      prompt: typeof body.prompt === "string" ? body.prompt : undefined,
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

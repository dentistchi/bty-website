/**
 * POST /api/center/letter — Center "나에게 쓰는 편지" 저장 + 답장 생성.
 * Response (200): service result. Errors: 401 { error: "Unauthorized" }, 400 body_empty, 500.
 */
import { NextResponse } from "next/server";
import { getLetterAuth, submitCenterLetter } from "@/lib/bty/center";
import { logApiError } from "@/lib/log-api-error";

export async function POST(request: Request) {
  try {
    const auth = await getLetterAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      body?: string;
      mood?: string;
      energy?: number;
      oneWord?: string;
      lang?: string;
    };

    const result = await submitCenterLetter(auth.supabase, {
      userId: auth.userId,
      body: typeof body.body === "string" ? body.body : "",
      mood: body.mood,
      energy: body.energy,
      oneWord: body.oneWord,
      locale: body.lang,
    });

    if (!result.ok) {
      const status = result.error === "body_empty" ? 400 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ saved: true, reply: result.reply });
  } catch (e) {
    logApiError("center/letter", 500, e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

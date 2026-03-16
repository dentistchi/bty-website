/**
 * POST /api/dojo/submit — Dojo 50문항 제출 (thin handler).
 * Body: { answers: Record<string, number> } (q 1–50, value 1–5).
 * Response (200): { submissionId, scores, summaryKey, mentorComment? }.
 * Errors: 401 { error: "UNAUTHENTICATED" }, 400 { error: "invalid_body" | service error }.
 */

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { submitDojo50 } from "@/lib/bty/foundry/dojoSubmitService";
import { getMessages } from "@/lib/i18n";

export const runtime = "nodejs";

type Locale = "ko" | "en";

function getLocaleFromRequest(request: Request): Locale {
  const accept = request.headers.get("accept-language") ?? "";
  const first = accept.split(",")[0]?.toLowerCase() ?? "";
  if (first.startsWith("ko")) return "ko";
  return "en";
}

function getMentorComment(summaryKey: string, locale: Locale): string {
  const messages = getMessages(locale);
  const d = messages.dojoResult;
  if (summaryKey === "high") return d.resultCommentHigh;
  if (summaryKey === "mid") return d.resultCommentMid;
  if (summaryKey === "low") return d.resultCommentLow;
  return "";
}

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body: { answers?: Record<string, number> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const raw = body.answers ?? {};
  const answers: Record<number, number> = {};
  for (let q = 1; q <= 50; q++) {
    const v = raw[String(q)] ?? raw[q];
    if (typeof v === "number" && v >= 1 && v <= 5) answers[q] = v;
  }

  const result = await submitDojo50(supabase, user.id, answers);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const locale = getLocaleFromRequest(request);
  const mentorComment = getMentorComment(result.summaryKey, locale);

  return NextResponse.json({
    submissionId: result.submissionId,
    scores: result.scores,
    summaryKey: result.summaryKey,
    mentorComment: mentorComment || undefined,
  });
}

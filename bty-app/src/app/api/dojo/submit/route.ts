/**
 * POST /api/dojo/submit — Dojo 50문항 제출·영역별 점수·Dr. Chi 코멘트.
 * DOJO_50_SUBMIT_RESULT_API_1PAGE. 도메인: validateDojo50Submit, computeDojo50Result만 사용.
 */

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { validateDojo50Submit, computeDojo50Result } from "@/domain/dojo/flow";
import { getMessages } from "@/lib/i18n";

export const runtime = "nodejs";

type Locale = "ko" | "en";

function getLocaleFromRequest(request: Request): Locale {
  const accept = request.headers.get("accept-language") ?? "";
  const first = accept.split(",")[0]?.toLowerCase() ?? "";
  if (first.startsWith("ko")) return "ko";
  return "en";
}

/** summaryKey별 Dr. Chi 코멘트 템플릿 (i18n). */
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

  const validation = validateDojo50Submit(answers);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const result = computeDojo50Result(answers);
  const locale = getLocaleFromRequest(request);
  const mentorComment = getMentorComment(result.summaryKey, locale);

  return NextResponse.json({
    scores: result.scores,
    summaryKey: result.summaryKey,
    mentorComment: mentorComment || undefined,
  });
}

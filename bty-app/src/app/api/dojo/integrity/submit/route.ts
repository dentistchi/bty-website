/**
 * POST /api/dojo/integrity/submit — 역지사지 연습 제출 (thin handler).
 * Body: { text?, choiceId?, scenarioId? }. Response (200): { submissionId: string }.
 * Errors: 401 { error: "UNAUTHENTICATED" }; 400 { error: "invalid_body" } | { error: string } (submitIntegrity 검증 실패).
 */

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { submitIntegrity } from "@/lib/bty/foundry/integritySubmitService";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  let body: { text?: string | null; choiceId?: string | null; scenarioId?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const result = await submitIntegrity(supabase, user.id, {
    text: body.text ?? null,
    choiceId: body.choiceId ?? null,
  }, {
    scenarioId: body.scenarioId ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    submissionId: result.submissionId,
  });
}

/**
 * GET /api/dojo/submissions — 로그인 사용자의 Dojo 50문항 제출 이력 조회.
 * RLS가 user_id 필터링을 보장하므로 .eq("user_id", user.id) 적용.
 * Response 200: DojoSubmissionsResponse. Errors: 401 { error: "UNAUTHENTICATED" }; 500 { error: string }.
 */

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import type { DojoSubmissionRow, DojoSubmissionsResponse } from "@/lib/bty/foundry/dojoSubmitService";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse<DojoSubmissionsResponse | { error: string }>> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { data, error } = await supabase
    .from("dojo_submissions")
    .select("id, scores_json, summary_key, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const submissions: DojoSubmissionRow[] = (data ?? []) as DojoSubmissionRow[];
  return NextResponse.json({ submissions } satisfies DojoSubmissionsResponse);
}

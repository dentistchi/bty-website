import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

/**
 * GET /api/arena/run/[id] — 단일 런 조회(본인 소유만).
 *
 * @contract
 * - **401:** `{ error: "UNAUTHENTICATED" }`.
 * - **404:** `{ error: "NOT_FOUND" }` — **`[id]` 공백**·해당 `run_id` 없음·**다른 사용자 런**(RLS/필터로 미조회).
 * - **200:** `{ run: { run_id, scenario_id, started_at, status, difficulty?, meta?, … } }`.
 * - **500:** `{ error: string }` — DB 오류.
 * - **250:** 404 본문은 항상 **`error: "NOT_FOUND"`** 단일 키.
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { id } = await context.params;
  const runId = typeof id === "string" ? id.trim() : "";
  if (!runId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("arena_runs")
    .select("run_id, scenario_id, locale, started_at, status, difficulty, meta")
    .eq("run_id", runId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  return NextResponse.json({ run: data });
}

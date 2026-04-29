import { NextRequest, NextResponse } from "next/server";
import { arenaRunIdFromUnknown } from "@/domain/arena/scenarios";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

/**
 * GET /api/arena/run/[runId] — **단일 런** 조회(본인 소유만).
 *
 * @contract
 * - **401:** `{ error: "UNAUTHENTICATED" }`.
 * - **400:** `{ error: "MISSING_RUN_ID" }` — path 빈 값·trim 후 빈 문자열·**`arenaRunIdFromUnknown`** 거부(내부 공백·초과 길이 등).
 * - **404:** `{ error: "NOT_FOUND" }` — 없거나 다른 사용자 런.
 * - **200:** `{ run: { run_id, scenario_id, locale, started_at, status, completed_at?, meta?, … } }` — `arena_runs` 선택 컬럼.
 * - **500:** `{ error: string }` — DB 오류.
 *
 * @see docs/spec/ARENA_DOMAIN_SPEC.md §4-1
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { runId: raw } = await params;
  const runId = arenaRunIdFromUnknown(typeof raw === "string" ? raw : "");
  if (runId === null) return NextResponse.json({ error: "MISSING_RUN_ID" }, { status: 400 });

  const { data, error } = await supabase
    .from("arena_runs")
    .select(
      "run_id, scenario_id, locale, started_at, status, completed_at, difficulty, meta, completion_state, acknowledgment_timestamp",
    )
    .eq("run_id", runId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  return NextResponse.json({ run: data });
}

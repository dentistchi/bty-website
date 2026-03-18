import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

/**
 * POST /api/arena/run — Arena 시나리오 런 시작 (`arena_runs` insert, `ensure_arena_profile` RPC).
 *
 * @contract
 * - **Auth:** 세션 필수 → 401 `{ error: "UNAUTHENTICATED" }`.
 * - **Body (JSON):** `scenarioId` string 필수. 선택: `locale`, `difficulty`, `meta` (plain object).
 * - **200:** `{ run: { run_id: string, scenario_id: string, started_at: string, status: string } }`.
 * - **400:** `{ error: "scenarioId_required" }` — `scenarioId` 누락·빈 문자열.
 * - **409:** 미사용 — 동일 시나리오 **연속 런 생성 허용**(중복 시작 충돌 코드 없음).
 * - **500:** `{ error: string }` (insert/RPC 실패).
 *
 * **Flow:** `POST /api/arena/event` 등으로 이벤트 적재 → `POST /api/arena/run/complete` 로 종료·XP.
 * @see docs/spec/ARENA_DOMAIN_SPEC.md §4-1 Run Lifecycle
 */
export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const scenarioId = String(body?.scenarioId ?? "");
  const locale = body?.locale ? String(body.locale) : null;
  const difficulty = body?.difficulty != null ? String(body.difficulty) : null;
  const meta = body?.meta != null && typeof body.meta === "object" ? body.meta : null;
  if (!scenarioId) return NextResponse.json({ error: "scenarioId_required" }, { status: 400 });

  await supabase.rpc("ensure_arena_profile");

  const insertRow: Record<string, unknown> = {
    user_id: user.id,
    scenario_id: scenarioId,
    locale,
  };
  if (difficulty !== null && difficulty !== "") insertRow.difficulty = difficulty;
  if (meta !== null) insertRow.meta = meta;

  const { data, error } = await supabase
    .from("arena_runs")
    .insert(insertRow)
    .select("run_id, scenario_id, started_at, status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ run: data });
}

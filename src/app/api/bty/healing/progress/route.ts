/**
 * GET /api/bty/healing/progress — Second Awakening **진행 조회** (완료 액트·다음 액트).
 *
 * @contract **GET**
 * - **Query:** 없음 — 경로만; 필터·페이지 파라미터 **미지원**(추가 시 본 계약 갱신).
 * - **200:** `{ ok: true, completedActs: number[], nextAct: number | null }` — 진행 행 없음 = `completedActs: []`·`nextAct: 1` (신규 사용자).
 * - **404:** **GET 본 경로 미발행** — “진행 없음”은 **200**으로 표현. **251:** 404는 **`GET /api/bty/awakening/acts/[actId]`** 등 단일 리소스용.
 * - **401:** `{ error: "UNAUTHENTICATED" }`.
 * - **500:** `{ error: string }` — DB 조회 실패.
 *
 * ---
 * POST /api/bty/healing/progress — Second Awakening **액트 완료 기록** (1→2→3 순서, 중복 불가).
 *
 * @contract **POST**
 * - **Body:** `{ actId: 1 | 2 | 3 }`.
 * - **200:** `{ ok: true, completedActs: number[] }`.
 * - **400:** `{ error: "INVALID_ACT_ID" }` | `{ error: "INVALID_JSON" }` | `{ error: "ACT_PREREQUISITE" }` (선행 액트 미완료).
 * - **401:** `{ error: "UNAUTHENTICATED" }`.
 * - **409:** `{ error: "ACT_ALREADY_COMPLETED" }` — 동일 액트 재제출(선행 검사 통과 후 **UNIQUE·중복 insert** 시에도 동일 코드).
 * - **500:** `{ error: string }` — DB 오류.
 * - **429:** 미적용 — 레이트 리밋 없음(향후 도입 시 계약 별도 갱신).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import {
  completeHealingAwakeningAct,
  getHealingAwakeningProgress,
} from "@/lib/bty/healing/completeAwakeningAct";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const result = await getHealingAwakeningProgress(supabase, user.id);
  if ("ok" in result && result.ok) {
    const res = NextResponse.json({
      ok: true,
      completedActs: result.completedActs,
      nextAct: result.nextAct,
    });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
  const fail = result as { status: 500; error: string };
  const res = NextResponse.json({ error: fail.error }, { status: 500 });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}

export async function POST(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  let body: { actId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const result = await completeHealingAwakeningAct(supabase, user.id, body?.actId);
  if ("ok" in result && result.ok) {
    const res = NextResponse.json({ ok: true, completedActs: result.completedActs });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
  const failure = result as { status: 400 | 409 | 500; error: string };
  const res = NextResponse.json({ error: failure.error }, { status: failure.status });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}

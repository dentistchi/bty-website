/**
 * GET /api/bty/awakening/acts/[actId] — 단일 액트 **메타**(이름). 진행 이력은 `POST /api/bty/healing/progress`·DB.
 *
 * @contract
 * - **200:** `{ actId: 1|2|3, name: string }`.
 * - **401:** `{ error: "UNAUTHENTICATED" }` — 목록/진행 API 소비 전 세션 필요 시.
 * - **404:** `{ error: "ACT_NOT_FOUND" }` — actId가 1·2·3이 아님(문자·범위 밖).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { AWAKENING_ACT_NAMES, isValidHealingAwakeningActId, type AwakeningActId } from "@/domain/healing";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ actId: string }> }
) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const { actId: raw } = await params;
  const n = parseInt(String(raw), 10);
  if (!isValidHealingAwakeningActId(n)) {
    return NextResponse.json({ error: "ACT_NOT_FOUND" }, { status: 404 });
  }
  const actId = n as AwakeningActId;
  const res = NextResponse.json({
    actId,
    name: AWAKENING_ACT_NAMES[actId],
  });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}

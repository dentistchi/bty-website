/**
 * GET /api/bty/awakening/acts — Second Awakening **액트 1·2·3 목록**(메타 일괄).
 *
 * @contract
 * - **200:** `{ ok: true, acts: { actId: 1|2|3, name: string }[] }` — 항상 3행.
 * - **401:** `{ error: "UNAUTHENTICATED" }`.
 * - **404:** 본 **목록** 경로에서는 미발생. 단일 액트 **`GET /api/bty/awakening/acts/[actId]`** — 존재하지 않는 `actId` → **404** `{ error: "ACT_NOT_FOUND" }`(해당 라우트 @contract 참조).
 * - **249:** emotional-stats·second-awakening과 구분 — 액트 메타는 본 경로·`[actId]` 조합.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { AWAKENING_ACT_NAMES, type AwakeningActId } from "@/domain/healing";

const ORDER: AwakeningActId[] = [1, 2, 3];

export async function GET(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const acts = ORDER.map((actId) => ({
    actId,
    name: AWAKENING_ACT_NAMES[actId],
  }));
  const res = NextResponse.json({ ok: true, acts });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}

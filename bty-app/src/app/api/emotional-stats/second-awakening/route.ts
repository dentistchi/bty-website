import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { getSecondAwakening } from "@/lib/bty/emotional-stats/secondAwakening";

/**
 * GET /api/emotional-stats/second-awakening — Second Awakening **자격·리추얼** (`getSecondAwakening`).
 *
 * @contract
 * - **200 (`SecondAwakeningResult`):** `eligible: boolean`, `completed: boolean`, `userDay: number`, `sessionCount: number`,
 *   `ritual?` — 자격 충족·미완료 시만 `ritual` 포함(act1/act2/act3 세션·언락 메타).
 * - **401:** `{ error: "UNAUTHENTICATED" }`.
 * - **500:** `{ error: "Failed to load Second Awakening", eligible: false, completed: false }`.
 *
 * **액트 완료 기록:** `POST /api/bty/healing/progress`.
 */
export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  try {
    const result = await getSecondAwakening(supabase, user.id);
    const out = NextResponse.json(result);
    copyCookiesAndDebug(base, out, req, true);
    return out;
  } catch (e) {
    const out = NextResponse.json(
      { error: "Failed to load Second Awakening", eligible: false, completed: false },
      { status: 500 }
    );
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }
}

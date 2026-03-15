/**
 * GET /api/bty/awakening
 * Q4 Awakening API — phase·콘텐츠(액트 이름) 도메인 연동.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { AWAKENING_ACT_NAMES } from "@/domain/healing";

export async function GET(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const res = NextResponse.json({
    ok: true,
    acts: AWAKENING_ACT_NAMES,
  });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}

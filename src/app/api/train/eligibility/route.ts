import { NextResponse } from "next/server";
import { consentRequiredResponse, isConsentCurrent } from "@/lib/legal/activeConsent";
import { getAuthUserFromRequest } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getUnlockedDayCount } from "@/lib/trainProgress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/train/eligibility
 * 세션 있으면 오늘 오픈된 Day로 next 반환. 없으면 ok false (클라이언트에서 / 로 보냄).
 * Response (200): { ok: true, next: string } when authenticated; { ok: false } when not (no 401).
 */
export async function GET(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false });
  }
  const __admin = getSupabaseAdmin();
  if (!__admin || !(await isConsentCurrent(__admin, user.id))) return consentRequiredResponse();

  const unlocked = getUnlockedDayCount(new Date());
  return NextResponse.json({ ok: true, next: `/train/day/${unlocked}` });
}

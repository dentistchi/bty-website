/**
 * GET /api/bty/awakening
 * Q4 Awakening API — phase·콘텐츠(액트 이름)·트리거 도메인 연동.
 * Response (200): { ok: true, acts: string[], trigger: { type: "day_based", day, requires_min_sessions } }.
 *
 * Error responses:
 * - 401: { error: "UNAUTHENTICATED" } (route-client)
 * - 500: { error: "INTERNAL_ERROR", detail?: string } (btyErrorResponse)
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import {
  AWAKENING_ACT_NAMES,
  AWAKENING_TRIGGER_DAY,
  AWAKENING_TRIGGER_MIN_SESSIONS,
} from "@/domain/healing";
import { btyErrorResponse } from "../errors";

export async function GET(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  try {
    const res = NextResponse.json({
      ok: true,
      acts: AWAKENING_ACT_NAMES,
      trigger: {
        type: "day_based" as const,
        day: AWAKENING_TRIGGER_DAY,
        requires_min_sessions: AWAKENING_TRIGGER_MIN_SESSIONS,
      },
    });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return btyErrorResponse(500, "INTERNAL_ERROR", message);
  }
}

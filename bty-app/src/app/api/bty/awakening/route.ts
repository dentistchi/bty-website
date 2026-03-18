/**
 * GET /api/bty/awakening — Q4 Awakening (액트 이름·day_based 트리거).
 *
 * @contract
 * - **200:** `{ ok: true, acts: Record<actId, name>, trigger: { type: "day_based", day, requires_min_sessions }, completedActs: number[] }` — `completedActs`는 DB 기록만(오름차순).
 *   **`acts`:** 도메인 고정 **3개** 액트명(`AWAKENING_ACT_NAMES`); **빈 배열 미반환**. (비자격·진행 전에도 동일 목록.)
 * - **401:** `{ error: "UNAUTHENTICATED" }` — 무세션 시 **acts 미수신**.
 * - **404:** 본 경로 미발생. **액트별:** `GET /api/bty/awakening/acts/[actId]` 에서 잘못된 actId → `ACT_NOT_FOUND` 404.
 * - **500:** `{ error: "INTERNAL_ERROR", detail?: string }` — `btyErrorResponse`.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import {
  AWAKENING_ACT_NAMES,
  AWAKENING_TRIGGER_DAY,
  AWAKENING_TRIGGER_MIN_SESSIONS,
} from "@/domain/healing";
import { btyErrorResponse } from "../errors";
import { getUserCompletedAwakeningActs } from "@/lib/bty/healing/getUserCompletedAwakeningActs";

export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  try {
    const progress = await getUserCompletedAwakeningActs(supabase, user.id);
    if (!progress.ok) {
      return btyErrorResponse(500, "INTERNAL_ERROR", progress.error);
    }

    const res = NextResponse.json({
      ok: true,
      acts: AWAKENING_ACT_NAMES,
      trigger: {
        type: "day_based" as const,
        day: AWAKENING_TRIGGER_DAY,
        requires_min_sessions: AWAKENING_TRIGGER_MIN_SESSIONS,
      },
      completedActs: progress.completedActs,
    });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return btyErrorResponse(500, "INTERNAL_ERROR", message);
  }
}

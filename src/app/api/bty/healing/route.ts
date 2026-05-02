/**
 * GET /api/bty/healing — Q4 Healing phase·콘텐츠. 도메인 상수 노출; per-user phase는 추후 서비스 연동.
 *
 * @contract
 * - **200:** `{ ok: true, phase, content: { ringType }, awakeningProgress: { progressPercent, nextActId, nextActName, completedActIds, allActsComplete } }` — Awakening 진행은 DB+도메인 순수값만.
 * - **401:** `{ error: "UNAUTHENTICATED" }` — `requireUser` 실패 (`unauthenticated`).
 * - **404:** 발행 안 함 — 경로 파라미터·목록 ID 없음(단일 GET 고정 페이로드).
 * - **500:** `{ error: "INTERNAL_ERROR", detail?: string }` — try/catch 비정상; `detail`은 진단용(운영 노출 주의).
 *
 * @see `src/app/api/bty/errors.ts` BtyApiErrorResponse
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import {
  AWAKENING_ACT_NAMES,
  HEALING_PHASE_I_LABEL,
  HEALING_PHASE_II_LABEL,
  HEALING_PHASE_RING_TYPE,
  healingAwakeningProgressPercent,
  isHealingAwakeningAllActsComplete,
  nextHealingAwakeningActAfter,
  type HealingPhaseLabel,
} from "@/domain/healing";
import { getUserCompletedAwakeningActs } from "@/lib/bty/healing/getUserCompletedAwakeningActs";
import { btyErrorResponse } from "../errors";

export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  try {
    const actsRes = await getUserCompletedAwakeningActs(supabase, user.id);
    if (!actsRes.ok) {
      return btyErrorResponse(500, "INTERNAL_ERROR", actsRes.error);
    }
    const completed = actsRes.completedActs;
    const nextId = nextHealingAwakeningActAfter(completed);
    const nextName = nextId != null ? AWAKENING_ACT_NAMES[nextId] : null;

    const { data: milestone } = await supabase
      .from("user_healing_milestones")
      .select("second_awakening_completed_at")
      .eq("user_id", user.id)
      .maybeSingle();
    const isPhaseII = !!(milestone as { second_awakening_completed_at: string | null } | null)
      ?.second_awakening_completed_at;

    const phase: HealingPhaseLabel = isPhaseII ? HEALING_PHASE_II_LABEL : HEALING_PHASE_I_LABEL;
    const res = NextResponse.json({
      ok: true,
      phase,
      content: {
        ringType: isPhaseII ? HEALING_PHASE_RING_TYPE : null,
      },
      awakeningProgress: {
        progressPercent: healingAwakeningProgressPercent(completed),
        nextActId: nextId,
        nextActName: nextName,
        completedActIds: completed,
        allActsComplete: isHealingAwakeningAllActsComplete(completed),
      },
    });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return btyErrorResponse(500, "INTERNAL_ERROR", message);
  }
}

/**
 * GET /api/center/weekly-report-card?userId=&weekOf=
 * Weekly persisted AIR report, live AIR sparkline series, healing phase gates — Center dashboard.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAIRTrend } from "@/engine/integrity/air-trend.service";
import { getIntegrityScoreCard } from "@/engine/integration/integrity-score-card.service";
import { getResilienceScore } from "@/engine/resilience/resilience-tracker.service";
import {
  getWeeklyReport,
  mondayUtcWeekOf,
} from "@/engine/integrity/weekly-air-report.service";
import { getPhaseGateStatus } from "@/engine/healing/healing-content.service";
import {
  HEALING_PHASE_ORDER,
  getCurrentPhase,
  type HealingPhase,
} from "@/engine/healing/healing-phase.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { user, base } = await requireUser(req);
    if (!user) return unauthenticated(req, base);

    let userId = req.nextUrl.searchParams.get("userId")?.trim() ?? "";
    if (!userId) userId = user.id;
    if (userId !== user.id) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    let weekOf = req.nextUrl.searchParams.get("weekOf")?.trim() ?? "";
    if (!weekOf) weekOf = mondayUtcWeekOf(new Date());

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: "ADMIN_UNAVAILABLE" }, { status: 503 });
    }

    const resilience = await getResilienceScore(userId, { supabase: admin, persist: true }).catch(
      (): null => null,
    );

    const [report, airTrend, currentPhaseRaw, integrityScoreCard] = await Promise.all([
      getWeeklyReport(userId, weekOf, { supabase: admin }),
      getAIRTrend(userId),
      getCurrentPhase(userId, admin),
      getIntegrityScoreCard(userId, {
        supabase: admin,
        reuse: { resilience: resilience ?? undefined },
      }),
    ]);

    const currentPhase: HealingPhase = currentPhaseRaw ?? "ACKNOWLEDGEMENT";
    const phaseGates = await Promise.all(
      HEALING_PHASE_ORDER.map((p) => getPhaseGateStatus(userId, p, admin)),
    );
    const phaseGate =
      phaseGates.find((g) => g.phase === currentPhase) ?? phaseGates[0]!;
    /** True when the user’s current healing phase still has required diagnostics pending. */
    const anyPhaseGateIncomplete = phaseGate.missing.length > 0;

    const res = NextResponse.json({
      weekOf,
      report,
      dailyAir: [...airTrend.dailyAir],
      airTrendDirection: airTrend.direction,
      currentPhase,
      phaseGate,
      phaseGates,
      anyPhaseGateIncomplete,
      integrityScoreCard,
      resilience,
    });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    console.error("[center/weekly-report-card]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}

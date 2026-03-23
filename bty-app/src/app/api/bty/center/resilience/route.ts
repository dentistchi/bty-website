/**
 * GET /api/bty/center/resilience — Arena/Center 회복력 지수 (engine {@link getResilienceScore}).
 * Read-only: `persist: false` (no append-only snapshot per page view).
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getResilienceScore,
  type ResilienceScoreCardApi,
} from "@/engine/resilience/resilience-tracker.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

export type { ResilienceScoreCardApi };

export async function GET(req: NextRequest) {
  try {
    const { user, base } = await requireUser(req);
    if (!user) return unauthenticated(req, base);

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: "ADMIN_UNAVAILABLE" }, { status: 503 });
    }

    const resilience = await getResilienceScore(user.id, { supabase: admin, persist: false });

    const { count, error: cErr } = await admin
      .from("integrity_slip_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 500 });
    }

    const integrity_slip_count = count ?? 0;
    const recovery_avg_days =
      integrity_slip_count > 0 ? resilience.recovery_days / integrity_slip_count : 0;

    const body: ResilienceScoreCardApi = {
      ...resilience,
      recovery_avg_days,
      integrity_slip_count,
    };

    const res = NextResponse.json(body);
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    console.error("[bty/center/resilience]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}

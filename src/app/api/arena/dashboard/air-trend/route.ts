import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAIRTrend } from "@/engine/integrity/air-trend.service";
import type { AIRTrendWarningPayload } from "@/engine/integrity/air-trend.service";
import { getCertifiedStatus } from "@/engine/integrity/certified-leader.monitor";
import {
  AIR_TREND_REALTIME_CHANNEL_PREFIX,
  AIR_TREND_WARNING_BROADCAST_EVENT,
} from "@/lib/bty/arena/air-trend-realtime";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";

function buildWarningPayload(userId: string, trend: Awaited<ReturnType<typeof getAIRTrend>>): AIRTrendWarningPayload {
  const lastIdx = trend.rolling7DayAverage.length - 1;
  const lr = trend.rolling7DayAverage[lastIdx]!;
  const pr = trend.rolling7DayAverage[lastIdx - 1]!;
  return {
    event: "air_trend_warning",
    userId,
    consecutiveDecliningRollingSteps: trend.consecutiveDecliningRollingSteps,
    lastRolling7DayAverage: lr,
    priorRolling7DayAverage: pr,
    last7DayWindowAvg: trend.last7DayWindowAvg,
    prior7DayWindowAvg: trend.prior7DayWindowAvg,
  };
}

/**
 * Fire-and-forget: notify the user's browser tab via Realtime broadcast (same channel/event as client widget).
 */
function broadcastAirTrendWarning(admin: SupabaseClient, payload: AIRTrendWarningPayload): void {
  const channelName = `${AIR_TREND_REALTIME_CHANNEL_PREFIX}${payload.userId}`;
  const ch = admin.channel(channelName);
  const done = () => {
    try {
      admin.removeChannel(ch);
    } catch {
      // ignore
    }
  };
  const t = setTimeout(done, 8000);
  ch.subscribe((status) => {
    if (status !== "SUBSCRIBED") return;
    void ch
      .send({
        type: "broadcast",
        event: AIR_TREND_WARNING_BROADCAST_EVENT,
        payload,
      })
      .finally(() => {
        clearTimeout(t);
        done();
      });
  });
}

/**
 * GET /api/arena/dashboard/air-trend
 * 30-day AIR trend (engine), Certified Leader status, optional Realtime `air_trend_warning` broadcast when warning applies.
 */
export async function GET(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const trend = await getAIRTrend(user.id);
  const certified = await getCertifiedStatus(user.id);

  if (trend.warningEmitted) {
    const admin = getSupabaseAdmin();
    if (admin) {
      broadcastAirTrendWarning(admin, buildWarningPayload(user.id, trend));
    }
  }

  const res = NextResponse.json({
    userId: user.id,
    trend,
    certified,
  });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}

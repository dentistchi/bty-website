import { NextRequest, NextResponse } from "next/server";
import { triggerWeeklyReset } from "@/engine/xp/weekly-xp-reset.service";

export const runtime = "nodejs";

/**
 * POST /api/cron/weekly-reset
 * Calls triggerWeeklyReset() — snapshot weekly_xp.xp_total → weekly_xp_history,
 * then zero weekly_xp + arena_profiles.weekly_xp, then weekly_reset_log entry.
 * Secured by CRON_SECRET (Authorization: Bearer <secret> or x-cron-secret header).
 * Idempotent per ended_week_monday via weekly_reset_log UNIQUE.
 */
export async function POST(req: NextRequest) {
  const secret =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    req.headers.get("x-cron-secret")?.trim();
  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await triggerWeeklyReset();
    if (!result.ok) {
      console.error("[cron:weekly-reset]", result.error ?? "unknown_error");
      return NextResponse.json(result, { status: 500 });
    }
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cron:weekly-reset]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

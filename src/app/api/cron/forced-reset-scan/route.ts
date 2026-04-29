import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { loadActivationRecordsForUser } from "@/lib/bty/leadership-engine/forced-reset-eval-inputs.server";
import { runForcedResetAfterAirIfStage3 } from "@/lib/bty/leadership-engine/forced-reset-runtime.server";

/**
 * POST /api/cron/forced-reset-scan
 * Service-role scan: users at LE stage 3 → same forced-reset eval as GET /air (after AIR inputs).
 * Secured by CRON_SECRET. Idempotent when already stage 4.
 */
export async function POST(req: NextRequest) {
  const secret =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    req.headers.get("x-cron-secret")?.trim();
  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfiguration (no admin client)" }, { status: 500 });
  }

  const { data: rows, error } = await admin
    .from("leadership_engine_state")
    .select("user_id")
    .eq("current_stage", 3);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = new Date();
  let processed = 0;
  let errors = 0;
  for (const row of rows ?? []) {
    const userId = (row as { user_id: string }).user_id;
    if (typeof userId !== "string") continue;
    try {
      const activations = await loadActivationRecordsForUser(admin, userId);
      await runForcedResetAfterAirIfStage3(admin, userId, activations, now);
      processed += 1;
    } catch {
      errors += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    stage3_users: (rows ?? []).length,
    processed,
    errors,
  });
}

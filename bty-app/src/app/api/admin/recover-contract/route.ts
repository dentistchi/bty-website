import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminEmail } from "@/lib/authz";
import { ensureActionContractForArenaRun } from "@/lib/bty/action-contract/ensureActionContractForArenaRun";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/recover-contract — repair missing `bty_action_contracts` for a completed run (admin only).
 * Body: `{ userId: string, runId: string, scenarioId: string }`
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdminEmail(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const userId = (body as { userId?: string })?.userId;
  const runId = (body as { runId?: string })?.runId;
  const scenarioId = (body as { scenarioId?: string })?.scenarioId;
  const patternFamilyRaw = (body as { patternFamily?: unknown }).patternFamily;
  const patternFamily =
    typeof patternFamilyRaw === "string" && patternFamilyRaw.trim() !== ""
      ? patternFamilyRaw.trim()
      : null;

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "MISSING_USER_ID" }, { status: 400 });
  }
  if (!runId || typeof runId !== "string") {
    return NextResponse.json({ error: "MISSING_RUN_ID" }, { status: 400 });
  }
  if (!scenarioId || typeof scenarioId !== "string") {
    return NextResponse.json({ error: "MISSING_SCENARIO_ID" }, { status: 400 });
  }

  const ensured = await ensureActionContractForArenaRun({
    userId,
    runId,
    scenarioId,
    nbaLogId: null,
    patternFamily,
  });

  return NextResponse.json({
    ok: ensured.ok,
    contractId: ensured.contractId,
    created: ensured.created,
  });
}

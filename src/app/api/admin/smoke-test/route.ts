import { NextRequest, NextResponse } from "next/server";
import { runSmokeTest } from "@/engine/integration/full-system-smoke-test";
import { requireAdminEmail } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/smoke-test — full-system smoke: Arena, Foundry, Center, dashboard, health,
 * avatar (snapshot + equipped + composite layers), onboarding + Foundry learning path, notifications + resilience.
 * Set `SMOKE_TEST_USER_ID` or `LOOP_HEALTH_TEST_USER_ID` for DB-backed steps.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdminEmail(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const report = await runSmokeTest();
    return NextResponse.json({ ok: report.overallOk, report });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "smoke_test_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { runExtendedHealthCheck } from "@/engine/integrity/e2e-loop-validator.service";
import { runLoopHealthCheck } from "@/engine/integration/full-loop-validator";
import { requireAdminEmail } from "@/lib/authz";

export const runtime = "nodejs";

/**
 * POST /api/admin/arena/loop-health — run {@link runLoopHealthCheck} (Arena→Foundry→Center loop).
 * `?extended=true` → {@link runExtendedHealthCheck} (v2 integration checks, same `run_id` on `loop_health_log`).
 * Requires admin (see `requireAdminEmail`). Set `LOOP_HEALTH_TEST_USER_ID` for user-scoped checks.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdminEmail(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const extended = req.nextUrl.searchParams.get("extended") === "true";

  try {
    if (extended) {
      const report = await runExtendedHealthCheck();
      return NextResponse.json({ ok: report.ok, report, extended: true });
    }
    const report = await runLoopHealthCheck();
    return NextResponse.json({ ok: report.ok, report });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "loop_health_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

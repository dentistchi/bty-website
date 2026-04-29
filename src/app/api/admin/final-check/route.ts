import { NextRequest, NextResponse } from "next/server";
import { runFinalWiringCheck } from "@/engine/integration/final-wiring-check";
import { requireAdminEmail } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/final-check — run {@link runFinalWiringCheck} (synthetic user + system health).
 * Optional env: `FINAL_WIRING_CHECK_USER_ID`.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdminEmail(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const report = await runFinalWiringCheck();
    return NextResponse.json({ ok: report.all_ok, report });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "final_wiring_check_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

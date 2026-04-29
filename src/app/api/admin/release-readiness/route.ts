import { NextRequest, NextResponse } from "next/server";
import { runReleaseReadinessCheck } from "@/engine/integration/release-readiness-check";
import { requireAdminEmail } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/release-readiness — {@link runReleaseReadinessCheck} (smoke + extended health + wiring + i18n).
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdminEmail(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const report = await runReleaseReadinessCheck();
    return NextResponse.json({
      all_clear: report.allClear,
      blockers: report.blockers,
      report,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "release_readiness_failed";
    return NextResponse.json({ all_clear: false, blockers: [msg], error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { runI18nAudit } from "@/engine/integration/i18n-completeness-validator";
import { requireAdminEmail } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/i18n-audit — run i18n completeness scan (persists to `i18n_audit_log` when admin DB available).
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdminEmail(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const report = await runI18nAudit();
    return NextResponse.json({ ok: true, report });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "i18n_audit_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

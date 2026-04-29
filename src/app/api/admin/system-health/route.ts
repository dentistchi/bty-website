import { NextRequest, NextResponse } from "next/server";
import { getSystemHealth } from "@/engine/integration/system-health-dashboard.service";
import { requireAdminEmail } from "@/lib/authz";

export const runtime = "nodejs";

/**
 * GET /api/admin/system-health — aggregated loop health + DB signals (120s server cache).
 * Query: `?refresh=1` bypasses cache.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdminEmail(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const bypass = req.nextUrl.searchParams.get("refresh") === "1";
  try {
    const snapshot = await getSystemHealth({ bypassCache: bypass });
    const res = NextResponse.json({ ok: true, snapshot });
    res.headers.set("Cache-Control", "private, max-age=120, stale-while-revalidate=60");
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "system_health_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

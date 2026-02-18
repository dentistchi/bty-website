import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const res = NextResponse.next();
  const auth = await requireAdmin(req, res); // orgId/regionId 쿼리스트링 필요
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers: res.headers });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Server not configured" }, { status: 503, headers: res.headers });

  const { data, error } = await admin
    .from("memberships")
    .select("id, user_id, role, status, job_function, created_at")
    .eq("org_id", auth.scope.orgId)
    .eq("region_id", auth.scope.regionId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: res.headers });

  return NextResponse.json({ ok: true, rows: data }, { headers: res.headers });
}

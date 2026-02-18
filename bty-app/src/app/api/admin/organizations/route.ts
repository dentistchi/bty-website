import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const res = NextResponse.next();
  const auth = await requireAdmin(req, res);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers: res.headers });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Server not configured" }, { status: 503, headers: res.headers });

  const { data, error } = await admin
    .from("organizations")
    .select("id, name, slug, created_at")
    .eq("id", auth.scope.orgId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: res.headers });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404, headers: res.headers });

  return NextResponse.json({ ok: true, organization: data }, { headers: res.headers });
}

import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Server not configured" }, { status: 503 });

  const { data, error } = await admin
    .from("organizations")
    .select("id, name, slug, created_at")
    .eq("id", auth.scope.orgId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true, organization: data });
}

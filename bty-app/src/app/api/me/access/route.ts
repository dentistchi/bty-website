import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const res = NextResponse.json({ ok: true }, { status: 200 });
  const supabase = getSupabaseServer(req, res);
  if (!supabase) return NextResponse.json({ error: "Server not configured" }, { status: 503 });

  const { data, error } = await supabase.auth.getUser();
  const user = data?.user;
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Server not configured" }, { status: 503 });

  const { data: memberships } = await admin
    .from("memberships")
    .select("org_id, region_id, role, job_function, status")
    .eq("user_id", user.id)
    .eq("status", "active");

  return NextResponse.json({
    user: { id: user.id, email: user.email },
    memberships: memberships ?? [],
  });
}

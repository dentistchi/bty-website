import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/organizations] fetch error:", error);
    return NextResponse.json({ error: "조직 목록 조회 실패" }, { status: 500 });
  }

  return NextResponse.json({ organizations: data ?? [] });
}

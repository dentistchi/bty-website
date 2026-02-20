import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServer();

  const { error } = await supabase.auth.signOut();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  // ✅ signOut 과정에서도 setAll이 호출되어 쿠키가 정리됨
  return NextResponse.json({ ok: true }, { status: 200 });
}

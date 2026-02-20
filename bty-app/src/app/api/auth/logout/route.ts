import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const supabase = await getSupabaseServer();
    await supabase.auth.signOut();

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false, error: "Logout failed" }, { status: 500 });
  }
}

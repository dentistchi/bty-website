import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getIsEliteTop5 } from "@/lib/bty/arena/eliteStatus";

export const runtime = "nodejs";

/** GET: 현재 사용자 상위 5% Elite 여부 (멘토 페이지 뱃지 등) */
export async function GET() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const isElite = await getIsEliteTop5(supabase, user.id);
  return NextResponse.json({ isElite });
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * GET /api/me/access — 현재 사용자 + 활성 멤버십 목록.
 *
 * @contract
 * - **401:** `{ error: "Unauthorized" }` — `getUser` 실패·무세션. **251:** arena `UNAUTHENTICATED`와 문자열 구분(me/* 관례).
 * - **503:** `{ error: "Server not configured" }` — admin 클라이언트 없음.
 * - **200:** `{ user: { id, email }, memberships: … }`.
 */
export async function GET(req: NextRequest) {
  const supabase = await getSupabaseServer();

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

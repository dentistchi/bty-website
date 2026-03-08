/**
 * Elite 멘토 신청 큐 (admin only). PHASE_4_ELITE_5_PERCENT_SPEC §10 3차, PROJECT_BACKLOG §5.
 * GET: pending 목록. 비즈니스 규칙은 도메인만.
 *
 * @contract
 * GET /api/arena/mentor-requests
 *   Auth: admin only (requireAdminEmail)
 *   200: { queue: Array<{ id, userId, status, message?, mentorId, createdAt }> }
 *   401/403: { error } (auth failure)
 *   500: { error: message } (DB)
 *   503: { error: "ADMIN_UNAVAILABLE" }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminEmail } from "@/lib/authz";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  const auth = await requireAdminEmail(_req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "ADMIN_UNAVAILABLE" }, { status: 503 });

  const { data: rows, error } = await admin
    .from("elite_mentor_requests")
    .select("id, user_id, status, message, mentor_id, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    queue: (rows ?? []).map((r: { id: string; user_id: string; status: string; message: string | null; mentor_id: string; created_at: string }) => ({
      id: r.id,
      userId: r.user_id,
      status: r.status,
      message: r.message ?? undefined,
      mentorId: r.mentor_id,
      createdAt: r.created_at,
    })),
  });
}

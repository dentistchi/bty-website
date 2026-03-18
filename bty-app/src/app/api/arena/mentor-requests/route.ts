/**
 * GET /api/arena/mentor-requests — Elite 멘토 신청 **pending 큐** (관리자 전용).
 *
 * @contract
 * - **Query:** 없음 — 항상 `status=pending` 고정 조회(추가 쿼리 파라미터 미지원·무시).
 * - **200:** `{ queue: { id, userId, status, message?, mentorId, createdAt }[] }`.
 * - **401:** `{ error: string }` — 비로그인.
 * - **403:** `{ error: "Forbidden: Admin access required" }` 등 — 비관리자.
 * - **500:** `{ error: string }` — Supabase `elite_mentor_requests` 조회 실패.
 * - **503:** `{ error: "ADMIN_UNAVAILABLE" }` — service role 미구성.
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

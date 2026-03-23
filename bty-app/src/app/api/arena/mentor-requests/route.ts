/**
 * GET /api/arena/mentor-requests — Elite 멘토 신청 **pending 큐** (관리자 전용).
 *
 * @contract
 * - **Query:** 없음 — 항상 `status=pending` 고정 조회(추가 쿼리 파라미터 미지원·무시).
 * - **200:** `{ queue: { id, userId, status, message?, mentorId, createdAt, updatedAt?, respondedAt? }[] }`.
 * - **Query `scope=all`:** 관리자만 — `pending` 제한 없이 최근 갱신순(최대 100건, `approved`/`rejected`/`pending` 포함). 생략 시 기존과 같이 **`pending`만** `created_at` 오름차순.
 * - **401:** `{ error: string }` — 비로그인.
 * - **403:** `{ error: "Forbidden: Admin access required" }` 등 — 비관리자.
 * - **500:** `{ error: string }` — Supabase `elite_mentor_requests` 조회 실패.
 * - **503:** `{ error: "ADMIN_UNAVAILABLE" }` — service role 미구성.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminEmail } from "@/lib/authz";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdminEmail(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "ADMIN_UNAVAILABLE" }, { status: 503 });

  const listAll = req.nextUrl.searchParams.get("scope") === "all";

  let q = admin
    .from("elite_mentor_requests")
    .select("id, user_id, status, message, mentor_id, created_at, updated_at, responded_at");

  if (!listAll) {
    q = q.eq("status", "pending");
  }

  const { data: rows, error } = await q
    .order(listAll ? "updated_at" : "created_at", { ascending: !listAll })
    .limit(listAll ? 100 : 500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    queue: (rows ?? []).map(
      (r: {
        id: string;
        user_id: string;
        status: string;
        message: string | null;
        mentor_id: string;
        created_at: string;
        updated_at?: string;
        responded_at?: string | null;
      }) => ({
        id: r.id,
        userId: r.user_id,
        status: r.status,
        message: r.message ?? undefined,
        mentorId: r.mentor_id,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        respondedAt: r.responded_at ?? undefined,
      }),
    ),
  });
}

/**
 * PATCH /api/arena/mentor-requests/[id] — Elite 멘토 신청 **승인/거절** (관리자 전용). `canTransitionStatus`로 전이 검증.
 *
 * @contract
 * - **240 Elite PATCH 요약:** **401** 비인증 · **403** 비관리자 · **404** 미존재 id · **500** DB 갱신 실패 · **503** admin 클라이언트 없음 · **400** 바디/id/전이 오류.
 * - **Body:** `{ status: "approved" | "rejected" }`.
 * - **200:** `{ ok: true, id, status, respondedAt }`.
 * - **400:** `MISSING_ID` | `INVALID_BODY` | `INVALID_STATUS` | `INVALID_TRANSITION`.
 * - **401:** `{ error: string }` — 세션 없음·로그인 필요 (`requireUser` 실패).
 * - **403:** `{ error: "Forbidden: Admin access required" }` 등 — 로그인됐으나 관리자 이메일 아님.
 * - **404:** `{ error: "NOT_FOUND" }`.
 * - **500:** `{ error: string }` — Supabase update 실패 등 서버 오류.
 * - **503:** `{ error: "ADMIN_UNAVAILABLE" }` — admin 클라이언트 미구성.
 *
 * @see docs/spec/ARENA_DOMAIN_SPEC.md §4-8
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminEmail } from "@/lib/authz";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { canTransitionStatus, type MentorRequestStatus } from "@/lib/bty/arena/mentorRequest";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminEmail(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "ADMIN_UNAVAILABLE" }, { status: 503 });

  const { id } = await params;
  const requestId = typeof id === "string" ? id.trim() : "";
  if (!requestId) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });

  let body: { status?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const nextStatus = (body.status ?? "").trim() as MentorRequestStatus;
  if (nextStatus !== "approved" && nextStatus !== "rejected") {
    return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
  }

  const { data: existing, error: fetchErr } = await admin
    .from("elite_mentor_requests")
    .select("id, status")
    .eq("id", requestId)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const current = existing.status as MentorRequestStatus;
  if (!canTransitionStatus(current, nextStatus)) {
    return NextResponse.json({ error: "INVALID_TRANSITION" }, { status: 400 });
  }

  const adminId = (auth.user.email ?? auth.user.id ?? "").trim();
  const { data: updated, error: updateErr } = await admin
    .from("elite_mentor_requests")
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
      responded_at: new Date().toISOString(),
      responded_by: adminId,
    })
    .eq("id", requestId)
    .select("id, status, responded_at")
    .single();

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  return NextResponse.json({
    ok: true,
    id: (updated as { id: string }).id,
    status: (updated as { status: string }).status,
    respondedAt: (updated as { responded_at: string }).responded_at,
  });
}

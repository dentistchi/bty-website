/**
 * Elite 멘토 신청 승인/거절 (admin only). PHASE_4_ELITE_5_PERCENT_SPEC §10 3차.
 * PATCH: body { status: "approved" | "rejected" }. 도메인 canTransitionStatus 검증.
 *
 * @contract
 * PATCH /api/arena/mentor-requests/[id]
 *   Auth: admin only (requireAdminEmail)
 *   Body: { status: "approved" | "rejected" }
 *   200: { ok: true, id, status, respondedAt }
 *   400: { error: "MISSING_ID" | "INVALID_BODY" | "INVALID_STATUS" | "INVALID_TRANSITION" }
 *   401/403: { error } (auth failure)
 *   404: { error: "NOT_FOUND" }
 *   500: { error: message } (update failed)
 *   503: { error: "ADMIN_UNAVAILABLE" }
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

/**
 * Elite 1:1 mentor session request (PHASE_4_ELITE_5_PERCENT_SPEC §10 3차, PROJECT_BACKLOG §5).
 * GET: 내 신청 상태. POST: 신청 생성(Elite만). 비즈니스 규칙은 도메인만 호출.
 *
 * @contract
 * GET /api/me/mentor-request
 *   Auth: required (session)
 *   200: { request: null } | { request: { id, status, message?, mentorId, createdAt, updatedAt, respondedAt?, respondedBy? } }
 *   401: { error: "UNAUTHENTICATED" }
 *
 * POST /api/me/mentor-request
 *   Auth: required (session). Elite만; pending 중복 불가.
 *   Body: { message?: string } (optional, max 500 chars per domain MENTOR_REQUEST_MESSAGE_MAX_LENGTH)
 *   201: { id, status: "pending", createdAt }
 *   400: { error: "message_too_long" } (validateMentorRequestPayload)
 *   401: { error: "UNAUTHENTICATED" }
 *   403: { error: "ELITE_ONLY" | "PENDING_EXISTS" }
 *   500: { error: "CREATE_FAILED" }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getIsEliteTop5 } from "@/lib/bty/arena/eliteStatus";
import {
  canRequestMentorSession,
  validateMentorRequestPayload,
  DEFAULT_MENTOR_ID,
  type MentorRequestStatus,
} from "@/lib/bty/arena/mentorRequest";

export const runtime = "nodejs";

type MentorRequestRow = {
  id: string;
  user_id: string;
  status: string;
  message: string | null;
  mentor_id: string;
  created_at: string;
  updated_at: string;
  responded_at: string | null;
  responded_by: string | null;
};

/** GET: 내 멘토 신청 1건 (최신 또는 pending 우선) */
export async function GET() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { data: rows } = await supabase
    .from("elite_mentor_requests")
    .select("id, user_id, status, message, mentor_id, created_at, updated_at, responded_at, responded_by")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const row = rows?.[0] as MentorRequestRow | undefined;
  if (!row) {
    return NextResponse.json({ request: null });
  }
  return NextResponse.json({
    request: {
      id: row.id,
      status: row.status as MentorRequestStatus,
      message: row.message ?? undefined,
      mentorId: row.mentor_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      respondedAt: row.responded_at ?? undefined,
      respondedBy: row.responded_by ?? undefined,
    },
  });
}

/** POST: 멘토 1:1 신청 (Elite만, pending 중복 불가) */
export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const isElite = await getIsEliteTop5(supabase, user.id);
  const { data: existing } = await supabase
    .from("elite_mentor_requests")
    .select("status")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  const existingStatus = (existing?.status as MentorRequestStatus) ?? null;
  if (!canRequestMentorSession(isElite, existingStatus)) {
    return NextResponse.json(
      { error: isElite ? "PENDING_EXISTS" : "ELITE_ONLY" },
      { status: 403 }
    );
  }

  let body: { message?: string } = {};
  try {
    body = await request.json();
  } catch {
    // optional body
  }
  const validation = validateMentorRequestPayload(body.message);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const message = body.message?.trim() || null;
  const { data: inserted, error } = await supabase
    .from("elite_mentor_requests")
    .insert({
      user_id: user.id,
      status: "pending",
      message,
      mentor_id: DEFAULT_MENTOR_ID,
    })
    .select("id, status, created_at")
    .single();

  if (error) return NextResponse.json({ error: "CREATE_FAILED" }, { status: 500 });
  return NextResponse.json(
    { id: (inserted as { id: string }).id, status: "pending", createdAt: (inserted as { created_at: string }).created_at },
    { status: 201 }
  );
}

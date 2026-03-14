/**
 * Elite 1:1 mentor session request (PHASE_4_ELITE_5_PERCENT_SPEC §10 3차, PROJECT_BACKLOG §5).
 * GET: 내 신청 상태. POST: 신청 생성(Elite만). 비즈니스 규칙은 도메인만 호출.
 *
 * @contract
 * GET /api/me/mentor-request
 *   Auth: required (session)
 *   200: MentorRequestGetResponse
 *   401: MentorRequestErrorResponse
 *
 * POST /api/me/mentor-request
 *   Auth: required (session). Elite만; pending 중복 불가.
 *   Body: { message?: string } (optional, max 500 chars per MENTOR_REQUEST_MESSAGE_MAX_LENGTH)
 *   201: MentorRequestPostResponse
 *   400 | 401 | 403 | 500: MentorRequestErrorResponse
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

/** Single mentor request item (GET 200 when request exists). */
export type MentorRequestItem = {
  id: string;
  status: MentorRequestStatus;
  message?: string;
  mentorId: string;
  createdAt: string;
  updatedAt: string;
  respondedAt?: string;
  respondedBy?: string;
};

/** GET 200: { request: null } | { request: MentorRequestItem } */
export type MentorRequestGetResponse =
  | { request: null }
  | { request: MentorRequestItem };

/** POST 201: created request summary */
export type MentorRequestPostResponse = {
  id: string;
  status: "pending";
  createdAt: string;
};

/** Error body for 400/401/403/500 */
export type MentorRequestErrorResponse = {
  error: "UNAUTHENTICATED" | "message_too_long" | "ELITE_ONLY" | "PENDING_EXISTS" | "CREATE_FAILED";
};

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

/**
 * GET: 내 멘토 신청 1건 (최신 또는 pending 우선).
 * @returns 200 MentorRequestGetResponse | 401 MentorRequestErrorResponse
 */
export async function GET(): Promise<
  NextResponse<MentorRequestGetResponse | MentorRequestErrorResponse>
> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "UNAUTHENTICATED" } satisfies MentorRequestErrorResponse,
      { status: 401 }
    );
  }

  const { data: rows } = await supabase
    .from("elite_mentor_requests")
    .select("id, user_id, status, message, mentor_id, created_at, updated_at, responded_at, responded_by")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const row = rows?.[0] as MentorRequestRow | undefined;
  if (!row) {
    return NextResponse.json({ request: null } satisfies MentorRequestGetResponse);
  }
  const body: MentorRequestGetResponse = {
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
  };
  return NextResponse.json(body);
}

/**
 * POST: 멘토 1:1 신청 (Elite만, pending 중복 불가).
 * @returns 201 MentorRequestPostResponse | 400|401|403|500 MentorRequestErrorResponse
 */
export async function POST(
  request: NextRequest
): Promise<
  NextResponse<MentorRequestPostResponse | MentorRequestErrorResponse>
> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "UNAUTHENTICATED" } satisfies MentorRequestErrorResponse,
      { status: 401 }
    );
  }

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
      { error: isElite ? "PENDING_EXISTS" : "ELITE_ONLY" } satisfies MentorRequestErrorResponse,
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
    const err = validation.error! as MentorRequestErrorResponse["error"];
    return NextResponse.json(
      { error: err } satisfies MentorRequestErrorResponse,
      { status: 400 }
    );
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

  if (error) {
    return NextResponse.json(
      { error: "CREATE_FAILED" } satisfies MentorRequestErrorResponse,
      { status: 500 }
    );
  }
  const postBody: MentorRequestPostResponse = {
    id: (inserted as { id: string }).id,
    status: "pending",
    createdAt: (inserted as { created_at: string }).created_at,
  };
  return NextResponse.json(postBody, { status: 201 });
}

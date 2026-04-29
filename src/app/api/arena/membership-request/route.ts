/**
 * GET: 현재 유저의 Arena 멤버십 요청 1건 (pending/approved 구분용).
 * POST: 멤버십 요청 제출 — job_function, joined_at, leader_started_at(optional), status=pending 저장 후 이메일 알림.
 * - Optional **submitted_at** (키가 있을 때만): **`arenaIsoTimestampFromUnknown`** — 실패 시 **400** `submitted_at_invalid`.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { notifyMembershipRequestPending } from "@/lib/bty/arena/notifyMembershipRequest";
import {
  arenaIsoDateOnlyFromUnknown,
  arenaIsoTimestampFromUnknown,
} from "@/domain/arena/scenarios";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { data, error } = await supabase
    .from("arena_membership_requests")
    .select("id, user_id, job_function, joined_at, leader_started_at, status, approved_at, approved_by, created_at, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data ?? null });
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body: {
    job_function?: string;
    joined_at?: string;
    leader_started_at?: string | null;
    submitted_at?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if ("submitted_at" in body) {
    const ts = arenaIsoTimestampFromUnknown(body.submitted_at);
    if (ts === null) {
      return NextResponse.json(
        {
          error: "submitted_at_invalid",
          message: "submitted_at must be a valid ISO-8601 timestamp",
        },
        { status: 400 },
      );
    }
  }

  const job_function = typeof body.job_function === "string" ? body.job_function.trim() : "";
  const joined_at = arenaIsoDateOnlyFromUnknown(body.joined_at);
  const leader_started_at =
    body.leader_started_at === null || body.leader_started_at === undefined
      ? null
      : arenaIsoDateOnlyFromUnknown(body.leader_started_at);

  if (!job_function || !joined_at) {
    return NextResponse.json({ error: "MISSING_FIELDS", message: "job_function and joined_at are required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const row = {
    user_id: user.id,
    job_function,
    joined_at,
    leader_started_at,
    status: "pending" as const,
    updated_at: now,
  };

  const { data: existing } = await supabase
    .from("arena_membership_requests")
    .select("id, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    if (existing.status === "approved") {
      return NextResponse.json(
        { error: "ALREADY_APPROVED", message: "Membership already approved. Contact admin to change details." },
        { status: 400 }
      );
    }
    const { error: updateError } = await supabase
      .from("arena_membership_requests")
      .update(row)
      .eq("user_id", user.id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  } else {
    const { error: insertError } = await supabase.from("arena_membership_requests").insert({
      ...row,
      created_at: now,
    });
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await notifyMembershipRequestPending({
    userEmail: user.email ?? "",
    jobFunction: job_function,
    joinedAt: joined_at,
    leaderStartedAt: leader_started_at,
  });

  return NextResponse.json({ ok: true, status: "pending" });
}

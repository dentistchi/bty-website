/**
 * GET: Pending Arena membership requests (admin only).
 * Used by Admin 승인 UI to list requests and approve.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminEmail } from "@/lib/authz";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { fetchFullNameMap } from "@/lib/bty/arena/fullNameMap.server";

export async function GET(req: NextRequest) {
  const auth = await requireAdminEmail(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "ADMIN_CLIENT_UNAVAILABLE" }, { status: 503 });

  const { data, error } = await admin
    .from("arena_membership_requests")
    .select("id, user_id, full_name, job_function, joined_at, leader_started_at, status, created_at, updated_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as Array<{ user_id: string; full_name: string | null }>;
  const fullNameMap = await fetchFullNameMap(admin, rows.map((r) => r.user_id));
  const requests = rows.map((r) => ({
    ...r,
    // authoritative arena_profiles name, fall back to the audit snapshot on the request
    fullName: fullNameMap.get(r.user_id) ?? r.full_name ?? null,
  }));

  return NextResponse.json({ requests });
}

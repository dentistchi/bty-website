/**
 * PATCH: Approve an Arena membership request (admin only).
 * Sets status=approved, approved_at=now(), approved_by=admin email.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminEmail } from "@/lib/authz";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminEmail(_req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "ADMIN_CLIENT_UNAVAILABLE" }, { status: 503 });

  const { id } = await params;
  const requestId = typeof id === "string" ? id.trim() : "";
  if (!requestId) return NextResponse.json({ error: "MISSING_REQUEST_ID" }, { status: 400 });

  const adminEmail = (auth.user.email ?? "").trim().toLowerCase();

  const { data, error } = await admin
    .from("arena_membership_requests")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: adminEmail,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id, user_id, status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "NOT_FOUND_OR_ALREADY_APPROVED" }, { status: 404 });

  return NextResponse.json({ ok: true, requestId: data.id, userId: data.user_id });
}

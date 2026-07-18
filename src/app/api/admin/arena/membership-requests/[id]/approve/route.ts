/**
 * PATCH: Approve an Arena membership request (admin only).
 * Sets status=approved, approved_at=now(), approved_by=admin email.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminEmail } from "@/lib/authz";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ensureCanonicalMembershipFromApproval } from "@/lib/bty/arena/organizationMembershipService";

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
    .select("id, user_id, status, joined_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "NOT_FOUND_OR_ALREADY_APPROVED" }, { status: 404 });

  // Write-through to the canonical membership foundation (Slice 3.1A-1). This is NOT
  // atomic with the approval above and is intentionally best-effort: the legacy approval
  // is the sole Arena access authority in this phase, so a canonical-write miss NEVER
  // blocks the approved user — it is surfaced as `reconciliation: "pending"` and caught
  // idempotently by the migration backfill / reconciliation. It never touches `memberships`.
  const numericRequestId = Number(data.id);
  const canonical = await ensureCanonicalMembershipFromApproval(admin, {
    userId: data.user_id,
    joinedAt: (data as { joined_at?: string | null }).joined_at ?? null,
    sourceRequestId: Number.isFinite(numericRequestId) ? numericRequestId : null,
  });

  return NextResponse.json({
    ok: true,
    requestId: data.id,
    userId: data.user_id,
    canonicalMembership: canonical.ok ? "ok" : "reconciliation_pending",
  });
}

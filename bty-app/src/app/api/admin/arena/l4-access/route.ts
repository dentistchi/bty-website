/**
 * PATCH: Set L4 (Partner) access for a user. Admin only.
 * L4 is not unlockable by tenure; only admin can grant/revoke.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminEmail } from "@/lib/authz";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(req: NextRequest) {
  const auth = await requireAdminEmail(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "ADMIN_CLIENT_UNAVAILABLE" },
      { status: 503 }
    );
  }

  let body: { userId?: string; l4_access?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const l4_access = typeof body.l4_access === "boolean" ? body.l4_access : undefined;

  if (!userId) {
    return NextResponse.json({ error: "MISSING_USER_ID" }, { status: 400 });
  }
  if (l4_access === undefined) {
    return NextResponse.json({ error: "MISSING_L4_ACCESS" }, { status: 400 });
  }

  const { error } = await admin
    .from("arena_profiles")
    .upsert(
      { user_id: userId, l4_access },
      { onConflict: "user_id" }
    );

  if (error) {
    return NextResponse.json(
      { error: "UPDATE_FAILED", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, userId, l4_access });
}

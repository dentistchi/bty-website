import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { requireApprovedMembership } from "@/lib/bty/arena/requireApprovedMembership";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Access context for the published-practice routes.
 *
 * A published practice is visible/playable to EITHER an approved Arena learner OR
 * its own CREATOR (published_by). So approved-membership is resolved as a
 * NON-FATAL flag here (not a hard 403) — the route/service then grants a creator
 * their own work even without a separate approved-member role, while still
 * gating other users' practices behind approved membership. Reads/writes use the
 * service-role client because the practice tables are client-deny.
 */
export type ArenaAccess = { userId: string; admin: SupabaseClient; isApprovedMember: boolean };

export async function requireArenaAccess(): Promise<
  { ok: true; access: ArenaAccess } | { ok: false; response: NextResponse }
> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, response: NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }) };

  // Membership is a capability flag, NOT a gate — a creator may lack it and still
  // see/test their own published work.
  const membership = await requireApprovedMembership(supabase, user.id);

  const admin = getSupabaseAdmin();
  if (!admin) {
    return { ok: false, response: NextResponse.json({ error: "ADMIN_CLIENT_UNAVAILABLE" }, { status: 503 }) };
  }
  return { ok: true, access: { userId: user.id, admin, isApprovedMember: membership.approved } };
}

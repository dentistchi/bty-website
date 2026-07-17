import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { requireApprovedMembership } from "@/lib/bty/arena/requireApprovedMembership";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Shared gate for the learner-facing published-practice routes.
 *
 * A published practice is played by an Arena LEARNER, so it reuses the exact Arena
 * entry gate (approved `arena_membership_requests`) — the same authority as every
 * canonical Arena run — rather than the Foundry Host gate. Reads/writes then use
 * the service-role client because `foundry_published_arena_practices` /
 * `foundry_arena_practice_runs` are client-deny.
 */
export async function requireArenaMember(): Promise<
  | { ok: true; userId: string; admin: SupabaseClient }
  | { ok: false; response: NextResponse }
> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, response: NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }) };

  const gate = await requireApprovedMembership(supabase, user.id);
  if (!gate.approved) {
    return {
      ok: false,
      response: NextResponse.json({ error: gate.error, reason: gate.reason }, { status: gate.status }),
    };
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return { ok: false, response: NextResponse.json({ error: "ADMIN_CLIENT_UNAVAILABLE" }, { status: 503 }) };
  }
  return { ok: true, userId: user.id, admin };
}

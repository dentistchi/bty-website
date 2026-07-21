import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getMyCompletionReview } from "@/lib/bty/foundry/events/foundryCompletionReviewService";
import { jsonNoStore } from "@/lib/bty/foundry/events/publicRoute";

export const runtime = "nodejs";

/**
 * GET /api/bty/foundry/assignment-review/[assignmentId] — Slice 3.1B-3E.1.
 *
 * Authenticated, read-only review of the caller's OWN completed assignment. Auth REQUIRED
 * (401). Identity is server-derived from auth.getUser() and is the ONLY ownership key — the
 * service matches it against the immutable assignment `user_id_snapshot` and requires status
 * `completed`, returning neutral 404 for a missing / not-owned / not-completed assignment (no
 * disclosure). Returns only the learner's own stored completion content; no participant is
 * created, no XP awarded, no status mutated.
 *
 * Top-level static segment `assignment-review` (dynamic child only) so it never shadows /
 * is-shadowed-by the sibling `assignments/mine`, and an unauthenticated hit is 401 not 404.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ assignmentId: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return jsonNoStore({ ok: false, error: "unavailable" }, 503);

  const supa = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return jsonNoStore({ ok: false, error: "unauthenticated" }, 401);

  const { assignmentId } = await ctx.params;
  const review = await getMyCompletionReview(admin, user.id, assignmentId);
  if (!review) return jsonNoStore({ ok: false, error: "not_found" }, 404);

  return jsonNoStore({ ok: true, review });
}

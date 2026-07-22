import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { submitFollowupOutcome } from "@/lib/bty/foundry/events/foundryFollowupService";
import { jsonNoStore } from "@/lib/bty/foundry/events/publicRoute";

export const runtime = "nodejs";

/**
 * POST /api/bty/foundry/followups/[followupId]/respond — the authenticated learner submits ONE
 * self-reported outcome (APPLIED / PARTLY_APPLIED / NOT_YET / BLOCKED), closing the checkpoint as
 * RESPONDED exactly once (Slice 3.1B-3K). Auth REQUIRED (401). Owner-verified + row-locked in the
 * RPC. A conflicting second outcome NEVER overwrites the first (409 already_responded); an identical
 * resubmission is idempotent (unchanged). NEVER touches completion / XP / assignment / Shared
 * Understanding. private, no-store.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ followupId: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return jsonNoStore({ ok: false, error: "unavailable" }, 503);

  const supa = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return jsonNoStore({ ok: false, error: "unauthenticated" }, 401);

  const { followupId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const res = await submitFollowupOutcome(admin, user.id, followupId, body?.outcome);

  if (res.result === "responded" || res.result === "unchanged") {
    return jsonNoStore({ ok: true, result: res.result, status: res.status, outcome: res.outcome });
  }
  if (res.result === "already_responded") {
    // The first outcome stands; return it read-only (never silently overwritten).
    return jsonNoStore(
      { ok: false, error: "already_responded", status: res.status, outcome: res.outcome },
      409,
    );
  }
  const status = res.result === "not_found" ? 404 : res.result === "not_owner" ? 404 : res.result === "invalid_outcome" ? 400 : 500;
  return jsonNoStore({ ok: false, error: res.result }, status);
}

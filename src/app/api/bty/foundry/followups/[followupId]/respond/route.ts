import { NextRequest } from "next/server";
import { consentRequiredResponse, isConsentCurrent } from "@/lib/legal/activeConsent";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { submitFollowupOutcome } from "@/lib/bty/foundry/events/foundryFollowupService";
import { jsonNoStore } from "@/lib/bty/foundry/events/publicRoute";

export const runtime = "nodejs";

/** Private learner data: `private, no-store` (mirrors the Today brief route), never shared-cacheable. */
function priv(body: unknown, status = 200) {
  const res = jsonNoStore(body, status);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

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
  if (!admin) return priv({ ok: false, error: "unavailable" }, 503);

  const supa = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return priv({ ok: false, error: "unauthenticated" }, 401);
  if (!(await isConsentCurrent(supa, user.id))) return consentRequiredResponse();

  const { followupId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const res = await submitFollowupOutcome(admin, user.id, followupId, body?.outcome);

  /*
    `canCheckInAgain` is carried by the SERVICE result (Slice 3.2R-R3-R1) and only forwarded here.
    The handler decides nothing about it — the surface must not have to re-derive, from the outcome
    it just submitted, whether another check-in is still possible.
  */
  if (res.result === "responded" || res.result === "unchanged") {
    return priv({
      ok: true,
      result: res.result,
      status: res.status,
      outcome: res.outcome,
      canCheckInAgain: res.canCheckInAgain,
    });
  }
  if (res.result === "already_responded") {
    // The first outcome stands; return it read-only (never silently overwritten).
    return priv(
      {
        ok: false,
        error: "already_responded",
        status: res.status,
        outcome: res.outcome,
        canCheckInAgain: res.canCheckInAgain,
      },
      409,
    );
  }
  const status = res.result === "not_found" ? 404 : res.result === "not_owner" ? 404 : res.result === "invalid_outcome" ? 400 : 500;
  return priv({ ok: false, error: res.result }, status);
}

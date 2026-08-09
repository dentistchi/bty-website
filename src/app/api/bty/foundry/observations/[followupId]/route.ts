import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getObservationRequest } from "@/lib/bty/foundry/events/foundryObservationService";
import { jsonNoStore } from "@/lib/bty/foundry/events/publicRoute";

export const runtime = "nodejs";

/** Private, never shared-cacheable — mirrors the learner follow-up route. */
function priv(body: unknown, status = 200) {
  const res = jsonNoStore(body, status);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

/**
 * GET /api/bty/foundry/observations/[followupId] — what an AUTHORISED observer is asked
 * (Slice 3.2M-5).
 *
 * 3.2M-4 built this capability as a service and never gave it a door: there was no route and
 * no page, so a colleague could not report anything and a second sighting was unreachable by
 * any human. This is that door, and nothing more.
 *
 * AUTHORITY IS UNCHANGED. Authentication plus the existing non-self ACTION_REVIEWER edge, both
 * resolved server-side from the obligation. Possession of this URL grants nothing: an
 * unauthorised caller — including the learner themselves — gets the same non-disclosing 404 as
 * someone asking about an obligation that does not exist, so the request's existence cannot be
 * probed.
 *
 * The payload is deliberately thin: who, the frozen standard, the latest date they may report,
 * and their OWN prior reports. Never the learner's reflection, decision, follow-up outcome or
 * Arena history — an observation biased by reading the learner's own claim is not independent.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ followupId: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return priv({ ok: false, error: "unavailable" }, 503);

  const supa = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return priv({ ok: false, error: "unauthenticated" }, 401);

  const { followupId } = await ctx.params;
  const res = await getObservationRequest(admin, user.id, followupId);
  if (!res.ok) {
    // `not_authorized` is answered exactly like `not_found` on purpose.
    const status = res.reason === "no_observable_standard" ? 409 : 404;
    return priv({ ok: false, error: res.reason === "no_observable_standard" ? res.reason : "not_found" }, status);
  }
  return priv({ ok: true, request: res.value });
}

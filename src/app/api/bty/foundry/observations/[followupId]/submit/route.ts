import { NextRequest } from "next/server";
import { consentRequiredResponse, isConsentCurrent } from "@/lib/legal/activeConsent";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { submitObservation } from "@/lib/bty/foundry/events/foundryObservationService";
import { jsonNoStore } from "@/lib/bty/foundry/events/publicRoute";

export const runtime = "nodejs";

/** Private, never shared-cacheable — mirrors the learner follow-up respond route. */
function priv(body: unknown, status = 200) {
  const res = jsonNoStore(body, status);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

/**
 * POST /api/bty/foundry/observations/[followupId]/submit — one authorised observer records
 * what they personally saw or heard, and WHEN (Slice 3.2M-5).
 *
 * Nested under the dynamic segment exactly like `followups/[followupId]/respond`, which is the
 * shape proven to route correctly on the Cloudflare runtime.
 *
 * `observedOn` is the OCCURRENCE date, not the filing date — the server stamps `submitted_at`
 * itself and the two are kept apart. It is validated against today in the CANONICAL obligation
 * timezone, never a timezone the client sends.
 *
 * The route stays terminal-free: an observer may come back later and report another sighting on
 * a later date, for as long as their authority holds. Only the identical (date, answer) episode
 * is idempotent, and it answers 200 with `created: false` rather than an error — a double tap is
 * not a mistake worth shouting about.
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
  const res = await submitObservation(admin, user.id, followupId, body?.outcome, body?.observedOn);

  if (res.ok) return priv({ ok: true, outcome: res.outcome, observedOn: res.observedOn, created: res.created });

  /*
    `subject_identity_unresolved` joins `no_observable_standard` at 409 (Slice R4-R1): the
    obligation is real and the caller is authorised, but the request could not be presented — so
    nothing was written. It is mapped identically in the read route, so a client cannot see one
    surface refuse and the other accept.
  */
  const status =
    res.reason === "invalid_outcome" || res.reason === "invalid_date" || res.reason === "future_date"
      ? 400
      : res.reason === "no_observable_standard" || res.reason === "subject_identity_unresolved"
        ? 409
        : res.reason === "error"
          ? 500
          : 404; // not_found AND not_authorized — non-disclosing, as in the read route
  const error = res.reason === "not_authorized" ? "not_found" : res.reason;
  return priv({ ok: false, error }, status);
}

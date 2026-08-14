import { NextRequest } from "next/server";
import { consentRequiredResponse, isConsentCurrent } from "@/lib/legal/activeConsent";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { listMyObservationOpportunities } from "@/lib/bty/foundry/events/observationOpportunityService";
import { jsonNoStore } from "@/lib/bty/foundry/events/publicRoute";

export const runtime = "nodejs";

/** Private, never shared-cacheable — the same posture as the other reviewer/learner reads. */
function priv(body: unknown, status = 200) {
  const res = jsonNoStore(body, status);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

/**
 * GET /api/bty/foundry/observations/mine — the behaviours this reviewer may confirm (Slice 3.2N).
 *
 * Sits beside `assignments/mine` and mirrors its shape: the caller is identified from the
 * session, never from the request, and the answer is scoped to what their own edges reach.
 *
 * EMPTY IS A SUCCESS. A signed-in person with no reviewer edges gets `200 { items: [] }`, not a
 * 403 — "you have no review work" and "you are not allowed here" are different sentences, and
 * showing the second to someone who simply has nothing to do would be both wrong and unkind.
 * It would also leak the shape of the authority graph to anyone who probed it.
 *
 * The payload is a NAVIGATION SUMMARY: who, what behaviour to watch for, what has been recorded,
 * and an id used only to open the existing observation page — which re-resolves authority itself,
 * so appearing in this list grants nothing.
 */
export async function GET(_req: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) return priv({ ok: false, error: "unavailable" }, 503);

  const supa = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return priv({ ok: false, error: "unauthenticated" }, 401);
  if (!(await isConsentCurrent(supa, user.id))) return consentRequiredResponse();

  try {
    const items = await listMyObservationOpportunities(admin, user.id);
    return priv({ ok: true, items });
  } catch {
    // Fail-soft into an honest empty list rather than a 500 into the reviewer surface: the
    // section self-gates away, exactly as the action-review queue does on a read failure.
    return priv({ ok: true, items: [] });
  }
}

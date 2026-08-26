import { NextRequest } from "next/server";
import { consentRequiredResponse, isConsentCurrent } from "@/lib/legal/activeConsent";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { redeemCompletionClaim } from "@/lib/bty/foundry/events/completionClaimService";
import { jsonNoStore } from "@/lib/bty/foundry/events/publicRoute";
import { rateLimitKV, getCfClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Private learner data: `private, no-store`, never shared-cacheable. */
function priv(body: unknown, status = 200) {
  const res = jsonNoStore(body, status);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

/**
 * POST /api/bty/foundry/completion-claim — a signed-in learner attaches a training they finished
 * anonymously (Deferred Completion Claim V1).
 *
 * ONE REFUSAL, NOT FIVE. Invalid, expired, already spent, already owned and never existed all
 * return the same `invalid`. Distinguishing them would turn this endpoint into an oracle for
 * probing which codes are real, which is exactly what a 60-bit bearer secret cannot afford.
 *
 * RATE LIMITED BY ACCOUNT, NOT BY IP. The code is guessable only by volume, and an attacker
 * controls their IP far more easily than a signed-in identity — so the key is the user id, with
 * the client IP folded in so one account cannot be farmed across many machines either. The
 * existing `rateLimitKV` is reused unchanged; it fails CLOSED in staging and production, which is
 * the correct direction for a credential endpoint.
 *
 * THE ENTROPY ARGUMENT ONLY HOLDS WITH THIS LIMIT. 60 bits at 10 attempts/minute is ~10^11 years
 * to a median hit. Remove the limit and the number stops meaning anything.
 *
 * NO LEARNER TEXT CROSSES THIS ROUTE. The response carries the claimed training's ids only —
 * never a response, reflection or decision.
 */
export async function POST(req: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) return priv({ ok: false, error: "unavailable" }, 503);

  const supa = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return priv({ ok: false, error: "unauthenticated" }, 401);
  if (!(await isConsentCurrent(supa, user.id))) return consentRequiredResponse();

  const rl = await rateLimitKV({
    endpoint: "foundry_completion_claim",
    identifier: `${user.id}:${getCfClientIp(req)}`,
    limit: 10,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    const res = priv({ ok: false, error: "rate_limited" }, 429);
    res.headers.set("Retry-After", String(rl.retryAfterSeconds));
    return res;
  }

  const body = (await req.json().catch(() => ({}))) as { code?: unknown; tz?: unknown };
  const result = await redeemCompletionClaim(
    admin,
    body?.code,
    user.id,
    typeof body?.tz === "string" ? body.tz : null,
  );
  if (!result.ok) return priv({ ok: false, error: "invalid" }, 400);
  return priv({ ok: true, eventId: result.eventId });
}

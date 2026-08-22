import { NextRequest } from "next/server";
import { consentRequiredResponse, isConsentCurrent } from "@/lib/legal/activeConsent";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { claimXp } from "@/lib/bty/foundry/events/foundryTrainingService";
import { jsonNoStore, readParticipantSession, PUBLIC_REASON_STATUS } from "@/lib/bty/foundry/events/publicRoute";

export const runtime = "nodejs";

/**
 * POST /api/bty/foundry/public/[token]/progress/claim-xp — an employee who
 * completed the training anonymously claims their Core XP after signing in. Auth
 * is REQUIRED here (unlike completion). Verifies the same participant session +
 * a completed progress row + XP-not-yet-awarded; awards via the canonical path;
 * idempotent (a second claim returns already-awarded).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return jsonNoStore({ ok: false, error: "unavailable" }, 503);

  const supa = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return jsonNoStore({ ok: false, error: "unauthenticated" }, 401);
  if (!(await isConsentCurrent(supa, user.id))) return consentRequiredResponse();

  const { token } = await ctx.params;
  const session = readParticipantSession(req, token);
  const body = await req.json().catch(() => ({}));
  const r = await claimXp(admin, token, session, user.id, body?.tz);
  if (!r.ok) return jsonNoStore({ ok: false, error: r.reason }, PUBLIC_REASON_STATUS[r.reason] ?? 400);
  // assignmentClaim (3.1B-3D) is a NEUTRAL, non-disclosing field: 'claimed' connects the
  // learner's own assignment; anything else (incl. no_matching_assignment) is silent.
    // R4-R5C9A — the server's own materialization outcome; absent unless a Reality step is live.
return jsonNoStore({ ok: true, ...r.snapshot, assignmentClaim: r.assignmentClaim, applyWindow: r.applyWindow });
}

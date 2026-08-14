import { NextRequest } from "next/server";
import { consentRequiredResponse, isConsentCurrent } from "@/lib/legal/activeConsent";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { claimDocumentXp } from "@/lib/bty/foundry/events/foundryDocumentService";
import { jsonNoStore, readParticipantSession, PUBLIC_REASON_STATUS } from "@/lib/bty/foundry/events/publicRoute";

export const runtime = "nodejs";

/**
 * POST /api/bty/foundry/public/[token]/doc/claim-xp — a participant who completed
 * a PDF Study Room anonymously claims their Core XP after signing in. Auth is
 * REQUIRED (unlike completion). Verifies the same participant session + a completed
 * progress row + XP-not-yet-awarded; awards via the canonical path; idempotent.
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
  const r = await claimDocumentXp(admin, token, session, user.id, body?.tz);
  if (!r.ok) return jsonNoStore({ ok: false, error: r.reason }, PUBLIC_REASON_STATUS[r.reason] ?? 400);
  // assignmentClaim (3.1B-3D): neutral, non-disclosing.
  return jsonNoStore({ ok: true, ...r.snapshot, assignmentClaim: r.assignmentClaim });
}

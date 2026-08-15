import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireConsentedUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { listMyEvidence } from "@/lib/bty/foundry/events/learnerEvidenceService";

export const runtime = "nodejs";

/**
 * GET /api/bty/foundry/evidence/mine — what the caller's own completed trainings have actually
 * established since (Slice 3.2R-R1).
 *
 * A SEPARATE route from `/api/bty/foundry/history` on purpose. History carries the learner's
 * private writing and is also read by the Today brief; evidence is a different question with a
 * different cost, and splitting them means My Learning can render its completions immediately
 * and fill the evidence in without either one being able to break the other — the pattern that
 * surface already uses for reviewed action plans.
 *
 * OWNER-SCOPED. The user id comes from the session, never the client, and the service-role read
 * is scoped to that user's `linked_user_id`. There is no eventId/userId parameter to tamper with.
 *
 * CARRIES NO TEXT. The response holds rung names and row ids only. No response_text, no
 * learner_reflection_text, no decision text, no AI output — asserted over the serialized body in
 * `evidenceMineRoute.test.ts`, not merely stated here.
 */
export async function GET(req: NextRequest) {
  const { user, base, consentDenied } = await requireConsentedUser(req);
  if (!user) return unauthenticated(req, base);
  if (consentDenied) return consentDenied;

  const admin = getSupabaseAdmin();
  if (!admin) {
    const res = NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  const items = await listMyEvidence(admin, user.id);

  const res = NextResponse.json({
    ok: true,
    items: items.map((it) => ({
      entryId: it.entryId,
      eventId: it.eventId,
      established: it.evidence.established,
      highestEstablished: it.evidence.highestEstablished,
    })),
  });
  // Private learner data (which rungs one person has established) — never shared-cacheable.
  res.headers.set("Cache-Control", "private, no-store");
  copyCookiesAndDebug(base, res, req, true);
  return res;
}

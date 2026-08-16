import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireConsentedUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { listMyEvidence } from "@/lib/bty/foundry/events/learnerEvidenceService";
import { resolveUserTzContext } from "@/lib/bty/daily/userDay";

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

  /*
    READER FRAME, RESOLVED READ-ONLY (Slice 3.2R-R3-R2).

    `openFollowUp` is a "has this checkpoint arrived?" question, so it needs the same BTY-day frame
    Today uses — and it must reuse the SAME authority rather than introduce a second one.

    `deviceTz` is deliberately passed as null. The resolver's middle rung CAPTURES a device tz to
    the profile with an UPDATE, and rendering My Learning must write nothing at all; with no device
    tz that rung cannot be reached, so this resolves profile-tz → "UTC" and touches no row. The
    same call shape `foundryTrainingService` already uses for a read path.
  */
  const { timezone } = await resolveUserTzContext(admin, user.id, null);
  const items = await listMyEvidence(admin, user.id, new Date(), timezone);

  const res = NextResponse.json({
    ok: true,
    items: items.map((it) => ({
      entryId: it.entryId,
      eventId: it.eventId,
      established: it.evidence.established,
      highestEstablished: it.evidence.highestEstablished,
      /*
        Slice 3.2R-R3-R1 — the return route to a follow-up that can still take a later check-in.
        Re-projected field by field like everything else here, so the "carries no text" property
        of this route survives: an id, a checkpoint number, and a settled enum the learner and
        Host can both already see. Never a sentence.
      */
      checkInAgain: (it.checkInAgain ?? []).map((c) => ({
        followupId: c.followupId,
        followUpDays: c.followUpDays,
        outcome: c.outcome,
      })),
      /*
        Slice 3.2R-R3-R2 — the return route to an obligation that has NO answer yet. Two separate
        fields rather than one list with a status discriminator, because the two CTAs say different
        sentences and a client that had to branch on a status string is a client that would
        eventually offer "Check in again" for a question nobody answered. Same allow-list
        discipline: an id and a checkpoint number, never a sentence and never a date.
      */
      openFollowUp: (it.openFollowUp ?? []).map((c) => ({
        followupId: c.followupId,
        followUpDays: c.followUpDays,
      })),
    })),
  });
  // Private learner data (which rungs one person has established) — never shared-cacheable.
  res.headers.set("Cache-Control", "private, no-store");
  copyCookiesAndDebug(base, res, req, true);
  return res;
}

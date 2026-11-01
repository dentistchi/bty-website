import { NextRequest, NextResponse } from "next/server";
import { requireConsentedUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { isHealingCompletionReviewError } from "@/lib/bty/healing/healingCompletionRead.server";
import { getSecondAwakening, completeSecondAwakening } from "@/lib/bty/emotional-stats/secondAwakening";

/** POST: Enter Next Phase — mark Second Awakening complete and grant starter unlock if applicable. */
export async function POST(req: NextRequest) {
  const { user, supabase, base, consentDenied } = await requireConsentedUser(req);
  if (!user) return unauthenticated(req, base);
  if (consentDenied) return consentDenied;

  try {
    const result = await getSecondAwakening(supabase, user.id);
    if (!result.eligible && !result.completed) {
      const out = NextResponse.json(
        { ok: false, error: "Not eligible or already completed" },
        { status: 400 }
      );
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }

    const complete = await completeSecondAwakening(supabase, user.id);
    if (!complete.ok) {
      const out = NextResponse.json(
        { ok: false, error: complete.status === 409 ? "This completion needs review before it can be confirmed." : "Failed to complete",
          ...(complete.error === "HEALING_COMPLETION_REVIEW_REQUIRED" ? { code: complete.error } : {}) },
        { status: complete.status ?? 500 }
      );
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }

    const out = NextResponse.json({
      ok: true,
      starterUnlockGranted: complete.starterUnlockGranted ?? undefined,
      idempotent: complete.idempotent === true,
    });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  } catch (error) {
    if (isHealingCompletionReviewError(error)) {
      const review = NextResponse.json({ ok: false, error: "This completion needs review before it can be confirmed.",
        code: "HEALING_COMPLETION_REVIEW_REQUIRED" }, { status: 409 });
      copyCookiesAndDebug(base, review, req, true); return review;
    }
    const out = NextResponse.json({ ok: false, error: "Failed to complete" }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

}

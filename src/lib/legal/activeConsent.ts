import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { consentSatisfied } from "@/domain/legal/consent-document";

/**
 * ONE CONSENT PRIMITIVE FOR EVERY LEARNER SEAM (Slice 3.2R-R9B.2).
 *
 * R9B.1 closed the largest seam by teaching `requireConsentedUser` to read the profile and judge it
 * with R9A's authority. The remaining seams authenticate differently — `getLetterAuth` has no
 * `NextRequest` at all, `requireArenaAccess` resolves membership, and 71 routes call
 * `supabase.auth.getUser()` inline — so each of them would otherwise have grown its own copy of
 * "read consent_version, compare it". That is exactly how a second definition of "consented" gets
 * born, and how the two definitions drift.
 *
 * So the comparison lives here, once, and every seam calls it. `ACTIVE_CONSENT_VERSION` still
 * appears in exactly one file in the repository; this only knows how to ask the database.
 *
 * FAILS CLOSED, identically everywhere: a missing profile, an errored read and a thrown query are
 * all "consent not established", never "consented".
 */
export async function isConsentCurrent(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("arena_profiles")
      .select("consent_version")
      .eq("user_id", userId)
      .maybeSingle<{ consent_version: string | null }>();
    if (error) return false;
    return consentSatisfied(data?.consent_version);
  } catch {
    return false;
  }
}

/**
 * The one refusal shape for a learner who is authenticated but not currently consented.
 *
 * 403 with a machine code, matching the measured convention on this API. NOT 401 — clients route
 * that to login and an authenticated learner would loop — and NOT 409, which R9A already uses for
 * `consent_document_stale`.
 */
export function consentRequiredResponse<T = unknown>(): NextResponse<T> {
  /*
    Generic only so the refusal can be returned from handlers that declare a narrow response union
    (the assessment routes do). The BODY is always the same `{ error: "consent_required" }`; the
    type parameter carries no runtime meaning.
  */
  return NextResponse.json({ error: "consent_required" }, { status: 403 }) as NextResponse<T>;
}

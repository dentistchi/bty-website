import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { consentSatisfied } from "@/domain/legal/consent-document";

/**
 * Read the server-verified profile projection used by every learner consent gate.
 * A missing profile, stale version or failed read requires consent.
 */
export async function isConsentCurrent(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("arena_profiles")
      .select("consent_version:consent_verified_version")
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

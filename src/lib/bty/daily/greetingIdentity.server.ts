import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveGreetingAddress,
  GENERIC_GREETING_ADDRESS,
  type CanonicalProfessionalIdentity,
  type GreetingAddress,
} from "@/domain/daily/greetingAddress";

/**
 * TODAY PERSONAL GREETING — the canonical identity behind "Good morning, Dr. Chi."
 * SERVER ONLY, and owner-scoped: every read is keyed by the signed-in user's own id.
 *
 * NO NEW IDENTITY STORAGE. Everything here already exists:
 *
 *   NAME      `arena_profiles.full_name`  the real name the person submitted to BTY
 *             `user_metadata.full_name` / `.name`  the provider name, on the canonical user
 *             record (the same two keys `teamsAccountLabel` and `resolveSuggestedTrainingName`
 *             already read). MEASURED 2026-09-23: 20/20 accounts carry `full_name`.
 *
 *   POSITION  the person's ACTIVE PRIMARY row in `bty_org_memberships` — `job_family_key` and
 *             `primary_role_key`, the CHECK-constrained canonical taxonomy. This REPLACED the
 *             legacy free-text read (`memberships.role` / `job_function` /
 *             `arena_membership_requests.job_function`) in M3.1; there is no fallback to it,
 *             because a second source is how two answers to one question start.
 *
 * MEASURED ABSENCE, stated so nobody re-derives it: BTY stores no first name, no last name, no
 * preferred name and no job-title column, and the stored Microsoft identity carries only one
 * full-name string — no `given_name`, no `family_name`, no `jobTitle`. That is why the family
 * name is SPLIT from the full name rather than read, and why `preferredName` is passed as
 * undefined: inventing a column for it would be duplicate identity storage.
 *
 * WHY user_metadata IS ACCEPTABLE HERE, where `recipientDisplayName` refuses it: that resolver
 * names OTHER people to a Host who acts on the answer, so a self-editable name would be a way to
 * misdirect a follow-up. This names the reader to themselves. Nothing is authorized by it, and it
 * cannot misidentify anyone but the person already looking at their own screen. Doctor status —
 * the only part that asserts something — comes from the role tables, which they cannot edit.
 *
 * FAIL-SOFT, PER SOURCE. A table that is missing, empty or erroring yields no role and no name
 * rather than an error: the worst outcome of this whole feature is the greeting Today already
 * shows. It never throws.
 */

type UserMetadata = Record<string, unknown> | null | undefined;

/**
 * The user's own ACTIVE PRIMARY canonical membership, as the pure rule wants it.
 *
 * Owner-scoped, and `null` on absence OR failure — deliberately the same answer, because an
 * unreadable roster and an empty one both mean "we do not know that this person is a provider",
 * and the safe reply to that is their first name, not an error. Only the two descriptive keys are
 * selected; the organization, dates, provenance and responsibilities are none of the greeting's
 * business.
 */
async function readCanonicalProfessionalIdentity(
  admin: SupabaseClient,
  userId: string,
): Promise<CanonicalProfessionalIdentity | null> {
  try {
    const { data } = await admin
      .from("bty_org_memberships")
      .select("job_family_key, primary_role_key")
      .eq("user_id", userId)
      .eq("status", "active")
      .eq("is_primary", true)
      .maybeSingle();
    if (!data) return null;
    const row = data as { job_family_key?: unknown; primary_role_key?: unknown };
    return { jobFamilyKey: row.job_family_key ?? null, primaryRoleKey: row.primary_role_key ?? null };
  } catch {
    // No membership readable → no professional claim, not an error surface.
    return null;
  }
}

/** Read `arena_profiles.full_name` for the user. null on any failure. */
async function readProfileFullName(admin: SupabaseClient, userId: string): Promise<string | null> {
  try {
    const { data } = await admin
      .from("arena_profiles")
      .select("full_name")
      .eq("user_id", userId)
      .maybeSingle();
    const v = (data as { full_name?: unknown } | null)?.full_name;
    return typeof v === "string" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Resolve how Today should address this user.
 *
 * @param metadata the signed-in user's own `user_metadata`, obtained server-side by the caller.
 * @returns the addressee + form of address. NEVER a role key — the position is used to choose the
 *          form and is then discarded inside the domain rule.
 */
export async function resolveGreetingIdentity(
  admin: SupabaseClient,
  userId: string,
  metadata: UserMetadata,
): Promise<GreetingAddress> {
  try {
    const [profileFullName, professionalIdentity] = await Promise.all([
      readProfileFullName(admin, userId),
      readCanonicalProfessionalIdentity(admin, userId),
    ]);
    const meta = (metadata ?? {}) as Record<string, unknown>;
    return resolveGreetingAddress({
      profileFullName,
      fullName: meta.full_name,
      name: meta.name,
      // No canonical preferred-name source exists today. The domain rule already honours one.
      preferredName: undefined,
      professionalIdentity,
    });
  } catch {
    return GENERIC_GREETING_ADDRESS;
  }
}

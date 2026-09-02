import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A bound recipient's display name, for the Host who is deciding whom to follow up with.
 * SERVER ONLY, and owner-scoped by every caller.
 *
 * ★ THE SOURCE IS `auth.identities.identity_data`, NOT `user_metadata`.
 *
 * They usually hold the same string, and the difference is the whole point:
 *
 *   identity_data   written by the PROVIDER at each sign-in. Microsoft owns it.
 *   user_metadata   writable by the account holder — `supabase.auth.updateUser({ data })`.
 *
 * A Host reads these names to decide who to chase. If the name came from `user_metadata`, a
 * recipient could rename themselves to anything, including another colleague, and the Host would
 * follow up with the wrong person on the strength of it. Presentation is not authorization, but a
 * name shown next to "needs help" is acted on, so it has to come from a source the subject cannot
 * edit.
 *
 * MEASURED (2026-09-02): there is no canonical BTY profile table to read instead. `profiles` holds
 * ZERO rows and `bty_profiles` is training progress — `current_day`, `season`, `bounce_back_count`
 * — with no name column at all. Every one of the 13 Microsoft-linked accounts carries a
 * provider-supplied name here, so this reads 13/13 today and needs no migration to do it.
 *
 * NEVER THE EMAIL. `preferred_username` on that same object is the address, and it is deliberately
 * not read: a Host surface must not become the place employee emails are listed.
 */

/** Only these keys, in this order. Anything else on the object is ignored rather than fallen back to. */
const NAME_KEYS = ["full_name", "name"] as const;

function nameFromIdentityData(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  for (const k of NAME_KEYS) {
    const v = d[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Resolve display names for the given canonical user ids.
 *
 * Deduplicated, so a person appearing in several of a Host's runs costs one lookup. Failures are
 * silent and individual: a name that cannot be resolved becomes `null`, and the caller renders the
 * person without one rather than dropping them from the list — a recipient whose name is missing
 * is still someone the Host needs to see.
 */
export async function resolveDisplayNames(
  admin: SupabaseClient,
  userIds: readonly string[],
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const distinct = [...new Set(userIds.filter(Boolean))];

  for (const id of distinct) {
    try {
      const { data, error } = await admin.auth.admin.getUserById(id);
      if (error || !data?.user) {
        out.set(id, null);
        continue;
      }
      const identities = data.user.identities ?? [];
      // The Microsoft identity first, because that is the one the workplace knows the person by.
      const azure = identities.find((i) => i.provider === "azure");
      const name =
        nameFromIdentityData(azure?.identity_data) ??
        nameFromIdentityData(identities[0]?.identity_data);
      out.set(id, name);
    } catch {
      // Code-free: an identity lookup must not become a way to enumerate the directory via logs.
      console.error("[announcement] display-name lookup failed");
      out.set(id, null);
    }
  }
  return out;
}

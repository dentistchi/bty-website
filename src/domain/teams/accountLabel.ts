/**
 * How the Teams Personal Tab names the person it is signed in as — PURE. Slice A0-RUNTIME2.
 *
 * THE DEFECT THIS REPLACES. The account row rendered the literal "…" because it displays an email
 * and nothing else, and in a Teams tab the session route returned no user at all. The email was
 * then unavailable, and "…" is what an absent email looks like.
 *
 * EMAIL IS NOT THE ANSWER, EVEN ONCE THE ROUTE WORKS. Canonical identity is `tenant id + Entra
 * oid` -> the canonical BTY user. Email is neither an identity claim nor a lookup key anywhere in
 * this product, and putting it on screen in the Teams host would make it look like one. So this
 * function cannot return an email: there is no branch that reads one.
 *
 * WHAT IT USES INSTEAD, AND WHY THAT IS NOT A NEW SOURCE. `full_name` / `name` live on the
 * CANONICAL BTY user record that the resolver already returned — the same row, already fetched by
 * the session route. Nothing new is queried, nothing new is trusted, and this value never decides
 * who anyone is. It is presentation, downstream of an identity that was settled server-side.
 *
 * MEASURED, so the fallback is not decorative: `arena_profiles.display_name` is NULL for the
 * Founder and for every other user (0 of them have one), so the profile table cannot answer this
 * today. When it can, it belongs ahead of `full_name` — and until then a truthful fallback beats
 * an empty row.
 */

export type TeamsAccountLabel = {
  /** The line that names WHO. Never an email, never "…". */
  who: string;
  /** The line that says HOW they are connected. */
  how: "connected_with_teams";
  /** True when no name was available and the generic label is standing in. */
  isFallback: boolean;
};

/** The generic, honest stand-in when the canonical user carries no name at all. */
export const TEAMS_ACCOUNT_FALLBACK = "Microsoft Teams account";

function clean(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length > 0 && s.length <= 120 ? s : null;
}

/**
 * Pick the name for the Teams account row.
 *
 * Order is deliberate: a name a person curated beats one a provider supplied, and a fuller name
 * beats a shorter one. An email-shaped value is refused at every tier — `name` and `full_name` are
 * free text on the user record and could contain anything, and this row must never become the
 * place an address is displayed as identity.
 */
export function teamsAccountLabel(input: {
  /** `arena_profiles.display_name`, when BTY ever carries one. */
  profileDisplayName?: unknown;
  /** `user_metadata.full_name` on the canonical BTY user. */
  fullName?: unknown;
  /** `user_metadata.name` on the canonical BTY user. */
  name?: unknown;
}): TeamsAccountLabel {
  for (const candidate of [input.profileDisplayName, input.fullName, input.name]) {
    const v = clean(candidate);
    // An address is not a name, wherever it turned up.
    if (v && !v.includes("@")) return { who: v, how: "connected_with_teams", isFallback: false };
  }
  return { who: TEAMS_ACCOUNT_FALLBACK, how: "connected_with_teams", isFallback: true };
}

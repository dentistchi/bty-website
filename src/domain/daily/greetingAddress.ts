/**
 * TODAY PERSONAL GREETING — how Today addresses the person who just opened it. PURE.
 *
 * Today opened with "Good morning." for everyone. This resolves WHO to name in that sentence,
 * and nothing else: the daypart band, the sub-line and the rest of the screen are untouched.
 *
 * IT RETURNS AN ADDRESSEE, NOT A SENTENCE. `kind` says which form of address the person's
 * canonical role earns; `addressee` is the single name token that goes in it. The locale copy
 * composes "Good morning, Dr. {name}." — a domain rule does not write display strings.
 *
 * THE POSITION IS USED, NEVER SHOWN. `professionalIdentity` decides the form of address and is
 * then discarded. No branch copies a role key into `addressee`, so no job title can reach the
 * screen through this function.
 *
 * MEASURED SOURCES (2026-09-23). There is no first/last/preferred-name column anywhere in BTY or
 * in the stored Microsoft identity — only one full-name string. So this splits a full name rather
 * than reading parts that do not exist, and every split that cannot be made safely falls back
 * instead of guessing. The professional claim comes from the canonical roster
 * (`bty_org_memberships.job_family_key` + `primary_role_key`), never from a name or a title.
 *
 * NEVER FROM THE EMAIL, NEVER FROM THE NAME. An address is refused at every tier (`@`), and
 * doctor status is decided ONLY by the canonical roster. A person called "Dr." in their name is
 * not a doctor here — the honorific is stripped and they are greeted by first name — because the
 * name is self-editable and the role is not.
 */

/** The form of address Today uses. `generic` → the existing unnamed greeting, unchanged. */
export type GreetingAddress =
  | { kind: "doctor"; addressee: string }
  | { kind: "personal"; addressee: string }
  | { kind: "generic"; addressee: null };

export const GENERIC_GREETING_ADDRESS: GreetingAddress = { kind: "generic", addressee: null };

/**
/**
 * THE PROFESSIONAL FORM IS A CREDENTIAL CLAIM, SO ONLY THE CANONICAL ROSTER MAY MAKE IT.
 *
 * Until M3.1 this matched free text (`memberships.job_function`, `memberships.role`) with word
 * rules — "doctor", "dentist", the phrase "clinical director". That could only ever be a guess
 * about a string an admin typed, and it got `ORTHODONTIST` wrong, because an orthodontist's title
 * contains neither word. It is replaced, not layered.
 *
 * `bty_org_memberships` carries a CHECK-constrained taxonomy, so the rule is now an exact pair:
 * the job FAMILY says the person delivers clinical care, and the PRIMARY ROLE says which licensed
 * provider they are.
 *
 * WHAT DELIBERATELY DOES NOT EARN IT. `CLINICAL_DIRECTOR` and `PARTNER` are RESPONSIBILITIES —
 * leadership a person holds, not a credential they earned — and this function never receives
 * them. `DENTAL_ASSISTANT` sits in `CLINICAL_SUPPORT`, beside a provider but not one. An unknown
 * role, a null pair and a missing membership all mean the same thing here: we do not know, so we
 * use the person's name.
 */
export const PROFESSIONAL_JOB_FAMILY_KEY = "CLINICAL_PROVIDER" as const;

/** The licensed-provider roles. Both are `CLINICAL_PROVIDER` in the canonical `ROLE_TO_FAMILY`. */
export const PROFESSIONAL_ROLE_KEYS: readonly string[] = ["GENERAL_DENTIST", "ORTHODONTIST"];

/** The canonical pair, exactly as `bty_org_memberships` stores it. Either side may be null. */
export type CanonicalProfessionalIdentity = {
  jobFamilyKey: unknown;
  primaryRoleKey: unknown;
};

/**
 * True only when BOTH halves of the canonical pair agree that this person is a licensed provider.
 * Exact, case-sensitive key comparison — no normalisation, because these are stored keys from a
 * CHECK-constrained column, not something a human typed.
 */
export function earnsProfessionalAddress(identity: CanonicalProfessionalIdentity | null | undefined): boolean {
  if (!identity) return false;
  const { jobFamilyKey, primaryRoleKey } = identity;
  if (jobFamilyKey !== PROFESSIONAL_JOB_FAMILY_KEY) return false;
  return typeof primaryRoleKey === "string" && PROFESSIONAL_ROLE_KEYS.includes(primaryRoleKey);
}

/** Reject the values that mean "absent" once they have been through metadata + JSON. */
function usableName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/\s+/g, " ");
  if (!t || t.length > 120) return null;
  const lower = t.toLowerCase();
  if (lower === "null" || lower === "undefined") return null;
  // An address is not a name, wherever it turned up (same refusal as teamsAccountLabel).
  if (t.includes("@")) return null;
  return t;
}

/** Drop a leading honorific so "Dr. Hanbit Chi" never becomes "Dr. Dr. Chi". */
function stripHonorific(name: string): string {
  return name.replace(/^(?:dr\.?|doctor|prof\.?|professor|닥터)\s+/i, "").trim();
}

/**
 * Trailing parts that are not the person's name, dropped before the family name is taken.
 * MEASURED: a real account carries the provider name "Dr. Hanbit Chi (hc)" — its last
 * whitespace token is "(hc)", which would have rendered "Dr. (hc)".
 */
const NAME_SUFFIXES = new Set([
  "jr", "jr.", "sr", "sr.", "ii", "iii", "iv",
  "dds", "dmd", "md", "do", "phd", "rdh",
]);

/**
 * Split a name into the parts that are actually NAME parts.
 *
 * Bracketed segments — "(hc)", "[locum]" — are initials, handles and annotations, never the
 * name someone is called. Commas are separators, credential suffixes are dropped, and each
 * surviving token must START with a letter, so "J.", "3" and "(hc)" cannot become an addressee.
 */
function nameParts(name: string): string[] {
  return name
    .replace(/[([{][^)\]}]*[)\]}]/g, " ")
    .replace(/,/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t && t.length <= 60 && !NAME_SUFFIXES.has(t.toLowerCase()))
    .filter((t) => /^[A-Za-z가-힣][A-Za-z가-힣'\u2019-]*$/.test(t));
}

export type GreetingAddressInput = {
  /** `arena_profiles.full_name` — the real name the person gave BTY. */
  profileFullName?: unknown;
  /** `user_metadata.full_name` on the canonical user record. */
  fullName?: unknown;
  /** `user_metadata.name` on the canonical user record. */
  name?: unknown;
  /** Reserved: BTY stores no preferred name today. Passed through when one ever exists. */
  preferredName?: unknown;
  /**
   * The signed-in person's ACTIVE PRIMARY canonical organizational membership, or null when they
   * have none. Used to choose the form of address, then discarded — it never supplies the name.
   */
  professionalIdentity?: CanonicalProfessionalIdentity | null;
};

/**
 * Resolve the form of address for the signed-in person.
 *
 * Name precedence: `arena_profiles.full_name` (the real name they submitted) → provider
 * `full_name` → provider `name`. The public leaderboard nickname (`arena_profiles.display_name`)
 * is deliberately NOT a source — Today greets a person, not a code name.
 *
 * The doctor form needs BOTH a canonical provider identity AND a usable family name. Missing
 * either one falls through to the personal form rather than rendering a half-built honorific.
 */
export function resolveGreetingAddress(input: GreetingAddressInput): GreetingAddress {
  const full =
    usableName(input.profileFullName) ?? usableName(input.fullName) ?? usableName(input.name);
  const preferred = usableName(input.preferredName);
  if (!full && !preferred) return GENERIC_GREETING_ADDRESS;

  const isDoctor = earnsProfessionalAddress(input.professionalIdentity);

  const parts = full ? nameParts(stripHonorific(full)) : [];

  if (isDoctor && parts.length >= 2) {
    // A family name can only be taken from a name that HAS separable name parts. A single-token
    // name (every Korean full name, and any mononym) is left alone.
    return { kind: "doctor", addressee: parts[parts.length - 1] };
  }

  if (preferred) {
    const p = nameParts(stripHonorific(preferred));
    if (p.length) return { kind: "personal", addressee: p[0] };
  }

  // fall through from the doctor branch lands here: a safe first name, never "Dr. undefined"
  return parts.length ? { kind: "personal", addressee: parts[0] } : GENERIC_GREETING_ADDRESS;
}

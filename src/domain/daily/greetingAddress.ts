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
 * THE POSITION IS USED, NEVER SHOWN. `roleValues` decides the form of address and is then
 * discarded. No branch copies a role string into `addressee`, so no job title can reach the
 * screen through this function.
 *
 * MEASURED SOURCES (2026-09-23). There is no first/last/preferred-name column and no job-title
 * column anywhere in BTY or in the stored Microsoft identity — only one full-name string and the
 * canonical role vocabulary (`memberships.role`, `memberships.job_function`,
 * `arena_membership_requests.job_function`). So this splits a full name rather than reading parts
 * that do not exist, and every split that cannot be made safely falls back instead of guessing.
 *
 * NEVER FROM THE EMAIL, NEVER FROM THE NAME. An address is refused at every tier (`@`), and
 * doctor status is decided ONLY by `roleValues`. A person called "Dr." in their provider name is
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
 * Canonical role values that earn "Dr." — the clinical job functions this product already names
 * (`STAFF_JOB_FUNCTIONS` / `LEADER_JOB_FUNCTIONS` in arena program config, `memberships.role`),
 * plus the clinical titles the Founder specified.
 *
 * `director`, `dso`, `partner`, `office_manager`, `regional_om`, `hygienist`, `assistant`,
 * `admin`, `staff` and `leader` are deliberately absent: none of them establishes that the person
 * is a clinician, and a wrong "Dr." is worse than a first name.
 */
export const DOCTOR_ROLE_VALUES: readonly string[] = [
  "doctor",
  "junior doctor",
  "senior doctor",
  "associate doctor",
  "lead doctor",
  "dentist",
  "associate dentist",
  "lead dentist",
  "clinical director",
  "regional clinical director",
];

/** lower-case, underscores/hyphens/punctuation → spaces, collapse runs. "Senior_Doctor" → "senior doctor". */
function normalizeRole(v: unknown): string {
  if (typeof v !== "string") return "";
  return v
    .toLowerCase()
    .replace(/[^a-z가-힣0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * True when a canonical role value identifies a clinician.
 *
 * Exact match against {@link DOCTOR_ROLE_VALUES}, plus two word-level rules so a free-text
 * `job_function` the admin screens allow ("Lead Dentist", "Regional Clinical Director") is not
 * missed: the standalone word `doctor` or `dentist`, and the phrase `clinical director`.
 * Word-level, never substring — "dental assistant" and "director" do not match.
 */
export function isDoctorRole(value: unknown): boolean {
  const r = normalizeRole(value);
  if (!r) return false;
  if (DOCTOR_ROLE_VALUES.includes(r)) return true;
  const words = r.split(" ");
  if (words.includes("doctor") || words.includes("dentist")) return true;
  return r.includes("clinical director");
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
  /** Canonical position/role strings. Used to choose the form of address, then discarded. */
  roleValues?: readonly unknown[];
};

/**
 * Resolve the form of address for the signed-in person.
 *
 * Name precedence: `arena_profiles.full_name` (the real name they submitted) → provider
 * `full_name` → provider `name`. The public leaderboard nickname (`arena_profiles.display_name`)
 * is deliberately NOT a source — Today greets a person, not a code name.
 *
 * Doctor form needs BOTH a doctor role AND a usable family name. Missing either one falls through
 * to the personal form rather than rendering a half-built honorific.
 */
export function resolveGreetingAddress(input: GreetingAddressInput): GreetingAddress {
  const full =
    usableName(input.profileFullName) ?? usableName(input.fullName) ?? usableName(input.name);
  const preferred = usableName(input.preferredName);
  if (!full && !preferred) return GENERIC_GREETING_ADDRESS;

  const isDoctor = (input.roleValues ?? []).some(isDoctorRole);

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

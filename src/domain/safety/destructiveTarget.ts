/**
 * Destructive-operation target boundary (PURE). Slice P0-R1.
 *
 * WHY THIS EXISTS, MEASURED RATHER THAN IMAGINED. On 2026-08-31 a forensic audit measured that
 * every pre-existing `auth.users` row had been deleted from the production project, and that the
 * loss had propagated through `ON DELETE CASCADE` into `bty_action_contracts` (94 → 0),
 * `arena_runs` (534 → 0), `core_xp_ledger` (64 → 0) and both Leadership Engine logs (44 → 0).
 * The same audit measured two ways production could be reached destructively AGAIN:
 *
 *   1. `/api/dev/reset-arena-state` was live on the production Worker, because its guard read
 *      `NODE_ENV !== "production" || BTY_ENV === "staging"` and `wrangler.toml` ships
 *      `BTY_ENV = "staging"` — the production Worker IS the staging Worker (single environment).
 *   2. Destructive E2E helpers read `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from
 *      `.env.local`, which points at production, so a local test run could call
 *      `auth.admin.deleteUser` against the real database.
 *
 * THE RULE. A destructive dev/test operation must prove BOTH:
 *   A. an explicit destructive-test opt-in is enabled, AND
 *   B. the Supabase project it would act on is NOT the production project.
 *
 * WHY THE PROJECT REF AND NOT A LABEL. Both prior guards trusted a NAME — `NODE_ENV`, then
 * `BTY_ENV` — and a name is an assertion about the environment, not a fact about the database
 * being written to. The project ref is read off the connection the operation will actually use, so
 * it cannot disagree with reality. A label can be wrong; the address you are about to delete from
 * cannot be.
 *
 * FAIL CLOSED, ALWAYS. An absent, malformed or unrecognisable Supabase URL is a REFUSAL, never a
 * default-allow — if we cannot prove which database we are pointed at, we have not earned the
 * right to delete from it.
 *
 * There is deliberately NO production override, not even an env-gated one. An override is the
 * thing that gets set once for a good reason and then stays set.
 */

/** The one production project. Deleting here is never a test operation. */
export const PRODUCTION_SUPABASE_PROJECT_REF = "mveycersmqfiuddslnrj";

/** The existing opt-in this codebase already uses for destructive test cleanup — reused, not reinvented. */
export const DESTRUCTIVE_OPT_IN_VALUE = "1";

export type DestructiveTargetDecision =
  | { allowed: true; projectRef: string }
  | {
      allowed: false;
      /**
       * `production_project`     — pointed at the live database.
       * `no_opt_in`              — no explicit destructive-test opt-in.
       * `unresolvable_project`   — could not prove which database this is (fail closed).
       */
      reason: "production_project" | "no_opt_in" | "unresolvable_project";
      projectRef: string | null;
    };

/**
 * `https://<ref>.supabase.co` → `<ref>`.
 *
 * Returns null for anything whose project cannot be identified, INCLUDING localhost and
 * self-hosted URLs. That is intentional: an unidentifiable target is refused, and a local stack
 * that wants destructive helpers can be named explicitly later rather than admitted by a hole
 * that also admits typos.
 */
export function supabaseProjectRef(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const raw = url.trim();
  if (raw === "") return null;
  let host: string;
  try {
    host = new URL(raw).hostname;
  } catch {
    return null;
  }
  const m = /^([a-z0-9-]+)\.supabase\.(co|in)$/i.exec(host);
  return m ? m[1].toLowerCase() : null;
}

/**
 * The whole boundary, as one decision. Both conditions must hold, and the project check is
 * evaluated even when the opt-in is missing so the reported reason names the strongest objection:
 * "you are pointed at production" is a more useful thing to read in a log than "you forgot a flag".
 */
export function evaluateDestructiveTarget(input: {
  supabaseUrl: unknown;
  optIn: unknown;
}): DestructiveTargetDecision {
  const projectRef = supabaseProjectRef(input.supabaseUrl);

  if (projectRef === PRODUCTION_SUPABASE_PROJECT_REF) {
    return { allowed: false, reason: "production_project", projectRef };
  }
  if (projectRef === null) {
    return { allowed: false, reason: "unresolvable_project", projectRef: null };
  }
  if (typeof input.optIn !== "string" || input.optIn.trim() !== DESTRUCTIVE_OPT_IN_VALUE) {
    return { allowed: false, reason: "no_opt_in", projectRef };
  }
  return { allowed: true, projectRef };
}

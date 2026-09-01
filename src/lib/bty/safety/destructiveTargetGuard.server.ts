import {
  evaluateDestructiveTarget,
  type DestructiveTargetDecision,
} from "@/domain/safety/destructiveTarget";

/**
 * The single authority every destructive dev/test path asks before touching a database (P0-R1).
 *
 * One authority, not five copies: the audit found the previous guards had drifted into three
 * different rules across three files, and the weakest one is the one that decides what production
 * is actually exposed to. Callers here get a decision, never their own opinion.
 *
 * Reads the SAME variables the destructive operation itself would use to connect, so the guard and
 * the action cannot disagree about which database is in play.
 */

/** Env-resolved decision. Refusal is the default whenever anything is missing or unclear. */
export function destructiveTargetDecision(): DestructiveTargetDecision {
  return evaluateDestructiveTarget({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    optIn: process.env.E2E_ALLOW_TEST_CLEANUP,
  });
}

/** Boolean form, for a route that must answer with a status code rather than an exception. */
export function isDestructiveTargetAllowed(): boolean {
  return destructiveTargetDecision().allowed;
}

/**
 * Throwing form, for service helpers with no HTTP response to shape.
 *
 * Throws BEFORE the caller reaches any client, credential or delete — a refusal that arrives after
 * the connection is open is a refusal that has already lost. The message names the project ref so
 * the operator can see WHICH database was refused, and never includes a key.
 */
export function assertDestructiveTargetAllowed(label: string): void {
  const d = destructiveTargetDecision();
  if (d.allowed) return;
  const detail =
    d.reason === "production_project"
      ? `refusing to run against the production Supabase project (${d.projectRef})`
      : d.reason === "unresolvable_project"
        ? "refusing: the target Supabase project could not be identified from NEXT_PUBLIC_SUPABASE_URL"
        : `refusing: destructive test opt-in (E2E_ALLOW_TEST_CLEANUP=1) is not enabled for project ${d.projectRef}`;
  throw new Error(`[destructive-guard] ${label}: ${detail}`);
}

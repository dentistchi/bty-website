/**
 * Elite canonical runtime: marks `arena_runs.meta` written by POST /api/arena/run/step so clients can
 * refuse resume of pre-compat runs (stale escalation_text / primary_choice_id without canonical projection).
 */

export const ELITE_RUNTIME_COMPAT_VERSION = 2;

/**
 * True when meta contains elite escalation payload from an older runtime (no compat version) and must not drive resume.
 */
export function isStaleEliteRunMetaForResume(meta: unknown): boolean {
  if (meta == null || typeof meta !== "object") return false;
  const m = meta as Record<string, unknown>;
  const hasEscalationPayload =
    typeof m.escalation_text === "string" ||
    m.primary_choice_id != null ||
    m.escalation_branch_key != null;
  if (!hasEscalationPayload) return false;
  return m.elite_runtime_compat !== ELITE_RUNTIME_COMPAT_VERSION;
}

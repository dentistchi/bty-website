import { refusalCountsForGovernance } from "@/domain/foundry/arena-draft/generationInputRevision";

/**
 * IN-MEMORY DOUBLE FOR THE GOVERNED ADMISSION FUNCTION (Slice 3.2I-R5B2-R5C-4A2).
 *
 * The real authority is `start_foundry_practice_generation_attempt_governed_v1`, and its
 * ATOMICITY is proven only against real PostgreSQL with two connections — never here. This double
 * exists so unit tests can exercise the paths AROUND admission (fail-before-spend, instrumentation,
 * attribution) without a database.
 *
 * It deliberately mirrors the SQL rule ORDER, and a contract test pins its refusal vocabulary
 * against the migration text, so the two cannot silently diverge.
 */

export type FakeRow = Record<string, unknown>;

export type GovernedRpcParams = {
  p_draft_id: string;
  p_owner_user_id: string;
  p_expected_generation_input_revision: number | null;
  p_locale: "en" | "ko";
  p_confirm_same_input_retry: boolean;
  p_deploy_version: string | null;
  [key: string]: unknown;
};

export type GovernedRpcResult = { data: FakeRow[] | null; error: { code: string; message: string } | null };

/**
 * Evaluate governance and, when admitted, append the parent row — in one call, exactly as the
 * database function does it in one statement.
 */
export function fakeGovernedAdmission(
  params: GovernedRpcParams,
  drafts: FakeRow[],
  attempts: FakeRow[],
): GovernedRpcResult {
  if (params.p_locale !== "en" && params.p_locale !== "ko") {
    return { data: null, error: { code: "22023", message: "invalid_generation_locale" } };
  }
  if (typeof params.p_deploy_version !== "string" || !/^[0-9a-f]{40}$/.test(params.p_deploy_version)) {
    return { data: null, error: { code: "22023", message: "invalid_source_identity" } };
  }

  const draft = drafts.find((d) => d.id === params.p_draft_id && d.owner_user_id === params.p_owner_user_id);
  if (!draft) return { data: null, error: { code: "42501", message: "draft_not_accessible" } };

  const epoch = Number(draft.generation_input_revision);
  const base = (state: string, count: number, needsConfirm: boolean) => ({
    data: [
      {
        admitted: false,
        attempt_id: null,
        generation_input_revision: epoch,
        generation_locale: params.p_locale,
        refusal_count: count,
        state,
        requires_explicit_confirmation: needsConfirm,
        review_setup_recommended: count >= 1,
      },
    ],
    error: null,
  });

  if (params.p_expected_generation_input_revision !== epoch) return base("input_revision_stale", 0, false);

  const mine = attempts.filter((a) => a.draft_id === params.p_draft_id);
  if (mine.some((a) => a.lifecycle_state === "started")) return base("in_progress", 0, false);

  const count = Math.min(
    2,
    mine.filter(
      (a) =>
        a.lifecycle_state === "completed" &&
        refusalCountsForGovernance(a.outcome as string | null, a.terminal_reason_code as string | null) &&
        // Exact same-input match, or the baseline wildcard while the draft is still at epoch 1.
        ((a.generation_input_revision === epoch && a.locale === params.p_locale) ||
          (epoch === 1 && (a.generation_input_revision === null || a.generation_input_revision === undefined))),
    ).length,
  );

  if (count >= 2) return base("revision_required", count, false);
  if (count === 1 && params.p_confirm_same_input_retry !== true) return base("confirm_second_attempt", count, true);

  const row: FakeRow = {
    id: `att-${attempts.length + 1}`,
    draft_id: params.p_draft_id,
    draft_revision: draft.revision,
    generation_input_revision: epoch,
    owner_user_id: params.p_owner_user_id,
    locale: params.p_locale,
    deploy_version: params.p_deploy_version,
    lifecycle_state: "started",
    correlation_id: params.p_correlation_id,
    provider_timeout_ms: params.p_provider_timeout_ms,
    model: params.p_model,
    structured_output_mode: params.p_structured_output_mode,
    max_tokens: params.p_max_tokens,
    boundary_mode: params.p_boundary_mode,
    boundary_constraint_count: params.p_boundary_constraint_count,
    attempt_number: params.p_attempt_number,
    source_event_id: params.p_source_event_id,
  };
  attempts.push(row);
  return {
    data: [
      {
        admitted: true,
        attempt_id: row.id,
        generation_input_revision: epoch,
        generation_locale: params.p_locale,
        refusal_count: count,
        state: "admitted",
        requires_explicit_confirmation: false,
        review_setup_recommended: count >= 1,
      },
    ],
    error: null,
  };
}

/** Attach `.rpc()` to a fake Supabase client built around these row arrays. */
export function withGovernedRpc<T extends object>(
  client: T,
  drafts: FakeRow[],
  attempts: FakeRow[],
  /** Simulates the admission call itself failing — the fail-before-spend condition. */
  opts: { admissionFails?: () => boolean } = {},
): T {
  return Object.assign(client, {
    rpc: async (name: string, params: GovernedRpcParams) => {
      if (name !== "start_foundry_practice_generation_attempt_governed_v1") {
        return { data: null, error: { code: "42883", message: "unknown_function" } };
      }
      if (opts.admissionFails?.()) return { data: null, error: { code: "42501", message: "denied" } };
      return fakeGovernedAdmission(params, drafts, attempts);
    },
  });
}

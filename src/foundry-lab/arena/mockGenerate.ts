/**
 * BTY FOUNDRY LAB — deterministic mock generator (M0).
 *
 * Stands in for `generateProgram` when `--provider mock` is used, so the WHOLE harness (runner,
 * persistence, resume, evaluation, reporting) can be exercised with no model and no cost. It
 * writes ledger rows through the same capture the real generator would, and its outcome depends
 * only on the case id and the repair flag — never on time or randomness.
 *
 * It is plumbing verification only. A mock result is never a measurement of the Training Builder,
 * and every report from a mock run says `provider_mode: mock`.
 */
import { sha256 } from "./manifest";
import type { GenerateFn } from "./adapter";
import type { LedgerCapture } from "./ledgerCapture";

type Args = Parameters<GenerateFn>[1];

export const mockGenerate: GenerateFn = async (admin, args: Args) => {
  const ledger = admin as unknown as LedgerCapture;
  const bucket = parseInt(sha256(args.answers.observableBehavior ?? "").slice(0, 2), 16) % 4;
  // bucket 0 → refused first time (repairable), 1 → service retry then valid, 2/3 → valid first pass.
  const refuse = bucket === 0 && !args.repairAfterRefusal;
  const retried = bucket === 1;
  const attempt = await ledger.from("foundry_program_generation_attempts").insert({ proposal_version: "mock", deploy_version: args.deployVersion, locale: args.locale }).select("id").maybeSingle();
  const attemptId = (attempt.data as { id: string }).id;
  const calls = retried ? 2 : 1;
  for (let i = 0; i < calls; i++) {
    const last = i === calls - 1;
    await ledger.from("foundry_program_generation_attempt_calls").insert({
      attempt_id: attemptId,
      call_sequence: i + 1,
      call_kind: i === 0 ? "authorship" : "authorship_retry",
      model: "mock",
      outcome: last && !refuse ? "success" : "schema_invalid",
      prompt_tokens: 1000,
      completion_tokens: 200,
      total_tokens: 1200,
      duration_ms: 5,
      finish_reason: "stop",
    });
  }
  if (refuse) {
    await ledger.from("foundry_program_generation_attempts").update({ outcome: "validation_refused", refusal_code: "non_observable_standard" }).eq("id", attemptId);
    return { ok: false, code: "invalid_output", refusal: "non_observable_standard", refusalKind: "observable_standard" };
  }
  const a = args.answers;
  const el = (kind: string, content: string) => ({ kind, content, rationale: "mock" });
  const proposal = {
    displayTitle: a.title ?? "Mock training",
    elements: [
      el("why_it_matters", a.problem ?? ""),
      el("observable_standard", a.observableBehavior ?? ""),
      el("action_decision", `I will ${String(a.observableBehavior ?? "").replace(/\.$/, "").toLowerCase()}.`),
      el("field_application", `Next time: ${a.recurringMoment}.`),
      el("completion_check", "When will this next come up for you?"),
      el("follow_up", "In seven days you will be asked what you did."),
      el("evidence", a.successEvidence ?? ""),
    ],
    assumptions: [],
    warnings: [],
    evidenceLanguage: "",
    behaviorContract: null,
    scenarioContract: null,
    applicationContract: { applicationMoment: "The next time this happens" },
    completionContract: { verificationTarget: "the_behaviour", responseMode: "name_the_moment" },
    followUpContract: { reviewFocus: "what_you_said", confirmer: "self_report" },
    operationalConstruct: null,
  };
  await ledger.from("foundry_program_generation_attempts").update({ outcome: "success" }).eq("id", attemptId);
  return { ok: true, value: { proposal: proposal as never, version: "mock" }, attemptId, contextFingerprint: "" };
};

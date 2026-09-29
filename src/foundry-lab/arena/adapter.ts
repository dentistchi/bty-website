/**
 * BTY FOUNDRY LAB — Arena adapter (M0).
 *
 * Runs ONE candidate program through the production generator, unchanged:
 * `generateProgram` from `programAuthorshipService` — the same prompt, strict JSON schema,
 * `validateProgramProposal`, bounded retry (MAX_ATTEMPTS = 2) and refusal vocabulary the Builder
 * uses. The only substitution is the ledger client (see `ledgerCapture.ts`).
 *
 * PIPELINES.
 *   generator — one `generateProgram` call, exactly as the detailed builder issues it.
 *   simple    — Simple Mode's product rule on top: a content refusal is followed by ONE more
 *               `generateProgram` carrying `repairAfterRefusal`, never more.
 */
import { randomUUID } from "node:crypto";
import { generateProgram } from "@/lib/bty/foundry/events/programAuthorshipService";
import {
  PROGRAM_REJECT_CODES,
  programContext,
  programContextFingerprint,
  type ProgramProposal,
  type ProgramRejectCode,
} from "@/domain/foundry/module/program-authorship";
import { LedgerCapture, type CapturedRow } from "./ledgerCapture";
import type { BenchmarkCase } from "./manifest";

export type Pipeline = "generator" | "simple";
export const PIPELINES: readonly Pipeline[] = ["generator", "simple"];

const ATTEMPTS_TABLE = "foundry_program_generation_attempts";
const CALLS_TABLE = "foundry_program_generation_attempt_calls";

export type ProgramAttemptRecord = {
  /** 1 for the first program; 2 only for the simple pipeline's product-level repair. */
  program_attempt: number;
  repair_after_refusal: string | null;
  ok: boolean;
  error_code: string | null;
  refusal_code: string | null;
  refusal_kind: string | null;
  proposal_version: string | null;
  /** The attempt row exactly as the production ledger would have stored it. */
  ledger_attempt: CapturedRow | null;
  /** Its provider-call rows (1, or 2 when the service's own bounded retry ran). */
  ledger_calls: CapturedRow[];
  elapsed_ms: number;
};

export type GenerationOutcome = {
  ok: boolean;
  pipeline: Pipeline;
  final_error_code: string | null;
  final_refusal_code: string | null;
  final_refusal_kind: string | null;
  proposal: ProgramProposal | null;
  proposal_version: string | null;
  attempts: ProgramAttemptRecord[];
  elapsed_ms: number;
};

export type GenerateFn = typeof generateProgram;

export async function runGeneration(
  c: BenchmarkCase,
  opts: { pipeline: Pipeline; sourceSha: string; generate?: GenerateFn },
): Promise<GenerationOutcome> {
  const generate = opts.generate ?? generateProgram;
  const ctx = programContext(c.answers);
  if (!ctx) throw new Error(`case ${c.case_id} has incomplete program context`);
  const fingerprint = programContextFingerprint(ctx);
  // The ledger requires a 40-hex deploy version; the source SHA is exactly that.
  const deployVersion = /^[0-9a-f]{40}$/.test(opts.sourceSha) ? opts.sourceSha : "0".repeat(40);
  const t0 = Date.now();
  const attempts: ProgramAttemptRecord[] = [];

  const once = async (programAttempt: number, repair?: ProgramRejectCode): Promise<ProgramAttemptRecord> => {
    const ledger = new LedgerCapture();
    const draftId = randomUUID();
    const ownerUserId = randomUUID();
    const t = Date.now();
    const r = await generate(ledger as never, {
      draftId,
      ownerUserId,
      submissionIntentId: randomUUID(),
      answers: c.answers,
      ctx,
      locale: c.locale,
      deployVersion,
      correlationId: randomUUID(),
      ...(repair ? { repairAfterRefusal: repair } : {}),
      reloadDraftState: async () => ({ draftId, ownerUserId, status: "draft", fingerprint }),
    });
    const attemptRow = ledger.rows(ATTEMPTS_TABLE)[0] ?? null;
    return {
      program_attempt: programAttempt,
      repair_after_refusal: repair ?? null,
      ok: r.ok,
      error_code: r.ok ? null : r.code,
      refusal_code: r.ok ? null : (r.refusal ?? null),
      refusal_kind: r.ok ? null : (r.refusalKind ?? null),
      proposal_version: r.ok ? r.value.version : ((attemptRow?.proposal_version as string | undefined) ?? null),
      ledger_attempt: attemptRow,
      ledger_calls: ledger.rows(CALLS_TABLE).sort((a, b) => Number(a.call_sequence ?? 0) - Number(b.call_sequence ?? 0)),
      elapsed_ms: Date.now() - t,
      ...(r.ok ? { proposal: r.value.proposal } : {}),
    } as ProgramAttemptRecord & { proposal?: ProgramProposal };
  };

  let last = await once(1);
  attempts.push(last);
  const repairable = !last.ok && last.error_code === "invalid_output" && !!last.refusal_code && (PROGRAM_REJECT_CODES as readonly string[]).includes(last.refusal_code);
  if (opts.pipeline === "simple" && repairable) {
    last = await once(2, last.refusal_code as ProgramRejectCode);
    attempts.push(last);
  }
  const proposal = (last as ProgramAttemptRecord & { proposal?: ProgramProposal }).proposal ?? null;
  for (const a of attempts) delete (a as { proposal?: unknown }).proposal;
  return {
    ok: last.ok,
    pipeline: opts.pipeline,
    final_error_code: last.error_code,
    final_refusal_code: last.refusal_code,
    final_refusal_kind: last.refusal_kind,
    proposal,
    proposal_version: last.proposal_version,
    attempts,
    elapsed_ms: Date.now() - t0,
  };
}

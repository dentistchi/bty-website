import type { SupabaseClient } from "@supabase/supabase-js";
import { getLlmClient, getLlmModel, isLlmAvailable, type LlmChatMessage } from "@/lib/bty/llm/client";
import {
  validateProgramProposal,
  requiredProgramKinds,
  programContextFingerprint,
  repairInstruction,
  isStructuralCode,
  PROGRAM_AUTHORSHIP_VERSION,
  PROGRAM_JSON_SCHEMA,
  PROGRAM_SCHEMA_NAME,
  type ProgramContext,
  type ProgramValidated,
  type StructuralDiagnosis,
} from "@/domain/foundry/module/program-authorship";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";
import { staleReason, type DraftAuthorshipState } from "@/domain/foundry/module/program-generation-lease";
import {
  startProgramAttempt,
  finalizeProgramAttempt,
  startProgramCall,
  finalizeProgramCall,
  digestProgramResponse,
  type ProgramAttemptOutcome,
} from "./programGenerationRecorder";

/**
 * Whole-program authorship — generation service (server-only, Slice 3.2L).
 *
 * ONE call produces ONE complete participant-shaped program from the Host's intent. This
 * is deliberately not a field-suggestion widget: the Builder already has two of those,
 * and neither ever lets BTY say "here is the training I created for you".
 *
 * The model PROPOSES; the domain validator DECIDES, fail-closed. On unavailable /
 * timeout / provider error, or output the validator rejects after one bounded retry,
 * this returns a stable code. NO deterministic fabrication, NO partial success, and NO
 * draft mutation — a proposal reaches the database only if the Host applies it.
 *
 * The provider never sees a draft id, a user id or any identifier; only the Host's own
 * canonical text. Raw output is never returned to the client or persisted — only its
 * digest and shape.
 */

const LLM_TIMEOUT_MS = 45_000;
const MAX_ATTEMPTS = 2; // one bounded retry, for present-but-invalid output only
const MAX_TOKENS = 2600;
/**
 * What the OBSERVABILITY ledger records. The existing CHECK vocabulary already has a
 * value for strict schema, so this needs no migration — the transport sends
 * `response_format.type = "json_schema"`, which is the provider's spelling of the same
 * thing.
 */
const STRUCTURED_MODE = "json_schema_strict" as const;

/**
 * Does this transport error mean the endpoint/model cannot honour a strict JSON Schema?
 * Matching is deliberately narrow — an unrelated 400 must stay a provider error, never be
 * mistaken for a capability gap. Same rule the practice arc uses.
 */
function isStructuredOutputUnsupported(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  if (!/\b(400|404|422)\b/.test(msg)) return false;
  return /response_format|json_schema|structured output|schema/i.test(msg);
}

export type ProgramGenerateErrorCode =
  | "provider_unavailable"
  | "timeout"
  | "provider_error"
  | "invalid_output"
  | "duplicate_intent"
  /** The draft changed while the provider was working — the proposal is unusable. */
  | "stale_context";

export type ProgramGenerateResult =
  | { ok: true; value: ProgramValidated; attemptId: string | null; contextFingerprint: string }
  | { ok: false; code: ProgramGenerateErrorCode; refusal?: string };

function logOutcome(outcome: string, code?: string): void {
  // Outcome and code only — never the Host's intent or the generated program.
  console.info(`[programAuthorship] ${outcome}${code ? ` code=${code}` : ""}`);
}

function stripJsonFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

const KIND_BRIEF: Record<string, string> = {
  why_it_matters:
    "why this change matters, written FOR the participants. NEVER restate the manager's complaint back at them — reframe it as what is at stake for the people doing the work and for whoever depends on them.",
  observable_standard: "the concrete standard, phrased so another person could see or hear whether it happened.",
  scenario:
    "one short realistic situation from THIS team's work where the behavior is hard to hold. Ground it only in what the host described — invent no policy number, no named person, no incident, no date.",
  reflection: "one question that makes the participant examine their own current practice honestly.",
  action_decision:
    "one specific commitment the participant makes. It must COMMIT to an action ('I will …'), not merely invite thought.",
  field_application: "where in real work this shows up next: who does what, and when.",
  evidence: "what the host would look for in real work. State what it does and does NOT prove.",
  completion_check:
    "ONE question answered after the material. Specific to the behavior, requiring a concrete decision or application. Not yes/no, not a feelings prompt, not a summary request.",
  follow_up: "what happens at the follow-up: what the participant will be asked, and what it can honestly show.",
};

function systemPrompt(locale: "en" | "ko", required: readonly string[], evidenceCeiling: string): string {
  const isKo = locale === "ko";
  return [
    "You are a workplace training designer. You write the PARTICIPANT-FACING program — the words the team will read. Neutral, practical, respectful. Not a mentor, not a coach, not a character.",
    "The host has described a real recurring problem and the behavior they want. Turn that into ONE coherent training program.",
    "",
    "ELEMENTS TO WRITE — exactly these kinds, no others:",
    ...required.map((k) => `- ${k}: ${KIND_BRIEF[k] ?? k}`),
    "",
    "HARD RULES:",
    "- Invent NO facts. No policy numbers, no form codes, no dates, no named people, no incidents, no metrics, no regulations the host did not state.",
    "- Never claim any material, file, checklist, video or document already exists or is attached. The host supplies the material.",
    "- DO NOT INFER THE CONTENTS OF LINKED MATERIAL. A link proves a video or file exists; it tells you nothing about what is inside it. Never describe a template, checklist, form or instruction as being 'in the video' or 'provided'.",
    "- Never state or assume that a template, form, checklist, guide, policy, tool, system or dashboard EXISTS, or that anyone has access to one, unless the context above names it explicitly. Do not assume it in an assumption either — an assumption is not evidence.",
    "- A desired OUTPUT is not an existing RESOURCE. 'Handoff record' as success evidence means the record is what the host wants produced; it does NOT mean a handoff record template exists.",
    "- When a new artifact would help, describe CREATING it as a future action: 'agree on the required fields and create a shared handoff record'. Never 'use the handoff record template'.",
    "- Never evaluate a person's worth, loyalty, character, attitude or competence. Describe actions and situations only.",
    "- Never use internal system vocabulary: evidence ladder, capability candidate, learning need, module, journey element, builder step. Participants must never see it.",
    `- EVIDENCE HONESTY. ${evidenceCeiling} Never claim behavior changed, was verified, was mastered, is permanent, or that trust was restored.`,
    "- Each element must say something DIFFERENT. Do not restate one section in another.",
    "- The action decision must share the vocabulary of the standard — they are about the same behavior.",
    "",
    "Also give a short learner-facing program title, the assumptions the program depends on, warnings when training alone will not fix the problem (a workflow, staffing, access or policy change may be needed), and one sentence of evidence_language stating plainly what completing this program can and cannot show.",
    `Write ALL participant-facing text in ${isKo ? "Korean" : "English"}.`,
    "",
    "Output ONLY a compact JSON object — no markdown, no fences, no commentary. EXACT shape:",
    '{"program":{"display_title":string,"elements":[{"kind":string,"content":string,"rationale":string}],"assumptions":string[],"warnings":string[],"evidence_language":string}}',
  ].join("\n");
}

/** The honest ceiling on what THIS configuration can establish. */
export function evidenceCeilingFor(ctx: ProgramContext): string {
  const parts = ["Reading or watching the material can show only that people were exposed to it."];
  if (ctx.completionPrompt) parts.push("A written answer shows reflection, not competence.");
  if (ctx.learningNeeds.includes("decide")) parts.push("An action decision records a decision, never a completed action.");
  if (ctx.arenaRecommended) parts.push("Practice is rehearsal, never field mastery.");
  if (ctx.followUpDays > 0) parts.push("A scheduled self-report is what someone says they did, not observed behavior.");
  parts.push("Nothing here can show sustained change.");
  return parts.join(" ");
}

function userPrompt(ctx: ProgramContext): string {
  const lines = [
    `The recurring problem: ${ctx.problemStatement}`,
    `Who needs to change: ${ctx.audienceType}${ctx.audienceDetail ? ` — ${ctx.audienceDetail}` : ""}`,
    ctx.capabilityCandidate ? `The ability being built: ${ctx.capabilityCandidate}` : null,
    `The behavior expected afterwards: ${ctx.observableBehavior}`,
    `What the host would look for in real work: ${ctx.successEvidence}`,
    `What the training must include: ${ctx.learningNeeds.join(", ") || "information"}`,
    ctx.arenaRecommended ? "The team will also rehearse this under pressure." : null,
    ctx.followUpDays > 0 ? `The host will check back after ${ctx.followUpDays} days.` : "There is no scheduled follow-up.",
    ctx.sharedQuestion ? `The host already asks participants: ${ctx.sharedQuestion}` : null,
    ctx.materialIntent ? `Participants will learn from: ${ctx.materialIntent}` : null,
  ].filter(Boolean) as string[];
  return lines.join("\n");
}

type CallOutcome = {
  ok: boolean;
  parsed?: unknown;
  raw?: string;
  code: ProgramGenerateErrorCode | null;
  httpStatus?: number | null;
  errorCategory?: string | null;
  finishReason?: string | null;
  usage?: { prompt?: number; completion?: number; total?: number };
};

async function invoke(messages: LlmChatMessage[]): Promise<CallOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const completion = await getLlmClient().chat.completions.create(
      {
        model: getLlmModel(),
        messages,
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: MAX_TOKENS,
        // STRICT structured output (Slice 3.2L-R3). The fourth controlled window burned
        // both calls on a non-string element field that `json_object` could never have
        // prevented. The shape is now enforced by the transport; a provider that rejects
        // the schema fails CLOSED rather than silently downgrading to free-form JSON.
        response_format: {
          type: "json_schema",
          json_schema: { name: PROGRAM_SCHEMA_NAME, strict: true, schema: PROGRAM_JSON_SCHEMA },
        },
      },
      { signal: controller.signal },
    );
    const choice = completion.choices?.[0];
    const raw = choice?.message?.content;
    const usage = (completion as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }).usage;
    const meta = {
      finishReason: choice?.finish_reason ?? null,
      usage: { prompt: usage?.prompt_tokens, completion: usage?.completion_tokens, total: usage?.total_tokens },
    };
    if (!raw) return { ok: false, code: "invalid_output", ...meta };
    try {
      return { ok: true, parsed: JSON.parse(stripJsonFences(raw)), raw, code: null, ...meta };
    } catch {
      return { ok: false, code: "invalid_output", raw, ...meta };
    }
  } catch (e) {
    if (controller.signal.aborted) return { ok: false, code: "timeout", errorCategory: "aborted" };
    if (isStructuredOutputUnsupported(e)) {
      // Never downgrade to unconstrained JSON to obtain an answer.
      return { ok: false, code: "provider_error", errorCategory: "bad_request" };
    }
    const status = (e as { status?: number })?.status ?? null;
    return {
      ok: false,
      code: "provider_error",
      httpStatus: status,
      errorCategory: status === 429 ? "rate_limited" : status === 401 ? "unauthorized" : status && status >= 500 ? "server_error" : "unknown",
    };
  } finally {
    clearTimeout(timer);
  }
}

const ATTEMPT_OUTCOME: Record<ProgramGenerateErrorCode, ProgramAttemptOutcome> = {
  provider_unavailable: "provider_unavailable",
  timeout: "provider_timeout",
  provider_error: "provider_transport_error",
  invalid_output: "validation_refused",
  duplicate_intent: "internal_failure",
  stale_context: "stale_context",
};

/**
 * Author one program, or fail closed. Every provider call and every terminal state is
 * recorded durably; recording never blocks the product.
 */
export async function generateProgram(
  admin: SupabaseClient,
  args: {
    draftId: string;
    ownerUserId: string;
    submissionIntentId: string;
    answers: BuilderAnswers;
    ctx: ProgramContext;
    locale: "en" | "ko";
    deployVersion: string;
    correlationId: string;
    /**
     * Titles of materials the application has VERIFIED — currently uploaded file names.
     * These may ground an artifact's EXISTENCE. A URL never appears here: a link proves a
     * material exists, not what is inside it, and nothing retrieves those contents.
     */
    verifiedArtifacts?: readonly string[];
    /**
     * Re-read the draft's authorship state AFTER the provider returns. Supplied by the
     * caller so this service still owns no database reads of its own beyond the ledger.
     */
    reloadDraftState: () => Promise<DraftAuthorshipState | null>;
  },
): Promise<ProgramGenerateResult> {
  const fingerprint = programContextFingerprint(args.ctx);
  const required = requiredProgramKinds(args.answers);

  const started = await startProgramAttempt(admin, {
    draftId: args.draftId,
    ownerUserId: args.ownerUserId,
    submissionIntentId: args.submissionIntentId,
    contextFingerprint: fingerprint,
    proposalVersion: PROGRAM_AUTHORSHIP_VERSION,
    locale: args.locale,
    deployVersion: args.deployVersion,
    correlationId: args.correlationId,
  });
  if (!started.ok && started.duplicate) {
    logOutcome("duplicate_intent");
    return { ok: false, code: "duplicate_intent" };
  }
  const attemptId = started.ok ? started.attemptId : null;
  const t0 = Date.now();

  /**
   * The parent records how the attempt ENDED. Every structural fact lives on the child
   * call that produced it — an attempt makes up to two calls that can fail differently,
   * so a single parent column could only ever hold one of them.
   */
  const finish = async (code: ProgramGenerateErrorCode, refusal?: string, refusalKind?: string) => {
    if (attemptId) {
      await finalizeProgramAttempt(admin, {
        attemptId,
        outcome: ATTEMPT_OUTCOME[code],
        durationMs: Date.now() - t0,
        refusalCode: refusal ?? null,
        refusalKind: refusalKind ?? null,
      });
    }
    logOutcome("failed", refusal ?? code);
    return { ok: false as const, code, refusal };
  };

  if (!isLlmAvailable()) {
    if (attemptId) {
      await finalizeProgramAttempt(admin, { attemptId, outcome: "provider_unavailable", durationMs: Date.now() - t0 });
    }
    logOutcome("provider_unavailable");
    return { ok: false, code: "provider_unavailable" };
  }

  const base: LlmChatMessage[] = [
    { role: "system", content: systemPrompt(args.locale, required, evidenceCeilingFor(args.ctx)) },
    { role: "user", content: userPrompt(args.ctx) },
  ];

  let lastCode: ProgramGenerateErrorCode = "invalid_output";
  let lastRefusal: string | undefined;
  let lastRefusalKind: string | undefined;
  /** The exact shape fault the repair call must fix. Never carries model prose. */
  let lastDiagnosis: StructuralDiagnosis | undefined;
  /** A meaning fault is not repairable by asking again — only a shape fault is. */
  let repairable = false;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const messages: LlmChatMessage[] =
      i === 0
        ? base
        : [
            ...base,
            {
              role: "user" as const,
              // TARGETED. The fourth controlled window handed the model only a code name
              // ("field_type"), so it could not know which field was wrong and produced the
              // same fault twice. This names the exact path and the type actually received.
              content: lastDiagnosis
                ? `Your previous response had one formatting problem: ${repairInstruction(lastDiagnosis)} Return the SAME program with only that corrected. Return ONLY the JSON object.`
                : `The previous response could not be read. Return ONLY the JSON object, exactly in the required shape.`,
            },
          ];

    const callId = attemptId
      ? await startProgramCall(admin, {
          attemptId,
          callKind: i === 0 ? "authorship" : "authorship_retry",
          callSequence: i + 1,
          model: getLlmModel(),
          providerTimeoutMs: LLM_TIMEOUT_MS,
          structuredOutputMode: STRUCTURED_MODE,
          maxTokens: MAX_TOKENS,
        })
      : null;

    const c0 = Date.now();
    const r = await invoke(messages);
    const digest = r.raw ? await digestProgramResponse(r.raw) : null;

    if (!r.ok) {
      if (callId) {
        await finalizeProgramCall(admin, {
          callId,
          outcome: r.code === "timeout" ? "timeout" : r.code === "provider_error" ? (r.httpStatus ? "http_error" : "transport_error") : r.raw ? "malformed_output" : "empty_output",
          durationMs: Date.now() - c0,
          providerHttpStatus: r.httpStatus ?? null,
          providerErrorCategory: r.errorCategory ?? null,
          finishReason: r.finishReason ?? null,
          promptTokens: r.usage?.prompt ?? null,
          completionTokens: r.usage?.completion ?? null,
          totalTokens: r.usage?.total ?? null,
          responseBytes: digest?.bytes ?? null,
          responseSha256: digest?.sha256 ?? null,
        });
      }
      lastCode = r.code ?? "invalid_output";
      if (lastCode !== "invalid_output") return finish(lastCode);
      continue;
    }

    const validated = validateProgramProposal(r.parsed, args.answers, args.verifiedArtifacts ?? []);
    if (callId) {
      await finalizeProgramCall(admin, {
        callId,
        outcome: validated.ok ? "success" : "schema_invalid",
        durationMs: Date.now() - c0,
        finishReason: r.finishReason ?? null,
        promptTokens: r.usage?.prompt ?? null,
        completionTokens: r.usage?.completion ?? null,
        totalTokens: r.usage?.total ?? null,
        responseBytes: digest?.bytes ?? null,
        responseSha256: digest?.sha256 ?? null,
        // THIS call's own diagnosis, written before the loop moves on — so a repair call
        // can never overwrite what call 1 proved. A structural fault carries its exact
        // path; a semantic one records only that it was a meaning fault and where.
        diagnosis: validated.ok
          ? null
          : validated.diagnosis
            ? { ...validated.diagnosis }
            : {
                stage: "semantic",
                path: validated.kind ? `elements.${validated.kind}` : "program",
                expected: "a grounded, honest value",
                actual: "string",
                retryable: false,
              },
      });
    }

    if (validated.ok) {
      // POST-PROVIDER REVALIDATION (Slice 3.2L-R1). The draft is reloaded and compared
      // against the state generation was ADMITTED on. Measured live: a draft was
      // published mid-flight and the generation still recorded success. A proposal for a
      // draft that has been published, deleted, or edited underneath is not a success —
      // it is unusable, and saying otherwise would be the dishonesty this repair exists
      // to remove. Recorded as `stale_context`, an outcome the vocabulary already had.
      const admitted: DraftAuthorshipState = {
        draftId: args.draftId,
        ownerUserId: args.ownerUserId,
        status: "draft",
        fingerprint,
      };
      const stale = staleReason(admitted, await args.reloadDraftState());
      if (stale) {
        if (attemptId) {
          await finalizeProgramAttempt(admin, { attemptId, outcome: "stale_context", durationMs: Date.now() - t0 });
        }
        logOutcome("stale_after_provider", stale);
        return { ok: false, code: "stale_context", refusal: stale };
      }

      if (attemptId) {
        await finalizeProgramAttempt(admin, {
          attemptId,
          outcome: "success",
          durationMs: Date.now() - t0,
          elementCount: validated.value.proposal.elements.length,
          requiredKindCount: required.length,
        });
      }
      logOutcome(i === 0 ? "authored" : "authored_on_retry");
      return { ok: true, value: validated.value, attemptId, contextFingerprint: fingerprint };
    }

    lastCode = "invalid_output";
    lastRefusal = validated.code;
    lastRefusalKind = validated.kind;
    lastDiagnosis = validated.diagnosis;
    repairable = isStructuralCode(validated.code);
    logOutcome("rejected", validated.code);
    // A SEMANTIC refusal — a fabricated template, an overclaim — is not repaired by
    // asking again. Retrying spends a second call to be told the same thing, so the loop
    // stops here and the Host gets an honest answer sooner.
    if (!repairable) break;
  }

  return finish(lastCode, lastRefusal, lastRefusalKind);
}

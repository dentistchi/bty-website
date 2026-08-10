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
  deriveMaterialAuthority,
  isSemanticRepairableCode,
  type ProgramRejectCode,
  semanticRepairInstruction,
  evidenceClaimBrief,
  materialAuthorityBrief,
  type MaterialAuthority,
} from "@/domain/foundry/module/program-authorship";
import { proposalDigest } from "@/domain/foundry/module/proposal-digest";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";
import {
  CONTRACT_FIELD_STORAGE,
  deriveOperationalConstruct,
  scenarioPressurePromptLines,
  type OperationalConstruct,
} from "@/domain/foundry/module/program-coherence";
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
  observable_standard:
    "the concrete standard. Write it as ONE sentence describing a visible repeatable behavior — it must match the behavior_contract you also return.",
  scenario:
    "one short realistic situation where the behavior is hard to hold AT THE MOMENT THE TRIGGER NAMES. It must match the scenario_contract you also return, and must not move the action to another occasion. Invent no policy number, no named person, no incident, no date.",
  reflection: "one question that makes the participant examine their own current practice honestly.",
  action_decision:
    "one specific commitment the participant makes. It must COMMIT to an action ('I will …'), not merely invite thought.",
  field_application: "where in real work this shows up next: who does what, and when.",
  evidence: "what the host would look for in real work. State what it does and does NOT prove.",
  completion_check:
    "ONE question answered after the material. Specific to the behavior, requiring a concrete decision or application. Not yes/no, not a feelings prompt, not a summary request.",
  follow_up: "what happens at the follow-up: what the participant will be asked, and what it can honestly show.",
};

/**
 * Exported for the generator-contract test (Slice 3.2O-R1) — the prompt is half of a contract
 * whose other half is a validator, and a rule that lives only in a string literal is one
 * refactor away from silently covering one field instead of two. Asserting the composed
 * prompt is the only way to hold the two halves together.
 */
export function systemPrompt(
  locale: "en" | "ko",
  required: readonly string[],
  evidenceCeiling: string,
  material: MaterialAuthority,
  evidenceClaims: readonly string[],
): string {
  const isKo = locale === "ko";
  return [
    "You are a workplace training designer. You write the PARTICIPANT-FACING program — the words the team will read. Neutral, practical, respectful. Not a mentor, not a coach, not a character.",
    "The host has described a real recurring problem and the behavior they want. Turn that into ONE coherent training program.",
    "",
    "ELEMENTS TO WRITE — exactly these kinds, no others:",
    ...required.map((k) => `- ${k}: ${KIND_BRIEF[k] ?? k}`),
    "",
    /*
      Stated BEFORE the prohibitions (Slice 3.2L-R11.4G). The one authorized canonical
      generation was refused for `material_fabrication` — correctly — because the model was
      told only what it must not claim and left to guess what it was allowed to author with
      no materials. The answer is: everything, self-contained. It now reads that first.
    */
    ...materialAuthorityBrief(material),
    "",
    /*
      The second refusal, `cdd16aaf`, was `evidence_overclaim` while this prompt already
      carried a ceiling — but the ceiling described what the training CANNOT show, and the
      outcome ban named five nouns against a validator that refuses ~30. Derived from the
      validator's own set, allowed claims first (Slice 3.2L-R11.4H).
    */
    ...evidenceClaims,
    "",
    "HARD RULES:",
    "- Invent NO facts. No policy numbers, no form codes, no dates, no named people, no incidents, no metrics, no regulations the host did not state.",
    "- Never claim any material, file, checklist, video or document already exists or is attached. The host supplies the material.",
    "- DO NOT INFER THE CONTENTS OF LINKED MATERIAL. A link proves a video or file exists; it tells you nothing about what is inside it. Never describe a template, checklist, form or instruction as being 'in the video' or 'provided'.",
    "- Never state or assume that a template, form, checklist, guide, policy, tool, system or dashboard EXISTS, or that anyone has access to one, unless the context above names it explicitly. Do not assume it in an assumption either — an assumption is not evidence.",
    "- A desired OUTPUT is not an existing RESOURCE. 'Handoff record' as success evidence means the record is what the host wants produced; it does NOT mean a handoff record template exists.",
    "- When a new artifact would help, refer to CREATING it as a future action — 'agree on the required fields and create a shared handoff record' — never 'use the handoff record template'. This applies to NARRATIVE sections only, never to behavior_contract.",
    "- Never evaluate a person's worth, loyalty, character, attitude or competence. Describe actions and situations only.",
    "- Never use internal system vocabulary: evidence ladder, capability candidate, learning need, module, journey element, builder step. Participants must never see it.",
    `- EVIDENCE HONESTY. ${evidenceCeiling} Never claim behavior changed, was verified, was mastered, is permanent, or that trust was restored.`,
    "- Each element must say something DIFFERENT. Do not restate one section in another.",
    "- The action decision must share the vocabulary of the standard — they are about the same behavior.",
    "",
    // ---- Slice 3.2L-R4 — defence in depth for the behavioral contract and the program's
    // internal order. The deterministic validator is the authority; this is here so the
    // model has a chance to get it right on the first call rather than being refused.
    "WHAT YOU ARE AUTHORISED TO DESIGN:",
    "- DESIGNING A FUTURE BEHAVIOR IS NOT INVENTING A FACT. Proposing what a person should do from now on is exactly your job. The 'invent nothing' rules above are about the world as it is TODAY — existing templates, approvals, access, tools, results — not about what you propose people start doing.",
    "- So you MAY choose a concrete visible action even when the host did not spell one out. Ground it in their problem and context; it does not have to be quoted from them.",
    "- ALLOWED (designing future behavior): 'states each unfinished item aloud'; 'identifies who owns the next action'; 'confirms the agreed next step'; 'repeats back what will happen next'.",
    "- FORBIDDEN (claiming today's reality): 'the team already follows this standard'; 'the approved standard requires these steps'; 'use the existing template fields'; 'record it in the tool everyone already has'; 'the manager observes and scores it'; 'this has already improved handoffs'.",
    "- Those are illustrations of the boundary, not a menu. Choose the behavior THIS host's problem actually needs.",
    "",
    "THE STANDARD — behavior_contract:",
    "- THE STANDARD must define a VISIBLE REPEATABLE BEHAVIOR. It must NOT merely say that a standard, process or framework will be created, adopted or used.",
    "- Return behavior_contract with: actor (who performs it), trigger (the moment it must happen), observable_action (what another person can SEE or HEAR the actor doing), and completion.",
    "- completion has TWO parts: confirmed_by (WHO confirms — a person or role) and confirmation_action (what you would SEE THEM DO, in base form: 'repeat back who owns the next step'). Never write a bare phrase like 'receive a confirmation' — say who does the confirming.",
    "- 'A shared handoff standard is created and utilized by team members' is NOT acceptable: it describes the standard's life cycle, not a person's action. Write what someone is seen doing instead.",
    "- Write observable_action in BASE form, as it would follow 'must': 'state each unfinished item and identify its next owner', not 'states … and identifies …'.",
    "- The confirming act must be something a second person could witness — a read-back, a confirmation, a signature, a logged entry. Not a feeling, and not 'the standard now exists'.",
    "- There is ONE definition of completion. Do not invent a second, different way of knowing it happened for the application step.",
    "",
    "THE PRACTICE SITUATION — scenario_contract:",
    "- Return scenario_contract with pressure_condition (what competes with doing it properly) and pressure_detail (a second circumstance, or null when one is enough).",
    "- The situation is built FROM the behavior contract, so do not invent a different actor, trigger, action or completion signal for it.",
    "- THE SITUATION HAPPENS AT THE TRIGGER. There is ONE moment in the program and behavior_contract.trigger already named it. Do NOT give the situation an occasion of its own.",
    /*
      BOTH FIELDS, NOT ONE (Slice 3.2O-R1). The rule was stated for pressure_condition only,
      while the validator has always applied it to pressure_detail too — and pressure_detail
      was introduced as "a second circumstance", which invites exactly the phrasing that is
      refused. A live pilot was refused for it.
    */
    "- THIS APPLIES TO BOTH pressure_condition AND pressure_detail. Neither may name an occasion of its own.",
    "- Forbidden in EITHER field: 'during a team meeting', 'at the next handover', 'before the deadline', 'at the end of each project', 'during the call', 'before the appointment', 'at the end of the day' — any phrase that anchors a second time or event.",
    /*
      THE OCCASION COLLISION. The trigger's own noun — call, appointment, handover, shift,
      round — is exactly the vocabulary the refusal watches for, so a scenario about the very
      thing being trained is the easiest one to fail. The model is the only party that knows
      which noun it chose, so the rule is written to be self-applied rather than parsed here.
    */
    "- In particular: whatever occasion your own behavior_contract.trigger names, do NOT restate that occasion in either pressure field. If the trigger is 'before each confirmation call', then 'during the call' is a second moment and will be refused — describe only what makes it hard.",
    /*
      DERIVED, NOT HAND-WRITTEN (Slice 3.2O-R2). The R1 version of this line was written from
      product intuition and named two categories — "workload" and "operational constraint" —
      that the pressure floor recognises nothing of. A window was then refused
      `scenario_without_pressure` against a prompt that had just recommended them. These
      lines now come from SCENARIO_PRESSURE_POLICY, the same array the validator matches on,
      so the two cannot disagree again.
    */
    "- A real difficulty is one of these, and none of them is an occasion:",
    ...scenarioPressurePromptLines(),
    "- 'A queue is building at the desk' is fine; 'during the call the patient is distracted' is not.",
    "- pressure_condition must name a real difficulty — someone is waiting, the shift ran late, the other person has already left, a senior disagrees. Not 'it is difficult' and not a restatement of the required action.",
    "",
    "THE REST OF THE PROGRAM — completion_contract, follow_up_contract:",
    "- YOUR DECISION, APPLY IT, BEFORE YOU FINISH and WHAT HAPPENS NEXT are BUILT from these. Do not write them as free sentences and expect them to be used.",
    "- Do NOT return an application moment. YOUR DECISION and APPLY IT are set at the NEXT OCCURRENCE of behavior_contract.trigger, which BTY works out itself — you have no way to know anyone\u2019s actual schedule.",
    "- So behavior_contract.trigger MUST describe something that comes round again: 'at each handoff point', 'every time a task is reassigned', 'whenever a deadline moves'. A one-off moment has no next one and the program will be refused.",
    "- Do NOT restate the actor, the action or the completion here. All three are inherited from behavior_contract.",
    "- completion_contract and follow_up_contract are CHOICES from fixed lists, not sentences. Pick the one that fits the training.",
    "- The follow-up window is already set by the host. Do not invent a different one.",
    "",
    "PROPOSING A NEW WAY OF WORKING:",
    "- You MAY propose a new standard, process, checklist or agreement. WHY THIS MATTERS may say the team is establishing one.",
    "- But the proposed thing is NEVER the trained behavior. behavior_contract describes a PERSON doing something visible, not the construct being created, adopted, supported or used.",
    "- Do NOT present it as something that already exists.",
    "- DEFINE the behavior in THE STANDARD before any later section asks the participant to use it. A participant cannot follow a standard no section has described.",
    "- BEFORE YOU FINISH verifies understanding, a decision, or an application plan. It must NOT be where the standard's contents are finally decided — never ask what elements, fields or steps the standard should contain when an earlier section already told the participant to use it.",
    "",
    "Also give a short learner-facing program title, the assumptions the program depends on, and warnings when training alone will not fix the problem (a workflow, staffing, access or policy change may be needed).",
    "- Do NOT write what the program proves. BTY states that itself, from what the journey actually records.",
    "- WHY THIS MATTERS explains the problem the host described. It must NOT promise outcomes — no claim that this improves project success, collaboration, productivity, safety or results.",
    `Write ALL participant-facing text in ${isKo ? "Korean" : "English"}.`,
    "",
    "Output ONLY a compact JSON object — no markdown, no fences, no commentary. EXACT shape:",
    '{"program":{"display_title":string,"elements":[{"kind":string,"content":string,"rationale":string}],"assumptions":string[],"warnings":string[],"behavior_contract":{"actor":string,"trigger":string,"observable_action":string,"completion":{"confirmed_by":string,"confirmation_action":string}},"scenario_contract":{"pressure_condition":string,"pressure_detail":string|null}|null,"completion_contract":{"verification_target":"the_behaviour"|"the_application_plan"|"the_confirmation_step","response_mode":"name_the_moment"|"state_what_you_will_say"|"name_what_could_stop_you"}|null,"follow_up_contract":{"review_focus":"what_you_said"|"what_happened_next"|"the_confirmation","confirmer":"self_report"|"the_other_person"|"the_host"}|null}}',
  ].join("\n");
}

/** The honest ceiling on what THIS configuration can establish. */
export function evidenceCeilingFor(ctx: ProgramContext): string {
  // Kept for the prompt's EVIDENCE HONESTY line. The Host-visible ceiling is derived in the
  // domain by `deriveEvidenceCeiling`, so there is one authority for what the program proves.
  const parts = ["Reading or watching the material can show only that people were exposed to it."];
  if (ctx.completionPrompt) parts.push("A written answer shows reflection, not competence.");
  if (ctx.learningNeeds.includes("decide")) parts.push("An action decision records a decision, never a completed action.");
  if (ctx.arenaRecommended) parts.push("Practice is rehearsal, never field mastery.");
  if (ctx.followUpDays > 0) parts.push("A scheduled self-report is what someone says they did, not observed behavior.");
  parts.push("Nothing here can show sustained change.");
  return parts.join(" ");
}

function userPrompt(
  ctx: ProgramContext,
  construct: OperationalConstruct | null,
  material: MaterialAuthority,
): string {
  const lines = [
    `The recurring problem: ${ctx.problemStatement}`,
    `Who needs to change: ${ctx.audienceType}${ctx.audienceDetail ? ` — ${ctx.audienceDetail}` : ""}`,
    ctx.capabilityCandidate ? `The ability being built: ${ctx.capabilityCandidate}` : null,
    /**
     * NOT "the behavior expected afterwards" (Slice 3.2L-R7). The canonical draft's answer
     * here is "Create a shared handoff standard" — a DESIGN INTENT, not a behaviour. Handing
     * it to the model under a behaviour label, and then refusing a standard that is about
     * creating a standard, is the contradiction that refused parent 604d09e5.
     */
    `The change the host wants: ${ctx.observableBehavior}`,
    `What the host would look for in real work: ${ctx.successEvidence}`,
    `What the training must include: ${ctx.learningNeeds.join(", ") || "information"}`,
    ctx.arenaRecommended ? "The team will also rehearse this under pressure." : null,
    ctx.followUpDays > 0 ? `The host will check back after ${ctx.followUpDays} days.` : "There is no scheduled follow-up.",
    ctx.sharedQuestion ? `The host already asks participants: ${ctx.sharedQuestion}` : null,
    /*
      Was `Participants will learn from: youtube` — a bare noun that reads like a resource
      the program can lean on, next to nothing about what may be said of it. It now states
      the authority instead of implying one (Slice 3.2L-R11.4G).
    */
    material.exists.length > 0
      ? `Material the host has pointed at (its EXISTENCE only — this system has never read its contents): ${material.exists.join(", ")}`
      : "The host has supplied no material. Write a program that stands entirely on its own.",
    /**
     * The construct's identity and its AUTHORITY MODE, system-derived from the Host's own
     * words. Until R7 this existed only in server code, so the model had no way to know it
     * was allowed to design the behaviour that gives the construct meaning.
     */
    construct
      ? `The way of working being proposed: ${construct.label} — ${
          construct.authorityMode === "proposed"
            ? "PROPOSED. It does not exist yet. You are designing what it will mean in practice."
            : construct.authorityMode === "host_grounded_existing"
              ? "the host says this already exists. Do not invent its contents."
              : "verified from material the host supplied. Do not invent contents beyond it."
        }`
      : null,
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

  /**
   * The same system-derived construct the validator uses, so the model is told what it is
   * allowed to design instead of having to guess from prohibitions.
   */
  const promptConstruct = deriveOperationalConstruct(
    {
      observableBehavior: args.answers.observableBehavior,
      successEvidence: args.answers.successEvidence,
      capabilityCandidate: args.answers.capabilityCandidate,
      problem: args.answers.problem,
    },
    args.verifiedArtifacts ?? [],
  );

  /** One authority for what may be said about materials — the same facts the validator uses. */
  const materialAuthority = deriveMaterialAuthority(args.answers, args.verifiedArtifacts ?? []);

  const base: LlmChatMessage[] = [
    { role: "system", content: systemPrompt(args.locale, required, evidenceCeilingFor(args.ctx), materialAuthority, evidenceClaimBrief(args.answers)) },
    { role: "user", content: userPrompt(args.ctx, promptConstruct, materialAuthority) },
  ];

  let lastCode: ProgramGenerateErrorCode = "invalid_output";
  let lastRefusal: string | undefined;
  let lastRefusalKind: string | undefined;
  /** The exact shape fault the repair call must fix. Never carries model prose. */
  let lastDiagnosis: StructuralDiagnosis | undefined;
  /** A shape fault, or one of the two honesty faults a targeted rewrite can fix (R11.4I). */
  let repairable = false;
  /** Set when the ONE bounded repair is a meaning fault rather than a shape fault. */
  let semanticRepairCode: ProgramRejectCode | undefined;

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
              content: semanticRepairCode
                ? semanticRepairInstruction(semanticRepairCode, args.answers)
                : lastDiagnosis
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
        // R7 — which behaviour-contract role failed, null for every other outcome.
        behaviorContract: validated.ok || !validated.contract
          ? null
          : {
              field: CONTRACT_FIELD_STORAGE[validated.contract.field],
              reason: validated.contract.reason,
            },
        // R6.1 — closed-vocabulary dependency facts, null for every other outcome.
        dependency: validated.ok || !validated.dependency
          ? null
          : {
              branch: validated.dependency.branch,
              constructKind: validated.dependency.construct,
              counterpartKind: validated.dependency.counterpartKind,
            },
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
          /*
            The identity of the exact proposal being returned for review, computed HERE from
            the validated value — never supplied by a client (Slice 3.2L-R11.3). Inert until
            the digest column exists; the recorder drops it while the gate is off.
          */
          proposalDigest: proposalDigest(validated.value.proposal, required),
        });
      }
      logOutcome(i === 0 ? "authored" : "authored_on_retry");
      return { ok: true, value: validated.value, attemptId, contextFingerprint: fingerprint };
    }

    lastCode = "invalid_output";
    lastRefusal = validated.code;
    lastRefusalKind = validated.kind;
    lastDiagnosis = validated.diagnosis;
    /*
      ONE bounded repair, under the SAME parent attempt and the same submission intent
      (Slice 3.2L-R11.4I). `MAX_ATTEMPTS` is 2, so a second refusal is terminal and no loop
      is possible. A meaning fault is repairable only for the two honesty families whose
      instruction can be written without the model's own words; everything else still ends
      the attempt immediately, because a program describing the wrong behaviour is not one
      sentence away from being right.
    */
    semanticRepairCode = isSemanticRepairableCode(validated.code) ? validated.code : undefined;
    repairable = isStructuralCode(validated.code) || semanticRepairCode !== undefined;
    logOutcome("rejected", validated.code);
    if (!repairable) break;
  }

  return finish(lastCode, lastRefusal, lastRefusalKind);
}

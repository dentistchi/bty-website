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
  repairFreezeViolated,
  repairLicenseFor,
  repairPatchContract,
  licensedRepairContext,
  applyRepairPatch,
  evidenceClaimBrief,
  materialAuthorityBrief,
  type MaterialAuthority,
} from "@/domain/foundry/module/program-authorship";
import type { JourneyElementKind } from "@/domain/foundry/module/journey";
import { proposalDigest } from "@/domain/foundry/module/proposal-digest";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";
import {
  CONTRACT_FIELD_STORAGE,
  deriveOperationalConstruct,
  pressureFramePromptLines,
  type OperationalConstruct,
} from "@/domain/foundry/module/program-coherence";
import { audienceAuthorityFor, audiencePromptLines } from "@/domain/foundry/module/audience-authority";
import { staleReason, isGenerationUuid, type DraftAuthorshipState } from "@/domain/foundry/module/program-generation-lease";
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
  | "stale_context"
  /**
   * The attempt could not be recorded, so nothing was generated (Slice 3.2P-W1-R1).
   *
   * DELIBERATELY NOT `invalid_output`, `provider_error` or `validation_refused`: no provider
   * call happened, so every one of those would describe a generation that does not exist.
   */
  | "attempt_recording_failed";

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
    "the concrete standard. Write it as ONE sentence describing a visible repeatable behavior — it must match the action_verb and action_detail you also return.",
  scenario:
    "one short realistic situation where the behavior is hard to hold AT THE MOMENT THE HOST NAMED. It must match the scenario_contract you also return, and must not move the action to another occasion. Invent no policy number, no named person, no incident, no date.",
  reflection:
    "one question about the participant's CURRENT practice. It must not assume the trained behaviour already happens — see REFLECT below.",
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
  /**
   * The Host's audience, as an authority rather than as decoration (Slice 3.2P-R3.2). Derived
   * from the SAME policy the validator consults, so the prompt cannot ask for an actor the
   * floor refuses — the parity rule R2 established for scenario pressure.
   */
  audienceLines: readonly string[] = [],
  /**
   * The host's own completion evidence (Slice 3.2P-R3.4-R1). Quoted to the model so it knows
   * completion is already decided — not so it can restate it. There is no field to put it in.
   */
  completionCriterion = "",
  /** The host's own recurring occasion (Slice 3.2P-R3.6-R1). Quoted so the model knows it is fixed. */
  recurringMoment = "",
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
    ...audienceLines,
    "",
    /*
      REFLECT MUST LEAVE ROOM FOR "IT DOESN'T HAPPEN" (Slice 3.2P-A2-R2).

      A2 succeeded on every floor and still failed Founder acceptance. Its reflection read "How
      do you currently ensure that action items are assigned to specific owners and deadlines
      during your huddles?" — a wh-question over the MANNER of an asserted proposition. It takes
      "you ensure this" as given and asks only how. The learner this training exists for is
      precisely the one for whom it does not happen; that question leaves them no truthful
      answer but an invented process.

      The instruction said only "examine their own current practice honestly", which describes
      how they should ANSWER, not what the question may ASSUME. A requirement that lives only in
      the acceptance gate is a requirement the model was never given.

      DELIBERATELY NOT A WORD RULE. Measured on seventeen labelled questions, banning `ensure` /
      `make sure` / `always` refuses ordinary reflections — "How do you currently ensure everyone
      can hear the huddle?" is fine, because what it presupposes is not the trained behaviour.
      The distinction is a RELATION between the question and the behaviour, so it is stated as
      one, and the examples below are illustrations of that relation rather than a vocabulary.
    */
    "REFLECT — the honest question:",
    "- Ask about the participant's CURRENT practice, and write it so it stays truthfully answerable by someone who does NOT do the trained behaviour today.",
    "- The answer 'it doesn't happen', 'it happens sometimes', or 'nobody does this' must all fit the question. If the only possible answers describe a working practice, the question assumes its own answer.",
    "- GOOD, because they ask what happens: 'What usually happens when an action needs an owner?'; 'How is this handled today?'",
    "- BAD, because they assume it already happens and ask only how: 'How do you ensure this always happens?'; 'How do you make sure the standard is followed?'",
    "- This is about what the question ASSUMES, not about particular words. Asking how someone ensures something UNRELATED to the trained behaviour is perfectly fine.",
    "",
    "THE STANDARD — behavior_contract:",
    "- THE STANDARD must define a VISIBLE REPEATABLE BEHAVIOR. It must NOT merely say that a standard, process or framework will be created, adopted or used.",
    "- Return behavior_contract with exactly TWO fields: action_verb and action_detail.",
    "- action_verb is ONE verb naming what the learner visibly does, in the form it takes after the word 'must': 'state', 'write', 'follow', 'sign', 'check'. Never 'states', never two words, never a person.",
    "- action_detail is the REST of that action phrase and nothing else. It is not always an object: 'follow' + 'up with the owner'; 'sign' + 'off on the checklist'; 'state' + 'the owner and deadline'.",
    /*
      POSITIVE OWNERSHIP (Slice 3.2P-R3.7). v13 said only what not to do, and W6 did it anyway —
      the model wrote the host's occasion into the action and BTY rendered it twice. The validator
      now refuses that, and this says what the field IS so the two halves describe one thing.
    */
    "- BTY supplies the rest of the sentence: WHO does it, WHEN it happens, HOW OFTEN, and WHAT SHOWS it was done. Write none of them into either field.",
    "- CORRECT: action_verb 'state', action_detail 'the owner, action, and deadline for each agreed item'.",
    "- WRONG: action_verb 'you' or 'the leader' (BTY writes the subject); action_detail '… during the weekly meeting' (BTY writes the moment); action_detail '… until it is recorded' (BTY writes the evidence).",
    /*
      WHO and WHEN ARE SETTLED (Slice 3.2P-R3.6-R1). Both were model fields until v12 and both
      drifted: W3 named "a team member" for a `leaders` audience, and W5 died on a moment the
      Host had already stated three times. The schema no longer has either field, so these lines
      explain the absence rather than prohibit a field that exists.
    */
    `- WHO does it is already settled: the program speaks to the learner directly as "you". Do not name a role, population or job title as the person performing the behaviour.`,
    `- WHEN it happens is already settled by the host, in their own words: "${recurringMoment}". BTY states that itself. Do not restate it, sharpen it, or give the behaviour a different occasion.`,
    /*
      COMPLETION IS NOT YOURS TO WRITE (Slice 3.2P-R3.4-R1). The schema has no field for it, so
      this line is not a prohibition holding a door shut — it explains why the door is absent,
      which is what stops the model compensating by naming a confirmer inside another field.
    */
    `- HOW COMPLETION IS RECOGNISED is already decided by the host, in their own words: "${completionCriterion}". BTY states that itself. There is no completion field for you to return.`,
    "- So do NOT name a person, role, reviewer, manager, keeper or system who confirms it, anywhere — not in behavior_contract, not in any section. Nobody has been assigned that job, and inventing one puts a responsibility on someone the host never named.",
    "- 'A shared handoff standard is created and utilized by team members' is NOT acceptable: it describes the standard's life cycle, not a person's action. Write what someone is seen doing instead.",
    "- Write observable_action in BASE form, as it would follow 'must': 'state each unfinished item and identify its next owner', not 'states … and identifies …'.",
    "- There is ONE definition of completion and the host already wrote it. Do not restate it, improve it, or give the application step a second way of knowing it happened.",
    "",
    /*
      THE MODEL CHOOSES THE DIFFICULTY; BTY WRITES IT (Slice 3.2P-A7-R2).

      What used to be here was seven lines of prohibition — one moment, both fields, forbidden
      phrasings, a worked example of the trap. A7 obeyed none of it twice: its first call named
      an occasion, and its licensed repair, told in its opening sentence exactly what it had
      done wrong, named another one. So the prohibition is gone along with the fields it was
      protecting. There is nothing left to forbid.
    */
    "THE PRACTICE SITUATION — scenario_contract:",
    "- Return scenario_contract with pressure_frame: ONE id from the list below. You do not write the situation — BTY does, from the host's moment and the frame you choose.",
    "- Choose the difficulty most plausible for the problem the host described, and the one that would actually make this behaviour hard to do well.",
    ...pressureFramePromptLines(),
    "- 'A queue is building at the desk' is fine; 'during the call the patient is distracted' is not.",
    "",
    "THE REST OF THE PROGRAM — completion_contract, follow_up_contract:",
    "- YOUR DECISION, APPLY IT, BEFORE YOU FINISH and WHAT HAPPENS NEXT are BUILT from these. Do not write them as free sentences and expect them to be used.",
    "- Do NOT return an application moment. YOUR DECISION and APPLY IT are set at the NEXT OCCURRENCE of the host's own moment, which BTY works out itself — you have no way to know anyone\u2019s actual schedule.",
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
    /*
      THE ADVISORY COMMISSION (Slice 3.2P-A4-R2).

      The previous wording asked for "warnings when training alone will not fix the problem (a
      workflow, staffing, access or policy change may be needed)" — and naming the remedy is
      one clause away from naming what the remedy will achieve, which is the rule that refused
      A1 and A4. It commissioned the exact shape the validator refuses.

      So it now asks for the CONDITION and stops there. The evidence block above carries the
      general relation and the illustrations; this line only has to stop steering into it.
    */
    "Also give a short learner-facing program title, the assumptions the program depends on, and warnings for what training alone cannot settle.",
    "- A warning names a CONDITION, not a cure: what lies outside this training's control, what support, process, access or staffing may also be needed, and what limitation remains afterwards. Never say what that other thing would achieve — the evidence rules above apply to every warning, every assumption and the title.",
    "- A title names the capability or the problem. It never claims mastery, readiness or a result.",
    "- Do NOT write what the program proves. BTY states that itself, from what the journey actually records.",
    "- WHY THIS MATTERS explains the problem the host described. It must NOT promise outcomes — no claim that this improves project success, collaboration, productivity, safety or results.",
    `Write ALL participant-facing text in ${isKo ? "Korean" : "English"}.`,
    "",
    "Output ONLY a compact JSON object — no markdown, no fences, no commentary. EXACT shape:",
    '{"program":{"display_title":string,"elements":[{"kind":string,"content":string,"rationale":string}],"assumptions":string[],"warnings":string[],"behavior_contract":{"action_verb":string,"action_detail":string},"scenario_contract":{"pressure_frame":string}|null,"completion_contract":{"verification_target":"the_behaviour"|"the_application_plan"|"the_confirmation_step","response_mode":"name_the_moment"|"state_what_you_will_say"|"name_what_could_stop_you"}|null,"follow_up_contract":{"review_focus":"what_you_said"|"what_happened_next"|"the_confirmation","confirmer":"self_report"|"the_host"}|null}}',
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

async function invoke(
  messages: LlmChatMessage[],
  /**
   * WHICH response shape this call must return (Slice 3.2P-A1-R3). The initial authorship call
   * asks for the whole program; a repair asks ONLY for its licensed surface, so an unlicensed
   * field has nowhere to be written rather than being caught afterwards.
   */
  responseContract: { name: string; schema: Record<string, unknown> },
): Promise<CallOutcome> {
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
          json_schema: { name: responseContract.name, strict: true, schema: responseContract.schema },
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
  /*
    Unreachable by construction: this code is returned BEFORE an attempt row exists, so there
    is never a row to finalize with it. Present because the map is exhaustive over the error
    vocabulary, and an incomplete map would fail to compile the day that changes.
  */
  attempt_recording_failed: "internal_failure",
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

  /**
   * NO DURABLE RECORD, NO SPEND (Slice 3.2P-W1-R1).
   *
   * WHAT HAPPENED. A governed window was executed by calling this service directly with a
   * hand-built `submission_intent_id` that was not a uuid. The HTTP route validates that field
   * and would have refused; the direct call did not go through the route. The ledger insert
   * failed on the uuid column, `startProgramAttempt` returned `{ok:false, duplicate:false}`,
   * `attemptId` became null — and the provider call ran anyway. The money was spent and NOTHING
   * was recorded: no attempt, no child call, no refusal reason. Only a returned top-level code
   * survived, so the fine-grained diagnosis of that refusal is permanently unknown.
   *
   * THE INVARIANT, stated as ordering rather than as atomicity, because there is none across
   * Postgres and the provider:
   *
   *     identifiers valid → durable parent attempt id → THEN the provider
   *
   * A generation that cannot be recorded is a generation that must not happen. Attempt
   * recording is not observability here; it is the authority to spend.
   */
  if (!isGenerationUuid(args.submissionIntentId) || !isGenerationUuid(args.correlationId)) {
    logOutcome("attempt_recording_failed", "identifier_not_uuid");
    return { ok: false, code: "attempt_recording_failed" };
  }

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
  /*
    Any OTHER start failure — insert error, thrown request, a row that came back without a
    usable id — stops here. There is nothing to finalize against, so this returns before `t0`
    rather than through `finish()`, which exists to close an attempt that was opened.
  */
  if (!started.ok || !isGenerationUuid(started.attemptId)) {
    logOutcome("attempt_recording_failed", started.ok ? "attempt_id_unusable" : "attempt_insert_failed");
    return { ok: false, code: "attempt_recording_failed" };
  }
  const attemptId: string = started.attemptId;
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
    { role: "system", content: systemPrompt(args.locale, required, evidenceCeilingFor(args.ctx), materialAuthority, evidenceClaimBrief(args.answers), audiencePromptLines(audienceAuthorityFor(args.answers)), args.ctx.successEvidence, args.ctx.recurringMoment) },
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
  /**
   * The RAW proposal a repair is licensed to correct part of, and the refusal that licensed
   * it (Slice 3.2P-R0). Held in memory for the length of this call only — never persisted,
   * never logged, never returned.
   */
  let frozenBaseline: unknown;
  let frozenRefusal: { code: ProgramRejectCode; kind: JourneyElementKind | undefined } | undefined;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    /**
     * A REPAIR RETURNS ONLY ITS LICENCE (Slice 3.2P-A1-R3).
     *
     * A1's retry asked for the whole program, told the model in prose to preserve the rest, and
     * never showed it what the rest was. It could not be won, and it was not. Now the licence IS
     * the response schema, and the model is shown the current value of every field it may change
     * — the smallest context that makes the task possible, and nothing it has no authority over.
     */
    const license = i === 0 || !frozenRefusal ? null : repairLicenseFor(frozenRefusal.code, frozenRefusal.kind);
    const patchContract = license ? repairPatchContract(license) : null;
    const patchContext = license ? licensedRepairContext(frozenBaseline, license) : null;
    /*
      NO KNOWN-UNWINNABLE FALLBACK — for the repairs that are FROZEN.

      A SEMANTIC repair is measured against `repairFreezeViolated`, so it must be able to leave
      the frozen content untouched. If its licence cannot be expressed as a patch, or its current
      values cannot be read back, the attempt ends on the ORIGINAL refusal rather than spending a
      call on something that could not succeed. A retry nobody can win is not a retry.

      A STRUCTURAL fault is different in kind and deliberately keeps whole-program regeneration:
      the previous response was MALFORMED, `frozenRefusal` is undefined, and the freeze is never
      evaluated for it. There is nothing to preserve — asking again for the whole object is the
      only meaningful repair, and no invariant later punishes it for differing.
    */
    if (i > 0 && frozenRefusal && (!patchContract || !patchContext)) {
      logOutcome("repair_not_representable", frozenRefusal.code);
      break;
    }
    /*
      A STRUCTURAL retry still regenerates the whole program — and still gets its exact
      diagnosis. Only the FROZEN (semantic) repairs became patches.
    */
    const structuralRepair =
      i > 0 && !patchContext
        ? [
            ...base,
            {
              role: "user" as const,
              content: lastDiagnosis
                ? `Your previous response had one formatting problem: ${repairInstruction(lastDiagnosis)} Return the SAME program with only that corrected. Return ONLY the JSON object.`
                : "The previous response could not be read. Return ONLY the JSON object, exactly in the required shape.",
            },
          ]
        : null;
    const messages: LlmChatMessage[] =
      i === 0
        ? base
        : structuralRepair ?? [
            ...base,
            {
              role: "user" as const,
              // TARGETED. The fourth controlled window handed the model only a code name
              // ("field_type"), so it could not know which field was wrong and produced the
              // same fault twice. This names the fault AND supplies what it is repairing.
              content: [
                semanticRepairInstruction(semanticRepairCode!, args.answers),
                "",
                "This is what you wrote in the fields you may change:",
                JSON.stringify(patchContext),
                "",
                "Return ONLY those fields, corrected. The response shape contains everything you are allowed to change; everything else in the program is kept exactly as it is and is not yours to rewrite.",
              ].join("\n"),
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
    const r = await invoke(
      messages,
      patchContract ?? { name: PROGRAM_SCHEMA_NAME, schema: PROGRAM_JSON_SCHEMA },
    );
    // The digest describes what the PROVIDER actually returned — the patch on a repair call,
    // not a fictional whole program (Slice 3.2P-A1-R3).
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

    /**
     * MERGE BEFORE VALIDATION (Slice 3.2P-A1-R3). The patch is not a proposal; the merged
     * candidate is. It then goes through the SAME `validateProgramProposal` as any first call,
     * so a repair that fixes its own fault but breaks another floor is still refused.
     */
    let candidate = r.parsed;
    /**
     * A PATCH THE MERGE REFUSES IS A FREEZE VIOLATION (Slice 3.2P-A1-R3).
     *
     * The schema should already have made an unlicensed field unreturnable, so reaching here
     * means the provider ignored its contract. That is exactly what `repair_freeze_violated`
     * has always meant — the repair left its envelope — so it is recorded as one rather than
     * invented as a new code, and the child row is finalized honestly instead of being
     * abandoned mid-flight.
     */
    let mergeRefused = false;
    if (license) {
      const mergedResult = applyRepairPatch({ baseline: frozenBaseline, license, patch: r.parsed });
      if (mergedResult.ok) candidate = mergedResult.merged;
      else {
        logOutcome("repair_merge_refused", mergedResult.reason);
        mergeRefused = true;
      }
    }
    /*
      THE LOCALE THE GENERATION RAN IN (Slice R4-R5C13). The same value that chose the system
      prompt's language now chooses the language of BTY's own rendered sentences, so a Korean
      program cannot come back with four English sections composed after the model replied.
    */
    let validated = validateProgramProposal(candidate, args.answers, args.verifiedArtifacts ?? [], args.locale);
    /*
      EVERY BOUNDED REPAIR IS FROZEN (Slice 3.2P-R0). A repair licensed to fix one surface may
      not return a second draft. Checked whatever the repair produced — a repair that turns an
      honest refusal into a DIFFERENT refusal is exactly the case window 4 hit, where a
      reflection fix deleted `follow_up` and the attempt died on the consequence.

      On violation the candidate is discarded and the attempt terminates on the ORIGINAL
      refusal. A failed repair does not get to rewrite what went wrong.
    */
    /*
      EVALUATED ONCE, BEFORE THE ROW IS WRITTEN (Slice 3.2P-R0.3). `undefined` means the freeze
      was not evaluated for this call at all — the initial authorship call, or a refusal outside
      the repairable set — and must never be stored as `false`. Only a retry that was actually
      measured yields a boolean, and it is the SAME evaluation that decides whether to discard
      the candidate, so the row can never disagree with what the service did.
    */
    let freezeVerdict: boolean | undefined;
    if (mergeRefused && frozenRefusal) {
      freezeVerdict = true;
      validated = { ok: false, code: frozenRefusal.code, kind: frozenRefusal.kind };
    } else if (i > 0 && frozenRefusal) {
      /*
        A DEFENSIVE INVARIANT NOW, not a gate (Slice 3.2P-A1-R3). The merge writes only what the
        licence names, so this should always be false. If it is ever true the server merge is
        wrong, and the candidate is discarded exactly as before rather than shipped.
      */
      freezeVerdict = repairFreezeViolated({ ...frozenRefusal, before: frozenBaseline, after: candidate });
      if (freezeVerdict) {
        logOutcome("repair_freeze_violated", frozenRefusal.code);
        validated = { ok: false, code: frozenRefusal.code, kind: frozenRefusal.kind };
      }
    }
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
        /*
          THIS CALL'S OWN REFUSAL, from the SAME validated result that decides what happens
          next (Slice 3.2P-R0.2) — never re-derived from the parent's final outcome. A
          repaired attempt makes two calls that can fail differently, and the parent keeps
          only the last one.
        */
        refusal: validated.ok ? null : { code: validated.code, kind: validated.kind ?? null },
        /*
          INDEPENDENT OF `refusal` ABOVE, on purpose. A discarded repair keeps call 1's
          ORIGINAL code — that truth-preservation is the point of the freeze — so this boolean
          is the only field that can say the candidate was thrown away rather than refused
          again on its own merits.
        */
        repairFreezeViolated: freezeVerdict ?? null,
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
        /*
          A5-R2 — the exact subtype behind an umbrella refusal, taken from the SAME validated
          result that decided the refusal. Never re-derived from `refusal_code`, the offending
          path, or the text: a second derivation is a second opinion, and the ledger is supposed
          to record what actually happened.
        */
        scenarioReason: validated.ok ? null : (validated.scenario?.reason ?? null),
        evidenceRule: validated.ok ? null : (validated.evidenceRule ?? null),
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
    // Every semantic repair is licensed and frozen, so every one needs its baseline and the
    // refusal that authorised it.
    // The candidate a repair will patch — the MERGED one on a retry, so a second repair would
    // build on what was actually judged.
    frozenBaseline = semanticRepairCode ? candidate : undefined;
    frozenRefusal = semanticRepairCode ? { code: semanticRepairCode, kind: validated.kind } : undefined;
    repairable = isStructuralCode(validated.code) || semanticRepairCode !== undefined;
    logOutcome("rejected", validated.code);
    if (!repairable) break;
  }

  return finish(lastCode, lastRefusal, lastRefusalKind);
}

import type { ProgramRejectCode } from "@/domain/foundry/module/program-authorship";
import type { ProgramGenerateErrorCode } from "@/lib/bty/foundry/events/programAuthorshipService";
import type { DependencyBranch } from "@/domain/foundry/module/program-coherence";

/**
 * Host-facing copy for EVERY reachable program refusal (Slice 3.2L-R5).
 *
 * THE LIVE DEFECT. The R4 window refused `scenario_unrelated` — a relevance fault — and the
 * Founder was shown:
 *
 *   "BTY drafted something that didn't meet our honesty rules, so we discarded it rather
 *    than show it to you."
 *
 * Nothing dishonest had been written. The copy map had entries for the structural codes and
 * for the two grounding codes, and everything else fell through to `invalid_output`, whose
 * sentence was written for fabrication. Ten semantic codes shared that fallback, so a
 * relevance, coherence or phrasing fault was reported to the Host as dishonesty by BTY.
 *
 * The map is now keyed by the CODE UNION itself, so `tsc` refuses to compile a new refusal
 * code that has no copy and no recovery. That is the mechanism — not a lint rule and not a
 * runtime warning, both of which can be shipped past.
 *
 * WRITING RULE: name what BTY could not produce. Never call a relevance, coherence,
 * ordering or formatting fault dishonesty, unsafe, or a policy violation.
 */

/** What the Host can actually do next. The ACTION is always the same; this shapes the words. */
export type RefusalRecovery =
  /** Nothing to change — the model's output was at fault. A new draft may simply go better. */
  | "start_a_new_draft"
  /** The Host holds the missing input: a real file, template or policy. */
  | "add_the_real_material"
  /** The Host's own Builder answers are what the draft is thin on. */
  | "adjust_your_training_inputs"
  /** Nothing is wrong with the draft; the service was unavailable. */
  | "wait_and_try_later";

export type RefusalCopy = {
  /** The primary sentence. Says what BTY could not produce, and that nothing changed. */
  headline: string;
  /** One concise sentence of explanation, or "" when the headline says it all. */
  explanation: string;
  recovery: RefusalRecovery;
};

/** Every refusal is terminal and routes back through target confirmation — see PROGRAM_RETRY_POLICY. */
const NOTHING_CHANGED = "Nothing was changed.";

/**
 * EXHAUSTIVE over `ProgramRejectCode`. Adding a code to the union without an entry here is
 * a compile error.
 */
export const PROGRAM_REFUSAL_COPY: Record<ProgramRejectCode, RefusalCopy> = {
  // ---- shape faults: the response came back malformed -----------------------
  // The Host cannot act differently on "elements[0].content was an object" versus
  // "display_title was missing" — both mean the draft came back malformed. The precise
  // path belongs in the durable diagnostics, not on screen.
  not_object: { headline: `BTY couldn’t format the program correctly. ${NOTHING_CHANGED}`, explanation: "", recovery: "start_a_new_draft" },
  missing_program: { headline: `BTY couldn’t format the program correctly. ${NOTHING_CHANGED}`, explanation: "", recovery: "start_a_new_draft" },
  missing_field: { headline: `BTY couldn’t format the program correctly. ${NOTHING_CHANGED}`, explanation: "", recovery: "start_a_new_draft" },
  field_type: { headline: `BTY couldn’t format the program correctly. ${NOTHING_CHANGED}`, explanation: "", recovery: "start_a_new_draft" },
  empty_field: { headline: `BTY left part of the program empty. ${NOTHING_CHANGED}`, explanation: "", recovery: "start_a_new_draft" },
  too_long: { headline: `BTY wrote a section too long to show. ${NOTHING_CHANGED}`, explanation: "", recovery: "start_a_new_draft" },
  unknown_kind: { headline: `BTY couldn’t format the program correctly. ${NOTHING_CHANGED}`, explanation: "", recovery: "start_a_new_draft" },
  duplicate_kind: { headline: `BTY wrote the same section twice. ${NOTHING_CHANGED}`, explanation: "", recovery: "start_a_new_draft" },
  unrequested_kind: { headline: `BTY wrote a section this training didn’t ask for. ${NOTHING_CHANGED}`, explanation: "", recovery: "start_a_new_draft" },
  invalid_assumptions: { headline: `BTY couldn’t format the program correctly. ${NOTHING_CHANGED}`, explanation: "", recovery: "start_a_new_draft" },
  invalid_warnings: { headline: `BTY couldn’t format the program correctly. ${NOTHING_CHANGED}`, explanation: "", recovery: "start_a_new_draft" },
  missing_required_kind: {
    headline: `BTY couldn’t build a complete program for this training. ${NOTHING_CHANGED}`,
    explanation: "One of the parts your training design needs was missing.",
    recovery: "start_a_new_draft",
  },

  // ---- the two grounding faults: keep the specific material explanation ------
  material_fabrication: {
    headline: "BTY drafted a program that relied on a template or tool you haven’t provided. Nothing was added.",
    explanation: "Attach the real material, or draft it again without assuming one exists.",
    recovery: "add_the_real_material",
  },
  invented_specifics: {
    headline: "BTY drafted a program that referred to a policy or form you haven’t provided. Nothing was added.",
    explanation: "Draft it again, or add the real material first.",
    recovery: "add_the_real_material",
  },

  // ---- meaning faults: named precisely, never called dishonesty --------------
  scenario_unrelated: {
    headline: `BTY couldn’t connect the practice situation clearly enough to the behaviour being trained. ${NOTHING_CHANGED}`,
    explanation: "",
    recovery: "start_a_new_draft",
  },
  scenario_without_pressure: {
    headline: `BTY wrote a practice situation with nothing difficult in it. ${NOTHING_CHANGED}`,
    explanation: "A situation only teaches something when it is genuinely hard to do well.",
    recovery: "start_a_new_draft",
  },
  /**
   * REWRITTEN (Slice 3.2P-R3.5). The old copy read:
   *
   *   "…Say when this keeps happening in your own words and draft again."
   *
   * On the W5 window that sentence was untrue twice over. The Host HAD said it, in their own
   * words, in three separate answers — "During morning huddles…", "At the next huddle…",
   * "…in the next huddle…" — and there is no Builder question that holds a moment, so there
   * was no field for them to put it in. It asked for something already given, through a
   * control that does not exist, and blamed them for the gap.
   *
   * Until a Host-owned recurring moment exists, BTY cannot know whether the Host supplied one.
   * So the copy says only what is certainly true: BTY wrote the moment, BTY could not turn it
   * into a repeating one, and nothing changed. The recovery moves to `start_a_new_draft` for
   * the same reason — that category means "nothing for you to change; a new draft may simply
   * go better", which is the honest instruction here.
   */
  trigger_not_recurring: {
    headline: `BTY couldn’t work out when the first real chance to do this would be. ${NOTHING_CHANGED}`,
    explanation: "The moment BTY wrote wasn’t clearly one that comes round again, so there was no next one to point people at.",
    recovery: "start_a_new_draft",
  },
  scenario_independent_moment: {
    headline: `BTY put the practice situation at a different moment than the behaviour itself. ${NOTHING_CHANGED}`,
    explanation: "A program has one moment. Practising at another one teaches people to do it at the wrong time.",
    recovery: "start_a_new_draft",
  },
  non_observable_standard: {
    headline: `BTY couldn’t define a behaviour the team could clearly observe and confirm. ${NOTHING_CHANGED}`,
    explanation: "",
    recovery: "start_a_new_draft",
  },
  /**
   * BRANCH-IMPRECISE UNTIL R6. The R5 window showed "asked people to use a standard before
   * defining it" for a refusal raised on WHY THIS MATTERS — a narrative section that asks
   * the participant to do nothing. Semantic-role scoping means narrative can no longer
   * raise this at all, and the remaining branches now have their own words.
   */
  dependency_inversion: {
    headline: `BTY’s draft asked people to use part of the training before defining it. ${NOTHING_CHANGED}`,
    explanation: "",
    recovery: "start_a_new_draft",
  },
  complaint_replay: {
    headline: `BTY repeated your description of the problem back at the team instead of explaining why it matters to them. ${NOTHING_CHANGED}`,
    explanation: "",
    recovery: "start_a_new_draft",
  },
  decision_is_only_reflection: {
    headline: `BTY wrote something to think about instead of something to commit to. ${NOTHING_CHANGED}`,
    explanation: "",
    recovery: "start_a_new_draft",
  },
  application_moment_unrelated: {
    headline: `BTY picked a first moment that isn’t the moment the behaviour is required. ${NOTHING_CHANGED}`,
    explanation: "The training says when this must happen; the first real chance to do it should be one of those times.",
    recovery: "start_a_new_draft",
  },
  application_without_actor: {
    headline: `BTY didn’t say who does this, or when. ${NOTHING_CHANGED}`,
    explanation: "",
    recovery: "start_a_new_draft",
  },
  generic_completion: {
    headline: `BTY’s closing question was too general to show anything. ${NOTHING_CHANGED}`,
    explanation: "",
    recovery: "start_a_new_draft",
  },
  section_contradiction: {
    headline: `BTY’s sections weren’t about the same behaviour. ${NOTHING_CHANGED}`,
    explanation: "",
    recovery: "start_a_new_draft",
  },
  duplicate_content: {
    headline: `BTY repeated the same sentence in more than one section. ${NOTHING_CHANGED}`,
    explanation: "",
    recovery: "start_a_new_draft",
  },
  evidence_overclaim: {
    headline: `BTY claimed the training proves more than it can. ${NOTHING_CHANGED}`,
    explanation: "Completing a program can show people were exposed to it — not that behaviour changed.",
    recovery: "start_a_new_draft",
  },
  person_evaluation: {
    headline: `BTY described people instead of actions. ${NOTHING_CHANGED}`,
    explanation: "",
    recovery: "start_a_new_draft",
  },
  internal_jargon: {
    headline: `BTY used internal wording your team should never see. ${NOTHING_CHANGED}`,
    explanation: "",
    recovery: "start_a_new_draft",
  },
  unsafe_markup: {
    headline: `BTY’s draft contained formatting we don’t allow in participant text. ${NOTHING_CHANGED}`,
    explanation: "",
    recovery: "start_a_new_draft",
  },
};

/**
 * Branch-specific wording for a dependency refusal. `dependency_inversion` remains the
 * stable stored code; these choose the sentence the Host reads. Product terminology only —
 * never "graph", "branch" or "construct".
 */
export const DEPENDENCY_BRANCH_COPY: Record<DependencyBranch, string> = {
  used_before_defined: `BTY’s draft asked people to use part of the training before defining it. ${NOTHING_CHANGED}`,
  defined_after_use: `BTY’s draft defined an important part of the training only after asking people to use it. ${NOTHING_CHANGED}`,
  authority_mismatch: `BTY’s draft described different behaviours across the program. ${NOTHING_CHANGED}`,
};

/** EXHAUSTIVE over the service's terminal error codes. */
export const GENERATE_ERROR_COPY: Record<ProgramGenerateErrorCode, RefusalCopy> = {
  provider_unavailable: {
    headline: `Program drafting isn’t available right now. ${NOTHING_CHANGED}`,
    explanation: "You can keep writing this training yourself.",
    recovery: "wait_and_try_later",
  },
  timeout: {
    headline: `Drafting took too long and was stopped. ${NOTHING_CHANGED}`,
    explanation: "",
    recovery: "wait_and_try_later",
  },
  provider_error: {
    headline: `We couldn’t reach the drafting service. ${NOTHING_CHANGED}`,
    explanation: "",
    recovery: "wait_and_try_later",
  },
  /**
   * Reached only when a refusal code is absent — every known code resolves above. The
   * sentence deliberately makes NO accusation about what the model wrote, because at this
   * point we do not know.
   */
  invalid_output: {
    headline: `BTY couldn’t produce a program that met our rules, so nothing was shown. ${NOTHING_CHANGED}`,
    explanation: "",
    recovery: "start_a_new_draft",
  },
  duplicate_intent: {
    headline: "That request was already sent.",
    explanation: "Refresh to see the result rather than drafting twice.",
    recovery: "wait_and_try_later",
  },
  stale_context: {
    headline: `This training changed while BTY was writing, so the draft no longer matches it. ${NOTHING_CHANGED}`,
    explanation: "",
    recovery: "start_a_new_draft",
  },
  /**
   * The attempt could not be recorded, so drafting never started (Slice 3.2P-W1-R1). The Host
   * is told nothing ran — which is the whole point of the code existing separately from the
   * refusals above, all of which describe something that DID run.
   */
  attempt_recording_failed: {
    headline: `Drafting didn’t start. ${NOTHING_CHANGED}`,
    explanation: "Nothing was written and nothing was used. Ask for it again in a moment.",
    recovery: "wait_and_try_later",
  },
};

/** Failures raised by the page around the service rather than by the validator. */
export const SURFACE_FAILURE_COPY: Record<string, RefusalCopy> = {
  context_mismatch: {
    headline: "Your training changed since this draft was written.",
    explanation: "Generate it again so it matches.",
    recovery: "start_a_new_draft",
  },
  status_no_longer_draft: {
    headline: `This training was created as a session while BTY was writing, so the draft can no longer be added to it. ${NOTHING_CHANGED}`,
    explanation: "",
    recovery: "adjust_your_training_inputs",
  },
  inputs_changed: {
    headline: `Your training changed since BTY started writing. ${NOTHING_CHANGED}`,
    explanation: "Start the draft again so it matches.",
    recovery: "start_a_new_draft",
  },
  context_incomplete: {
    headline: "Add the problem, audience, moment, behaviour and evidence first.",
    explanation: "BTY drafts from those.",
    recovery: "adjust_your_training_inputs",
  },
  /**
   * THE TWO HOST-MOMENT READINESS CODES (Slice 3.2P-R3.6-R1).
   *
   * These are SURFACE failures, not paid refusals, and that is the whole point of them existing.
   * W5 paid for a generation and returned `trigger_not_recurring` for something the draft already
   * knew. Both of these answer before an attempt row is created, and both say what to do — which
   * is now truthful, because there is a field to do it in.
   */
  recurring_moment_required: {
    headline: "Add when this situation usually happens.",
    explanation: "BTY builds the whole training around that one moment.",
    recovery: "adjust_your_training_inputs",
  },
  /*
    KEPT, UNREACHABLE (Slice 3.2P-R3.7). Generation no longer refuses a moment for its phrasing —
    the Host owns their own workplace and a narrow English grammar must not outrank them. The
    same sentence now appears as non-blocking guidance beside the question itself. This entry
    stays so a client holding an older response still renders something true.
  */
  recurring_moment_not_repeatable: {
    headline: "BTY couldn’t tell when the next chance to do this would be.",
    explanation: "The moment you described sounds like one specific time. If it happens again and again, say that where you wrote it.",
    recovery: "adjust_your_training_inputs",
  },
  source_identity_unavailable: {
    headline: `This build can’t identify itself, so drafting is disabled. ${NOTHING_CHANGED}`,
    explanation: "",
    recovery: "wait_and_try_later",
  },
};

/**
 * LAST RESORT — a runtime condition none of the maps above knows about. It must stay
 * non-accusatory: an unknown failure is not evidence that the model wrote something wrong.
 */
export const UNKNOWN_FAILURE_COPY: RefusalCopy = {
  headline: `The draft couldn’t be completed. ${NOTHING_CHANGED}`,
  explanation: "",
  recovery: "start_a_new_draft",
};

/** One sentence for a recovery category, shown under the headline. */
export const RECOVERY_NOTE: Record<RefusalRecovery, string> = {
  start_a_new_draft: "Come back to this review to start a new draft. Each draft starts a new AI generation.",
  add_the_real_material: "Attach the real material first, then come back to this review to start a new draft. Each draft starts a new AI generation.",
  adjust_your_training_inputs: "Update your training answers, then come back to this review to start a new draft. Each draft starts a new AI generation.",
  wait_and_try_later: "Come back to this review when you’re ready. Each draft starts a new AI generation.",
};

/**
 * Resolve the copy for a terminal failure. Refusal code first (the precise reason), then
 * the service error code, then the surrounding surface, then the non-accusatory fallback.
 */
export function resolveRefusalCopy(code: string | null | undefined, refusal: string | null | undefined): RefusalCopy {
  // The refusal is the PRECISE reason and always wins — including the surface reasons the
  // service returns alongside a broader code, e.g. `stale_context` +
  // `status_no_longer_draft`, where only the refusal says what actually happened.
  if (refusal && refusal in PROGRAM_REFUSAL_COPY) return PROGRAM_REFUSAL_COPY[refusal as ProgramRejectCode];
  if (refusal && refusal in SURFACE_FAILURE_COPY) return SURFACE_FAILURE_COPY[refusal];
  if (code && code in GENERATE_ERROR_COPY) return GENERATE_ERROR_COPY[code as ProgramGenerateErrorCode];
  if (code && code in SURFACE_FAILURE_COPY) return SURFACE_FAILURE_COPY[code];
  return UNKNOWN_FAILURE_COPY;
}

/**
 * RETRY AUTHORITY (Slice 3.2L-R5). Uniform and deliberately not a per-code decision: NO
 * terminal failure starts a provider call from the refusal screen. Drafting again is always
 * possible, and always goes back through the Training Program Target confirmation, which
 * states that another draft starts a new AI generation.
 *
 * The R4 window is why this is uniform. `scenario_unrelated` was not on the old
 * no-immediate-retry list, so the refusal screen offered "Draft it again" for a failure the
 * Host could neither see nor correct — inputs unchanged, prompt unchanged, temperature 0.7.
 * That is an invitation to pay for a re-roll, dressed as a remedy.
 */
export const PROGRAM_RETRY_POLICY = {
  /** No code, under any circumstance, may start a generation directly from the refusal. */
  immediateRetryAllowed: false as const,
};

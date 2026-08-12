import type { JourneyElementKind } from "@/domain/foundry/module/journey";
import type { ProgramContracts, ReviewBlockReason } from "@/domain/foundry/module/program-authorship";
import {
  VERIFICATION_TARGETS,
  RESPONSE_MODES,
  REVIEW_FOCUSES,
  CONFIRMERS,
  isVerificationTarget,
  isResponseMode,
  isReviewFocus,
  isConfirmer,
} from "@/domain/foundry/module/program-coherence";

/**
 * The Host-facing controls for structured review editing (Slice 3.2L-R6.1).
 *
 * The Host adjusts the shared CONTRACT; every dependent sentence re-renders. That is what
 * makes it impossible for APPLY IT to describe one behaviour while THE STANDARD describes
 * another — there is only one authority to disagree with.
 *
 * NO INTERNAL NAMES REACH THE SCREEN. `behavior_contract`, `verification_target` and
 * `response_mode` are how the code and the provider talk to each other; a Host is asked
 * "Who does this?" and "How do they answer?".
 */

/**
 * THE TWO THINGS A HOST IS ACTUALLY DECIDING (Slice 3.2L-R9.2).
 *
 * THE STANDARD's five controls were one flat list of identically-styled fields, and it
 * contained two "Who …?" questions and two "What would … see … them do?" questions. Two
 * consecutive Founder gates typed the confirmer into the ACTOR field — someone who knew
 * exactly which test they were running, twice. That is not operator error; a Host should
 * not have to hold `behavior_contract` in their head to edit a training.
 *
 * The fields and their meanings are unchanged. They are now presented as the two concepts
 * they always were: what someone does, and how anyone knows it happened.
 */
/*
  ONE GROUP SINCE v11 (Slice 3.2P-R3.4-R1). `completion` is kept in the type because the
  grouping mechanism is general and the heading map is what a second group would need; the
  completion controls themselves are gone, so nothing currently declares it.
*/
export type FieldGroup = "action" | "completion";

/** Shown once, above the first control in each group. */
export const FIELD_GROUP_HEADING: Record<FieldGroup, string> = {
  action: "The action",
  completion: "How completion is confirmed",
};

export type DetailField = {
  /** Stable test/DOM id. Not shown. */
  id: string;
  /** Which concept this control belongs to. Absent for kinds with a single concept. */
  group?: FieldGroup;
  /** What the Host reads. */
  label: string;
  get: (c: ProgramContracts) => string;
  set: (c: ProgramContracts, v: string) => ProgramContracts;
  /** Present for enumerated authorities, which are chosen rather than written. */
  options?: { value: string; label: string }[];
};

/**
 * NO `affects` LIST ANY MORE (Slice 3.2L-R8.1).
 *
 * Each control used to declare which sections it was believed to change, and the review
 * surface badged those sections. On the physical gate the list was wrong in both
 * directions — it missed APPLY IT when the confirmer changed, and marked two sections whose
 * sentences never moved. Provenance is now computed by comparing rendered output, so a
 * control declares only what it edits, and nothing about consequences it cannot see.
 */

/** Only the three string roles are edited this way; completion has its own two controls. */
const behaviourField = (
  id: string,
  label: string,
  key: "actor" | "trigger" | "observableAction",
): DetailField => ({
  id,
  label,
  group: "action",
  get: (c) => c.behavior[key],
  set: (c, v) => ({ ...c, behavior: { ...c.behavior, [key]: v } }),
});

const VERIFICATION_LABEL: Record<(typeof VERIFICATION_TARGETS)[number], string> = {
  the_behaviour: "The behaviour itself",
  the_application_plan: "Their plan to put it into practice",
  the_confirmation_step: "The moment it’s confirmed",
};

const RESPONSE_LABEL: Record<(typeof RESPONSE_MODES)[number], string> = {
  name_the_moment: "Name the next moment it happens",
  state_what_you_will_say: "Say exactly what they’ll say",
  name_what_could_stop_you: "Name what could get in the way",
};

const FOCUS_LABEL: Record<(typeof REVIEW_FOCUSES)[number], string> = {
  what_you_said: "What they actually said",
  what_happened_next: "What happened afterwards",
  the_confirmation: "Whether it was confirmed",
};

const CONFIRMER_LABEL: Record<(typeof CONFIRMERS)[number], string> = {
  self_report: "They report it themselves",
  the_host: "You read it with them",
};

export const DETAIL_FIELDS: Partial<Record<JourneyElementKind, DetailField[]>> = {
  observable_standard: [
    /**
     * ONE CONTROL (Slice 3.2P-R3.6-R1).
     *
     * THE STANDARD had four: who, when, what they do, and what confirms it. Three of them are
     * no longer this surface's to edit, and each left for the same reason — the Host already
     * answered it somewhere with authority, and a second editor for one sentence means two
     * answers that drift the moment either is touched:
     *
     *   who      → the audience, rendered as "you"          (removed at v11)
     *   confirms → "How will you know it worked?"           (removed at v11)
     *   when     → "When does this usually happen?"         (removed here)
     *
     * The Host has lost no edit. Each moved back to the question that owns it, and changing it
     * there re-renders every sentence derived from it.
     */
    behaviourField("action", "What would you see or hear them do?", "observableAction"),
  ],
  scenario: [
    {
      id: "pressure",
      label: "What makes this moment hard?",
      get: (c) => c.scenario?.pressureCondition ?? "",
      set: (c, v) => (c.scenario ? { ...c, scenario: { ...c.scenario, pressureCondition: v } } : c),
    },
    /*
      NOT "where and when does it happen?" any more. That control is what let a Host give
      the practice situation an occasion of its own, and the program then required the
      behaviour at two different moments. When it happens is THE STANDARD's "When is it
      required?", and there is only one of those.
    */
    {
      id: "pressure-detail",
      label: "Anything else making it hard? (optional)",
      get: (c) => c.scenario?.pressureDetail ?? "",
      set: (c, v) => (c.scenario ? { ...c, scenario: { ...c.scenario, pressureDetail: v } } : c),
    },
  ],
  /*
    NO first-moment control any more (Slice 3.2L-R10-A). "When is it required?" and "when
    do they first do it for real?" were never two decisions — the second is a deterministic
    projection of the first. Editing "When should they do it?" under THE ACTION now moves
    YOUR DECISION and APPLY IT with it.
  */
  completion_check: [
    {
      id: "verifies",
      label: "What is this question checking?",
      options: VERIFICATION_TARGETS.map((v) => ({ value: v, label: VERIFICATION_LABEL[v] })),
      get: (c) => c.completion?.verificationTarget ?? "",
      set: (c, v) => (c.completion && isVerificationTarget(v) ? { ...c, completion: { ...c.completion, verificationTarget: v } } : c),
    },
    {
      id: "responds",
      label: "How do they answer?",
      options: RESPONSE_MODES.map((v) => ({ value: v, label: RESPONSE_LABEL[v] })),
      get: (c) => c.completion?.responseMode ?? "",
      set: (c, v) => (c.completion && isResponseMode(v) ? { ...c, completion: { ...c.completion, responseMode: v } } : c),
    },
  ],
  follow_up: [
    {
      id: "focus",
      label: "What gets reviewed later?",
      options: REVIEW_FOCUSES.map((v) => ({ value: v, label: FOCUS_LABEL[v] })),
      get: (c) => c.followUp?.reviewFocus ?? "",
      set: (c, v) => (c.followUp && isReviewFocus(v) ? { ...c, followUp: { ...c.followUp, reviewFocus: v } } : c),
    },
    {
      id: "confirmer",
      label: "Who confirms it?",
      options: CONFIRMERS.map((v) => ({ value: v, label: CONFIRMER_LABEL[v] })),
      get: (c) => c.followUp?.confirmer ?? "",
      set: (c, v) => (c.followUp && isConfirmer(v) ? { ...c, followUp: { ...c.followUp, confirmer: v } } : c),
    },
  ],
};

/**
 * Why Apply is blocked, in the Host's terms. Never names a validator, a contract or a
 * field id — the Host adjusted "Who does this?", not `behavior_contract.actor`.
 */
export const REVIEW_BLOCK_COPY: Record<ReviewBlockReason, string> = {
  standard_incomplete: "Describe what someone would see or hear the person doing.",
  standard_not_observable: "The standard doesn’t yet describe something a person could be seen doing, at a particular moment, with a clear finish.",
  scenario_incomplete: "The practice situation needs a real difficulty — not “it’s hard”, and not another moment. When it happens comes from “When is it required?” above.",
  application_incomplete: "Say when this behaviour is required, in a way that comes round again — “at each handoff”, “every time a task is reassigned”.",
  action_unusable: "That action can’t be turned into a sentence people can follow. Try a short phrase like “state each open item aloud”.",
  application_unrelated: "“When should they do it?” needs to describe something that happens again, so there is a next one to aim at.",
  completion_invalid: "Choose what the closing question checks and how people answer it.",
  follow_up_invalid: "Choose what gets reviewed later and who confirms it.",
  narrative_unsafe: "One of the sections you wrote claims something the training can’t show, or relies on material you haven’t provided.",
  derived_too_long: "One section is now too long to show. Shorten the details you changed.",
};

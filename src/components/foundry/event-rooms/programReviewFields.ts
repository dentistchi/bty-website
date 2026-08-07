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

export type DetailField = {
  /** Stable test/DOM id. Not shown. */
  id: string;
  /** What the Host reads. */
  label: string;
  get: (c: ProgramContracts) => string;
  set: (c: ProgramContracts, v: string) => ProgramContracts;
  /** Sections whose visible sentence changes when this value changes. */
  affects: JourneyElementKind[];
  /** Present for enumerated authorities, which are chosen rather than written. */
  options?: { value: string; label: string }[];
};

/**
 * PROVENANCE SCOPE (Slice 3.2L-R6.2) — per FIELD, not per contract.
 *
 * Marking all six sections whenever any behaviour value changed was over-marking: YOUR
 * DECISION speaks in the first person and never renders the actor, so changing "Who does
 * this?" leaves its sentence untouched and it should keep saying "Drafted by BTY".
 *
 * `completionSignal` is the deliberate exception: it is marked on `completion_check` and
 * `follow_up` even though those only render it under one enum setting each
 * (`the_confirmation_step` / `the_confirmation`). Their SEMANTIC AUTHORITY changed either
 * way, and a badge that flickers with an unrelated dropdown would be the more confusing lie.
 */
const ACTION_DEPENDENTS: JourneyElementKind[] = [
  "observable_standard",
  "scenario",
  "action_decision",
  "field_application",
  "completion_check",
  "follow_up",
];
const ACTOR_DEPENDENTS: JourneyElementKind[] = ["observable_standard", "scenario", "field_application"];
const SIGNAL_DEPENDENTS: JourneyElementKind[] = ["observable_standard", "scenario", "completion_check", "follow_up"];
const TRIGGER_DEPENDENTS: JourneyElementKind[] = ["observable_standard"];

const APPLICATION_DEPENDENTS: JourneyElementKind[] = ["action_decision", "field_application"];

/** Only the three string roles are edited this way; completion has its own two controls. */
const behaviourField = (
  id: string,
  label: string,
  key: "actor" | "trigger" | "observableAction",
  affects: JourneyElementKind[],
): DetailField => ({
  id,
  label,
  affects,
  get: (c) => c.behavior[key],
  set: (c, v) => ({ ...c, behavior: { ...c.behavior, [key]: v } }),
});

const applicationField = (id: string, label: string, key: "applicationMoment"): DetailField => ({
  id,
  label,
  affects: APPLICATION_DEPENDENTS,
  get: (c) => c.application?.[key] ?? "",
  set: (c, v) =>
    c.application ? { ...c, application: { ...c.application, [key]: v } } : c,
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
  the_other_person: "The other person is asked too",
  the_host: "You read it with them",
};

export const DETAIL_FIELDS: Partial<Record<JourneyElementKind, DetailField[]>> = {
  observable_standard: [
    behaviourField("actor", "Who does this?", "actor", ACTOR_DEPENDENTS),
    behaviourField("trigger", "When is it required?", "trigger", TRIGGER_DEPENDENTS),
    behaviourField("action", "What would someone see or hear them do?", "observableAction", ACTION_DEPENDENTS),
    {
      id: "confirmed-by",
      label: "Who confirms it’s done?",
      affects: SIGNAL_DEPENDENTS,
      get: (c) => c.behavior.completion.confirmedBy,
      set: (c, v) => ({ ...c, behavior: { ...c.behavior, completion: { ...c.behavior.completion, confirmedBy: v } } }),
    },
    {
      id: "completion",
      label: "What would you see them do?",
      affects: SIGNAL_DEPENDENTS,
      get: (c) => c.behavior.completion.confirmationAction,
      set: (c, v) => ({ ...c, behavior: { ...c.behavior, completion: { ...c.behavior.completion, confirmationAction: v } } }),
    },
  ],
  scenario: [
    {
      id: "pressure",
      label: "What makes this moment hard?",
      affects: ["scenario"],
      get: (c) => c.scenario?.pressureOrConstraint ?? "",
      set: (c, v) => (c.scenario ? { ...c, scenario: { ...c.scenario, pressureOrConstraint: v } } : c),
    },
    {
      id: "context",
      label: "Where and when does it happen?",
      affects: ["scenario"],
      get: (c) => c.scenario?.contextDetail ?? "",
      set: (c, v) => (c.scenario ? { ...c, scenario: { ...c.scenario, contextDetail: v } } : c),
    },
  ],
  action_decision: [
    applicationField("moment", "When will they first do this for real?", "applicationMoment"),
  ],
  field_application: [
    applicationField("moment-apply", "When will they first do this for real?", "applicationMoment"),
  ],
  completion_check: [
    {
      id: "verifies",
      label: "What is this question checking?",
      affects: ["completion_check"],
      options: VERIFICATION_TARGETS.map((v) => ({ value: v, label: VERIFICATION_LABEL[v] })),
      get: (c) => c.completion?.verificationTarget ?? "",
      set: (c, v) => (c.completion && isVerificationTarget(v) ? { ...c, completion: { ...c.completion, verificationTarget: v } } : c),
    },
    {
      id: "responds",
      label: "How do they answer?",
      affects: ["completion_check"],
      options: RESPONSE_MODES.map((v) => ({ value: v, label: RESPONSE_LABEL[v] })),
      get: (c) => c.completion?.responseMode ?? "",
      set: (c, v) => (c.completion && isResponseMode(v) ? { ...c, completion: { ...c.completion, responseMode: v } } : c),
    },
  ],
  follow_up: [
    {
      id: "focus",
      label: "What gets reviewed later?",
      affects: ["follow_up"],
      options: REVIEW_FOCUSES.map((v) => ({ value: v, label: FOCUS_LABEL[v] })),
      get: (c) => c.followUp?.reviewFocus ?? "",
      set: (c, v) => (c.followUp && isReviewFocus(v) ? { ...c, followUp: { ...c.followUp, reviewFocus: v } } : c),
    },
    {
      id: "confirmer",
      label: "Who confirms it?",
      affects: ["follow_up"],
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
  standard_incomplete: "The standard needs all four details filled in: who does it, when, what they do, and what confirms it.",
  standard_not_observable: "The standard doesn’t yet describe something a person could be seen doing, at a particular moment, with a clear finish.",
  scenario_incomplete: "The practice situation needs a real difficulty and a real place — not “it’s hard” or “at work”.",
  application_incomplete: "Say when this first happens for real, and what would show it happened.",
  action_unusable: "That action can’t be turned into a sentence people can follow. Try a short phrase like “state each open item aloud”.",
  completion_incomplete: "Say who confirms it’s done, and what you would see them do.",
  application_unrelated: "The first real moment should be one of the times the behaviour is required.",
  completion_invalid: "Choose what the closing question checks and how people answer it.",
  follow_up_invalid: "Choose what gets reviewed later and who confirms it.",
  narrative_unsafe: "One of the sections you wrote claims something the training can’t show, or relies on material you haven’t provided.",
  derived_too_long: "One section is now too long to show. Shorten the details you changed.",
};

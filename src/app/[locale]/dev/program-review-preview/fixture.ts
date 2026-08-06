import type { ProgramProposal } from "@/domain/foundry/module/program-authorship";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

/**
 * A STATIC program_authorship_v3 proposal for the physical readability gate (Slice 3.2L-R5).
 *
 * WHY A FIXTURE. The R4 window returned a terminal refusal and displayed no proposal, so
 * the AutoTextarea repair shipped in R4 has never been seen on the Founder's phone. Proving
 * it with another paid generation would spend a provider call to answer a layout question,
 * and would still not be reproducible.
 *
 * Everything here is INVENTED FOR THE PREVIEW. It is deliberately about a different team
 * and a different behaviour than the canonical draft, so nothing on this page can be
 * mistaken for the Founder's real training, and the canonical draft is never referenced.
 *
 * Several sections sit at 500–700 characters — the domain ceiling — because the defect
 * being tested only appears once content exceeds three rendered rows.
 */

/** Long enough to wrap well past three rows at an iPhone width. */
const WHY_IT_MATTERS =
  "When a shift ends and something is still unfinished, the person coming on has to reconstruct it from whatever is left behind: a half-written note, a screen someone forgot to close, or nothing at all. They lose the first part of their shift working out what already happened, and the person who could have explained it in twenty seconds has gone home. The cost does not land on whoever left it — it lands on the next person, and then on whoever is waiting on the work. Saying the unfinished part out loud is not extra process. It is the difference between the next person starting and the next person guessing.";

const SCENARIO =
  "At the end of every shift, before leaving the floor, the outgoing team member faces two colleagues already waiting to ask them something else and a shift that has run twenty minutes late. In the last few minutes of a busy evening handover, they still state each unfinished task, its deadline and what could go wrong with it out loud to the person taking over. It is complete when the person taking over repeats the list back and confirms they have it.";

const FOLLOW_UP =
  "In seven days you will be asked one question: what did you actually say at your last handover, and what happened next. That is your own account of it, not something anyone observed, and it is recorded that way. It cannot show that handovers improved across the team, and it is not a performance measure. What it can do is give you a second, quieter moment to notice whether the thing you decided to do survived contact with a real shift — and if it did not, what got in the way.";

export const PREVIEW_ANSWERS: BuilderAnswers = {
  problem: "Unfinished work disappears at shift change.",
  audienceType: "everyone",
  observableBehavior: "Hand over unfinished work out loud.",
  successEvidence: "Handover note",
  learningNeeds: ["know", "decide", "practice"],
  materialIntent: "youtube",
  materialText: "https://example.invalid/preview",
  completionPrompt: "What will you say aloud at your next handover?",
  arenaRecommended: true,
  followUpDays: 7,
};

export const PREVIEW_PROPOSAL: ProgramProposal = {
  displayTitle: "Handing over what isn’t finished",
  elements: [
    { kind: "why_it_matters", content: WHY_IT_MATTERS, rationale: "Reframes the manager's complaint as what is at stake for the people doing the work." },
    {
      kind: "observable_standard",
      // Derived from the behaviour contract below — this is what v3 renders.
      content:
        "At the end of every shift, before leaving the floor, the outgoing team member states each unfinished task, its deadline and what could go wrong with it out loud to the person taking over. It is complete when the person taking over repeats the list back and confirms they have it.",
      rationale: "Names who acts, when, what is visible, and how completion is confirmed.",
    },
    { kind: "scenario", content: SCENARIO, rationale: "The same behaviour under the pressure that usually defeats it." },
    {
      kind: "action_decision",
      content: "I will state every unfinished task out loud at handover, even when the shift has run late and someone is waiting for me.",
      rationale: "Commits to an action rather than inviting reflection.",
    },
    {
      kind: "field_application",
      content:
        "At your next shift change, before you leave the floor, you state the unfinished tasks to the person taking over and wait for them to repeat the list back. If the person taking over has not arrived yet, you leave the same list where they will see it first and tell someone who will still be there.",
      rationale: "Names the actor, the moment and the fallback.",
    },
    { kind: "completion_check", content: "What will you say aloud at your next handover that you did not say before?", rationale: "Verifies a concrete application plan." },
    { kind: "follow_up", content: FOLLOW_UP, rationale: "States plainly what a self-report can and cannot show." },
  ],
  assumptions: [
    "Handovers happen at a predictable shift change.",
    "The person taking over is present, or can be reached, at the end of the shift.",
  ],
  warnings: [
    "If shifts are scheduled with no overlap at all, training alone will not create a moment to hand over in.",
  ],
  evidenceLanguage:
    "Completing this shows people were exposed to the standard and decided something. It does not show that handovers changed, and a seven-day self-report is what someone says they did, not observed behaviour.",
  behaviorContract: {
    actor: "the outgoing team member",
    trigger: "At the end of every shift, before leaving the floor",
    observableAction: "states each unfinished task, its deadline and what could go wrong with it out loud to the person taking over",
    completionSignal: "the person taking over repeats the list back and confirms they have it",
  },
  scenarioContract: {
    pressureOrConstraint: "two colleagues already waiting to ask them something else and a shift that has run twenty minutes late",
    contextDetail: "the last few minutes of a busy evening handover",
  },
};

export const PREVIEW_EVIDENCE_CEILING =
  "Reading or watching the material can show only that people were exposed to it. An action decision records a decision, never a completed action. Practice is rehearsal, never field mastery. Nothing here can show sustained change.";

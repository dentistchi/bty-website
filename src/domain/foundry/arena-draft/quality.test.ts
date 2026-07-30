import { describe, it, expect } from "vitest";
import { validateDifficultChoice } from "./quality";
import type { ArenaScenarioDraft } from "./types";

/**
 * Difficult-choice quality gate (Slice 3.2H). These fixtures also serve as the
 * deterministic Founder review set. The `_value` / `_cost` annotations on each choice
 * are for review + these tests ONLY — they are NOT part of the learner-facing draft.
 */

type Annotated = { id: string; label: string; isActionCommitment?: boolean; _value: string; _cost: string };
function strip(cs: Annotated[]) {
  return cs.map((c) =>
    c.isActionCommitment === undefined
      ? { id: c.id, label: c.label }
      : { id: c.id, label: c.label, isActionCommitment: c.isActionCommitment },
  );
}
function draft(d: {
  title: string;
  opening: string;
  primary: Annotated[];
  escalation: string;
  tradeoff: Annotated[];
  prompt: string;
  action: Annotated[];
}): ArenaScenarioDraft {
  return {
    title: d.title,
    opening: d.opening,
    primary: { choices: strip(d.primary) },
    tradeoff: { escalationText: d.escalation, choices: strip(d.tradeoff) },
    actionDecision: { prompt: d.prompt, choices: strip(d.action) as ArenaScenarioDraft["actionDecision"]["choices"] },
  };
}

// ---------------------------------------------------------------------------
// GOLDEN DIFFICULT-CHOICE FIXTURES (Founder review set) — all must PASS the gate.
// ---------------------------------------------------------------------------

const LEADERSHIP_ACCOUNTABILITY = draft({
  title: "Owning a missed commitment — when your credibility is on the line",
  opening:
    "Your team missed a delivery you personally promised the client. You can front the failure now or hold the line on the recovery plan, and both the client and your team are waiting.",
  primary: [
    { id: "primary_1", label: "Tell the client now that your team missed it and you own the miss, accepting the hit to your credibility", _value: "transparency/trust", _cost: "your own credibility" },
    { id: "primary_2", label: "Take a short, defined pause to confirm the recovery plan, then bring the client a concrete fix, accepting the risk the pause itself becomes a problem", _value: "an accurate, actionable plan", _cost: "the pause may compound the miss" },
    { id: "primary_3", label: "Reset the client with a revised plan focused on the fix rather than blame, protecting the relationship but leaving accountability less explicit", _value: "the relationship/forward focus", _cost: "less explicit accountability" },
  ],
  escalation:
    "The client convenes both teams and asks, on the record, how this will be handled and who stands behind the fix.",
  tradeoff: [
    { id: "tradeoff_1", label: "Name yourself as accountable and shield the team from the client's frustration, absorbing the blame personally", _value: "the team", _cost: "personal blame" },
    { id: "tradeoff_2", label: "Explain the specific breakdown honestly, which is accurate but exposes a team member by name", _value: "accuracy", _cost: "exposing a teammate" },
  ],
  prompt: "Decide what you will actually do in the room now.",
  action: [
    { id: "action_1", label: "Own it out loud now and commit to a concrete fix by a named date", isActionCommitment: true, _value: "trust", _cost: "being locked to a date under scrutiny" },
    { id: "action_2", label: "Ask for ten minutes to confirm the recovery plan with the team before you commit publicly, holding the client waiting", isActionCommitment: false, _value: "accuracy of the promise", _cost: "keeping the client waiting" },
  ],
});

const COMMS_TIME_PRESSURE = draft({
  title: "Answering before you are certain — when the clock is running",
  opening:
    "A customer is waiting on a fix that is ninety percent confirmed. You can respond now or verify the last detail first, and every minute of delay costs them.",
  primary: [
    { id: "primary_1", label: "Give them your best current answer now so they can act, flagging that one detail is still being confirmed and may change", _value: "responsiveness", _cost: "the detail may change under them" },
    { id: "primary_2", label: "Confirm the last detail before you respond, protecting accuracy while they wait with nothing from you yet", _value: "accuracy", _cost: "the customer waiting with no answer" },
    { id: "primary_3", label: "Answer only the part you have confirmed and tell them when the rest will follow, protecting reliability but leaving their main question open for now", _value: "reliability", _cost: "the main question left open" },
  ],
  // Branch-neutral escalation: a NEW independent pressure that presupposes no specific
  // prior action (no delay, no message sent) — compatible with every Primary path.
  escalation:
    "The customer's manager joins the thread and says a decision is being made today that hinges on this exact detail. The stakes on the unconfirmed point just rose for everyone involved.",
  tradeoff: [
    { id: "tradeoff_1", label: "Put the confirmed parts on the record now and mark the open detail as still pending, accepting that a pending item reads as less decisive", _value: "honesty", _cost: "looking less decisive" },
    { id: "tradeoff_2", label: "Hold the whole answer until the detail is confirmed, accepting that the decision may proceed today without your input", _value: "accuracy", _cost: "the decision proceeding without you" },
  ],
  prompt: "Decide what you will actually do now.",
  action: [
    { id: "action_1", label: "Get on a call now, give them everything confirmed, and own the one open item live", isActionCommitment: true, _value: "transparency", _cost: "being exposed on the open item live" },
    { id: "action_2", label: "Confirm the last detail first, then send one complete written answer within the hour, accepting it may land after the decision", isActionCommitment: false, _value: "accuracy", _cost: "it may arrive too late to count" },
  ],
});

const FAIRNESS_CONFLICT = draft({
  title: "Fairness versus keeping your strongest performer",
  opening:
    "Two team members are in open conflict. One is a top performer; the other says they were treated unfairly. You have to respond, and the whole team is watching how you handle it.",
  primary: [
    { id: "primary_1", label: "Apply the same standard to both immediately, accepting that the top performer may decide to leave", _value: "consistency", _cost: "possibly losing the performer" },
    { id: "primary_2", label: "Use a time-bound corrective agreement before the full consequence, preserving retention while delaying resolution and risking perceived inconsistency", _value: "retention", _cost: "delay and perceived inconsistency" },
    { id: "primary_3", label: "Bring both into a facilitated conversation to reach a shared account first, protecting the relationships but leaving the standard unstated for now", _value: "the relationships", _cost: "the standard left unstated for now" },
  ],
  escalation:
    "Word spreads and the team is now watching how consistently the outcome is applied. The top performer signals, quietly, that their future here depends on how it lands.",
  tradeoff: [
    { id: "tradeoff_1", label: "Apply the full consequence consistently and accept that you may lose the top performer", _value: "consistency", _cost: "losing a strong performer" },
    { id: "tradeoff_2", label: "Hold the top performer to a concrete improvement plan instead of the full consequence, accepting that some will read it as uneven", _value: "retention", _cost: "some reading it as uneven" },
  ],
  prompt: "Decide what you will actually do now.",
  action: [
    { id: "action_1", label: "Tell both your decision and the standard behind it now, accepting that one of them will be unhappy today", isActionCommitment: true, _value: "clarity", _cost: "an unhappy team member today" },
    { id: "action_2", label: "Have a neutral colleague pressure-test your decision first, accepting the short delay and the look that you needed a second opinion", isActionCommitment: false, _value: "impartiality", _cost: "delay and a hit to your standing" },
  ],
});

const OPERATIONAL_ACCURACY = draft({
  title: "Correcting a number executives already trust",
  opening:
    "A dashboard your executives rely on shows a figure that looks wrong. Correcting it means pausing reporting during a critical week, and people are already acting on the number.",
  primary: [
    { id: "primary_1", label: "Announce the suspected error immediately so no one acts on bad data, accepting that you may be wrong and cause a false alarm", _value: "sound decisions", _cost: "a possible false alarm" },
    { id: "primary_2", label: "Quietly verify the figure first before saying anything, protecting your credibility but letting others keep using it meanwhile", _value: "accuracy/credibility", _cost: "others using bad data longer" },
    { id: "primary_3", label: "Flag it only to the executives who depend on it most, protecting their decisions but leaving everyone else uninformed", _value: "the highest-stakes decisions", _cost: "uneven information" },
  ],
  escalation:
    "An executive has already made a public commitment based on the number, and a reporting freeze would now be visible to the whole company.",
  tradeoff: [
    { id: "tradeoff_1", label: "Correct it company-wide and accept the disruption and the executive's public exposure", _value: "shared truth", _cost: "disruption and exposing a leader" },
    { id: "tradeoff_2", label: "Contain the correction to the affected decision and accept that the flawed figure stays visible elsewhere for now", _value: "stability", _cost: "an inconsistency left standing" },
  ],
  prompt: "Decide what you will actually do now.",
  action: [
    { id: "action_1", label: "Issue the correction company-wide now and own the disruption it causes", isActionCommitment: true, _value: "transparency", _cost: "owning company-wide disruption" },
    { id: "action_2", label: "Confirm the true figure with the data team first and correct within the hour, accepting that wrong calls may be made meanwhile", isActionCommitment: false, _value: "accuracy", _cost: "wrong decisions during the hour" },
  ],
});

const AUTHORITY_ESCALATION = draft({
  title: "Stepping in outside your authority",
  opening:
    "You spot a serious problem outside your area. Acting means overstepping a peer's authority; staying in your lane means the problem may go unaddressed while the window closes.",
  primary: [
    { id: "primary_1", label: "Act directly to fix it now, protecting the outcome but overstepping your peer's authority", _value: "the outcome", _cost: "breaching a peer's authority" },
    { id: "primary_2", label: "Escalate to the peer's manager, protecting the chain of command but slowing the response and risking your peer's trust", _value: "process", _cost: "speed and your peer's trust" },
    { id: "primary_3", label: "Raise it with the peer directly first, protecting the relationship but depending on them to act in time", _value: "the relationship", _cost: "depending on them under a deadline" },
  ],
  escalation: "The peer disagrees that it is a problem at all, and the window to act is nearly closed.",
  tradeoff: [
    { id: "tradeoff_1", label: "Override the peer and act, accepting the conflict and the precedent it sets for the team", _value: "the outcome", _cost: "conflict and a hard precedent" },
    { id: "tradeoff_2", label: "Defer to the peer's call and document your concern in writing, accepting that the problem may not be addressed in time", _value: "the chain of command", _cost: "the problem possibly going unaddressed" },
  ],
  prompt: "Decide what you will actually do now.",
  action: [
    { id: "action_1", label: "Act now and inform your peer and their manager immediately afterward, accepting the fallout", isActionCommitment: true, _value: "the outcome", _cost: "fallout with your peer" },
    { id: "action_2", label: "Give the peer a firm deadline to act and step in only if it passes, accepting the risk that the delay proves too long", isActionCommitment: false, _value: "the relationship", _cost: "a delay that may be too long" },
  ],
});

const GOLDEN = {
  "leadership accountability": LEADERSHIP_ACCOUNTABILITY,
  "communication under time pressure": COMMS_TIME_PRESSURE,
  "fairness / team conflict": FAIRNESS_CONFLICT,
  "operational accuracy vs speed": OPERATIONAL_ACCURACY,
  "authority / escalation": AUTHORITY_ESCALATION,
} as const;

// ---------------------------------------------------------------------------
// OBVIOUS-ANSWER REGRESSION FIXTURE (the pre-3.2H template) — must FAIL the gate.
// ---------------------------------------------------------------------------

const OBVIOUS_ANSWER = draft({
  title: "Do the expected behavior — in that moment",
  opening: "A realistic moment. Doing the expected behavior is called for, but it lands exactly in that moment. How do you begin?",
  primary: [
    { id: "primary_1", label: "Do it now, directly, in the moment", _value: "n/a", _cost: "n/a" },
    { id: "primary_2", label: "Read the situation first, then approach carefully", _value: "n/a", _cost: "n/a" },
    { id: "primary_3", label: "Defer it to someone else or an easier time", _value: "none", _cost: "none" },
  ],
  escalation: "It gets harder. The pressure now weighs in, and the cost of your first move becomes clear.",
  tradeoff: [
    { id: "tradeoff_1", label: "Absorb the cost and hold to the behavior you intended", _value: "n/a", _cost: "n/a" },
    { id: "tradeoff_2", label: "Step back to protect the relationship and stay safe", _value: "n/a", _cost: "n/a" },
  ],
  prompt: "Now decide. What will you actually do?",
  action: [
    { id: "action_1", label: "Commit to taking the real action now", isActionCommitment: true, _value: "n/a", _cost: "n/a" },
    { id: "action_2", label: "Wait and prepare a little longer first", isActionCommitment: false, _value: "none", _cost: "none" },
  ],
});

describe("validateDifficultChoice — golden difficult-choice fixtures (Founder review set)", () => {
  for (const [name, fixture] of Object.entries(GOLDEN)) {
    it(`passes the gate: ${name}`, () => {
      const r = validateDifficultChoice(fixture);
      expect(r.errors).toEqual([]);
      expect(r.ok).toBe(true);
    });
  }
});

describe("validateDifficultChoice — obvious-answer regression", () => {
  it("REJECTS the pre-3.2H template (hollow throwaway options)", () => {
    const r = validateDifficultChoice(OBVIOUS_ANSWER);
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("primary_hollow_option");
    expect(r.errors).toContain("action_hollow_option");
  });
});

describe("validateDifficultChoice — targeted anti-patterns", () => {
  it("rejects answer-key / moral-label language", () => {
    const bad = draft({
      ...spread(LEADERSHIP_ACCOUNTABILITY),
      primary: [
        { id: "primary_1", label: "Make the right choice and tell the client immediately", _value: "x", _cost: "y" },
        { id: "primary_2", label: "Give the team one more day before saying anything, accepting the risk", _value: "x", _cost: "y" },
      ],
    });
    expect(validateDifficultChoice(bad).errors).toContain("moral_label_language");
  });

  it("rejects a hollow 'do nothing' option", () => {
    const bad = draft({
      ...spread(COMMS_TIME_PRESSURE),
      tradeoff: [
        { id: "tradeoff_1", label: "Correct the record immediately, accepting that you were incomplete", _value: "x", _cost: "y" },
        { id: "tradeoff_2", label: "Do nothing and hope the customer does not notice", _value: "none", _cost: "none" },
      ],
    });
    expect(validateDifficultChoice(bad).errors).toContain("tradeoff_hollow_option");
  });

  it("rejects an Action Decision that reduces to act vs bare avoidance", () => {
    const bad = draft({
      ...spread(FAIRNESS_CONFLICT),
      action: [
        { id: "action_1", label: "Announce the standard to both now and accept the fallout", isActionCommitment: true, _value: "x", _cost: "y" },
        { id: "action_2", label: "Wait", isActionCommitment: false, _value: "none", _cost: "none" },
      ],
    });
    const r = validateDifficultChoice(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e === "action_hollow_option" || e === "action_act_vs_avoidance")).toBe(true);
  });

  it("blocks extreme choice-length asymmetry", () => {
    const bad = draft({
      ...spread(OPERATIONAL_ACCURACY),
      primary: [
        {
          id: "primary_1",
          label:
            "Announce the suspected error immediately so nobody acts on bad data, accepting that you may be wrong and cause a costly and highly visible false alarm across the whole organization during a critical reporting week",
          _value: "x",
          _cost: "y",
        },
        { id: "primary_2", label: "Verify it", _value: "x", _cost: "y" },
      ],
    });
    expect(validateDifficultChoice(bad).errors).toContain("primary_choice_asymmetry");
  });

  it("allows a deferral that names its concrete cost (not hollow)", () => {
    // AUTHORITY_ESCALATION.tradeoff_2 starts with "Defer" but carries an explicit cost.
    const r = validateDifficultChoice(AUTHORITY_ESCALATION);
    expect(r.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// BRANCH-COHERENCE + LANGUAGE-PARITY REGRESSION FIXTURES (Founder review revision).
// The flat playable schema has ONE shared escalation for all Primary paths, so it must
// never presuppose a specific prior action, and a follow-on choice must not reference an
// artifact a branch never produced. These MUST FAIL the gate.
// ---------------------------------------------------------------------------

describe("validateDifficultChoice — branch coherence + language parity (must fail)", () => {
  it("A — escalation blames a delay the learner may not have taken", () => {
    const bad = draft({
      ...spread(COMMS_TIME_PRESSURE),
      escalation:
        "The customer already made a decision based on your delay, and the unconfirmed detail now matters more than before.",
    });
    expect(validateDifficultChoice(bad).errors).toContain("branch_incoherent_escalation");
  });

  it("B — a follow-on choice references a message that may never have been sent", () => {
    const bad = draft({
      ...spread(COMMS_TIME_PRESSURE),
      tradeoff: [
        { id: "tradeoff_1", label: "Stand by your original message and manage the fallout directly", _value: "x", _cost: "y" },
        { id: "tradeoff_2", label: "Put the confirmed parts on the record and mark the rest pending, accepting it reads as less decisive", _value: "x", _cost: "y" },
      ],
    });
    expect(validateDifficultChoice(bad).errors).toContain("branch_incoherent_reference");
  });

  it("C — legitimizing vs condemning language exposes the moral answer", () => {
    const bad = draft({
      ...spread(FAIRNESS_CONFLICT),
      tradeoff: [
        { id: "tradeoff_1", label: "Uphold the complaint on its merits and accept the risk of losing the top performer", _value: "x", _cost: "y" },
        { id: "tradeoff_2", label: "Partly discount the grievance to keep the peace on the team", _value: "x", _cost: "y" },
      ],
    });
    expect(validateDifficultChoice(bad).errors).toContain("tradeoff_moral_asymmetry");
  });

  it("D — one shared escalation whose facts require a single Primary path (went public)", () => {
    const bad = draft({
      ...spread(FAIRNESS_CONFLICT),
      escalation:
        "Now that you've gone public with the complaint to the whole team, leadership demands to know why it was not handled quietly.",
    });
    expect(validateDifficultChoice(bad).errors).toContain("branch_incoherent_escalation");
  });

  it("E — Action Decision asks the learner to continue an action never started in this branch", () => {
    const bad = draft({
      ...spread(LEADERSHIP_ACCOUNTABILITY),
      action: [
        { id: "action_1", label: "Continue the public announcement you started and commit to a fix date", isActionCommitment: true, _value: "x", _cost: "y" },
        { id: "action_2", label: "Confirm the recovery plan with the team first, holding the client waiting", isActionCommitment: false, _value: "x", _cost: "y" },
      ],
    });
    expect(validateDifficultChoice(bad).errors).toContain("branch_incoherent_reference");
  });
});

describe("validateDifficultChoice — revised fixtures pass after coherence + parity fixes", () => {
  it("keeps all five golden fixtures passing (branch-neutral, parity-balanced)", () => {
    for (const fixture of Object.values(GOLDEN)) {
      const r = validateDifficultChoice(fixture);
      expect(r.errors).toEqual([]);
      expect(r.ok).toBe(true);
    }
  });
});

/** Shallow re-annotation helper so a fixture can be partially overridden in a test. */
function spread(d: ArenaScenarioDraft) {
  const ann = (c: { id: string; label: string; isActionCommitment?: boolean }): Annotated => ({ ...c, _value: "x", _cost: "y" });
  return {
    title: d.title,
    opening: d.opening,
    primary: d.primary.choices.map(ann),
    escalation: d.tradeoff.escalationText,
    tradeoff: d.tradeoff.choices.map(ann),
    prompt: d.actionDecision.prompt,
    action: d.actionDecision.choices.map(ann),
  };
}

import { describe, it, expect } from "vitest";
import { validateConcreteScene } from "./quality";
import type { ArenaScenarioDraft, ScenarioBranch } from "./types";

/** A concrete base scene that PASSES the gate; individual fixtures override one part. */
function scene(over: Partial<ArenaScenarioDraft> = {}): ArenaScenarioDraft {
  return {
    title: "A call you have to make",
    opening: "A teammate flags a problem to you while the client is waiting and the shift is about to end.",
    primary: {
      choices: [
        { id: "primary_1", label: "Raise it with the team now and decide together" },
        { id: "primary_2", label: "Check the facts yourself first, then decide how to handle it" },
      ],
    },
    tradeoff: {
      escalationText: "The client asks who is responsible in front of the whole team.",
      choices: [
        { id: "t1", label: "Tell them plainly and own the miss yourself" },
        { id: "t2", label: "Bring in your manager to back the call, accepting how it looks" },
      ],
    },
    actionDecision: {
      prompt: "Decide what you will actually do now.",
      choices: [
        { id: "a1", label: "Decide now and tell everyone your reasoning, owning the pushback", isActionCommitment: true },
        { id: "a2", label: "Pause to confirm the facts first, accepting the delay", isActionCommitment: false },
      ],
    },
    ...over,
  };
}

describe("validateConcreteScene — the base concrete scene passes", () => {
  it("passes a scene with an actor, incident, stakeholder, and concrete actions", () => {
    const r = validateConcreteScene(scene());
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });
});

describe("validateConcreteScene — mandatory failing fixtures (must fail)", () => {
  it("A — 'A realistic moment … is called for' opening", () => {
    const r = validateConcreteScene(scene({ opening: "A realistic moment. Raise the risk before the shortcut is taken is called for, but it lands in that moment." }));
    expect(r.errors).toContain("opening_not_a_scene");
  });

  it("B — 'A difficult situation occurs. Leadership is required.'", () => {
    expect(validateConcreteScene(scene({ opening: "A difficult situation occurs. Leadership is required." })).errors).toContain("opening_not_a_scene");
  });

  it("C — abstract values prompt with no actor", () => {
    expect(validateConcreteScene(scene({ opening: "You must protect trust or protect accuracy. What do you choose?" })).errors).toContain("opening_no_actor");
  });

  it("D — a Primary choice with no concrete action", () => {
    const r = validateConcreteScene(scene({ primary: { choices: [{ id: "primary_1", label: "Demonstrate accountability" }, { id: "primary_2", label: "Raise it with the team now" }] } }));
    expect(r.errors).toContain("choice_no_concrete_action");
  });

  it("E — a generic escalation with no specific reaction", () => {
    const r = validateConcreteScene(scene({ tradeoff: { escalationText: "Your decision creates more pressure and people are concerned.", choices: [{ id: "t1", label: "Tell them and own it" }, { id: "t2", label: "Bring in your manager" }] } }));
    expect(r.errors).toContain("generic_escalation");
  });

  it("F — the same boilerplate repeated across the opening and every branch", () => {
    const b = (id: string): ScenarioBranch => ({
      escalationText: "The pressure grows because there isn't enough time to fix it.",
      tradeoffChoices: [{ id: `${id}_t1`, label: "Tell them now" }, { id: `${id}_t2`, label: "Bring in the lead" }],
      actionDecision: { prompt: "p", choices: [{ id: `${id}_a1`, label: "Decide now and tell them", isActionCommitment: true }, { id: `${id}_a2`, label: "Pause to confirm first", isActionCommitment: false }] },
    });
    const draft = scene({
      opening: "A teammate flags it, but there isn't enough time to deal with it before the shift ends.",
      branches: { primary_1: b("p1"), primary_2: b("p2") },
    });
    expect(validateConcreteScene(draft).errors).toContain("boilerplate_repetition");
  });

  it("G — a raw capability copied into a broken opening", () => {
    expect(validateConcreteScene(scene({ opening: "You must Raise the risk before the shortcut is taken is called for right now." })).errors).toContain("opening_not_a_scene");
  });

  it("catches placeholder / template-marker leakage", () => {
    expect(validateConcreteScene(scene({ opening: "A teammate flags {{incident}} to you while the client waits." })).errors).toContain("placeholder_leak");
  });
});

/*
  ★ A KOREAN OCCUPATION NOUN IS AN ACTOR (Founder practice, measured).

  `의사` was absent from the ACTOR vocabulary, so a complete Korean scene naming a doctor failed
  `opening_no_actor` — the gate could not see a person who was plainly on stage. The English list
  already carried `doctor`, but an English word boundary cannot match Korean text.

  The compound trap is the reason this is a lookahead and not a bare alternative: 의사결정 is
  "decision-making" and 의사소통 is "communication". Neither is a human being.
*/
describe("the Korean actor vocabulary", () => {
  const openingErrors = (opening: string) => validateConcreteScene(scene({ opening })).errors;

  it("counts 의사 as an actor however the particle attaches", () => {
    for (const opening of [
      "다른 의사가 휴가를 요청했고 당신은 지금 결정해야 한다.",
      "의사는 결정을 기다리고 있고 일정은 오늘 확정된다.",
      "한 의사에게 요청을 받았고 지금 답을 해야 한다.",
    ]) {
      expect(openingErrors(opening), opening).not.toContain("opening_no_actor");
    }
  });

  it("does NOT accept the abstract compounds that merely start with 의사", () => {
    for (const opening of [
      "의사결정이 어렵고 지금 판단을 내려야 하는 상황이다.",
      "의사소통이 중요하고 오늘 안에 정리해야 하는 상황이다.",
    ]) {
      expect(openingErrors(opening), opening).toContain("opening_no_actor");
    }
  });

  it("keeps every actor term that already worked", () => {
    for (const opening of [
      "동료가 문제를 알려왔고 지금 결정해야 한다.",
      "환자들이 기다리고 있고 일정은 오늘 확정된다.",
      "팀원이 이의를 제기했고 당신은 지금 답해야 한다.",
      "A teammate flags a problem to you while the client is waiting.",
    ]) {
      expect(openingErrors(opening), opening).not.toContain("opening_no_actor");
    }
  });
});

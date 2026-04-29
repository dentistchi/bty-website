import { describe, expect, it } from "vitest";
import {
  buildPatternState,
  CHAIN_PATTERN_SIGNIFICANT_GAP,
  detectPatternTriggers,
  encodeActionContractQrUri,
  emptyArchetypeCounts,
  generateChainPatternInsight,
  parseActionContractQrUri,
  type ChainChoiceRecord,
} from "./chainPatternEngine";

const impact = (
  r: number,
  t: number,
  sn: number,
  c: number,
): ChainChoiceRecord["state_impact"] => ({
  reputation: r as ChainChoiceRecord["state_impact"]["reputation"],
  trust: t as ChainChoiceRecord["state_impact"]["trust"],
  self_narrative: sn as ChainChoiceRecord["state_impact"]["self_narrative"],
  courage: c as ChainChoiceRecord["state_impact"]["courage"],
});

describe("buildPatternState", () => {
  it("counts archetypes and sums impacts", () => {
    const choices: ChainChoiceRecord[] = [
      { archetype: "avoid", state_impact: impact(0, -1, 0, 0) },
      { archetype: "avoid", state_impact: impact(0, -1, 0, 0) },
      { archetype: "structure", state_impact: impact(0, 0, 1, 0) },
    ];
    const s = buildPatternState(choices);
    expect(s.archetypeCounts).toEqual({ avoid: 2, structure: 1, confront: 0 });
    expect(s.summedImpact).toEqual({ reputation: 0, trust: -2, self_narrative: 1, courage: 0 });
    expect(s.choiceCount).toBe(3);
  });

  it("starts at zero for empty input", () => {
    const s = buildPatternState([]);
    expect(s.archetypeCounts).toEqual(emptyArchetypeCounts());
    expect(s.summedImpact).toEqual({ reputation: 0, trust: 0, self_narrative: 0, courage: 0 });
    expect(s.choiceCount).toBe(0);
  });
});

describe("detectPatternTriggers", () => {
  it("A: repetition when any archetype >= 4", () => {
    const choices: ChainChoiceRecord[] = Array.from({ length: 9 }, () => ({
      archetype: "avoid" as const,
      state_impact: impact(0, 0, 0, 0),
    }));
    const t = detectPatternTriggers(buildPatternState(choices));
    expect(t.repetition).toBe(true);
  });

  it("B: negative drift on trust/courage/self_narrative <= -3", () => {
    const choices: ChainChoiceRecord[] = [
      { archetype: "structure", state_impact: impact(0, -2, 0, 0) },
      { archetype: "structure", state_impact: impact(0, -2, 0, 0) },
    ];
    const t = detectPatternTriggers(buildPatternState(choices));
    expect(t.negativeDrift).toBe(true);
  });

  it("C: imbalance when avoid - confront >= gap", () => {
    const choices: ChainChoiceRecord[] = [
      { archetype: "avoid", state_impact: impact(0, 0, 0, 0) },
      { archetype: "avoid", state_impact: impact(0, 0, 0, 0) },
      { archetype: "confront", state_impact: impact(0, 0, 0, 0) },
    ];
    const t = detectPatternTriggers(buildPatternState(choices));
    expect(CHAIN_PATTERN_SIGNIFICANT_GAP).toBe(2);
    expect(t.imbalance).toBe(false);
    const choices2: ChainChoiceRecord[] = [
      ...choices,
      { archetype: "avoid", state_impact: impact(0, 0, 0, 0) },
    ];
    expect(detectPatternTriggers(buildPatternState(choices2)).imbalance).toBe(true);
  });

  it("interventionQr only when repetition and negative drift", () => {
    const nineAvoid: ChainChoiceRecord[] = Array.from({ length: 9 }, () => ({
      archetype: "avoid" as const,
      state_impact: impact(0, -1, 0, 0),
    }));
    const t1 = detectPatternTriggers(buildPatternState(nineAvoid));
    expect(t1.repetition).toBe(true);
    expect(t1.negativeDrift).toBe(true);
    expect(t1.interventionQr).toBe(true);
    expect(t1.stretchPrompt).toBe(false);
  });

  it("stretchPrompt when repetition and imbalance but not negative drift (no intervention QR)", () => {
    const nineAvoidNeutral: ChainChoiceRecord[] = Array.from({ length: 9 }, () => ({
      archetype: "avoid" as const,
      state_impact: impact(0, 0, 0, 0),
    }));
    const t2 = detectPatternTriggers(buildPatternState(nineAvoidNeutral));
    expect(t2.repetition).toBe(true);
    expect(t2.negativeDrift).toBe(false);
    expect(t2.imbalance).toBe(true);
    expect(t2.interventionQr).toBe(false);
    expect(t2.stretchPrompt).toBe(true);
  });

  it("neither when repetition missing or drift without repetition", () => {
    const noRep: ChainChoiceRecord[] = [
      { archetype: "avoid", state_impact: impact(0, -3, 0, 0) },
      { archetype: "structure", state_impact: impact(0, 0, 0, 0) },
    ];
    const t3 = detectPatternTriggers(buildPatternState(noRep));
    expect(t3.repetition).toBe(false);
    expect(t3.negativeDrift).toBe(true);
    expect(t3.interventionQr).toBe(false);
    expect(t3.stretchPrompt).toBe(false);
  });
});

describe("encodeActionContractQrUri / parseActionContractQrUri", () => {
  it("round-trips query fields", () => {
    const answers = {
      who: "Alex",
      what: "the budget talk",
      when: "Friday 4pm",
      how: "I'll ask for 15 minutes on calendar",
    };
    const uri = encodeActionContractQrUri(answers);
    expect(uri.startsWith("bty://contract?")).toBe(true);
    const back = parseActionContractQrUri(uri);
    expect(back).toEqual(answers);
  });

  it("encodes special characters", () => {
    const uri = encodeActionContractQrUri({
      who: "A & B",
      what: "what?",
      when: "soon",
      how: "start with hi",
    });
    expect(uri).toContain("who=A+%26+B");
    expect(parseActionContractQrUri(uri)?.who).toBe("A & B");
  });
});

describe("generateChainPatternInsight", () => {
  it("returns example-style lines for dominant + drained axis", () => {
    const avoidTrust: ChainChoiceRecord[] = [
      { archetype: "avoid", state_impact: impact(0, -1, 0, 0) },
      { archetype: "avoid", state_impact: impact(0, -1, 0, 0) },
      { archetype: "avoid", state_impact: impact(0, -1, 0, 0) },
      { archetype: "structure", state_impact: impact(0, 0, 0, 0) },
      { archetype: "confront", state_impact: impact(0, 0, 0, 0) },
    ];
    const state = buildPatternState(avoidTrust);
    const triggers = detectPatternTriggers(state);
    const line = generateChainPatternInsight(state, triggers);
    expect(line).toContain("trust");

    const confrontRep: ChainChoiceRecord[] = [
      { archetype: "confront", state_impact: impact(-1, 0, 0, 0) },
      { archetype: "confront", state_impact: impact(-1, 0, 0, 0) },
      { archetype: "confront", state_impact: impact(-1, 0, 0, 0) },
      { archetype: "avoid", state_impact: impact(0, 0, 0, 0) },
      { archetype: "structure", state_impact: impact(0, 0, 0, 0) },
    ];
    const state2 = buildPatternState(confrontRep);
    const line2 = generateChainPatternInsight(state2, detectPatternTriggers(state2));
    expect(line2.toLowerCase()).toMatch(/standing|reputation|direct/);
  });
});

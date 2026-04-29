import { describe, expect, it } from "vitest";
import { runAllLayer1Rules } from "./layer1Rules";

describe("runAllLayer1Rules", () => {
  it("returns all Layer 1 failures together (not fail-fast)", () => {
    const errors = runAllLayer1Rules({
      who: "they",
      what: "x",
      how: "ok",
      when: "soon",
      rawText: "",
    });
    const rules = errors.map((e) => e.rule);
    expect(rules).toContain("R6");
    expect(rules).toContain("R1");
    expect(rules).toContain("R2");
    expect(rules).toContain("R4");
    expect(rules).toContain("R5");
  });

  it("passes a minimal well-formed contract", () => {
    expect(
      runAllLayer1Rules({
        who: "My direct report Alex Kim",
        what: "Schedule a 30-minute feedback meeting with Alex",
        how: "Send a calendar invite and agenda for concrete examples",
        when: "Tomorrow at 3pm",
        rawText: "Full step-6 capture verbatim.",
      }),
    ).toEqual([]);
  });
});

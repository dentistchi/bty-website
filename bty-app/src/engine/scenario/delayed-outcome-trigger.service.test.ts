import { describe, it, expect } from "vitest";
import {
  DELAYED_OUTCOME_TEMPLATES,
  pickDelayedOutcomeTemplate,
} from "./delayed-outcome-trigger.service";

describe("delayed-outcome-trigger.service", () => {
  it("DELAYED_OUTCOME_TEMPLATES has 2 entries per flag bucket", () => {
    for (const k of ["HERO_TRAP", "INTEGRITY_SLIP", "CLEAN", "ROLE_MIRROR"] as const) {
      expect(DELAYED_OUTCOME_TEMPLATES[k].length).toBe(2);
    }
  });

  it("pickDelayedOutcomeTemplate toggles with scenario_type hash", () => {
    const a = pickDelayedOutcomeTemplate("HERO_TRAP", "aa");
    const b = pickDelayedOutcomeTemplate("HERO_TRAP", "a");
    expect(a.id).not.toBe(b.id);
  });

  it("normalizes flag substrings to buckets", () => {
    const t = pickDelayedOutcomeTemplate("x INTEGRITY_SLIP y", "");
    expect(DELAYED_OUTCOME_TEMPLATES.INTEGRITY_SLIP.map((x) => x.id)).toContain(t.id);
  });
});

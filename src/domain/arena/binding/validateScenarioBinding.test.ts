import { describe, expect, it } from "vitest";
import { validateScenarioBinding } from "./validateScenarioBinding";

describe("validateScenarioBinding", () => {
  it("ok when ids present and in allowlist", () => {
    const r = validateScenarioBinding(
      {
        dbScenarioId: "core_01",
        choices: [
          { choiceId: "A", dbChoiceId: "core_01:primary:A" },
          { choiceId: "B", dbChoiceId: "core_01:primary:B" },
        ],
      },
      ["core_01:primary:A", "core_01:primary:B"],
    );
    expect(r).toEqual({ ok: true });
  });

  it("fails missing_dbScenarioId", () => {
    expect(validateScenarioBinding({ dbScenarioId: "", choices: [{ choiceId: "A", dbChoiceId: "x" }] }, ["x"])).toEqual({
      ok: false,
      reason: "missing_dbScenarioId",
    });
  });

  it("fails missing_choices", () => {
    expect(validateScenarioBinding({ dbScenarioId: "s", choices: [] }, [])).toEqual({
      ok: false,
      reason: "missing_choices",
    });
  });

  it("fails unmatched dbChoiceId", () => {
    const r = validateScenarioBinding(
      { dbScenarioId: "s", choices: [{ choiceId: "A", dbChoiceId: "not-in-list" }] },
      ["allowed-only"],
    );
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.reason).toContain("unmatched_dbChoiceId");
  });
});

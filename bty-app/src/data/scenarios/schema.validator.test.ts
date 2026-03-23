import { describe, it, expect } from "vitest";
import path from "path";
import {
  ScenarioSchema,
  ScenarioValidationError,
  validateScenarioFile,
  validateAllScenarioJsonFilesAtLoad,
} from "./schema.validator";

describe("schema.validator", () => {
  it("ScenarioSchema parses difficulty union", () => {
    expect(() =>
      ScenarioSchema.parse({
        id: "a",
        locale: "ko",
        title: "",
        body: "",
        scenario_type: "t",
        difficulty: 4 as unknown as 1,
        choices: [{ id: "A", text: "", flag_type: "" }],
      }),
    ).toThrow();
  });

  it("validateScenarioFile succeeds for sample en JSON", async () => {
    const p = path.join(
      process.cwd(),
      "src/data/scenarios/en/patient_refuses_treatment_001.json",
    );
    const r = await validateScenarioFile(p);
    expect(r.ok).toBe(true);
    expect(r.data.id).toBe("patient_refuses_treatment_001");
  });

  it("validateScenarioFile throws ScenarioValidationError for bad JSON path field", async () => {
    const badPath = path.join(process.cwd(), "src/data/scenarios/en/__missing__.json");
    await expect(validateScenarioFile(badPath)).rejects.toThrow(ScenarioValidationError);
  });

  it("validateAllScenarioJsonFilesAtLoad runs on repo samples", async () => {
    const r = await validateAllScenarioJsonFilesAtLoad();
    expect(r.count).toBeGreaterThanOrEqual(2);
  });
});

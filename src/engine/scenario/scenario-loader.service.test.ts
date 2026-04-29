import { describe, it, expect } from "vitest";
import { ScenarioSchema } from "@/data/scenarios/schema.validator";

describe("scenario loader + Zod scenario JSON", () => {
  it("ScenarioSchema accepts minimal valid payload", () => {
    const r = ScenarioSchema.parse({
      id: "x",
      locale: "en",
      title: "T",
      body: "B",
      scenario_type: "st",
      difficulty: 1,
      choices: [{ id: "A", text: "t", flag_type: "f" }],
    });
    expect(r.difficulty).toBe(1);
  });
});

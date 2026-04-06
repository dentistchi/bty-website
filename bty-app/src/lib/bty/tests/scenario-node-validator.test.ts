import { describe, expect, it } from "vitest";
import {
  validateScenarioNode,
  validateScenarioSet,
  type ScenarioNode,
} from "../scenario-node-validator";
import {
  invalidGenericChoiceLabel,
  invalidLevel5MissingQuestion,
  invalidWrongChoiceCount,
  validChainNodeStage3,
} from "./fixtures/scenario-node-fixtures";

describe("scenario-node-validator", () => {
  describe("validateScenarioNode", () => {
    it("accepts the valid fixture (errors only; warnings allowed)", () => {
      const r = validateScenarioNode(validChainNodeStage3);
      expect(r.valid).toBe(true);
      expect(r.issues.filter((i) => i.severity === "error")).toHaveLength(0);
    });

    it("errors when choices length is not 3", () => {
      const r = validateScenarioNode(invalidWrongChoiceCount);
      expect(r.valid).toBe(false);
      expect(r.issues.some((i) => i.field === "choices" && i.severity === "error")).toBe(true);
    });

    it("errors on generic phrasing in choice label", () => {
      const r = validateScenarioNode(invalidGenericChoiceLabel);
      expect(r.valid).toBe(false);
      expect(
        r.issues.some(
          (i) => i.field === "choices.A.label" && i.message.includes("generic phrasing")
        )
      ).toBe(true);
    });

    it("errors when level 5 omits level_5 question", () => {
      const r = validateScenarioNode(invalidLevel5MissingQuestion);
      expect(r.valid).toBe(false);
      expect(
        r.issues.some(
          (i) => i.field === "questions.level_5" && i.severity === "error"
        )
      ).toBe(true);
    });
  });

  describe("validateScenarioSet", () => {
    it("flags duplicate scenario ids", () => {
      const a: ScenarioNode = { ...validChainNodeStage3, id: "dup-id" };
      const b: ScenarioNode = { ...validChainNodeStage3, id: "dup-id", title: "Other title" };
      const r = validateScenarioSet([a, b]);
      expect(r.valid).toBe(false);
      expect(r.issues.some((i) => i.message.includes("Duplicate scenario id"))).toBe(true);
    });

    it("flags next_map target missing from the set", () => {
      const node: ScenarioNode = {
        ...validChainNodeStage3,
        id: "has-bad-next",
        next_map: { A: "missing-node", B: "missing-node", C: "missing-node" },
      };
      const r = validateScenarioSet([node]);
      expect(r.valid).toBe(false);
      expect(
        r.issues.some((i) => i.field.includes("next_map") && i.message.includes("missing scenario id"))
      ).toBe(true);
    });

    it("passes two valid nodes with consistent next_map", () => {
      const first: ScenarioNode = {
        ...validChainNodeStage3,
        id: "chain-a",
        chain_stage: 1,
        level: 1,
        questions: { level_1: validChainNodeStage3.questions.level_1! },
        next_map: { A: "chain-b", B: "chain-b", C: "chain-b" },
      };
      const second: ScenarioNode = {
        ...validChainNodeStage3,
        id: "chain-b",
        title: "Second beat",
      };
      const r = validateScenarioSet([first, second]);
      expect(r.issues.filter((i) => i.severity === "error")).toHaveLength(0);
      expect(r.valid).toBe(true);
    });
  });
});

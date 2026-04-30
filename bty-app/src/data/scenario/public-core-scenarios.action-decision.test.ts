/**
 * Public scenario en.json: every escalation branch with action_decision.choices
 * must expose AD1 (action commitment) vs AD2 (non-commitment), matching JSON runtime
 * expectations: AD1 maps to ACTION_REQUIRED, AD2 to NEXT_SCENARIO_READY.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scenarioList } from "@/data/scenario";

const publicScenarioDir = join(process.cwd(), "public/data/scenario");

type AdChoice = {
  id?: string;
  meaning?: { is_action_commitment?: boolean };
  is_action_commitment?: boolean;
};

function commitmentOf(c: AdChoice): boolean | undefined {
  return c.meaning?.is_action_commitment ?? c.is_action_commitment;
}

describe("public/data/scenario core catalog", () => {
  it.each(scenarioList)("has base.json, en.json, ko.json for %s", (id) => {
    for (const name of ["base.json", "en.json", "ko.json"] as const) {
      const p = join(publicScenarioDir, id, name);
      expect(existsSync(p), `missing ${p}`).toBe(true);
    }
  });

  it.each(scenarioList)("en.json AD1=true AD2=false on every action_decision branch for %s", (id) => {
    const raw = readFileSync(join(publicScenarioDir, id, "en.json"), "utf8");
    const en = JSON.parse(raw) as { escalationBranches?: Record<string, unknown> };
    expect(en.escalationBranches, `${id}: escalationBranches`).toBeTruthy();
    for (const [branchKey, branch] of Object.entries(en.escalationBranches ?? {})) {
      if (!branch || typeof branch !== "object") continue;
      const ad = (branch as { action_decision?: { choices?: AdChoice[] } }).action_decision;
      const choices = ad?.choices;
      if (!Array.isArray(choices) || choices.length === 0) continue;
      const ad1 = choices.find((c) => c.id === "AD1");
      const ad2 = choices.find((c) => c.id === "AD2");
      expect(ad1, `${id} branch ${branchKey}: AD1`).toBeTruthy();
      expect(ad2, `${id} branch ${branchKey}: AD2`).toBeTruthy();
      expect(commitmentOf(ad1!), `${id} ${branchKey} AD1 commitment`).toBe(true);
      expect(commitmentOf(ad2!), `${id} ${branchKey} AD2 commitment`).toBe(false);
    }
  });
});

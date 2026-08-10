import { describe, it, expect } from "vitest";
import {
  SCENARIO_PRESSURE_POLICY,
  namesRealPressure,
  namesIndependentMoment,
  scenarioPressurePromptLines,
  validateScenarioContract,
  type BehaviorContract,
} from "./program-coherence";

/**
 * SLICE 3.2O-R2 — ONE PRESSURE AUTHORITY, TWO CONSUMERS.
 *
 * Three paid windows were spent on one real training. The third was refused
 * `scenario_without_pressure` against a prompt that had, one slice earlier, been hardened to
 * say what pressure MAY be — and two of the categories it named matched nothing the floor
 * recognises. The prompt was hand-written beside a regex nobody could compare it against.
 *
 * These tests hold the two halves together. The first suite proves the refactor changed no
 * semantics; the second proves every category the model is told about is one the validator
 * actually accepts; the third proves the two scenario gates remain independent.
 */
const B: BehaviorContract = {
  actor: "Front desk staff",
  trigger: "before each scheduled appointment",
  observableAction: "make a confirmation call and follow the checklist of required questions",
  completion: { confirmedBy: "the supervisor", confirmationAction: "review the completed checklist" },
};

const scenario = (pressureCondition: string, pressureDetail: string | null = null) =>
  validateScenarioContract({ pressure_condition: pressureCondition, pressure_detail: pressureDetail }, B);

const refusalOf = (r: ReturnType<typeof scenario>) => (r.ok ? null : `${r.defect.field}/${r.defect.reason}`);

/**
 * THE FROZEN REFERENCE — the exact regex that shipped before this slice, kept verbatim so
 * the refactor is measured against it rather than against a memory of it.
 */
const FROZEN_CONSTRAINT_MARKER =
  /\b(?:no\s+time|not\s+enough\s+time|short\s+of\s+time|running\s+late|late|rush\w*|hurry|busy|queue|waiting|already|interrupt\w*|pressure|push\w*\s+back|pushback|resist\w*|disagree\w*|argu\w*|refus\w*|tired|exhaust\w*|end\s+of\s+(?:the\s+)?(?:shift|day)|understaffed|short-staffed|missing|unavailable|absent|urgent|deadline|competing|conflict\w*|distract\w*|noisy|noise|nobody|no\s+one|someone\s+else|another\s+(?:person|task|request)|only\s+\w+\s+minutes|still\s+\w+ing|has\s+not\s+arrived|hasn't\s+arrived|left\s+(?:early|for\s+the\s+day)|awkward|uncomfortable|senior|manager\s+is|being\s+watched|first\s+time|unclear|unsure)\b|바쁘|늦|압박|서둘/i;

/** Every token the frozen regex accepted, plus phrases that must stay refused. */
const CORPUS: string[] = [
  // --- one probe per accepted alternative, in the frozen regex's own order ---
  "there is no time", "there is not enough time", "they are short of time", "the nurse is running late",
  "the appointment ran late", "it is a rush", "everyone is in a hurry", "the desk is busy",
  "a queue is building", "someone is waiting", "the room is already full", "the phone interrupts constantly",
  "there is pressure from the front", "the lead pushes back", "there is pushback", "the colleague resists",
  "the doctor disagrees", "two people are arguing", "the patient refuses", "the staff member is tired",
  "the team is exhausted", "it is the end of the shift", "it is the end of day", "the clinic is understaffed",
  "the clinic is short-staffed", "the record is missing", "the file is unavailable", "the lead is absent",
  "the case is urgent", "a deadline is close", "two tasks are competing", "the instructions conflict",
  "the noise distracts them", "the room is noisy", "there is background noise", "nobody is free",
  "no one has time", "someone else is doing it", "another task needs attention", "there are only five minutes",
  "the doctor is still writing", "the chart has not arrived", "the chart hasn't arrived",
  "the colleague left early", "the colleague left for the day", "it feels awkward", "it is uncomfortable",
  "a senior is watching", "the manager is present", "they are being watched", "it is their first time",
  "the next step is unclear", "the staff member is unsure",
  "환자가 기다리고 있어 바쁘다", "늦었다", "압박이 있다", "서둘러야 한다",
  // --- must remain UNMATCHED: no constraint named ---
  "the workload is heavy and staff are managing many tasks",
  "the system is slow and records load one at a time",
  "the team works hard every day",
  "staff follow the usual approach",
  "the desk is calm and everything is on schedule",
];

describe("[3.2O-R2] the refactor changed NO validator semantics", () => {
  it("matches the frozen regex on every corpus phrase, in both directions", () => {
    const drift = CORPUS.filter((p) => FROZEN_CONSTRAINT_MARKER.test(p) !== namesRealPressure(p));
    expect(drift, `drifted:\n${drift.join("\n")}`).toEqual([]);
  });

  it("still accepts what it accepted, and still refuses what it refused", () => {
    // The two phrases from the R1 prompt that this slice exists because of.
    expect(namesRealPressure("the workload is heavy and staff are managing many tasks")).toBe(false);
    expect(namesRealPressure("the system is slow and records load one at a time")).toBe(false);
    expect(namesRealPressure("a queue is building at the desk")).toBe(true);
  });

  it("the policy is not empty and every family carries its required parts", () => {
    expect(SCENARIO_PRESSURE_POLICY.length).toBeGreaterThan(0);
    for (const f of SCENARIO_PRESSURE_POLICY) {
      expect(f.id, "id").toMatch(/^[a-z_]+$/);
      expect(f.promptLine.trim().length, `${f.id} promptLine`).toBeGreaterThan(10);
      expect(f.example.trim().length, `${f.id} example`).toBeGreaterThan(10);
    }
    expect(new Set(SCENARIO_PRESSURE_POLICY.map((f) => f.id)).size).toBe(SCENARIO_PRESSURE_POLICY.length);
  });
});

describe("[3.2O-R2] PROMPT ↔ VALIDATOR PARITY — the defect that cost the third window", () => {
  /**
   * The invariant that would have caught it: every category the model is told counts as
   * pressure must be one the floor recognises, demonstrated by a sentence that survives the
   * WHOLE scenario validator — not just the marker test.
   */
  it("every family's example survives the real validator end to end", () => {
    const failures: string[] = [];
    for (const f of SCENARIO_PRESSURE_POLICY) {
      const r = scenario(f.example);
      if (!r.ok) failures.push(`${f.id}: "${f.example}" → ${refusalOf(r)}`);
    }
    expect(failures, `\n${failures.join("\n")}`).toEqual([]);
  });

  it("every family's example is matched by its OWN pattern, not merely by a sibling", () => {
    for (const f of SCENARIO_PRESSURE_POLICY) {
      expect(f.pattern.test(f.example), `${f.id} example does not exercise its own family`).toBe(true);
    }
  });

  it("no family example smuggles in a second occasion", () => {
    for (const f of SCENARIO_PRESSURE_POLICY) {
      expect(namesIndependentMoment(f.example), `${f.id} example names an occasion`).toBe(false);
    }
  });

  it("the prompt lines are derived from the policy — one line per family, never hand-listed", () => {
    const lines = scenarioPressurePromptLines();
    expect(lines).toHaveLength(SCENARIO_PRESSURE_POLICY.length);
    for (const f of SCENARIO_PRESSURE_POLICY) {
      expect(lines.some((l) => l.includes(f.promptLine)), `${f.id} missing from the prompt`).toBe(true);
    }
  });

  it("the categories that caused the third refusal can no longer be recommended", () => {
    // "workload" and "operational constraint" named nothing the floor accepts. If either is
    // ever put back into a promptLine, its family example would have to pass — and it cannot.
    const prose = scenarioPressurePromptLines().join(" ").toLowerCase();
    expect(prose).not.toContain("workload");
    expect(prose).not.toContain("operational constraint");
  });
});

describe("[3.2O-R2] the two scenario gates stay independent", () => {
  it("valid pressure + inherited moment + no restatement → PASS", () => {
    expect(scenario("a queue is building at the desk").ok).toBe(true);
    expect(scenario("the information is missing", "another task is competing for attention").ok).toBe(true);
  });

  it("no pressure → scenario_without_pressure", () => {
    expect(refusalOf(scenario("the workload is heavy and staff are managing many tasks")))
      .toBe("pressureCondition/no_pressure");
    expect(refusalOf(scenario("the system is slow and records load one at a time")))
      .toBe("pressureCondition/no_pressure");
  });

  it("valid pressure + a second occasion → independent_moment, in EITHER field", () => {
    expect(refusalOf(scenario("someone is waiting during the next confirmation call")))
      .toBe("pressureCondition/independent_moment");
    expect(refusalOf(scenario("a queue is building", "the patient is distracted during the call")))
      .toBe("pressureDetail/independent_moment");
  });

  it("a sentence can name real pressure and STILL be refused for its occasion", () => {
    // Proof the gates are separate: this passes the floor and fails the moment rule.
    const text = "the desk is busy before the next appointment";
    expect(namesRealPressure(text), "floor accepts it").toBe(true);
    expect(namesIndependentMoment(text), "moment rule refuses it").toBe(true);
    expect(refusalOf(scenario(text))).toBe("pressureCondition/independent_moment");
  });

  it("restating the trained action is still refused", () => {
    expect(refusalOf(scenario("staff make a confirmation call and follow the checklist of required questions")))
      .toBe("pressureCondition/restates_action");
  });

  it("placeholder difficulty is still refused as generic", () => {
    for (const g of ["it is difficult", "there is pressure", "a busy day"]) {
      expect(refusalOf(scenario(g)), g).toBe("pressureCondition/generic");
    }
  });
});

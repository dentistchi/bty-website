import { describe, it, expect } from "vitest";
import {
  PROGRAM_REFUSAL_COPY,
  GENERATE_ERROR_COPY,
  SURFACE_FAILURE_COPY,
  UNKNOWN_FAILURE_COPY,
  RECOVERY_NOTE,
  PROGRAM_RETRY_POLICY,
  resolveRefusalCopy,
} from "./programRefusalCopy";
import { PROGRAM_REJECT_CODES } from "@/domain/foundry/module/program-authorship";

/**
 * Slice 3.2L-R5 — G10/G11.
 *
 * THE LIVE DEFECT. The R4 window refused `scenario_unrelated` and the Founder was told BTY
 * "didn't meet our honesty rules". Nothing dishonest had been generated: the scenario was
 * judged off-topic by a lexical overlap check. Ten semantic codes shared that fallback.
 */

describe("[3.2L-R5] G10 — every refusal code has copy and a recovery", () => {
  it("the copy map covers the code union exactly, with nothing missing or extra", () => {
    const mapped = Object.keys(PROGRAM_REFUSAL_COPY).sort();
    const declared = [...PROGRAM_REJECT_CODES].sort();
    expect(mapped).toEqual(declared);
  });

  /**
   * THE MUTATION PROOF. `PROGRAM_REFUSAL_COPY` is typed `Record<ProgramRejectCode, …>`, so
   * adding a code to the union without copy is a COMPILE error, not a runtime surprise.
   * This asserts the runtime half of the same guarantee — a synthetic unmapped code
   * resolves to the non-accusatory fallback rather than to a sentence about honesty.
   */
  it("an unmapped code falls back without making any accusation", () => {
    const copy = resolveRefusalCopy("invalid_output", "synthetic_unmapped_code_r5");
    expect(copy).toEqual(GENERATE_ERROR_COPY.invalid_output);
    expect(copy.headline).not.toMatch(/honesty|dishonest|unsafe|policy/i);
    expect(UNKNOWN_FAILURE_COPY.headline).not.toMatch(/honesty|dishonest|unsafe|policy/i);
  });

  it("every entry says something, and says nothing changed", () => {
    for (const [code, copy] of Object.entries(PROGRAM_REFUSAL_COPY)) {
      expect(copy.headline.length, code).toBeGreaterThan(20);
      expect(copy.headline, code).toMatch(/Nothing was (changed|added)\./);
      expect(RECOVERY_NOTE[copy.recovery], code).toBeTruthy();
    }
    for (const [code, copy] of Object.entries(GENERATE_ERROR_COPY)) {
      expect(copy.headline.length, code).toBeGreaterThan(10);
      expect(RECOVERY_NOTE[copy.recovery], code).toBeTruthy();
    }
  });

  it("every recovery note states that another draft costs a new generation", () => {
    for (const [recovery, note] of Object.entries(RECOVERY_NOTE)) {
      expect(note, recovery).toMatch(/new AI generation/);
    }
  });
});

describe("[3.2L-R5] G11 — no honesty misattribution", () => {
  const HONESTY = /honesty|dishonest|deceptive|lie|unsafe|policy violation/i;

  it("relevance, coherence, ordering and formatting faults are never called dishonesty", () => {
    for (const code of [
      "scenario_unrelated",
      "scenario_without_pressure",
      "dependency_inversion",
      "non_observable_standard",
      "field_type",
      "generic_completion",
      "duplicate_content",
      "section_contradiction",
      "complaint_replay",
      "decision_is_only_reflection",
      "application_without_actor",
      "missing_required_kind",
    ] as const) {
      const copy = PROGRAM_REFUSAL_COPY[code];
      const text = `${copy.headline} ${copy.explanation}`;
      expect(text, code).not.toMatch(HONESTY);
    }
  });

  it("the exact live refusal now names the actual problem", () => {
    const copy = resolveRefusalCopy("invalid_output", "scenario_unrelated");
    expect(copy.headline).toContain("couldn’t connect the practice situation");
    expect(copy.headline).not.toMatch(HONESTY);
    // The sentence the Founder was actually shown must be gone.
    expect(copy.headline).not.toContain("discarded it rather than show it to you");
  });

  it("grounding refusals DO keep their specific material explanation", () => {
    const copy = PROGRAM_REFUSAL_COPY.material_fabrication;
    expect(copy.headline).toContain("template or tool you haven’t provided");
    expect(copy.recovery).toBe("add_the_real_material");
  });

  it("no copy exposes validator vocabulary", () => {
    const all = [
      ...Object.values(PROGRAM_REFUSAL_COPY),
      ...Object.values(GENERATE_ERROR_COPY),
      ...Object.values(SURFACE_FAILURE_COPY),
      UNKNOWN_FAILURE_COPY,
    ];
    for (const c of all) {
      const text = `${c.headline} ${c.explanation}`;
      expect(text).not.toMatch(/validator|schema|refusal_kind|regex|behavior_contract|scenario_contract|journey element|overlap/i);
    }
  });
});

describe("[3.2L-R5] G12 — no terminal refusal permits a direct provider call", () => {
  it("the retry policy is uniform and closed", () => {
    expect(PROGRAM_RETRY_POLICY.immediateRetryAllowed).toBe(false);
  });

  it("resolution order prefers the precise refusal over the broader code", () => {
    // `stale_context` + `status_no_longer_draft`: only the refusal says what happened.
    expect(resolveRefusalCopy("stale_context", "status_no_longer_draft")).toBe(SURFACE_FAILURE_COPY.status_no_longer_draft);
    expect(resolveRefusalCopy("invalid_output", "dependency_inversion")).toBe(PROGRAM_REFUSAL_COPY.dependency_inversion);
    expect(resolveRefusalCopy("timeout", null)).toBe(GENERATE_ERROR_COPY.timeout);
    expect(resolveRefusalCopy(null, null)).toBe(UNKNOWN_FAILURE_COPY);
  });
});

/**
 * SLICE 3.2P-R3.5 — THE REFUSAL MUST NOT ASK FOR WHAT THE HOST ALREADY GAVE.
 *
 * W5 refused `trigger_not_recurring` on a draft whose Host answers name the same repeating
 * moment three times, and told the Host to "Say when this keeps happening in your own words".
 * There is no Builder question that holds a moment, so the sentence asked for something already
 * supplied through a control that does not exist.
 */
describe("[3.2P-R3.5] trigger_not_recurring says only what BTY can know", () => {
  const copy = PROGRAM_REFUSAL_COPY.trigger_not_recurring;

  it("names what BTY could not produce, and that nothing changed", () => {
    expect(copy.headline).toContain("BTY couldn’t work out when the first real chance to do this would be");
    expect(copy.headline).toContain("Nothing was changed.");
    expect(copy.explanation).toContain("The moment BTY wrote");
  });

  it("does not instruct the Host to supply a moment through a field that does not exist", () => {
    const text = `${copy.headline} ${copy.explanation} ${RECOVERY_NOTE[copy.recovery]}`;
    expect(text).not.toMatch(/say when this keeps happening/i);
    expect(text).not.toMatch(/in your own words/i);
    expect(text).not.toMatch(/update your training answers/i);
    // …and it does not promise that editing anything will fix it.
    expect(text).not.toMatch(/will fix|then it will|so that it/i);
  });

  it("its recovery is the 'nothing for you to change' category", () => {
    expect(copy.recovery).toBe("start_a_new_draft");
  });

  it("exposes none of the internal vocabulary this repair touched", () => {
    const text = `${copy.headline} ${copy.explanation}`;
    expect(text).not.toMatch(/trigger|parser|quantifier|recurrence|gerund|fold/i);
  });

  it("NO refusal anywhere claims the Host withheld the moment", () => {
    /*
      The product cannot know that until a Host-owned recurring moment exists. Asserted across
      the whole map so the sentence cannot reappear under another code.
    */
    for (const [code, c] of Object.entries(PROGRAM_REFUSAL_COPY)) {
      expect(`${c.headline} ${c.explanation}`, code).not.toMatch(/say when this keeps happening/i);
    }
  });
});

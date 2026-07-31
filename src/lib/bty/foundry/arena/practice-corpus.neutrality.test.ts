import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EVAL_CORPUS } from "./practice-generation.eval";

/**
 * CORPUS NEUTRALITY + ARTIFACT LINEAGE (Slice 3.2I-R5B1A.1-R2.20).
 *
 * Two measured defects drive this file.
 *
 * 1. c01's input embedded an ANSWER KEY. `observableBehavior` said "Own the miss and reset the
 *    client honestly" and the avoidance pressure was "admitting the miss feels like losing the
 *    client's trust". The generator produced admit-versus-conceal twice (bad_faith_option, then
 *    moral_decoy), and in a later pass produced an ACCEPTED scenario whose second primary was
 *    "Assure the client that everything is on schedule" — an outright lie — while the phrase "the
 *    importance of honesty" appeared verbatim in the generated opening. A corpus that names the
 *    right behaviour cannot yield two defensible options.
 *
 * 2. Every filtered evaluation run wrote the SAME artifact path, so each canary destroyed the
 *    evidence of the one before it. Four prior artifacts are permanently gone.
 */

const c01 = EVAL_CORPUS.find((c) => c.id === "c01-missed-commitment")!;
const text = (c: typeof c01) =>
  [c.input.facts.problem, c.input.facts.observableBehavior, c.input.guided.avoidancePressure.text]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

describe("c01 corpus carries no moral answer key", () => {
  it("names no honesty/admission virtue as the expected behaviour", () => {
    const t = text(c01);
    for (const banned of ["honest", "honestly", "honesty", "admit", "admitting", "own the miss", "come clean", "truthful"]) {
      expect(t, `c01 still contains "${banned}"`).not.toContain(banned);
    }
  });

  it("does not prescribe the primary choices", () => {
    const t = text(c01);
    for (const prescriptive of ["disclose", "conceal", "hide", "cover up", "tell the client the truth"]) {
      expect(t).not.toContain(prescriptive);
    }
  });

  it("STILL carries the missed-commitment tension — it was neutralised, not made easier", () => {
    const t = text(c01);
    expect(t).toContain("missed a delivery");
    expect(t).toContain("personally promised"); // the leader owns the commitment
    expect(t).toContain("trust"); // the stake is preserved
    expect(t).toMatch(/not yet confirmed|recovery plan/); // incomplete recovery facts
    expect(c01.input.guided.hardestWhen.choice).toBe("time_limited"); // time pressure preserved
  });

  it("keeps its identity and locale", () => {
    expect(c01.id).toBe("c01-missed-commitment");
    expect(c01.locale).toBe("en");
    expect(c01.expectDecline ?? false).toBe(false); // still a generation case
  });

  it("the avoidance pressure is a real cost, not a moral temptation", () => {
    // "admitting feels like losing trust" made avoidance the tempting wrong answer. The replacement
    // names a genuine professional risk that applies to a defensible choice.
    const p = c01.input.guided.avoidancePressure.text.toLowerCase();
    expect(p).not.toMatch(/admit|honest/);
    expect(p).toMatch(/confirmed|date you cannot hold/);
  });
});

describe("no corpus case tells the generator the right answer", () => {
  // A broader guard: an expected-behaviour field naming a VIRTUE rather than an observable
  // behaviour reproduces the c01 defect. This sweep found a second instance.
  const VIRTUE_WORDS = ["honestly", "honesty", "truthfully", "with integrity", "ethically"];

  /**
   * c14-mixed-privacy says "Answer honestly without revealing protected details". It carries the
   * same virtue wording as c01 — but unlike c01 it has NEVER been generated, so the defect is
   * unproven for this case, and its real tension (candour versus a confirmed privacy boundary) is
   * legitimate rather than moral. It is recorded here as a KNOWN RISK instead of being edited on a
   * hypothesis: the next case to be run live should re-measure it before rewording.
   */
  const KNOWN_UNMEASURED_RISK = ["c14-mixed-privacy"];

  it("no generation-intended case states a virtue as the expected behaviour", () => {
    const offenders = EVAL_CORPUS.filter((c) => !c.expectDecline)
      .filter((c) => VIRTUE_WORDS.some((w) => (c.input.facts.observableBehavior ?? "").toLowerCase().includes(w)))
      .map((c) => c.id)
      .filter((id) => !KNOWN_UNMEASURED_RISK.includes(id));
    expect(offenders).toEqual([]);
  });

  it("the known-risk list stays honest — every entry really does still carry virtue wording", () => {
    // If c14 is reworded later this fails, forcing the stale exemption to be removed.
    for (const id of KNOWN_UNMEASURED_RISK) {
      const c = EVAL_CORPUS.find((x) => x.id === id)!;
      expect(VIRTUE_WORDS.some((w) => (c.input.facts.observableBehavior ?? "").toLowerCase().includes(w)), `${id} no longer needs an exemption`).toBe(true);
    }
  });

  it("c01 is NOT on the exemption list — its defect was measured and fixed", () => {
    expect(KNOWN_UNMEASURED_RISK).not.toContain("c01-missed-commitment");
  });
});

describe("evaluation artifacts are immutable per run", () => {
  const harness = readFileSync(join(process.cwd(), "src/lib/bty/foundry/arena/practice-generation.eval.test.ts"), "utf8");

  it("builds a unique per-run artifact path", () => {
    expect(harness).toMatch(/IMMUTABLE_ARTIFACT/);
    expect(harness).toMatch(/RUN_ID/);
    expect(harness).toMatch(/practice-generation\.\$\{RUN_KIND\}\.\$\{RUN_ID\}\.json/);
  });

  it("refuses to overwrite an existing run artifact", () => {
    expect(harness).toMatch(/existsSync\(immutablePath\)/);
    expect(harness).toMatch(/refusing to overwrite an existing run artifact/);
  });

  it("writes the immutable copy BEFORE the convenience pointer, and both before the assertions", () => {
    const iImmutable = harness.indexOf("writeFileSync(immutablePath");
    const iLatest = harness.indexOf("writeFileSync(join(dir, LATEST_ARTIFACT)");
    const iAssert = harness.indexOf("HARD GATES");
    expect(iImmutable).toBeGreaterThan(-1);
    expect(iLatest).toBeGreaterThan(iImmutable); // pointer is never the authority
    expect(iAssert).toBeGreaterThan(iLatest); // evidence survives a failing run
  });

  it("emits a digest for the run", () => {
    expect(harness).toMatch(/sha256=\$\{createHash\("sha256"\)/);
  });

  it("captures no credential in the artifact payload", () => {
    expect(harness).not.toMatch(/OPENAI_API_KEY|Authorization|Bearer /);
  });
});

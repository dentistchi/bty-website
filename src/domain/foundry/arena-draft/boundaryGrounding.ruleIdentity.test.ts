import { describe, expect, it } from "vitest";
import { boundaryGroundingFindings, validateBoundaryGrounding } from "./boundaryGrounding";
import { resolveRejection } from "./gatePrecedence";
import { buildCorrectionPacket, renderCorrectionPacket } from "./correctionPacket";
import { generationDiagnosticCodes } from "./generationDiagnosticCodes";
import { TC_CLINICAL, TC_INSURANCE, TC_NATURAL_GROUNDED, TC_NATURAL_VACUOUS, TC_NO_PRESSURE, TC_RULES, tcGrounding } from "./tcCaseAcceptanceFixture";

/**
 * WHICH RULE FAILED — Case Acceptance attempt 05480582.
 *
 * Three confirmed rules, one recorded signature: `vacuous_boundary_compliance` +
 * `missing_boundary_reference`. Before this, neither finding said which of the three rules it was
 * about, so the single retry was told "a rule" and had to guess.
 */

const productionSignature = () => boundaryGroundingFindings([tcGrounding(TC_CLINICAL), tcGrounding(TC_NO_PRESSURE)], TC_RULES, TC_NATURAL_VACUOUS);

describe("[rule identity] grounding findings name the confirmed rule", () => {
  it("I1 the production signature: the no-pressure rule is vacuous, the insurance rule has no record", () => {
    expect(productionSignature()).toEqual([
      { code: "vacuous_boundary_compliance", boundaryId: TC_NO_PRESSURE.id },
      { code: "missing_boundary_reference", boundaryId: TC_INSURANCE.id },
    ]);
  });

  it("I2 the gate's verdict is unchanged — same codes, same order, same outcome", () => {
    expect(validateBoundaryGrounding([tcGrounding(TC_CLINICAL), tcGrounding(TC_NO_PRESSURE)], TC_RULES, TC_NATURAL_VACUOUS)).toEqual({
      ok: false,
      errors: ["vacuous_boundary_compliance", "missing_boundary_reference"],
    });
  });

  it("I3 a rule id is attached only when it is a CONFIRMED id — never to an unknown or malformed record", () => {
    const f = boundaryGroundingFindings([tcGrounding(TC_CLINICAL), tcGrounding(TC_INSURANCE), { ...tcGrounding(TC_NO_PRESSURE), boundaryId: "c9_invented" }, { nope: 1 }], TC_RULES, TC_NATURAL_GROUNDED);
    expect(f).toContainEqual({ code: "unknown_boundary_reference" });
    expect(f).toContainEqual({ code: "grounding_malformed" });
    expect(f).toContainEqual({ code: "missing_boundary_reference", boundaryId: TC_NO_PRESSURE.id });
    expect(f.find((x) => x.code === "unknown_boundary_reference")).not.toHaveProperty("boundaryId");
  });

  it("I4 one natural phrase that names the patient and scheduling grounds every rule — nothing is reported", () => {
    expect(boundaryGroundingFindings(TC_RULES.map(tcGrounding), TC_RULES, TC_NATURAL_GROUNDED)).toEqual([]);
  });

  it("I5 the gate still refuses: the vacuous conversation fails with every record present", () => {
    expect(validateBoundaryGrounding(TC_RULES.map(tcGrounding), TC_RULES, TC_NATURAL_VACUOUS)).toEqual({ ok: false, errors: ["vacuous_boundary_compliance"] });
  });
});

describe("[rule identity] the retry correction names the rule; the recorded outcome does not change", () => {
  const findings = productionSignature().map((f) => ({ ...f, gate: "boundary_grounding" }));
  const withoutIds = findings.map(({ boundaryId: _drop, ...f }) => f);

  it("R1 primary code, defect codes and the attempt row's diagnostic codes are identical with or without rule ids", () => {
    const a = resolveRejection(findings)!;
    const b = resolveRejection(withoutIds)!;
    expect(a.primaryCode).toBe(b.primaryCode);
    expect(a.defectCodes).toEqual(b.defectCodes);
    expect(a.terminal).toBe(false);
    expect(generationDiagnosticCodes(a.defectCodes)).toEqual(["g_vacuous_boundary_compliance", "g_missing_boundary_reference"]);
  });

  it("R2 the rendered retry says WHICH rule, for each defect, and lists the statements those ids belong to", () => {
    const resolved = resolveRejection(findings)!;
    const text = renderCorrectionPacket(
      buildCorrectionPacket(1, resolved.primaryCode, resolved.findings, { facts: [], role: "", locale: "en", boundaries: TC_RULES.map(({ id, statement }) => ({ id, statement })) }),
    );
    const line = (code: string) => text.split("\n").find((l) => l.startsWith(`- [${code}]`)) ?? "";
    expect(line("vacuous_boundary_compliance")).toContain(`(boundary [${TC_NO_PRESSURE.id}])`);
    expect(line("missing_boundary_reference")).toContain(`(boundary [${TC_INSURANCE.id}])`);
    expect(line("vacuous_boundary_compliance")).not.toContain(TC_INSURANCE.id);
    expect(line("missing_boundary_reference")).not.toContain(TC_NO_PRESSURE.id);
    expect(text).toContain(`[${TC_NO_PRESSURE.id}] "${TC_NO_PRESSURE.statement}"`);
    // Natural speech, not keyword stuffing.
    expect(line("vacuous_boundary_compliance")).toMatch(/Do not repeat it in every option/);
  });

  it("R3 before this change the same packet could not say which rule — the defect being repaired", () => {
    const resolved = resolveRejection(withoutIds)!;
    const text = renderCorrectionPacket(buildCorrectionPacket(1, resolved.primaryCode, resolved.findings, { facts: [], role: "", locale: "en", boundaries: [] }));
    expect(text).not.toContain("(boundary [");
  });
});

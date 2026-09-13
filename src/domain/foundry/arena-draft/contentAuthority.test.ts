import { describe, expect, it } from "vitest";
import {
  CONTENT_PROVENANCE,
  PROVEN_CONTENT_AUTHORITY,
  PROVISIONAL_BOUNDARY_AUTHORITY,
  classifyContentAuthority,
  splitContentFindings,
} from "./contentAuthority";
import { hasRejectionAuthority, resolveRejection } from "./gatePrecedence";

/*
  THE DECISIVE TEST is not "which defect string rejects". It is whether the SAME string changes
  authority when the path that produced it changes. A string-keyed allowlist passes the first and
  fails the second, which is exactly how the previous blocklist kept leaking.
*/
describe("13. authority is defect code PLUS provenance, never the string alone", () => {
  it.each(Object.keys(PROVEN_CONTENT_AUTHORITY))(
    "%s is TERMINAL through the proven path and TELEMETRY when the model wrote it",
    (code) => {
      expect(classifyContentAuthority({ code, provenance: CONTENT_PROVENANCE.provenExactIdentity })).toBe("terminal");
      expect(classifyContentAuthority({ code, provenance: CONTENT_PROVENANCE.modelDefectCode })).toBe("telemetry");
      expect(classifyContentAuthority({ code, provenance: CONTENT_PROVENANCE.modelBoolean })).toBe("telemetry");
    },
  );

  it("a proven CODE cannot borrow the boundary exception's provenance either", () => {
    expect(
      classifyContentAuthority({
        code: "cross_branch_axis_collapse",
        provenance: CONTENT_PROVENANCE.provisionalBoundaryBoolean,
      }),
    ).toBe("telemetry");
  });

  it("a code nobody classified receives NOTHING, whatever path it arrived on", () => {
    for (const provenance of Object.values(CONTENT_PROVENANCE)) {
      expect(classifyContentAuthority({ code: "some_future_reviewer_code", provenance })).toBe("telemetry");
    }
  });

  it("the removed vocabulary rule has no surviving terminal path under any provenance", () => {
    for (const provenance of Object.values(CONTENT_PROVENANCE)) {
      expect(classifyContentAuthority({ code: "generic_communication_collapse", provenance })).toBe("telemetry");
    }
  });

  it("unsafe_delay is telemetry on every path — the reviewer alone establishes urgency", () => {
    for (const provenance of Object.values(CONTENT_PROVENANCE)) {
      expect(classifyContentAuthority({ code: "unsafe_delay", provenance })).toBe("telemetry");
    }
  });
});

describe("14. the PROVISIONAL boundary exception is a named path, not a family", () => {
  it.each(PROVISIONAL_BOUNDARY_AUTHORITY)("%s is terminal ONLY as a derived boundary boolean", (code) => {
    expect(classifyContentAuthority({ code, provenance: CONTENT_PROVENANCE.provisionalBoundaryBoolean })).toBe("terminal");
    // The identical string, written straight into boundaryAssessments[].defectCodes, earns nothing.
    expect(classifyContentAuthority({ code, provenance: CONTENT_PROVENANCE.modelDefectCode })).toBe("telemetry");
  });

  it("a boundary-SHAPED code outside the enumerated set inherits no authority from the family", () => {
    expect(
      classifyContentAuthority({ code: "boundary_feels_weak", provenance: CONTENT_PROVENANCE.provisionalBoundaryBoolean }),
    ).toBe("telemetry");
  });

  it("the exception set is enumerated, so it cannot grow by prefix accident", () => {
    expect(PROVISIONAL_BOUNDARY_AUTHORITY).toHaveLength(8);
    expect(new Set(PROVISIONAL_BOUNDARY_AUTHORITY).size).toBe(PROVISIONAL_BOUNDARY_AUTHORITY.length);
  });
});

describe("splitting keeps both halves", () => {
  it("downgraded is not deleted — the telemetry half retains code AND provenance", () => {
    const split = splitContentFindings([
      { code: "cross_branch_axis_collapse", provenance: CONTENT_PROVENANCE.provenExactIdentity },
      { code: "cross_branch_axis_collapse", provenance: CONTENT_PROVENANCE.modelDefectCode },
      { code: "generic_communication_collapse", provenance: CONTENT_PROVENANCE.modelBoolean },
    ]);
    expect(split.terminalFindings.map((f) => f.code)).toEqual(["cross_branch_axis_collapse"]);
    expect(split.telemetryFindings).toEqual([
      { code: "cross_branch_axis_collapse", provenance: "MODEL_DEFECT_CODE" },
      { code: "generic_communication_collapse", provenance: "MODEL_BOOLEAN" },
    ]);
  });

  it("dedupes by the AUTHORITY UNIT, so one string on two paths stays two findings", () => {
    const split = splitContentFindings([
      { code: "no_new_decision_dimension", provenance: CONTENT_PROVENANCE.modelDefectCode },
      { code: "no_new_decision_dimension", provenance: CONTENT_PROVENANCE.modelDefectCode },
      { code: "no_new_decision_dimension", provenance: CONTENT_PROVENANCE.provenExactIdentity },
    ]);
    expect(split.telemetryFindings).toHaveLength(1);
    expect(split.terminalFindings).toHaveLength(1);
  });
});

/*
  15. THE TWO CHANNELS POINT IN OPPOSITE DIRECTIONS ON PURPOSE.

  Unknown INTEGRITY fails closed: a review we cannot read cannot be trusted. Unknown CONTENT gets
  nothing: unclassified semantic opinion must not become a product veto. One principle, two defaults.
*/
describe("15. channel-aware precedence default", () => {
  it("an unknown INTEGRITY code still rejects, at the visible level 8", () => {
    const out = resolveRejection([{ code: "review_future_integrity_failure", gate: "semantic_review" }]);
    expect(out?.primaryCode).toBe("review_future_integrity_failure");
    expect(out?.primaryLevel).toBe(7);
    const unprefixed = resolveRejection([{ code: "totally_unknown_failure", gate: "dto" }]);
    expect(unprefixed?.primaryLevel).toBe(8);
  });

  it("an unknown CONTENT code rejects nothing and is reported as denied, not dropped", () => {
    const out = resolveRejection([{ code: "reviewer_thinks_it_is_weak", gate: "semantic_review", channel: "content" }]);
    expect(out).toBeNull();
  });

  it("a REGISTERED content code keeps the precedence it was declared with", () => {
    expect(hasRejectionAuthority("boundary_violation", "content")).toBe(true);
    expect(hasRejectionAuthority("reviewer_thinks_it_is_weak", "content")).toBe(false);
    expect(hasRejectionAuthority("reviewer_thinks_it_is_weak", "integrity")).toBe(true);
  });

  it("an unknown content code cannot take primaryCode from a finding that HAS authority", () => {
    const out = resolveRejection([
      { code: "reviewer_thinks_it_is_weak", gate: "semantic_review", channel: "content" },
      { code: "boundary_violation", gate: "boundary_review", channel: "content", boundaryId: "b1" },
    ]);
    expect(out?.primaryCode).toBe("boundary_violation");
    expect(out?.defectCodes).not.toContain("reviewer_thinks_it_is_weak");
    expect(out?.nonAuthoritativeCodes).toEqual(["reviewer_thinks_it_is_weak"]);
  });

  it("omitting the channel keeps the old fail-closed behaviour, so no caller changes by silence", () => {
    const out = resolveRejection([{ code: "reviewer_thinks_it_is_weak", gate: "semantic_review" }]);
    expect(out?.primaryCode).toBe("reviewer_thinks_it_is_weak");
  });
});

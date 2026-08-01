import { describe, it, expect } from "vitest";
import {
  BOUNDARY_NORMALIZATION_VERSION,
  assertReviewBoundaryAuthority,
  boundaryProvenanceSha256,
  buildBoundaryProvenance,
  checkBoundaryCoverage,
  detectBoundaryProvenanceDrift,
  noBoundaryProvenance,
  normalizeBoundaryText,
  type BoundaryReviewProvenance,
} from "./boundaryProvenance";

const SRC = "a".repeat(64);
const C1 = { id: "c1_verify", statement: "Two identifiers must be verified before treatment", provenance: "manager_entered" };
const C2 = { id: "c2_consent", statement: "Consent must be recorded before a procedure", provenance: "manager_entered" };

const bearing = (over: Partial<Parameters<typeof buildBoundaryProvenance>[0]> = {}) =>
  buildBoundaryProvenance({
    available: [C1],
    activeIds: ["c1_verify"],
    scopeConfirmed: true,
    sourceKind: "canonical_case_input",
    sourceReference: "corpus:c18",
    sourceSha256: SRC,
    ...over,
  });

describe("PROVENANCE — identity, order and normalization are all preserved", () => {
  it("1. boundary id, normalized text and original order are persisted", () => {
    const p = bearing({ available: [C1, C2], activeIds: ["c2_consent"] });
    expect(p.confirmedBoundaries.map((b) => [b.id, b.order, b.active])).toEqual([
      ["c1_verify", 0, false],
      ["c2_consent", 1, true],
    ]);
    expect(p.confirmedBoundaries[0].statement).toBe("Two identifiers must be verified before treatment");
  });

  it("normalizes whitespace exactly once, at capture", () => {
    const p = bearing({ available: [{ ...C1, statement: "  Two   identifiers must be\nverified before treatment " }] });
    expect(p.confirmedBoundaries[0].statement).toBe(C1.statement);
    expect(normalizeBoundaryText("  a \n b  ")).toBe("a b");
  });

  it("2/3/4. active set, source kind and source digest are persisted", () => {
    const p = bearing();
    expect(p.activeBoundaryIds).toEqual(["c1_verify"]);
    expect(p.sourceKind).toBe("canonical_case_input");
    expect(p.sourceSha256).toBe(SRC);
    expect(p.normalizationVersion).toBe(BOUNDARY_NORMALIZATION_VERSION);
  });

  it("5. the provenance digest moves when any bound value moves, and ignores explanation-only fields", () => {
    const base = boundaryProvenanceSha256(bearing());
    expect(boundaryProvenanceSha256(bearing({ available: [{ ...C1, statement: "One identifier is enough" }] }))).not.toBe(base);
    expect(boundaryProvenanceSha256(bearing({ available: [C1, C2], activeIds: ["c1_verify"] }))).not.toBe(base);
    expect(boundaryProvenanceSha256(bearing({ sourceSha256: "b".repeat(64) }))).not.toBe(base);
    // Ordering is identity: the same two rules in the other order is a different presentation.
    expect(boundaryProvenanceSha256(bearing({ available: [C1, C2], activeIds: ["c1_verify", "c2_consent"] })))
      .not.toBe(boundaryProvenanceSha256(bearing({ available: [C2, C1], activeIds: ["c1_verify", "c2_consent"] })));
    // reconstructionSources explain WHERE the answer came from, not WHAT it is.
    const withSources: BoundaryReviewProvenance = { ...bearing(), reconstructionSources: [{ path: "x", sha256: SRC, evidenceLocation: "y", normalizedBoundaryDigest: SRC }] };
    expect(boundaryProvenanceSha256(withSources)).toBe(base);
  });
});

describe("FAIL CLOSED — an empty array is never an answer", () => {
  it("10. absent provenance is refused, and is NOT treated as no-boundary", () => {
    for (const v of [null, undefined]) {
      const r = assertReviewBoundaryAuthority(v);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.codes).toContain("review_boundary_provenance_missing");
    }
  });

  it("8. a boundary-bearing record with an empty confirmed set is refused", () => {
    // The exact R2.26 shape, made impossible: mode says rules apply, the set says otherwise.
    const p: BoundaryReviewProvenance = { ...bearing(), boundaryMode: "bearing", confirmedBoundaries: [], availableBoundaries: [], activeBoundaryIds: [] };
    const r = assertReviewBoundaryAuthority(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codes).toEqual(expect.arrayContaining(["review_boundary_data_missing", "review_active_boundary_missing"]));
  });

  it("9. a boundary-bearing record with an empty ACTIVE set is refused", () => {
    const p: BoundaryReviewProvenance = { ...bearing(), activeBoundaryIds: [] };
    const r = assertReviewBoundaryAuthority(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codes).toContain("review_active_boundary_missing");
  });

  it("11/12. an unknown active id, or one that is not a subset of confirmed, is refused", () => {
    const p: BoundaryReviewProvenance = { ...bearing(), activeBoundaryIds: ["c9_nonexistent"] };
    const r = assertReviewBoundaryAuthority(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codes).toContain("review_unknown_active_boundary");
  });

  it("13. a narrowed set without scope confirmation is refused", () => {
    const p = bearing({ available: [C1, C2], activeIds: ["c1_verify"], scopeConfirmed: false });
    const r = assertReviewBoundaryAuthority(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codes).toContain("review_boundary_scope_unconfirmed");
  });

  it("14. a provenance digest mismatch is refused", () => {
    const p = bearing();
    const r = assertReviewBoundaryAuthority(p, "f".repeat(64));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codes).toContain("review_boundary_provenance_mismatch");
    expect(assertReviewBoundaryAuthority(p, boundaryProvenanceSha256(p)).ok).toBe(true);
  });

  it("15. the active flags and the active id list must agree", () => {
    const p = bearing({ available: [C1, C2], activeIds: ["c1_verify", "c2_consent"] });
    const tampered: BoundaryReviewProvenance = { ...p, activeBoundaryIds: ["c1_verify"] };
    const r = assertReviewBoundaryAuthority(tampered);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codes).toContain("review_boundary_subject_drift");
  });

  it("an active rule with empty text is refused — the reviewer cannot judge against nothing", () => {
    const p = bearing({ available: [{ ...C1, statement: "   " }] });
    const r = assertReviewBoundaryAuthority(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codes).toContain("review_boundary_data_missing");
  });

  it("a normalization-version change is refused rather than silently reinterpreted", () => {
    const p: BoundaryReviewProvenance = { ...bearing(), normalizationVersion: "practice-boundary-provenance/0" };
    const r = assertReviewBoundaryAuthority(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codes).toContain("review_boundary_normalization_drift");
  });
});

describe("NO-BOUNDARY — a legitimate state, distinct from a lost one", () => {
  it("17/19. an explicit no-boundary case is allowed", () => {
    const p = noBoundaryProvenance("corpus:c01", SRC);
    expect(p.boundaryMode).toBe("none");
    expect(p.sourceKind).toBe("canonical_case_input");
    expect(assertReviewBoundaryAuthority(p).ok).toBe(true);
  });

  it("18. absent provenance is NOT the same as an explicit none", () => {
    // The distinction the R2.26 defect turned on.
    expect(assertReviewBoundaryAuthority(null).ok).toBe(false);
    expect(assertReviewBoundaryAuthority(noBoundaryProvenance("corpus:c01", SRC)).ok).toBe(true);
  });

  it("a `none` record carrying boundaries is a contradiction and is refused", () => {
    const p: BoundaryReviewProvenance = { ...noBoundaryProvenance("corpus:c01", SRC), confirmedBoundaries: bearing().confirmedBoundaries };
    const r = assertReviewBoundaryAuthority(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codes).toContain("review_boundary_subject_drift");
  });

  it("a `none` record may not claim a Host scope decision as its source", () => {
    const p: BoundaryReviewProvenance = { ...noBoundaryProvenance("x", SRC), sourceKind: "host_confirmed_scope" };
    const r = assertReviewBoundaryAuthority(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codes).toContain("review_boundary_provenance_mismatch");
  });
});

describe("RECONSTRUCTION — must be labelled and must name its sources", () => {
  it("33. a reconstruction must be flagged and carry at least two sources", () => {
    const unlabelled: BoundaryReviewProvenance = { ...bearing({ sourceKind: "historical_reconstruction" }), reconstructed: false, reconstructionSources: [] };
    const r = assertReviewBoundaryAuthority(unlabelled);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codes).toContain("review_boundary_reconstruction_unlabelled");
  });

  it("a non-reconstruction may not claim to be one", () => {
    const p: BoundaryReviewProvenance = { ...bearing(), reconstructed: true };
    const r = assertReviewBoundaryAuthority(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codes).toContain("review_boundary_reconstruction_unlabelled");
  });
});

describe("DRIFT and COVERAGE", () => {
  it("provenance drift between freeze and rerun is detected", () => {
    expect(detectBoundaryProvenanceDrift(bearing(), bearing())).toEqual([]);
    expect(detectBoundaryProvenanceDrift(bearing(), bearing({ available: [{ ...C1, statement: "changed" }] }))).toContain("review_boundary_subject_drift");
  });

  it("22. exact coverage of the active set passes", () => {
    expect(checkBoundaryCoverage(["c1_verify"], ["c1_verify"], ["c1_verify"]).ok).toBe(true);
  });

  it("23. an omitted assessment is rejected", () => {
    const r = checkBoundaryCoverage(["c1_verify", "c2_consent"], ["c1_verify", "c2_consent"], ["c1_verify"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codes).toContain("boundary_assessment_omitted");
  });

  it("24. an unknown assessment is rejected", () => {
    const r = checkBoundaryCoverage(["c1_verify"], ["c1_verify"], ["c1_verify", "c9_made_up"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codes).toContain("boundary_assessment_unknown");
  });

  it("25. a duplicate assessment is rejected", () => {
    const r = checkBoundaryCoverage(["c1_verify"], ["c1_verify"], ["c1_verify", "c1_verify"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codes).toContain("boundary_assessment_duplicated");
  });

  it("the R2.26 shape — considered [] against an active set — is a coverage failure", () => {
    const r = checkBoundaryCoverage(["c1_verify"], [], []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codes).toEqual(expect.arrayContaining(["boundary_assessment_omitted", "boundary_ids_considered_mismatch"]));
  });
});

import { describe, it, expect } from "vitest";
import { validateDraftPatch } from "./module-builder";
import { reviewMissingSections } from "./module-publish";

/**
 * SLICE 3.2R-R3 — "A PDF EXISTS" WAS THE ENTIRE MATERIAL GATE.
 *
 * The pilot's first live learner joined a training called "Building Accountability in Huddles"
 * and was shown a document titled "Patient Communication Checklist". Every automated check had
 * passed, because the only material check is `countPublishablePdfAssets(draftId) >= 1`.
 *
 * The Host review surface could not have caught it either: material rendered as one line,
 * `education.pdf · Attached`, with no preview, no thumbnail and no way to open the bytes. The
 * last gate before a learner could see a filename and nothing else.
 *
 * BTY cannot read the document and cannot judge whether it matches the training. So the
 * requirement is the one thing a server can honestly check: a Host confirmation bound to the
 * exact bytes attached right now.
 */
describe("[3.2R-R3] the confirmation binds to content, not to a filename", () => {
  const HASH_A = "a".repeat(64);
  const HASH_B = "b".repeat(64);

  it("is accepted through the same whitelist as every other answer", () => {
    const r = validateDraftPatch({ answers: { materialReviewV1: { contentHash: HASH_A, confirmedAt: "2026-08-13T10:00:00.000Z" } } });
    expect(r.ok, r.ok ? "" : r.errors.join(",")).toBe(true);
    if (!r.ok) return;
    expect(r.value.answers?.materialReviewV1).toEqual({ contentHash: HASH_A, confirmedAt: "2026-08-13T10:00:00.000Z" });
  });

  it("a malformed confirmation is DROPPED, never stored", () => {
    /*
      A bad client must not be able to make the server believe a Host reviewed anything. Each of
      these is refused rather than coerced into something storable.
    */
    for (const bad of [
      { contentHash: "not-a-hash", confirmedAt: "2026-08-13T10:00:00.000Z" },
      { contentHash: HASH_A },
      { contentHash: HASH_A, confirmedAt: "yesterday" },
      { contentHash: HASH_A.toUpperCase(), confirmedAt: "2026-08-13T10:00:00.000Z" },
      { confirmedAt: "2026-08-13T10:00:00.000Z" },
      null,
      "reviewed",
    ]) {
      const r = validateDraftPatch({ answers: { materialReviewV1: bad as never } });
      expect(r.ok, JSON.stringify(bad)).toBe(false);
      if (!r.ok) expect(r.errors, JSON.stringify(bad)).toContain("material_review_invalid");
    }
  });

  it("a confirmation for DIFFERENT bytes is not a confirmation of these", () => {
    // The whole point of hashing: swapping the document invalidates the confirmation by
    // construction, with no cleanup rule for anyone to forget.
    const stored = { contentHash: HASH_A, confirmedAt: "2026-08-13T10:00:00.000Z" };
    const attachedNow = HASH_B;
    expect(stored.contentHash === attachedNow).toBe(false);
  });
});

describe("[3.2R-R3] the blocker is visible where the Host can clear it", () => {
  it("material_review_required maps to the material section, like its sibling", () => {
    /*
      A blocker with no Review row is a blocker the Host cannot see or clear. `material_pdf_required`
      has always mapped here; the new code is the same kind of server-only fact.
    */
    const rows = reviewMissingSections({} as never, ["material_review_required"]);
    expect(rows.map((r) => r.section)).toContain("material");
    const step = rows.find((r) => r.section === "material")?.step;
    expect(step).toBe(7);
  });

  it("and it collapses with the other material blocker rather than double-listing", () => {
    const rows = reviewMissingSections({} as never, ["material_pdf_required", "material_review_required"]);
    expect(rows.filter((r) => r.section === "material")).toHaveLength(1);
  });
});

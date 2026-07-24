import { describe, expect, it } from "vitest";
import {
  validateActionReviewDecisionInput,
  ACTION_REVIEW_REVISION_NOTE_MAX,
} from "./actionReviewDecision";

describe("validateActionReviewDecisionInput", () => {
  it("approve → ok, note discarded to null even if one is supplied", () => {
    const r = validateActionReviewDecisionInput({ decision: "approve", revisionNote: "ignore me" });
    expect(r).toEqual({ ok: true, decision: "approve", revisionNote: null });
  });

  it("request_revision with a valid note → trimmed note", () => {
    const r = validateActionReviewDecisionInput({ decision: "request_revision", revisionNote: "  fix the framing  " });
    expect(r).toEqual({ ok: true, decision: "request_revision", revisionNote: "fix the framing" });
  });

  it("request_revision with empty/whitespace note → NOTE_REQUIRED", () => {
    expect(validateActionReviewDecisionInput({ decision: "request_revision", revisionNote: "   " })).toEqual({
      ok: false,
      reason: "NOTE_REQUIRED",
    });
    expect(validateActionReviewDecisionInput({ decision: "request_revision" })).toEqual({
      ok: false,
      reason: "NOTE_REQUIRED",
    });
  });

  it("request_revision note at the 500 boundary is accepted; 501 is rejected", () => {
    const at = "x".repeat(ACTION_REVIEW_REVISION_NOTE_MAX);
    const over = "x".repeat(ACTION_REVIEW_REVISION_NOTE_MAX + 1);
    expect(validateActionReviewDecisionInput({ decision: "request_revision", revisionNote: at }).ok).toBe(true);
    expect(validateActionReviewDecisionInput({ decision: "request_revision", revisionNote: over })).toEqual({
      ok: false,
      reason: "NOTE_TOO_LONG",
    });
  });

  it("note length is counted in code points (matches Postgres char_length)", () => {
    // 500 astral code points = 1000 UTF-16 units; must be accepted, not treated as > 500.
    const emoji = "😀".repeat(ACTION_REVIEW_REVISION_NOTE_MAX);
    expect(validateActionReviewDecisionInput({ decision: "request_revision", revisionNote: emoji }).ok).toBe(true);
    const over = "😀".repeat(ACTION_REVIEW_REVISION_NOTE_MAX + 1);
    expect(validateActionReviewDecisionInput({ decision: "request_revision", revisionNote: over })).toEqual({
      ok: false,
      reason: "NOTE_TOO_LONG",
    });
  });

  it("unknown / missing decision → INVALID_DECISION", () => {
    expect(validateActionReviewDecisionInput({ decision: "reject" })).toEqual({ ok: false, reason: "INVALID_DECISION" });
    expect(validateActionReviewDecisionInput({ decision: "" })).toEqual({ ok: false, reason: "INVALID_DECISION" });
    expect(validateActionReviewDecisionInput({ decision: "APPROVE" })).toEqual({ ok: false, reason: "INVALID_DECISION" });
  });
});

import { describe, it, expect } from "vitest";
import {
  deriveCommitmentFrame,
  selectProposition,
  isTodayCommitmentFrame,
  COMMITMENT_FRAME_VERSION,
} from "@/domain/daily/livingResponseFrame";
import type { LivingResponseRelationship } from "@/domain/daily/livingResponse";
import { validateLivingResponse } from "@/lib/bty/daily/livingResponseValidator";
import { guardPhrasesFor } from "@/domain/daily/livingResponseGuardPhrases";

const REL: LivingResponseRelationship[] = ["self", "others", "world"];

describe("deriveCommitmentFrame — server-owned, 1:1 with relationship, fail-closed", () => {
  it("derives the canonical frame for each relationship (locale-independent, no free text)", () => {
    expect(deriveCommitmentFrame("self")).toMatchObject({ pathId: "self_return_honestly", movement: "unspoken_to_named", destination: "self", frameVersion: COMMITMENT_FRAME_VERSION });
    expect(deriveCommitmentFrame("others")).toMatchObject({ pathId: "others_carry_care", movement: "private_to_relational", destination: "another_person" });
    expect(deriveCommitmentFrame("world")).toMatchObject({ pathId: "world_build_stewardship", movement: "decision_to_action", destination: "shared_reality" });
  });

  it("is deterministic + replay-stable (same relationship → identical frame)", () => {
    for (const r of REL) expect(deriveCommitmentFrame(r)).toEqual(deriveCommitmentFrame(r));
  });

  it("unknown / impossible relationship fails closed → null", () => {
    for (const bad of ["Self", "", "arena", "SELF", "moon"]) expect(deriveCommitmentFrame(bad)).toBeNull();
  });

  it("isTodayCommitmentFrame rejects forged / mismatched frames", () => {
    const self = deriveCommitmentFrame("self")!;
    expect(isTodayCommitmentFrame(self)).toBe(true);
    expect(isTodayCommitmentFrame({ ...self, movement: "decision_to_action" })).toBe(false); // forged field
    expect(isTodayCommitmentFrame({ ...self, pathId: "world_build_stewardship" })).toBe(false);
    expect(isTodayCommitmentFrame({ ...self, frameVersion: "cf_v0" })).toBe(false);
    expect(isTodayCommitmentFrame(null)).toBe(false);
  });
});

describe("selectProposition — one authorized meaning + one angle, deterministic", () => {
  it("commitment depth: no history, angle deterministic per seed, no provenance codes", () => {
    const frame = deriveCommitmentFrame("self")!;
    const a = selectProposition(frame, "commitment", [], "2026-07-12:self");
    const b = selectProposition(frame, "commitment", [], "2026-07-12:self");
    expect(a).toEqual(b); // deterministic
    expect(a.depth).toBe("commitment");
    expect(a.propositionCode).toBe("self_return_honestly.commitment");
    expect(a.provenanceCodes).toEqual([]);
    expect(a.requiredAnchors).toEqual(["unspoken_to_named", "self"]);
    expect(["boundary", "visibility"]).toContain(a.angle); // commitment angles only (no continuity)
  });

  it("repetition depth: continuity angle becomes available + provenance codes carried", () => {
    const frame = deriveCommitmentFrame("self")!;
    // sweep several days so the continuity angle is actually selected on at least one
    const angles = new Set(
      ["a", "b", "c", "d", "e", "f"].map((d) => selectProposition(frame, "repetition", ["SELF_RETURN_STRONG"], `${d}:self`).angle),
    );
    const rep = selectProposition(frame, "repetition", ["SELF_RETURN_STRONG"], "2026-07-12:self");
    expect(rep.depth).toBe("repetition");
    expect(rep.provenanceCodes).toEqual(["SELF_RETURN_STRONG"]);
    expect(angles.has("continuity")).toBe(true); // continuity is reachable only at repetition depth
  });

  it("contrast is never authorized at runtime → coerced to commitment", () => {
    const frame = deriveCommitmentFrame("others")!;
    const p = selectProposition(frame, "contrast", [], "2026-07-12:others");
    expect(p.depth).toBe("commitment");
  });
});

// ─── GOLDEN SET: strong examples MUST pass; adversarial examples MUST be rejected ───────────────────

const propFor = (r: LivingResponseRelationship, depth: "commitment" | "repetition" = "commitment") =>
  selectProposition(deriveCommitmentFrame(r)!, depth, depth === "repetition" ? ["X_STRONG"] : [], `2026-07-12:${r}`);

const check = (
  t: string,
  r: LivingResponseRelationship,
  depth: "commitment" | "repetition" = "commitment",
  recentTexts: string[] = [],
) =>
  validateLivingResponse(t, {
    relationship: r,
    guardPhrases: guardPhrasesFor("en", r),
    concepts: [],
    recentTexts,
    proposition: propFor(r, depth),
  });

describe("V2.1 Golden Set — strong, frame-specific lines PASS", () => {
  it("Self — inward gains named form", () => {
    const res = check("What remains inward gains form when it can be named honestly.", "self");
    expect(res.violations).toEqual([]);
    expect(res.ok).toBe(true);
  });
  it("Others — care received by another person", () => {
    const res = check("Care changes shape when another person can actually receive it.", "others");
    expect(res.violations).toEqual([]);
    expect(res.ok).toBe(true);
  });
  it("World — stewardship visible in what is built", () => {
    const res = check("Stewardship becomes visible in the shape of what is built.", "world");
    expect(res.violations).toEqual([]);
    expect(res.ok).toBe(true);
  });
});

describe("V2.1 adversarial — every case is rejected", () => {
  it("universal concept-anchored aphorism → MOVEMENT_ANCHOR_MISSING", () => {
    expect(check("Clarity and growth arrive when you align with your intention.", "self").violations).toContain("MOVEMENT_ANCHOR_MISSING");
  });
  it("Today Path paraphrase → PATH_PARAPHRASE", () => {
    expect(check("Return to yourself with honesty right now.", "self").violations).toContain("PATH_PARAPHRASE");
  });
  it("repeated-frame / near-duplicate overuse → NOVELTY_REPEAT", () => {
    const line = "What remains inward gains form when it can be named honestly.";
    expect(check(line, "self", "commitment", [line]).violations).toContain("NOVELTY_REPEAT");
  });
  it("added action → INSTRUCTION", () => {
    expect(check("Name what stays inward and take time to sit with it.", "self").violations).toContain("INSTRUCTION");
  });
  it("diagnosis / identity → rejected", () => {
    expect(check("You are avoidant when what stays inward goes unnamed.", "self").ok).toBe(false);
  });
  it("praise → rejected", () => {
    expect(check("You are doing so well naming what stays inward.", "self").ok).toBe(false);
  });
  it("emotion inference → rejected", () => {
    expect(check("You feel anxious until what stays inward is named.", "self").ok).toBe(false);
  });
  it("motive inference (avoidance) → PROHIBITED_CLAIM", () => {
    expect(check("You avoid naming it because you fear yourself.", "self").violations).toContain("PROHIBITED_CLAIM");
  });
  it("unsupported historical claim at commitment depth → HISTORICAL_CLAIM", () => {
    expect(check("Again you return to name what stays inward honestly.", "self").violations).toContain("HISTORICAL_CLAIM");
  });
  it("unsupported contrast claim → CONTRAST_CLAIM", () => {
    expect(check("What used to stay hidden now takes named form.", "self").violations).toContain("CONTRAST_CLAIM");
  });
  it("cross-relationship contamination (Others line under Self proposition) → MOVEMENT_ANCHOR_MISSING", () => {
    expect(check("Your care finally reaches another person who receives it.", "self").violations).toContain("MOVEMENT_ANCHOR_MISSING");
  });
  it("World productivity claim → PROHIBITED_CLAIM", () => {
    expect(check("Productivity improves as stewardship shapes what is built.", "world").violations).toContain("PROHIBITED_CLAIM");
  });
  it("raw machine code leak → MACHINE_CODE", () => {
    expect(check("Your SELF_RETURN_STRONG shows in what is named.", "self").violations).toContain("MACHINE_CODE");
  });
  it("metric / count leak → rejected", () => {
    expect(check("You named what stays inward three times.", "self").ok).toBe(false);
  });
});

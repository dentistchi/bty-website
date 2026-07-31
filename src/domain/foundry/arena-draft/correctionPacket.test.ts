import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { buildCorrectionPacket, canonicalPacketJson, renderCorrectionPacket, MUST_REMAIN_UNCHANGED, type ImmutableContext } from "./correctionPacket";
import { resolveRejection, type Finding } from "./gatePrecedence";

/**
 * MULTI-DEFECT CORRECTION PACKET (Slice 3.2I-R5B1A.1-R2.23).
 *
 * The measured defect: a failed attempt carried several defects and the retry received one. These
 * cases pin the ordered, sanitized packet that replaces it — safety first, every coordinate kept,
 * nothing invented, and a stable digest so an attempt's correction can be identified later.
 */

const IMMUTABLE: ImmutableContext = {
  facts: ["Your team missed a delivery you personally promised the client", "Restore client trust while deciding timing and ownership"],
  role: "leaders",
  locale: "en",
  boundaries: [{ id: "c1_verify", statement: "Two identifiers must be verified before treatment" }],
};

const packetFor = (findings: Finding[], attempt = 1) => {
  const r = resolveRejection(findings)!;
  return buildCorrectionPacket(attempt, r.primaryCode, r.findings, IMMUTABLE);
};
const digest = (s: string) => createHash("sha256").update(s).digest("hex");

describe("packet ordering", () => {
  it("11. safety and boundary corrections are listed before ordinary quality corrections", () => {
    const p = packetFor([
      { code: "cross_branch_axis_collapse", gate: "branch_review" },
      { code: "vague_reassurance", gate: "phase_choice_review", phase: "branch_action", branchIndex: 1, choiceIndex: 0 },
      { code: "dominated_choice", gate: "choice_construction" },
      { code: "unsafe_delay", gate: "urgency_review", phase: "primary", choiceIndex: 0 },
      { code: "confirmed_boundary_absent", gate: "boundary_grounding", boundaryId: "c1_verify" },
    ]);
    expect(p.items.map((i) => i.code)).toEqual([
      "confirmed_boundary_absent", // level 3
      "unsafe_delay", // level 3
      "dominated_choice", // level 4
      "vague_reassurance", // level 5
      "cross_branch_axis_collapse", // level 6
    ]);
    expect(p.items.map((i) => i.level)).toEqual([3, 3, 4, 5, 6]);
    expect(p.primaryCode).toBe("confirmed_boundary_absent");
  });

  it("12. every coordinate is preserved, and a repeated defect becomes ONE item with all of them", () => {
    const p = packetFor([
      { code: "vague_reassurance", gate: "r", phase: "branch_action", branchIndex: 0, choiceIndex: 1 },
      { code: "vague_reassurance", gate: "r", phase: "branch_action", branchIndex: 1, choiceIndex: 1 },
      { code: "vague_reassurance", gate: "r", phase: "flat_tradeoff", branchIndex: -1, choiceIndex: 0 },
    ]);
    expect(p.items).toHaveLength(1);
    expect(p.items[0].coordinates).toEqual([
      { phase: "branch_action", branchIndex: 0, choiceIndex: 1 },
      { phase: "branch_action", branchIndex: 1, choiceIndex: 1 },
      { phase: "flat_tradeoff", choiceIndex: 0 }, // -1 branch index is flat, so it is omitted
    ]);
    const text = renderCorrectionPacket(p);
    expect(text).toContain("branch 1, action choice 2");
    expect(text).toContain("branch 2, action choice 2");
    expect(text).toContain("tradeoff choice 1");
  });

  it("9/17. terminal findings never enter the packet — a retry cannot correct them", () => {
    const p = packetFor([{ code: "structured_output_unavailable", gate: "t" }, { code: "vague_reassurance", gate: "r" }]);
    expect(p.defectCodes).toEqual(["vague_reassurance"]);
    // A terminal code cannot even HEAD the packet: telling a retry to fix something a retry cannot
    // fix is worse than saying nothing, so the most severe correctable defect heads it instead.
    expect(p.primaryCode).toBe("vague_reassurance");
    expect(renderCorrectionPacket(p)).not.toContain("structured_output_unavailable");
  });
});

describe("immutability and sanitation", () => {
  it("13. the facts, role, locale and CONFIRMED boundary statements are pinned verbatim", () => {
    const p = packetFor([{ code: "vague_reassurance", gate: "r" }]);
    expect(p.immutable).toEqual(IMMUTABLE);
    expect(p.mustRemainUnchanged).toEqual(MUST_REMAIN_UNCHANGED);
    const text = renderCorrectionPacket(p);
    expect(text).toContain('[c1_verify] "Two identifiers must be verified before treatment"');
    expect(text).toMatch(/UNCHANGED: the training facts, the confirmed boundary ids and statements, the output language, the target role, the scenario purpose/);
  });

  it("16. no reviewer reasoning, credential, provider metadata or example answer is carried", () => {
    const text = renderCorrectionPacket(packetFor([
      { code: "bad_faith_option", gate: "phase_choice_review", phase: "primary", choiceIndex: 1 },
      { code: "confirmed_boundary_absent", gate: "boundary_grounding" },
    ]));
    expect(text).not.toMatch(/sk-|Authorization|Bearer |api[_-]?key/i);
    expect(text).not.toMatch(/chain.of.thought|reasoning:|because I|the model said/i);
    // An EXAMPLE replacement would become the answer key the corpus work spent a slice removing.
    expect(text).not.toMatch(/for example, write|such as: "|e\.g\. "/);
  });

  it("no contradictory instruction: one item per code, so a code cannot be corrected two ways", () => {
    const p = packetFor([
      { code: "vague_reassurance", gate: "a", phase: "primary", choiceIndex: 0 },
      { code: "vague_reassurance", gate: "b", phase: "primary", choiceIndex: 1 },
    ]);
    expect(new Set(p.items.map((i) => i.code)).size).toBe(p.items.length);
  });
});

describe("digest", () => {
  it("14. the same packet serializes byte-identically and digests identically", () => {
    const a = packetFor([{ code: "vague_reassurance", gate: "r", phase: "primary", choiceIndex: 0 }]);
    const b = packetFor([{ code: "vague_reassurance", gate: "r", phase: "primary", choiceIndex: 0 }]);
    expect(canonicalPacketJson(a)).toBe(canonicalPacketJson(b));
    expect(digest(canonicalPacketJson(a))).toBe(digest(canonicalPacketJson(b)));
  });

  it("14b. the digest is insensitive to key insertion order but sensitive to content", () => {
    const p = packetFor([{ code: "vague_reassurance", gate: "r" }]);
    const reordered = JSON.parse(JSON.stringify({ items: p.items, attempt: p.attempt, primaryCode: p.primaryCode, primaryLevel: p.primaryLevel, defectCodes: p.defectCodes, immutable: p.immutable, mustRemainUnchanged: p.mustRemainUnchanged }));
    expect(canonicalPacketJson(reordered)).toBe(canonicalPacketJson(p));
    const different = packetFor([{ code: "dominated_choice", gate: "r" }]);
    expect(canonicalPacketJson(different)).not.toBe(canonicalPacketJson(p));
  });

  it("14c. a different attempt number is a different correction", () => {
    expect(canonicalPacketJson(packetFor([{ code: "vague_reassurance", gate: "r" }], 1)))
      .not.toBe(canonicalPacketJson(packetFor([{ code: "vague_reassurance", gate: "r" }], 2)));
  });
});

describe("rendered correction", () => {
  it("15. the rendered packet states the attempt, the primary code and every defect", () => {
    const text = renderCorrectionPacket(packetFor([
      { code: "confirmed_boundary_absent", gate: "b" },
      { code: "vague_reassurance", gate: "r", phase: "branch_action", branchIndex: 0, choiceIndex: 0 },
    ], 1));
    expect(text).toMatch(/^ATTEMPT 1 CORRECTION/);
    expect(text).toContain("Primary defect: confirmed_boundary_absent");
    expect(text).toContain("All defects: confirmed_boundary_absent, vague_reassurance");
    expect(text).toMatch(/Safety and confirmed-boundary items come first/);
    expect(text).toContain("[confirmed_boundary_absent]");
    expect(text).toContain("[vague_reassurance]");
  });

  it("every registered correction is actionable — it says what to do, not merely what is wrong", () => {
    for (const code of ["confirmed_boundary_absent", "unsafe_delay", "vague_reassurance", "cross_branch_axis_collapse", "no_real_cost"]) {
      const line = renderCorrectionPacket(packetFor([{ code, gate: "g" }]));
      expect(line, code).toMatch(/Replace|Establish|Make|Give|State|Keep|Correct|The primary choice|Every branch|Not every branch/);
    }
  });

  it("an unregistered code still receives a safe, non-empty instruction", () => {
    const text = renderCorrectionPacket(packetFor([{ code: "some_future_code", gate: "g" }]));
    expect(text).toContain("[some_future_code]");
    expect(text).toMatch(/preserving the case facts, the confirmed boundaries and the scenario purpose/);
  });
});

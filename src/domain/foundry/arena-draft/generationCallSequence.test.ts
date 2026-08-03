import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CALL_KINDS,
  CALL_OUTCOMES,
  CallSequenceLimitError,
  MAX_CALLS_PER_KIND,
  MAX_CALLS_PER_SUBMISSION,
  RESPONSE_DIGEST_SCOPE,
  createCallSequenceAllocator,
  utf8ByteLength,
  type CallKind,
} from "./generationCallSequence";

/**
 * PROVIDER-CALL SEQUENCE CONTRACT (Slice 3.2I-R5B2-R5C-2A).
 *
 * R5C measured that one submission can execute up to fourteen model calls. Reconstructing what
 * happened needs each call's real position, and the allocator that hands those out is only valid
 * because the four product call paths are SEQUENTIAL. That assumption is load-bearing, so the last
 * describe block pins it against the source itself.
 */

describe("[R5C-2A] positions begin at one and never repeat", () => {
  it("the first global position is 1, not 0", () => {
    // 0 would be indistinguishable from "unset" in an integer column.
    expect(createCallSequenceAllocator().next("generation").globalSequence).toBe(1);
  });

  it.each(CALL_KINDS)("the first %s position is 1", (kind) => {
    expect(createCallSequenceAllocator().next(kind).kindSequence).toBe(1);
  });

  it("mixed kinds keep REAL execution order globally, and count independently per kind", () => {
    const a = createCallSequenceAllocator();
    const order: CallKind[] = ["generation", "boundary_review", "semantic_review", "boundary_review", "boundary_repair", "generation"];
    const got = order.map((k) => a.next(k));
    expect(got.map((p) => p.globalSequence)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(got.map((p) => `${p.callKind}#${p.kindSequence}`)).toEqual([
      "generation#1",
      "boundary_review#1",
      "semantic_review#1",
      "boundary_review#2",
      "boundary_repair#1",
      "generation#2",
    ]);
  });

  it("no position is ever handed out twice", () => {
    const a = createCallSequenceAllocator();
    const seen = new Set<string>();
    for (const kind of CALL_KINDS) {
      for (let i = 0; i < MAX_CALLS_PER_KIND[kind]; i++) {
        const p = a.next(kind);
        expect(seen.has(`g${p.globalSequence}`)).toBe(false);
        expect(seen.has(`${p.callKind}#${p.kindSequence}`)).toBe(false);
        seen.add(`g${p.globalSequence}`);
        seen.add(`${p.callKind}#${p.kindSequence}`);
      }
    }
    expect(a.allocated()).toBe(MAX_CALLS_PER_SUBMISSION);
  });
});

describe("[R5C-2A] the measured ceilings are enforced", () => {
  it("matches the measured call graph exactly", () => {
    expect(MAX_CALLS_PER_KIND).toEqual({ generation: 2, boundary_review: 4, boundary_repair: 4, semantic_review: 4 });
    expect(MAX_CALLS_PER_SUBMISSION).toBe(14);
  });

  it.each(CALL_KINDS)("%s rejects the allocation past its ceiling", (kind) => {
    const a = createCallSequenceAllocator();
    for (let i = 0; i < MAX_CALLS_PER_KIND[kind]; i++) a.next(kind);
    expect(() => a.next(kind)).toThrow(CallSequenceLimitError);
  });

  it("the fifteenth allocation is impossible", () => {
    const a = createCallSequenceAllocator();
    for (const kind of CALL_KINDS) for (let i = 0; i < MAX_CALLS_PER_KIND[kind]; i++) a.next(kind);
    expect(a.allocated()).toBe(14);
    for (const kind of CALL_KINDS) expect(() => a.next(kind)).toThrow(CallSequenceLimitError);
  });

  it("a REJECTED allocation leaves the allocator untouched", () => {
    // A partially-applied allocation would corrupt every position after it.
    const a = createCallSequenceAllocator();
    a.next("generation");
    a.next("generation");
    const before = { total: a.allocated(), kind: a.allocatedForKind("generation") };
    expect(() => a.next("generation")).toThrow();
    expect(a.allocated()).toBe(before.total);
    expect(a.allocatedForKind("generation")).toBe(before.kind);
    // Another kind still receives the correct next global position.
    expect(a.next("semantic_review")).toEqual({ callKind: "semantic_review", globalSequence: 3, kindSequence: 1 });
  });

  it("the error names the scope without carrying content", () => {
    const a = createCallSequenceAllocator();
    a.next("generation");
    a.next("generation");
    try {
      a.next("generation");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(CallSequenceLimitError);
      expect((e as CallSequenceLimitError).scope).toBe("kind");
      expect((e as CallSequenceLimitError).kind).toBe("generation");
    }
  });
});

describe("[R5C-2A] the allocator is request-owned", () => {
  it("two allocators do not share state", () => {
    const a = createCallSequenceAllocator();
    const b = createCallSequenceAllocator();
    a.next("generation");
    a.next("generation");
    expect(b.next("generation").globalSequence).toBe(1);
  });

  it("it performs no I/O and reads no clock", () => {
    const src = readFileSync(join(process.cwd(), "src/domain/foundry/arena-draft/generationCallSequence.ts"), "utf8");
    // A select-count-then-insert would be a read-modify-write with no transaction around it.
    expect(src).not.toMatch(/\bfrom\s*\(|supabase|\.select\(|\.insert\(|fetch\(/);
    expect(src).not.toMatch(/Date\.now\(|new Date\(|Math\.random\(/);
  });
});

describe("[R5C-2A] the SEQUENTIAL orchestration assumption stays true", () => {
  /** The four measured product call paths. An in-memory allocator is only valid while these are serial. */
  const PATHS = [
    "src/lib/bty/foundry/arena/arenaScenarioGenerationService.ts",
    "src/lib/bty/foundry/arena/boundaryReviewStage.ts",
    "src/lib/bty/foundry/arena/narrowBoundaryReviewer.ts",
    "src/lib/bty/foundry/arena/foundryArenaDraftService.ts",
  ];

  it.each(PATHS)("%s introduces no concurrency primitive", (rel) => {
    const src = readFileSync(join(process.cwd(), rel), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(\/\/|\*).*$/gm, "");
    // If this ever fails, the allocator needs a transactional redesign BEFORE the code lands —
    // concurrent calls under one parent would hand out duplicate positions.
    expect(code, "concurrent provider calls would invalidate the in-memory allocator").not.toMatch(
      /Promise\s*\.\s*(all|allSettled|race|any)\b/,
    );
  });
});

describe("[R5C-2A] response identity primitives", () => {
  it("declares one digest scope", () => {
    expect(RESPONSE_DIGEST_SCOPE).toBe("model_content_utf8");
  });

  it("counts UTF-8 BYTES, not UTF-16 code units", () => {
    expect(utf8ByteLength("abc")).toBe(3);
    // Korean scenario content: 3 bytes each, where String.length reports 1.
    expect(utf8ByteLength("한국어")).toBe(9);
    expect("한국어".length).toBe(3);
    // Astral plane: 4 bytes, 2 UTF-16 units.
    expect(utf8ByteLength("😀")).toBe(4);
    expect(utf8ByteLength("")).toBe(0);
  });

  it("names the eight call outcomes, all about the CALL and none about its content", () => {
    expect(CALL_OUTCOMES).toHaveLength(8);
    expect(CALL_OUTCOMES).toContain("success");
    // A gate refusing the content is the PARENT's attribution, never a call outcome.
    expect(CALL_OUTCOMES as readonly string[]).not.toContain("scenario_quality_rejected");
    expect(CALL_OUTCOMES as readonly string[]).not.toContain("boundary_content_rejected");
  });
});

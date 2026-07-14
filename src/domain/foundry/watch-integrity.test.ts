import { describe, it, expect } from "vitest";
import {
  createWatchAccumulator,
  recordTick,
  setDuration,
  markReachedEnd,
  computeWatchIntegrity,
  classifyCompletion,
  parseCompletionState,
  computeCheckpoints,
  FORWARD_SEEK_THRESHOLD_SECONDS,
  MAX_PASS_FORWARD_SEEKS,
} from "./watch-integrity";

/** Simulate playing straight through `duration` seconds at ~1 tick/sec. */
function playThrough(durationSeconds: number, step = 1) {
  let acc = createWatchAccumulator(durationSeconds);
  for (let t = 0; t <= durationSeconds; t += step) {
    acc = recordTick(acc, t);
  }
  return markReachedEnd(acc);
}

describe("watch integrity — coverage", () => {
  it("full linear watch → coverage 1 and PASS", () => {
    const acc = playThrough(100);
    const s = computeWatchIntegrity(acc);
    expect(s.watchCoverage).toBe(1);
    expect(s.forwardSeekCount).toBe(0);
    expect(s.completionState).toBe("pass");
  });

  it("dedupes re-watched seconds (no coverage inflation)", () => {
    let acc = createWatchAccumulator(100);
    for (let i = 0; i < 3; i++) {
      for (let t = 0; t < 50; t++) acc = recordTick(acc, t);
    }
    // Watched only the first 50 unique seconds, three times over.
    expect(computeWatchIntegrity(acc).watchCoverage).toBeCloseTo(0.5, 5);
  });

  it("partial watch (65%) → REVIEW", () => {
    let acc = createWatchAccumulator(100);
    for (let t = 0; t < 65; t++) acc = recordTick(acc, t);
    expect(computeWatchIntegrity(acc).completionState).toBe("review");
  });

  it("sparse watch (30%) → INCOMPLETE", () => {
    let acc = createWatchAccumulator(100);
    for (let t = 0; t < 30; t++) acc = recordTick(acc, t);
    expect(computeWatchIntegrity(acc).completionState).toBe("incomplete");
  });
});

describe("watch integrity — forward seeks", () => {
  it("counts a forward jump beyond threshold", () => {
    let acc = createWatchAccumulator(100);
    acc = recordTick(acc, 0);
    acc = recordTick(acc, 1);
    acc = recordTick(acc, 1 + FORWARD_SEEK_THRESHOLD_SECONDS + 5); // scrub ahead
    expect(computeWatchIntegrity(acc).forwardSeekCount).toBe(1);
  });

  it("does not count natural drift or backward jumps", () => {
    let acc = createWatchAccumulator(100);
    acc = recordTick(acc, 10);
    acc = recordTick(acc, 11); // natural
    acc = recordTick(acc, 5); // rewind (review) — not a forward seek
    acc = recordTick(acc, 6);
    expect(computeWatchIntegrity(acc).forwardSeekCount).toBe(0);
  });

  it("heavy forward-seeking demotes an otherwise-full watch to REVIEW", () => {
    // Reach high coverage but with many scrub-aheads.
    let acc = createWatchAccumulator(100);
    let last = 0;
    for (let t = 0; t < 100; t++) {
      // Jump forward every few ticks to rack up seeks while still covering ground.
      last = t;
      acc = recordTick(acc, last);
      if (t % 5 === 0) {
        last += FORWARD_SEEK_THRESHOLD_SECONDS + 3;
        acc = recordTick(acc, last);
      }
    }
    const s = computeWatchIntegrity(acc);
    expect(s.forwardSeekCount).toBeGreaterThan(MAX_PASS_FORWARD_SEEKS);
    // coverage high but seeks high → not pass
    expect(s.completionState).not.toBe("pass");
  });
});

describe("watch integrity — unknown duration fallback", () => {
  it("reachedEnd with unknown duration reads as PASS (never more punitive than the server gate)", () => {
    let acc = createWatchAccumulator(0); // duration unknown
    acc = recordTick(acc, 0);
    acc = markReachedEnd(acc);
    const s = computeWatchIntegrity(acc);
    expect(s.watchCoverage).toBe(1);
    expect(s.completionState).toBe("pass");
  });

  it("no ticks, no end, unknown duration → INCOMPLETE", () => {
    const s = computeWatchIntegrity(createWatchAccumulator(0));
    expect(s.completionState).toBe("incomplete");
  });

  it("setDuration refines an initially-unknown duration", () => {
    let acc = createWatchAccumulator(0);
    for (let t = 0; t < 90; t++) acc = recordTick(acc, t);
    acc = setDuration(acc, 100);
    expect(computeWatchIntegrity(acc).watchCoverage).toBeCloseTo(0.9, 5);
  });
});

describe("classifyCompletion / parseCompletionState", () => {
  it("threshold boundaries", () => {
    expect(classifyCompletion(0.9, 0)).toBe("pass");
    expect(classifyCompletion(0.9, MAX_PASS_FORWARD_SEEKS + 1)).toBe("review");
    expect(classifyCompletion(0.6, 0)).toBe("review");
    expect(classifyCompletion(0.59, 0)).toBe("incomplete");
  });

  it("narrows only valid states", () => {
    expect(parseCompletionState("pass")).toBe("pass");
    expect(parseCompletionState("review")).toBe("review");
    expect(parseCompletionState("incomplete")).toBe("incomplete");
    expect(parseCompletionState("PASS")).toBeNull();
    expect(parseCompletionState(null)).toBeNull();
    expect(parseCompletionState(42)).toBeNull();
  });
});

describe("checkpoints", () => {
  it("short video → none", () => {
    expect(computeCheckpoints(5 * 60)).toEqual([]);
  });

  it("medium video → one near the middle", () => {
    const cps = computeCheckpoints(8 * 60);
    expect(cps).toHaveLength(1);
    expect(cps[0].atSeconds).toBe(Math.round((8 * 60) / 2));
    expect(cps[0].index).toBe(0);
  });

  it("long video → two at the thirds", () => {
    const cps = computeCheckpoints(15 * 60);
    expect(cps).toHaveLength(2);
    expect(cps[0].atSeconds).toBe(Math.round((15 * 60) / 3));
    expect(cps[1].atSeconds).toBe(Math.round((15 * 60 * 2) / 3));
  });

  it("is deterministic and ordered", () => {
    const a = computeCheckpoints(15 * 60);
    const b = computeCheckpoints(15 * 60);
    expect(a).toEqual(b);
    expect(a[0].atSeconds).toBeLessThan(a[1].atSeconds);
  });
});

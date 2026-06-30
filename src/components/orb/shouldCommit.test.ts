import { describe, it, expect } from "vitest";
import { shouldCommit } from "./Orb";

// Hold-to-commit latch (BTY Orb Entry Contract v1). `shouldCommit` is the pure
// observation: rising-edge true only when gather has saturated past the
// threshold AND this press has not yet committed. It mutates nothing — the
// gather/settle curve is unaffected.
const COMMIT_G = 0.97;

describe("shouldCommit — hold-to-commit latch", () => {
  it("1. does NOT commit before threshold (release-before-commit path)", () => {
    // mid-gather, not yet committed → nothing begins
    expect(shouldCommit(0.0, false, COMMIT_G)).toBe(false);
    expect(shouldCommit(0.5, false, COMMIT_G)).toBe(false);
    expect(shouldCommit(0.969, false, COMMIT_G)).toBe(false);
  });

  it("2. commits exactly at the threshold edge (rising edge fires)", () => {
    expect(shouldCommit(0.97, false, COMMIT_G)).toBe(true);
    expect(shouldCommit(1.0, false, COMMIT_G)).toBe(true);
  });

  it("3. does NOT re-fire once latched (held-past-commit, g pinned at 1.0)", () => {
    // committed already true across the remaining hold frames → no re-fire
    expect(shouldCommit(0.97, true, COMMIT_G)).toBe(false);
    expect(shouldCommit(1.0, true, COMMIT_G)).toBe(false);
  });

  it("4. release AFTER commit does not un-fire (latch stays closed)", () => {
    // settle frames after commit: g decays back toward 0 but committed stays true
    expect(shouldCommit(0.8, true, COMMIT_G)).toBe(false);
    expect(shouldCommit(0.0, true, COMMIT_G)).toBe(false);
  });

  it("5. a fresh press re-arms (committed reset to false) and can commit again", () => {
    // beginPress resets committedRef=false → next saturated hold commits once more
    expect(shouldCommit(0.5, false, COMMIT_G)).toBe(false); // gathering
    expect(shouldCommit(0.98, false, COMMIT_G)).toBe(true); // re-armed commit
  });
});

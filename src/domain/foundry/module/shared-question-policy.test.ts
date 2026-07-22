import { describe, it, expect } from "vitest";
import { shouldProposeSharedQuestion } from "./module-builder";

/**
 * Slice 3.1B-3G Amendment F — the Builder proposes a Shared Understanding question by default for
 * decide / practice / shared_standard needs (judgment, articulation of a standard), and leaves it
 * optional for Know-only. Pure + deterministic; the Host may always edit or remove it.
 */
describe("shouldProposeSharedQuestion (Builder default policy)", () => {
  it("proposes for decide / practice / shared_standard", () => {
    expect(shouldProposeSharedQuestion(["decide"])).toBe(true);
    expect(shouldProposeSharedQuestion(["practice"])).toBe(true);
    expect(shouldProposeSharedQuestion(["shared_standard"])).toBe(true);
  });

  it("does NOT propose for Know-only (stays optional)", () => {
    expect(shouldProposeSharedQuestion(["know"])).toBe(false);
  });

  it("proposes when ANY selected need warrants it", () => {
    expect(shouldProposeSharedQuestion(["know", "decide"])).toBe(true);
    expect(shouldProposeSharedQuestion(["know"])).toBe(false);
  });

  it("is safe for empty / undefined needs", () => {
    expect(shouldProposeSharedQuestion([])).toBe(false);
    expect(shouldProposeSharedQuestion(undefined)).toBe(false);
  });
});

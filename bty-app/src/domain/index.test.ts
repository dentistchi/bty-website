/**
 * domain/index — barrel re-exports 검증 (비즈니스/XP 미변경).
 */
import { describe, it, expect } from "vitest";
import * as domain from "./index";

describe("domain/index", () => {
  it("re-exports constants", () => {
    expect(domain.CORE_XP_PER_TIER).toBe(10);
    expect(domain.CODE_NAMES).toBeDefined();
    expect(domain.CODE_NAMES).toHaveLength(7);
  });

  it("re-exports dojo flow helpers", () => {
    expect(typeof domain.validateDojo50Submit).toBe("function");
    expect(typeof domain.computeDojo50Result).toBe("function");
    expect(domain.DOJO_50_AREAS).toBeDefined();
  });

  it("re-exports rules", () => {
    expect(domain.tierFromCoreXp).toBeDefined();
    expect(typeof domain.tierFromCoreXp).toBe("function");
  });
});

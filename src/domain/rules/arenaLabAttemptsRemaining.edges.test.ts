import { describe, it, expect } from "vitest";
import { arenaLabAttemptsRemaining } from "./arenaLabAttemptsRemaining";

describe("arenaLabAttemptsRemaining (edges)", () => {
  it("returns limit when used is 0", () => {
    expect(arenaLabAttemptsRemaining(0, 3)).toBe(3);
  });

  it("returns 0 when used >= limit", () => {
    expect(arenaLabAttemptsRemaining(3, 3)).toBe(0);
    expect(arenaLabAttemptsRemaining(5, 3)).toBe(0);
  });

  it("returns limit - used when 0 < used < limit", () => {
    expect(arenaLabAttemptsRemaining(2, 3)).toBe(1);
  });

  it("clamps negative used to 0", () => {
    expect(arenaLabAttemptsRemaining(-1, 3)).toBe(3);
  });
});

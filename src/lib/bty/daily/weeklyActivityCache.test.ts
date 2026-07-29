import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getCachedSummary, setCachedSummary, clearWeeklyActivityCache } from "./weeklyActivityCache";

afterEach(() => clearWeeklyActivityCache());

describe("weeklyActivityCache — account isolation (B3A.2D-R3.1)", () => {
  it("clearWeeklyActivityCache wipes the cached weekly summary (no cross-account seeding)", () => {
    setCachedSummary({ forgeStage: 5, weeklyPoints: 99 });
    expect(getCachedSummary()).not.toBeNull();
    clearWeeklyActivityCache();
    expect(getCachedSummary()).toBeNull();
  });

  it("AccountBlock clears the cache on both switch and sign-out (session teardown)", () => {
    const src = readFileSync(join(__dirname, "../../../components/app-shell/AccountBlock.tsx"), "utf8");
    expect(src).toMatch(/clearWeeklyActivityCache/);
    // Present in both the switch and sign-out handlers.
    const occurrences = src.match(/clearWeeklyActivityCache\(\)/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });
});

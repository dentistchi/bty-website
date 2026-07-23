/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { clearAccountScopedStorage } from "./accountScopedStorage";

describe("clearAccountScopedStorage (Slice 3.1B-3N-5B.1)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("(8)(10) clears account-scoped app keys so a previous account's state cannot persist", () => {
    localStorage.setItem("btyArenaState:v1", "x");
    localStorage.setItem("bty_mypage_refetch_required", "1");
    localStorage.setItem("bty_onboarding_role_v1", "leader");
    localStorage.setItem("assessment.answers.v1", "y");
    localStorage.setItem("dojo.result.v1", "y");
    localStorage.setItem("reflectionDraft:abc", "z");
    localStorage.setItem("missionState:run1", "m");
    sessionStorage.setItem("bty_d2_actor_seen_c1", "1");

    clearAccountScopedStorage();

    for (const k of [
      "btyArenaState:v1",
      "bty_mypage_refetch_required",
      "bty_onboarding_role_v1",
      "assessment.answers.v1",
      "dojo.result.v1",
      "reflectionDraft:abc",
      "missionState:run1",
    ]) {
      expect(localStorage.getItem(k)).toBeNull();
    }
    expect(sessionStorage.getItem("bty_d2_actor_seen_c1")).toBeNull();
  });

  it("preserves the freshly-written Supabase session (sb-*) and device-wide prefs", () => {
    localStorage.setItem("sb-mveycersmqfiuddslnrj-auth-token", "NEW_SESSION");
    localStorage.setItem("theme", "dark");
    localStorage.setItem("reduce-motion", "1");
    localStorage.setItem("btyArenaState:v1", "stale");

    clearAccountScopedStorage();

    expect(localStorage.getItem("sb-mveycersmqfiuddslnrj-auth-token")).toBe("NEW_SESSION");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(localStorage.getItem("reduce-motion")).toBe("1");
    expect(localStorage.getItem("btyArenaState:v1")).toBeNull();
  });
});

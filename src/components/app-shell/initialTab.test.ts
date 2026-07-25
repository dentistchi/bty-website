/** @vitest-environment node */
import { describe, it, expect } from "vitest";
import { resolveInitialAppTab } from "./initialTab";

/**
 * Return contract (App Shell + Today Simplification V1): `?tab=` opens one of the FOUR visible tabs;
 * legacy five-domain values still resolve (Foundry→Learn, Arena→Practice, Center→Me) so every
 * previously-shipped deep link keeps working; unknown/absent → null (default Today).
 */
describe("resolveInitialAppTab", () => {
  it("resolves each of the four visible tabs", () => {
    for (const tab of ["today", "learn", "practice", "me"]) {
      expect(resolveInitialAppTab(`?tab=${tab}`)).toBe(tab);
    }
  });

  it("maps legacy five-domain tab values to their new visible tab", () => {
    expect(resolveInitialAppTab("?tab=foundry")).toBe("learn");
    expect(resolveInitialAppTab("?tab=arena")).toBe("practice");
    expect(resolveInitialAppTab("?tab=center")).toBe("me");
  });

  it("still opens the correct tab from the account-switch return url", () => {
    // Legacy return url (?tab=foundry) resolves to Learn; a fresh one (?tab=learn) resolves directly.
    expect(resolveInitialAppTab("?next=x&tab=foundry&switch=1")).toBe("learn");
    expect(resolveInitialAppTab("?next=x&tab=learn&switch=1")).toBe("learn");
  });

  it("returns null for an absent tab param (default stays Today)", () => {
    expect(resolveInitialAppTab("")).toBeNull();
    expect(resolveInitialAppTab("?foo=bar")).toBeNull();
  });

  it("returns null for an UNKNOWN tab value (never alters shell state)", () => {
    expect(resolveInitialAppTab("?tab=admin")).toBeNull();
    expect(resolveInitialAppTab("?tab=")).toBeNull();
    expect(resolveInitialAppTab("?tab=FOUNDRY")).toBeNull(); // case-sensitive; not a known value
  });
});

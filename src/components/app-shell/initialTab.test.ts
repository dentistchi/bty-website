/** @vitest-environment node */
import { describe, it, expect } from "vitest";
import { resolveInitialAppTab } from "./initialTab";

/** Slice 3.1B-3E return contract: ?tab= opens a known tab; unknown/absent → null (default Today). */
describe("resolveInitialAppTab", () => {
  it("resolves each known tab", () => {
    for (const tab of ["today", "center", "arena", "foundry", "me"]) {
      expect(resolveInitialAppTab(`?tab=${tab}`)).toBe(tab);
    }
  });

  it("opens Foundry from the account-switch return url", () => {
    expect(resolveInitialAppTab("?tab=foundry")).toBe("foundry");
    expect(resolveInitialAppTab("?next=x&tab=foundry&switch=1")).toBe("foundry");
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

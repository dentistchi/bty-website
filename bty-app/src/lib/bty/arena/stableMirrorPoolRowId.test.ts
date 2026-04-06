import { describe, expect, it } from "vitest";
import { stableMirrorPoolRowId } from "./stableMirrorPoolRowId";

describe("stableMirrorPoolRowId", () => {
  it("is deterministic for the same user and origin", () => {
    const a = stableMirrorPoolRowId("11111111-1111-1111-1111-111111111111", "doctor_chronic_v2");
    const b = stableMirrorPoolRowId("11111111-1111-1111-1111-111111111111", "doctor_chronic_v2");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("differs when origin changes", () => {
    const u = "22222222-2222-2222-2222-222222222222";
    expect(stableMirrorPoolRowId(u, "a")).not.toBe(stableMirrorPoolRowId(u, "b"));
  });
});

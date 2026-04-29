import { describe, it, expect } from "vitest";
import { decodeRunsCursor, encodeRunsCursor } from "./runsCursor";

describe("runsCursor", () => {
  it("encode/decode round-trip", () => {
    const row = {
      started_at: "2026-03-15T10:00:00.000Z",
      run_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    };
    const c = encodeRunsCursor(row);
    const d = decodeRunsCursor(c);
    expect(d.ok).toBe(true);
    if (d.ok) {
      expect(d.sa).toBe(row.started_at);
      expect(d.rid).toBe(row.run_id);
    }
  });

  it("rejects invalid cursor", () => {
    expect(decodeRunsCursor("").ok).toBe(false);
    expect(decodeRunsCursor("!!!").ok).toBe(false);
    expect(decodeRunsCursor(Buffer.from("{}").toString("base64url")).ok).toBe(false);
  });
});

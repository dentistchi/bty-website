/**
 * GET /api/arena/avatar-assets — 200, body has accessories·outfits keys.
 */
import { describe, it, expect } from "vitest";
import { GET } from "./route";

describe("GET /api/arena/avatar-assets", () => {
  it("returns 200", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("returns JSON with accessories and outfits keys", async () => {
    const res = await GET();
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const data = await res.json();
    expect(data).toHaveProperty("accessories");
    expect(data).toHaveProperty("outfits");
    expect(data.accessories).toHaveProperty("dental");
    expect(data.accessories).toHaveProperty("game");
    expect(data.outfits).toHaveProperty("professional");
    expect(data.outfits).toHaveProperty("fantasy");
    expect(Array.isArray(data.accessories.dental)).toBe(true);
    expect(Array.isArray(data.accessories.game)).toBe(true);
    expect(Array.isArray(data.outfits.professional)).toBe(true);
    expect(Array.isArray(data.outfits.fantasy)).toBe(true);
  });
});

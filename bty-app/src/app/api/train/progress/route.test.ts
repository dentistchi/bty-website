/**
 * GET /api/train/progress — 200.
 */
import { describe, it, expect } from "vitest";
import { GET } from "./route";

describe("GET /api/train/progress", () => {
  it("returns 200 with ok, startDateISO, completedDays, todayUnlockedDay", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.hasSession).toBe(true);
    expect(typeof data.startDateISO).toBe("string");
    expect(Array.isArray(data.completedDays)).toBe(true);
    expect(data.todayUnlockedDay).toBe(1);
    expect(data.unlockedMaxDay).toBe(1);
  });

  it("sets Cache-Control no-store and Vary Cookie", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(res.headers.get("Vary")).toBe("Cookie");
  });

  it("returns 200 with content-type application/json on success", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const data = await res.json();
    expect(data).toHaveProperty("ok");
    expect(data).toHaveProperty("startDateISO");
    expect(data).toHaveProperty("completedDays");
    expect(data).toHaveProperty("todayUnlockedDay");
  });

  it("returns 200 with expected response keys", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    const expectedKeys = [
      "completedDays",
      "hasSession",
      "lastCompletedDay",
      "ok",
      "startDateISO",
      "todayUnlockedDay",
      "unlockedMaxDay",
    ].sort();
    expect(Object.keys(data).sort()).toEqual(expectedKeys);
  });

  it("returns 200 with hasSession as boolean", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.hasSession).toBe("boolean");
  });

  it("returns 200 with startDateISO as string", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.startDateISO).toBe("string");
    expect(data.startDateISO.length).toBeGreaterThan(0);
  });

  it("returns 200 with completedDays as array", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.completedDays)).toBe(true);
  });

  it("returns 200 with todayUnlockedDay as number", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.todayUnlockedDay).toBe("number");
  });
});

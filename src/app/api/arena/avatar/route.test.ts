/**
 * GET /api/arena/avatar — 400 (SPRINT 69 TASK 9 / C3).
 */
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

describe("GET /api/arena/avatar", () => {
  it("returns 400 when userId missing", async () => {
    const req = new NextRequest("http://localhost/api/arena/avatar");
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid userId");
  });

  it("returns 400 when userId is not a UUID", async () => {
    const req = new NextRequest(
      "http://localhost/api/arena/avatar?userId=not-a-uuid",
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid userId");
  });
});

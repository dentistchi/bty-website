/**
 * Legacy `/[locale]/arena` → `/[locale]/bty-arena` (308) — same layer as `bty-arena/run` canonical redirect.
 */
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";

describe("middleware — legacy /arena → /bty-arena (308)", () => {
  it("redirects /en/arena to /en/bty-arena preserving query", async () => {
    const { middleware } = await import("./middleware");
    const req = new NextRequest("http://localhost/en/arena?x=1");
    const res = await middleware(req);
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("http://localhost/en/bty-arena?x=1");
  });

  it("redirects /ko/arena/foo to /ko/bty-arena/foo", async () => {
    const { middleware } = await import("./middleware");
    const req = new NextRequest("http://localhost/ko/arena/foo");
    const res = await middleware(req);
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("http://localhost/ko/bty-arena/foo");
  });
});

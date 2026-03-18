/**
 * C6 238 — arena 경로가 미들웨어 matcher에 포함되는지 스모크.
 * (페이지 보호는 리다이렉트; API 401은 각 route의 requireUser/getUser.)
 */
import { describe, it, expect } from "vitest";

describe("middleware config — arena paths", () => {
  it("matcher covers /bty-arena and locale-prefixed app (so /en/bty-arena/* is gated)", async () => {
    const { config } = await import("./middleware");
    expect(config.matcher).toContain("/bty-arena/:path*");
    expect(config.matcher).toContain("/en/:path*");
    expect(config.matcher).toContain("/ko/:path*");
  });
});

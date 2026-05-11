import { describe, expect, it } from "vitest";
import { bcp47ToLocale, localeToBcp47, SUPPORTED_BCP47 } from "./bcp47";

describe("localeToBcp47", () => {
  it("maps en → en-US", () => {
    expect(localeToBcp47("en")).toBe("en-US");
  });
  it("maps ko → ko-KR", () => {
    expect(localeToBcp47("ko")).toBe("ko-KR");
  });
});

describe("bcp47ToLocale", () => {
  it("maps en-US → en", () => {
    expect(bcp47ToLocale("en-US")).toBe("en");
  });
  it("maps ko-KR → ko", () => {
    expect(bcp47ToLocale("ko-KR")).toBe("ko");
  });
  it("falls back to en for unknown locale", () => {
    expect(bcp47ToLocale("zh-CN")).toBe("en");
  });
  it("matches lowercase ko prefix", () => {
    expect(bcp47ToLocale("ko")).toBe("ko");
  });
});

describe("SUPPORTED_BCP47", () => {
  it("contains both en-US and ko-KR", () => {
    expect(SUPPORTED_BCP47).toContain("en-US");
    expect(SUPPORTED_BCP47).toContain("ko-KR");
  });
});

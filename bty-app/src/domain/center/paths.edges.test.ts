/**
 * Center paths 도메인 경계 테스트.
 * paths.test.ts와 중복 없이 미커버 경계만.
 */
import { describe, it, expect } from "vitest";
import {
  CENTER_CTA_PATH,
  CENTER_CHAT_OPEN_EVENT,
  getCenterCtaHref,
} from "./paths";

describe("Center paths (edges)", () => {
  it("getCenterCtaHref with locale containing hyphen", () => {
    expect(getCenterCtaHref("en-US")).toBe("/en-US/bty");
  });

  it("getCenterCtaHref with single-char locale", () => {
    expect(getCenterCtaHref("k")).toBe("/k/bty");
  });

  it("getCenterCtaHref with empty locale yields double-slash path", () => {
    expect(getCenterCtaHref("")).toBe("//bty");
  });

  it("getCenterCtaHref with locale containing underscore", () => {
    expect(getCenterCtaHref("zh_CN")).toBe("/zh_CN/bty");
  });

  it("getCenterCtaHref with locale containing slash yields path with segment", () => {
    expect(getCenterCtaHref("en/US")).toBe("/en/US/bty");
  });

  it("getCenterCtaHref with long locale string still yields valid path", () => {
    const long = "a".repeat(100);
    expect(getCenterCtaHref(long)).toBe(`/${long}/bty`);
  });

  it("getCenterCtaHref with single-space locale yields path with space", () => {
    expect(getCenterCtaHref(" ")).toBe("/ /bty");
  });

  it("getCenterCtaHref with digit-only locale", () => {
    expect(getCenterCtaHref("2")).toBe("/2/bty");
  });

  it("constants are stable for re-export usage", () => {
    expect(CENTER_CTA_PATH).toBe("/bty");
    expect(CENTER_CHAT_OPEN_EVENT).toBe("open-chatbot");
    expect(getCenterCtaHref("ko")).toContain(CENTER_CTA_PATH);
  });

  it("getCenterCtaHref with locale containing percent yields path with percent", () => {
    expect(getCenterCtaHref("en%2FUS")).toBe("/en%2FUS/bty");
  });

  it("getCenterCtaHref with numeric-looking locale string yields path", () => {
    expect(getCenterCtaHref("0")).toBe("/0/bty");
  });

  it("getCenterCtaHref with literal string 'undefined' yields path segment", () => {
    expect(getCenterCtaHref("undefined")).toBe("/undefined/bty");
  });

  it("getCenterCtaHref with 'ko' yields /ko/bty", () => {
    expect(getCenterCtaHref("ko")).toBe("/ko/bty");
  });

  it("getCenterCtaHref with locale containing unicode yields path with unicode", () => {
    expect(getCenterCtaHref("ko-한글")).toBe("/ko-한글/bty");
    expect(getCenterCtaHref("zh-中文")).toContain(CENTER_CTA_PATH);
  });

  it("getCenterCtaHref with locale having leading/trailing spaces does not trim (path includes spaces)", () => {
    expect(getCenterCtaHref(" en ")).toBe("/ en /bty");
  });

  it("getCenterCtaHref with undefined coerced to string yields path segment 'undefined'", () => {
    expect(getCenterCtaHref(undefined as unknown as string)).toBe("/undefined/bty");
  });
});

/**
 * Center paths 도메인 단위 테스트.
 * 경계/엣지는 paths.edges.test.ts에서 처리.
 */
import { describe, it, expect } from "vitest";
import {
  CENTER_CTA_PATH,
  CENTER_DEAR_ME_PATH,
  CENTER_CHAT_OPEN_EVENT,
  getCenterCtaHref,
  getDearMeHref,
} from "./paths";

describe("Center paths", () => {
  it("CENTER_CTA_PATH is /bty", () => {
    expect(CENTER_CTA_PATH).toBe("/bty");
  });

  it("CENTER_CHAT_OPEN_EVENT is open-chatbot", () => {
    expect(CENTER_CHAT_OPEN_EVENT).toBe("open-chatbot");
  });

  it("getCenterCtaHref returns /{locale}/bty for ko and en", () => {
    expect(getCenterCtaHref("ko")).toBe("/ko/bty");
    expect(getCenterCtaHref("en")).toBe("/en/bty");
  });

  it("Dear Me path and href", () => {
    expect(CENTER_DEAR_ME_PATH).toBe("/dear-me");
    expect(getDearMeHref("ko")).toBe("/ko/dear-me");
  });
});

/**
 * Center paths domain (§5·§6).
 */
import { describe, it, expect } from "vitest";
import {
  CENTER_CTA_PATH,
  CENTER_CHAT_OPEN_EVENT,
  getCenterCtaHref,
} from "./paths";

describe("Center paths", () => {
  it("CENTER_CTA_PATH is /bty", () => {
    expect(CENTER_CTA_PATH).toBe("/bty");
  });
  it("CENTER_CHAT_OPEN_EVENT is open-chatbot", () => {
    expect(CENTER_CHAT_OPEN_EVENT).toBe("open-chatbot");
  });
  it("getCenterCtaHref returns /locale/bty", () => {
    expect(getCenterCtaHref("ko")).toBe("/ko/bty");
    expect(getCenterCtaHref("en")).toBe("/en/bty");
  });
});

import { describe, expect, it } from "vitest";
import { trackConfirmationCard, trackDialogCard } from "./trackDialogCard";

describe("Track setup explains required input before submission", () => {
  it.each(["en", "ko"] as const)("%s labels the message and audience as required", locale => {
    const body = trackDialogCard(locale).card.content.body;
    const framing = body.find(field => "id" in field && field.id === "hostFraming");
    const people = body.find(field => "id" in field && field.id === "recipients");
    expect(framing).toMatchObject({
      isRequired: true,
      label: expect.stringContaining(locale === "ko" ? "필수" : "required"),
      errorMessage: expect.any(String),
      placeholder: expect.stringContaining(locale === "ko" ? "확인" : "review"),
    });
    expect(people).toMatchObject({
      isRequired: true,
      label: expect.stringContaining(locale === "ko" ? "필수" : "required"),
      errorMessage: expect.any(String),
      "choices.data": { dataset: "graph.microsoft.com/users?scope=currentContext" },
    });
  });

  it("keeps a rejected submission editable without losing the message", () => {
    const body = trackDialogCard("en", { trackingMode: "response", hostFraming: "Please reply by tomorrow." }).card.content.body;
    expect(body.find(field => "id" in field && field.id === "hostFraming"))
      .toMatchObject({ value: "Please reply by tomorrow.", isRequired: true });
    expect(body.find(field => "id" in field && field.id === "trackingMode"))
      .toMatchObject({ value: "response" });
    expect(body.find(field => "id" in field && field.id === "recipients"))
      .not.toHaveProperty("value");
  });

  it.each(["en", "ko"] as const)("%s explains preparation or failure without claiming delivery", locale => {
    const scheduled = trackConfirmationCard(1, locale, false, "scheduled");
    const unavailable = trackConfirmationCard(1, locale, false, "unavailable");
    expect(scheduled.card.content.body[2].text).toContain(locale === "ko" ? "준비" : "prepared");
    expect(unavailable.card.content.body[2].text).toContain(locale === "ko" ? "시작하지 못했습니다" : "have not started");
    expect(scheduled.height).toBeGreaterThan(trackConfirmationCard(1, locale).height);
  });
});

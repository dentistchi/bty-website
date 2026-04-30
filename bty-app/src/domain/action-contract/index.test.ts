import { describe, expect, it } from "vitest";
import { toDisplayState } from "./index";

describe("toDisplayState canonical action-contract transitions", () => {
  it("maps pending to action_required", () => {
    expect(toDisplayState("pending", false)).toBe("action_required");
  });

  it("maps submitted without validation approval to action_submitted", () => {
    expect(
      toDisplayState("submitted", false, {
        validationApprovedAt: null,
        verifiedAt: null,
      }),
    ).toBe("action_submitted");
  });

  it("maps submitted with validation_approved_at and no verified_at to action_awaiting_verification", () => {
    expect(
      toDisplayState("submitted", false, {
        validationApprovedAt: new Date().toISOString(),
        verifiedAt: null,
      }),
    ).toBe("action_awaiting_verification");
  });

  it("maps approved with verified_at to verified_completed", () => {
    expect(
      toDisplayState("approved", false, {
        validationApprovedAt: new Date().toISOString(),
        verifiedAt: new Date().toISOString(),
      }),
    ).toBe("verified_completed");
  });

  it("maps missed to missed", () => {
    expect(toDisplayState("missed", false)).toBe("missed");
  });

  it("maps pending+required to blocked", () => {
    expect(toDisplayState("pending", true)).toBe("blocked");
  });
});


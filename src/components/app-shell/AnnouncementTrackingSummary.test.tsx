/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import AnnouncementTrackingSummary from "./AnnouncementTrackingSummary";
import { summariseTracking, type TrackingEvidence } from "@/domain/announcement/trackingEvidence";

afterEach(cleanup);
const row = { trackingMode: "acknowledgment", openedAt: null, acknowledgedAt: null,
  responseSubmittedAt: null, recipientId: "recipient", display: "Alex", responseText: null } as const;

describe("a glanceable Track summary", () => {
  it.each(["en", "ko"] as const)("%s shows completion and keeps evidence details collapsed", locale => {
    const audience = [{ ...row, openedAt: "time" }];
    const { container } = render(<AnnouncementTrackingSummary counts={summariseTracking(1, audience)} audience={audience} locale={locale} />);
    expect(screen.getByTestId("tracking-progress").textContent)
      .toBe(locale === "ko" ? "1명 중 0명 확인 완료" : "0 of 1 confirmed");
    expect(screen.getByTestId("tracking-pending").textContent)
      .toBe(locale === "ko" ? "확인 대기 1명" : "1 awaiting confirmation");
    const details = container.querySelector("details")!;
    expect(details.open).toBe(false);
    expect(container.querySelector("dl")).toBeNull();
    fireEvent.click(screen.getByText(locale === "ko" ? "사람별 보기" : "View people"));
    expect(details.open).toBe(true);
    expect(screen.getByText("Alex")).toBeTruthy();
  });

  it("opening or acknowledging does not complete a requested reply", () => {
    const audience = [{ ...row, trackingMode: "response" as const, openedAt: "time", acknowledgedAt: "time" }];
    render(<AnnouncementTrackingSummary counts={summariseTracking(1, audience)} audience={audience} locale="en" />);
    expect(screen.getByTestId("tracking-progress").textContent).toBe("0 of 1 replied");
    expect(screen.getByTestId("tracking-pending").textContent).toBe("1 awaiting reply");
  });

  it("finishes only when each person's required action is recorded", () => {
    const audience = [{ ...row, acknowledgedAt: "time" }];
    render(<AnnouncementTrackingSummary counts={summariseTracking(1, audience)} audience={audience} locale="en" />);
    expect(screen.getByTestId("tracking-progress").textContent).toBe("1 of 1 confirmed");
    expect(screen.getByTestId("tracking-pending").textContent).toBe("All confirmed");
  });

  it("does not label a mixed audience as one kind of action", () => {
    const audience: (TrackingEvidence & { recipientId: string; display: string | null; responseText: string | null })[] = [
      { ...row, acknowledgedAt: "time" }, { ...row, recipientId: "other", trackingMode: "response" },
    ];
    render(<AnnouncementTrackingSummary counts={summariseTracking(2, audience)} audience={audience} locale="en" />);
    expect(screen.getByTestId("tracking-progress").textContent).toBe("1 of 2 completed");
  });
});

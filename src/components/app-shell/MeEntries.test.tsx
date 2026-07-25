/** @vitest-environment jsdom */
/** App Shell V1 Phase 7 — Me contains My Learning + Recovery/Center + My Experiences (placeholder). */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import MeEntries from "./MeEntries";

afterEach(cleanup);

describe("MeEntries", () => {
  it("renders My Learning, Recovery/Center, and a My Experiences placeholder", () => {
    render(<MeEntries locale="en" onOpenMyLearning={() => {}} onOpenRecovery={() => {}} />);
    expect(screen.getByTestId("me-my-learning")).toBeTruthy();
    expect(screen.getByTestId("me-recovery")).toBeTruthy();
    const experiences = screen.getByTestId("me-experiences");
    expect(experiences.textContent).toContain("Coming next");
    expect(experiences.hasAttribute("disabled")).toBe(true);
  });

  it("My Learning maps to its Me sub-view (callback fires)", () => {
    const onOpenMyLearning = vi.fn();
    render(<MeEntries locale="en" onOpenMyLearning={onOpenMyLearning} onOpenRecovery={() => {}} />);
    fireEvent.click(screen.getByTestId("me-my-learning"));
    expect(onOpenMyLearning).toHaveBeenCalledOnce();
  });

  it("Recovery / Center is reachable (voluntary entry callback fires)", () => {
    const onOpenRecovery = vi.fn();
    render(<MeEntries locale="en" onOpenMyLearning={() => {}} onOpenRecovery={onOpenRecovery} />);
    fireEvent.click(screen.getByTestId("me-recovery"));
    expect(onOpenRecovery).toHaveBeenCalledOnce();
  });

  it("renders KO copy under the ko locale", () => {
    render(<MeEntries locale="ko" onOpenMyLearning={() => {}} onOpenRecovery={() => {}} />);
    expect(screen.getByTestId("me-my-learning").textContent).toContain("나의 학습");
    expect(screen.getByTestId("me-recovery").textContent).toContain("회복");
  });
});

/** @vitest-environment jsdom */
/**
 * App Shell + Today Simplification V1 — the visible bottom navigation is EXACTLY four learner-facing
 * tabs (Today · Learn · Practice · Me), first-tap selects (no nested nav, no routing), and the bottom
 * safe-area inset is preserved.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import AppTabBar from "./AppTabBar";

afterEach(cleanup);

describe("AppTabBar — four visible tabs", () => {
  it("EN locale renders exactly Today / Learn / Practice / Me, in order", () => {
    render(<AppTabBar active="today" onSelect={() => {}} locale="en" />);
    const labels = screen.getAllByRole("button").map((b) => b.textContent);
    expect(labels).toEqual(["Today", "Learn", "Practice", "Me"]);
    // The retired five-domain labels are gone.
    for (const gone of ["Center", "Arena", "Foundry"]) {
      expect(screen.queryByText(gone)).toBeNull();
    }
  });

  it("KO locale renders exactly 오늘 / 배우기 / 연습 / 나, in order", () => {
    render(<AppTabBar active="today" onSelect={() => {}} locale="ko" />);
    const labels = screen.getAllByRole("button").map((b) => b.textContent);
    expect(labels).toEqual(["오늘", "배우기", "연습", "나"]);
  });

  it("renders exactly four tabs in BOTH locales (no fifth tab, same canonical order)", () => {
    const { unmount } = render(<AppTabBar active="today" onSelect={() => {}} locale="en" />);
    expect(screen.getAllByRole("button").length).toBe(4);
    unmount();
    render(<AppTabBar active="today" onSelect={() => {}} locale="ko" />);
    expect(screen.getAllByRole("button").length).toBe(4);
  });

  it("defaults to EN labels when no locale is provided", () => {
    render(<AppTabBar active="today" onSelect={() => {}} />);
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("Me")).toBeTruthy();
  });

  it("lays out four columns (no nested nav bar)", () => {
    const { container } = render(<AppTabBar active="today" onSelect={() => {}} locale="en" />);
    expect(container.querySelector(".grid.grid-cols-4")).not.toBeNull();
    expect(container.querySelectorAll("nav").length).toBe(1);
  });

  it("first tap selects the destination via callback (no routing)", () => {
    const onSelect = vi.fn();
    render(<AppTabBar active="today" onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Practice"));
    expect(onSelect).toHaveBeenCalledWith("practice");
    fireEvent.click(screen.getByText("Learn"));
    expect(onSelect).toHaveBeenCalledWith("learn");
  });

  it("marks the active tab with aria-current", () => {
    render(<AppTabBar active="me" onSelect={() => {}} />);
    expect(screen.getByText("Me").closest("button")?.getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("Today").closest("button")?.getAttribute("aria-current")).toBeNull();
  });

  it("preserves the bottom safe-area inset on the dock", () => {
    const { container } = render(<AppTabBar active="today" onSelect={() => {}} />);
    const nav = container.querySelector("nav")!;
    expect(nav.className).toContain("env(safe-area-inset-bottom)");
    expect(nav.className).toContain("shrink-0");
  });
});

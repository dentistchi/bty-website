/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import ApplyActionDayPicker from "./ApplyActionDayPicker";

afterEach(cleanup);

function Harness({ locale, spy }: { locale: "en" | "ko"; spy: (v: string | null) => void }) {
  const [v, setV] = useState<string | null>(null);
  return <ApplyActionDayPicker locale={locale} value={v} onChange={(n) => { setV(n); spy(n); }} />;
}

describe("ApplyActionDayPicker — day precision, tokens only", () => {
  it.each([
    ["en", "When will you do it?", "Today", "Tomorrow", "Pick a day", "Sometime this week", "In 2 days"],
    ["ko", "언제 하시겠습니까?", "오늘", "내일", "날짜 선택", "이번 주 중", "2일 후"],
  ] as const)("21–24. %s labels map to exact wire tokens", (locale, ask, today, tomorrow, pick, week, inTwo) => {
    const spy = vi.fn();
    render(<Harness locale={locale} spy={spy} />);
    expect(screen.getByText(ask)).toBeTruthy();
    fireEvent.click(screen.getByText(today)); expect(spy).toHaveBeenLastCalledWith("today");
    fireEvent.click(screen.getByText(tomorrow)); expect(spy).toHaveBeenLastCalledWith("tomorrow");
    fireEvent.click(screen.getByText(week)); expect(spy).toHaveBeenLastCalledWith("this_week");
    fireEvent.click(screen.getByText(pick));
    fireEvent.click(screen.getByText(inTwo)); expect(spy).toHaveBeenLastCalledWith("pick:2");
    // Every emitted value is a token or null — never a calendar date built from the device clock.
    for (const [v] of spy.mock.calls) expect(v === null || /^(today|tomorrow|this_week|pick:[2-6])$/.test(v)).toBe(true);
  });

  it("tapping the selected choice again clears it (optional by design)", () => {
    const spy = vi.fn();
    render(<Harness locale="en" spy={spy} />);
    fireEvent.click(screen.getByText("Tomorrow"));
    fireEvent.click(screen.getByText("Tomorrow"));
    expect(spy).toHaveBeenLastCalledWith(null);
  });

  it("offers no time-of-day, recurrence, reminder or deadline input", () => {
    const { container } = render(<Harness locale="en" spy={() => {}} />);
    fireEvent.click(screen.getByText("Pick a day"));
    expect(container.querySelectorAll("input, select, textarea")).toHaveLength(0);
    expect(container.textContent).not.toMatch(/AM|PM|repeat|remind|deadline/i);
  });
});

/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ArenaPulsePrompt from "./ArenaPulsePrompt";

afterEach(() => cleanup());

describe("ArenaPulsePrompt", () => {
  it("renders the KO question", () => {
    render(<ArenaPulsePrompt locale="ko" onSubmit={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByTestId("arena-pulse-question").textContent).toContain(
      "책임을 회피하지 않고",
    );
  });

  it("renders the EN question for non-ko locale", () => {
    render(<ArenaPulsePrompt locale="en" onSubmit={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByTestId("arena-pulse-question").textContent).toContain(
      "take responsibility without avoiding",
    );
  });

  it("submit disabled until a value is selected", () => {
    const onSubmit = vi.fn();
    render(<ArenaPulsePrompt locale="en" onSubmit={onSubmit} onSkip={vi.fn()} />);
    const submit = screen.getByTestId("arena-pulse-submit") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(submit);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("select then submit fires onSubmit with chosen value", () => {
    const onSubmit = vi.fn();
    render(<ArenaPulsePrompt locale="en" onSubmit={onSubmit} onSkip={vi.fn()} />);
    fireEvent.click(screen.getByTestId("arena-pulse-4"));
    fireEvent.click(screen.getByTestId("arena-pulse-submit"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(4);
  });

  it("skip fires onSkip", () => {
    const onSkip = vi.fn();
    render(<ArenaPulsePrompt locale="en" onSubmit={vi.fn()} onSkip={onSkip} />);
    fireEvent.click(screen.getByTestId("arena-pulse-skip"));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("submitted=true shows thanks, hides scale", () => {
    render(
      <ArenaPulsePrompt
        locale="en"
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        submitted
      />,
    );
    expect(screen.getByTestId("arena-pulse-thanks")).toBeTruthy();
    expect(screen.queryByTestId("arena-pulse-prompt")).toBeNull();
  });
});

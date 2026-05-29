/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getMessages } from "@/lib/i18n";

vi.mock("qrcode.react", () => ({
  QRCodeSVG: ({ value }: { value: string }) => <div data-testid="qr-code-mock" data-value={value} />,
}));

import { ActionLoopQrPanel } from "./ActionLoopQrPanel";

const URL_FIXTURE =
  "https://bty-arena-staging.ywamer2022.workers.dev/en/my-page?arena_action_loop=commit&aalo=tok-123";

afterEach(() => {
  cleanup();
});

describe("ActionLoopQrPanel — shared QR render contract", () => {
  it("renders QRCodeSVG with the provided url", () => {
    render(<ActionLoopQrPanel url={URL_FIXTURE} onDismiss={() => {}} locale="en" />);
    expect(screen.getByTestId("qr-code-mock").getAttribute("data-value")).toBe(URL_FIXTURE);
  });

  it("shows the selectable qr-debug-value with the url", () => {
    render(<ActionLoopQrPanel url={URL_FIXTURE} onDismiss={() => {}} locale="en" />);
    expect(screen.getByTestId("qr-debug-value").textContent).toContain(URL_FIXTURE);
  });

  it("calls onDismiss when the dismiss button is clicked", () => {
    const onDismiss = vi.fn();
    render(<ActionLoopQrPanel url={URL_FIXTURE} onDismiss={onDismiss} locale="en" />);
    fireEvent.click(screen.getByRole("button"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("resolves the dismiss label from getMessages(locale).actionContract.dismiss — en", () => {
    render(<ActionLoopQrPanel url={URL_FIXTURE} onDismiss={() => {}} locale="en" />);
    expect(screen.getByRole("button").textContent).toBe(getMessages("en").actionContract.dismiss);
  });

  it("resolves the dismiss label for ko", () => {
    render(<ActionLoopQrPanel url={URL_FIXTURE} onDismiss={() => {}} locale="ko" />);
    expect(screen.getByRole("button").textContent).toBe(getMessages("ko").actionContract.dismiss);
  });
});

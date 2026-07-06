/** @vitest-environment jsdom */
/**
 * Validation submit → QR CTA alignment: an `escalate` outcome still lands the
 * contract QR-ready server-side, so the actor must see "Show QR for verification"
 * (not be stuck on "sent for review"). Also guards the generic-error copy.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ArenaActionValidationForm } from "./ArenaActionValidationForm";

function fillAndSubmit() {
  fireEvent.change(screen.getByTestId("arena-action-validation-who"), { target: { value: "Jamie" } });
  fireEvent.change(screen.getByTestId("arena-action-validation-what"), { target: { value: "The tense standup" } });
  fireEvent.change(screen.getByTestId("arena-action-validation-result"), { target: { value: "I named the tension calmly." } });
  fireEvent.click(screen.getByTestId("arena-action-validation-submit"));
}

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, status, json: async () => body })) as unknown as typeof fetch,
  );
}

describe("ArenaActionValidationForm — escalate shows QR CTA", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("approve: calls onApproved, no QR CTA in the form", async () => {
    mockFetchOnce({ outcome: "approve", contract_state: "awaiting_qr", verified_at: null });
    const onApproved = vi.fn();
    render(<ArenaActionValidationForm locale="en" contractId="c1" onApproved={onApproved} />);
    fillAndSubmit();
    await waitFor(() => expect(onApproved).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Show QR for verification")).toBeNull();
  });

  it("escalate + QR-ready (awaiting_qr): shows QR CTA linking to My Page, does NOT call onApproved", async () => {
    mockFetchOnce({ outcome: "escalate", contract_state: "awaiting_qr", verified_at: null });
    const onApproved = vi.fn();
    render(<ArenaActionValidationForm locale="en" contractId="c1" onApproved={onApproved} />);
    fillAndSubmit();
    const cta = await screen.findByText("Show QR for verification");
    expect(cta.closest("a")?.getAttribute("href")).toBe("/en/my-page");
    expect(onApproved).not.toHaveBeenCalled();
    // review banner preserved
    expect(screen.getByTestId("arena-action-validation-banner")).toBeTruthy();
  });

  it("escalate but NOT QR-ready: no CTA, shows a specific state message (reports)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFetchOnce({ outcome: "escalate", contract_state: "pending", verified_at: null });
    render(<ArenaActionValidationForm locale="en" contractId="c1" onApproved={vi.fn()} />);
    fillAndSubmit();
    await screen.findByText("This action is not ready for QR verification yet.");
    expect(screen.queryByText("Show QR for verification")).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("resubmit 409 contract_not_submittable: shows QR CTA (already QR-ready), not a generic error", async () => {
    mockFetchOnce({ error: "contract_not_submittable", status: "submitted" }, false, 409);
    render(<ArenaActionValidationForm locale="en" contractId="c1" onApproved={vi.fn()} />);
    fillAndSubmit();
    expect(await screen.findByText("Show QR for verification")).toBeTruthy();
  });

  it("generic hard error: shows generic copy WITHOUT 'try again', no CTA", async () => {
    mockFetchOnce({ error: "update_failed" }, false, 500);
    render(<ArenaActionValidationForm locale="en" contractId="c1" onApproved={vi.fn()} />);
    fillAndSubmit();
    const banner = await waitFor(() => screen.getByTestId("arena-action-validation-banner"));
    expect(banner.textContent).toContain("Validation could not be completed.");
    expect(banner.textContent?.toLowerCase()).not.toContain("try again");
    expect(screen.queryByText("Show QR for verification")).toBeNull();
  });
});

/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AwakeningActsTrack } from "./AwakeningActsTrack";

const data = { ok: true, acts: { "1": "Reflect", "2": "Acknowledge", "3": "Continue" }, eligible: true, completedActs: [], trigger: { day: 28, requires_min_sessions: 12 } };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const fetcher = vi.fn();
beforeEach(() => { fetcher.mockReset(); vi.stubGlobal("fetch", fetcher); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function open(reply: () => Promise<Response>) {
  fetcher.mockImplementation((_url: string, init?: RequestInit) => init?.method === "POST" ? reply() : Promise.resolve(json(data)));
  render(<AwakeningActsTrack locale="en" />);
  const record = await screen.findByRole("button", { name: /record next act/i });
  fireEvent.click(record);
}

describe("Awakening Acts verified progress feedback", () => {
  it.each([{}, null, [], { ...data, ok: "true" }, { ...data, completedActs: [2] }, { ...data, completedActs: [1, 1] }].map(body => ({ body })))(
    "rejects malformed HTTP200 reads $body and offers retry", async ({ body }) => {
      let invalid = true; fetcher.mockImplementation(() => Promise.resolve(json(invalid ? body : data)));
      render(<AwakeningActsTrack locale="en" />);
      expect(await screen.findByRole("alert")).toBeTruthy();
      expect(screen.queryByRole("progressbar")).toBeNull();
      invalid = false; fireEvent.click(screen.getByRole("button", { name: /^Retry$/ }));
      expect((await screen.findByRole("progressbar")).getAttribute("aria-valuenow")).toBe("0");
    },
  );

  it.each([
    { ok: "true", completedActs: [1] }, { ok: true, completedActs: [] },
    { ok: true, completedActs: [2] }, { ok: true, completedActs: [1, 1] },
    { ok: true, completedActs: [1, 4] }, { ok: true, completedActs: "1" },
  ])("does not advance progress from malformed acknowledgement %j", async body => {
    await open(async () => json(body));
    expect(await screen.findByText(/Could not confirm your progress/i)).toBeTruthy();
    expect((screen.getByRole("progressbar")).getAttribute("aria-valuenow")).toBe("0");
    expect((screen.getByRole("button", { name: /record next act/i })).hasAttribute("disabled")).toBe(false);
  });

  it("does not describe a review-required 409 as an already recorded act or reload as success", async () => {
    await open(async () => json({ error: "HEALING_COMPLETION_REVIEW_REQUIRED", detail: "INTERNAL_REVIEW_MARKER" }, 409));
    expect((await screen.findAllByText(/This completion needs review/i)).length).toBeGreaterThan(0);
    expect((screen.getByRole("progressbar")).getAttribute("aria-valuenow")).toBe("0");
    expect(fetcher.mock.calls.filter(([, init]) => init?.method !== "POST")).toHaveLength(1);
    expect(screen.queryByText("INTERNAL_REVIEW_MARKER")).toBeNull();
  });

  it("shows a review-required read without guessing that all acts were completed", async () => {
    fetcher.mockResolvedValue(json({ error: "HEALING_COMPLETION_REVIEW_REQUIRED" }, 409));
    render(<AwakeningActsTrack locale="en" />);
    expect((await screen.findByRole("alert")).textContent).toContain("This completion needs review");
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByRole("button", { name: /^Retry$/ })).toBeTruthy();
  });

  it("only the explicit already-completed conflict reloads the canonical progress", async () => {
    let reads = 0;
    fetcher.mockImplementation((_url: string, init?: RequestInit) => init?.method === "POST"
      ? Promise.resolve(json({ error: "ACT_ALREADY_COMPLETED" }, 409))
      : Promise.resolve(json(++reads === 1 ? data : { ...data, completedActs: [1] })));
    render(<AwakeningActsTrack locale="en" />);
    fireEvent.click(await screen.findByRole("button", { name: /record next act/i }));
    await waitFor(() => expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("33"));
    expect(reads).toBe(2);
  });

  it("retains zero progress after a server failure, then accepts a canonical retry", async () => {
    let fail = true;
    await open(async () => fail ? json({ error: "INTERNAL_WRITE_MARKER" }, 500) : json({ ok: true, completedActs: [1] }));
    expect(await screen.findByText(/Could not confirm your progress/i)).toBeTruthy();
    expect((screen.getByRole("progressbar")).getAttribute("aria-valuenow")).toBe("0");
    fail = false; fireEvent.click(screen.getByRole("button", { name: /record next act/i }));
    await waitFor(() => expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("33"));
    expect(screen.queryByText("INTERNAL_WRITE_MARKER")).toBeNull();
  });
});

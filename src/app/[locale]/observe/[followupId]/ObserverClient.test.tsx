/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
/** Slice 3.2N — the page now offers an explicit way back (there is no browser chrome in the app). */
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import ObserverClient from "./ObserverClient";

/**
 * SLICE 3.2M-5 — the observer's page.
 *
 * The properties under test are the ones that make an attestation worth having: they are asked
 * about the frozen standard and nothing else, they are asked WHEN, they cannot pick a future
 * date, and they can come back and answer again. Plus the privacy floor — a colleague who has
 * read the learner's own claim is no longer an independent source.
 */
const REQUEST = {
  followupId: "fu-1",
  learnerDisplayName: "Ann",
  observableStandard: "The outgoing person states each open item aloud and the incoming person repeats it back.",
  maxObservedOn: "2026-08-20",
  myObservations: [] as { outcome: string; observedOn: string; submittedAt: string }[],
};

function mockApi(get: unknown, post: unknown = { ok: true, created: true }, getStatus = 200) {
  const calls: { url: string; body?: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : undefined });
      if (init?.method === "POST") return { ok: true, status: 200, json: async () => post };
      return { ok: getStatus === 200, status: getStatus, json: async () => get };
    }),
  );
  return calls;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ObserverClient", () => {
  it("asks about the frozen standard, verbatim", async () => {
    mockApi({ ok: true, request: REQUEST });
    render(<ObserverClient followupId="fu-1" locale="en" />);
    expect((await screen.findByTestId("observe-standard")).textContent).toBe(REQUEST.observableStandard);
    expect((await screen.findByTestId("observe-who")).textContent).toBe("Ann");
  });

  it("offers exactly three answers, and none of them is a rating", async () => {
    mockApi({ ok: true, request: REQUEST });
    render(<ObserverClient followupId="fu-1" locale="en" />);
    expect((await screen.findByTestId("observe-answer-OBSERVED")).textContent).toMatch(/I saw or heard this/);
    expect(screen.getByTestId("observe-answer-NOT_OBSERVED").textContent).toMatch(/didn't observe/);
    expect(screen.getByTestId("observe-answer-UNABLE_TO_TELL").textContent).toMatch(/couldn't tell/);
  });

  it("asks WHEN, defaults to today, and cannot be set to the future", async () => {
    mockApi({ ok: true, request: REQUEST });
    render(<ObserverClient followupId="fu-1" locale="en" />);
    const date = (await screen.findByTestId("observe-date")) as HTMLInputElement;
    expect(date.value, "today in the canonical frame — the commonest truthful answer").toBe("2026-08-20");
    expect(date.max, "the server checks this again; the attribute is only a courtesy").toBe("2026-08-20");
  });

  it("submits the OCCURRENCE date the observer chose, not the moment they pressed the button", async () => {
    const calls = mockApi({ ok: true, request: REQUEST });
    render(<ObserverClient followupId="fu-1" locale="en" />);
    const date = await screen.findByTestId("observe-date");
    fireEvent.change(date, { target: { value: "2026-08-13" } });
    fireEvent.click(screen.getByTestId("observe-answer-OBSERVED"));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/submit"))).toBe(true));
    const post = calls.find((c) => c.url.endsWith("/submit"))!;
    expect(post.body).toEqual({ outcome: "OBSERVED", observedOn: "2026-08-13" });
  });

  it("a repeat of the same date and answer is acknowledged calmly, not as a failure", async () => {
    mockApi({ ok: true, request: REQUEST }, { ok: true, created: false });
    render(<ObserverClient followupId="fu-1" locale="en" />);
    fireEvent.click(await screen.findByTestId("observe-answer-OBSERVED"));
    expect((await screen.findByTestId("observe-notice")).textContent).toMatch(/already reported that for this date/);
  });

  it("stays open after a report — a colleague can come back and answer for a later date", async () => {
    // No terminal state: the answer buttons and the date control are still there afterwards.
    mockApi({ ok: true, request: { ...REQUEST, myObservations: [{ outcome: "OBSERVED", observedOn: "2026-08-13", submittedAt: "2026-08-13T09:00:00Z" }] } });
    render(<ObserverClient followupId="fu-1" locale="en" />);
    expect(await screen.findByTestId("observe-answer-OBSERVED")).toBeTruthy();
    expect(screen.getByTestId("observe-date")).toBeTruthy();
  });

  it("shows the observer their OWN prior reports, by occurrence date", async () => {
    mockApi({
      ok: true,
      request: {
        ...REQUEST,
        myObservations: [
          { outcome: "OBSERVED", observedOn: "2026-08-10", submittedAt: "2026-08-10T09:00:00Z" },
          { outcome: "OBSERVED", observedOn: "2026-08-24", submittedAt: "2026-08-24T09:00:00Z" },
        ],
      },
    });
    render(<ObserverClient followupId="fu-1" locale="en" />);
    const prior = await screen.findAllByTestId("observe-prior");
    expect(prior).toHaveLength(2);
    expect(prior[0].textContent).toMatch(/Aug 10/);
    expect(prior[1].textContent).toMatch(/Aug 24/);
  });

  it("a refused date is explained in the observer's terms", async () => {
    mockApi({ ok: true, request: REQUEST }, { ok: false, error: "future_date" });
    render(<ObserverClient followupId="fu-1" locale="en" />);
    fireEvent.click(await screen.findByTestId("observe-answer-OBSERVED"));
    expect((await screen.findByTestId("observe-notice")).textContent).toMatch(/already happened/);
  });

  it("no authority reads exactly like nothing to answer — the page never confirms a request exists", async () => {
    mockApi({ ok: false, error: "not_found" }, undefined, 404);
    render(<ObserverClient followupId="fu-1" locale="en" />);
    expect((await screen.findByTestId("observe-unavailable")).textContent).toMatch(/nothing here for you to answer/);
  });

  it("shows NO learner evidence and NO ladder vocabulary", async () => {
    // The response is deliberately fattened with everything the server must never send. If any
    // of it reached the page, this fails — rather than passing because the page was still blank.
    mockApi({
      ok: true,
      request: {
        ...REQUEST,
        myObservations: [{ outcome: "OBSERVED", observedOn: "2026-08-10", submittedAt: "2026-08-10T09:00:00Z" }],
        reflection: "PRIVATE REFLECTION",
        decisionResponse: "MY DECISION",
        followUpOutcome: "APPLIED",
      },
    });
    const { container } = render(<ObserverClient followupId="fu-1" locale="en" />);
    await screen.findByTestId("observe-standard");
    const text = container.textContent ?? "";
    for (const forbidden of [
      "PRIVATE REFLECTION", "MY DECISION", "APPLIED", "sustained", "Evidence", "OBSERVED", "followup_id", "fu-1",
    ]) {
      expect(text, forbidden).not.toContain(forbidden);
    }
    // The observer's own prior answer is shown in THEIR words, never as the stored token.
    expect(text).toContain("I saw or heard this");
  });
});

/**
 * SLICE 3.2N — the page is now reached from the reviewer surface, so it needs a way back that
 * does not depend on browser chrome: in the native shell there is none, and a page whose only
 * exit is the browser's back button is a dead end there.
 */
describe("ObserverClient — getting back out", () => {
  it("offers an explicit way back to Practice", async () => {
    mockApi({ ok: true, request: REQUEST });
    render(<ObserverClient followupId="fu-1" locale="en" />);
    fireEvent.click(await screen.findByTestId("observe-back"));
    expect(push).toHaveBeenCalledWith("/en/app?tab=practice");
  });

  it("offers it even when there is nothing to answer — never a dead end", async () => {
    mockApi({ ok: false, error: "not_found" }, undefined, 404);
    render(<ObserverClient followupId="fu-1" locale="en" />);
    await screen.findByTestId("observe-unavailable");
    expect(screen.getByTestId("observe-back")).toBeTruthy();
  });
});

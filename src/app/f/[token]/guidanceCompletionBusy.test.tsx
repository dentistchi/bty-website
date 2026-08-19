/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import FoundryGuidanceClient from "./FoundryGuidanceClient";

/**
 * R4-R2G-R1 — THE BUSY STATE MUST ALWAYS RESOLVE.
 *
 * MEASURED IN PRODUCTION, on the first written-guidance completion: `completed_at` was written
 * at 18:37:38.61, seconds after the Founder tapped Complete — and the screen said "Completing…"
 * until roughly 18:49. Twelve minutes during which the training was finished in the database and
 * the learner was told it was still in flight.
 *
 * The client had no bound on the request and no way to reconcile, so its only notion of "done"
 * was the HTTP response arriving. These tests pin the contract that replaced it:
 *
 *   success  → busy clears, learner sees the finished training
 *   failure  → busy clears, one honest retryable sentence
 *   timeout  → busy clears, and we ASK the server rather than guessing:
 *                already complete ⇒ show it as complete (never a false failure)
 *                not complete     ⇒ the honest retryable sentence
 *   re-tap   → cannot produce a second completion or a second award
 */

const REQUEST_TIMEOUT_MS = 20_000;

const jsonRes = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const BASE = {
  content_type: "written_guidance" as const,
  event: { title: "Confirm Patient Understanding", status: "open" as const },
  participant: { display_name: "테스트11" },
  guidance: { material_text: "Ask them to say it back.", completion_prompt: "What will you ask?", shared_question: null },
  declared: true,
  stage: "response",
  xp_status: "none",
};

const COMPLETED = { ...BASE, stage: "completed_claimable", xp_status: "none" };

/**
 * `snapshotAfter` is what a GET returns — i.e. what the SERVER believes, independent of whether
 * the POST's response ever arrived. That separation is the whole point of the reconcile.
 */
function mockRoom(opts: {
  completeBehaviour: "ok" | "error" | "hang";
  snapshotAfter?: unknown;
}) {
  const calls: string[] = [];
  let gets = 0;
  const fn = vi.fn((url: string, o?: { method?: string; signal?: AbortSignal }) => {
    const method = o?.method ?? "GET";
    calls.push(`${method} ${url.replace(/^.*\/guidance/, "/guidance")}`);

    if (method === "POST" && url.includes("/complete")) {
      if (opts.completeBehaviour === "ok") return Promise.resolve(jsonRes({ ok: true, ...COMPLETED }));
      if (opts.completeBehaviour === "error") return Promise.resolve(jsonRes({ ok: false, error: "event_closed" }, 409));
      // "hang": never resolves on its own — only the client's own abort can end it.
      return new Promise((_resolve, reject) => {
        o?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    }
    /*
      The FIRST GET is the room opening, before anything was submitted — it must show the
      unfinished room or the completion form never renders. `snapshotAfter` is what the server
      says on any LATER read, which is where a reconcile looks.
    */
    gets += 1;
    return Promise.resolve(jsonRes(gets === 1 ? BASE : (opts.snapshotAfter ?? BASE)));
  });
  // @ts-expect-error test shim
  global.fetch = fn;
  return { calls, fn };
}

async function fillAndComplete() {
  const field = (await screen.findByLabelText("Before you finish")) as HTMLTextAreaElement;
  await act(async () => {
    fireEvent.change(field, { target: { value: "I'll ask them to say it back." } });
  });
  await act(async () => {
    fireEvent.click(screen.getByTestId("guidance-complete"));
  });
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("R4-R2G-R1 · success clears busy", () => {
  it("a completed request leaves no busy state and shows the finished training", async () => {
    mockRoom({ completeBehaviour: "ok" });
    render(<FoundryGuidanceClient token="tok" contentType="written_guidance" />);
    await fillAndComplete();

    await waitFor(() => expect(screen.getByText("Training complete")).toBeTruthy());
    expect(screen.queryByText("Completing…")).toBeNull();
    expect(screen.queryByTestId("guidance-submit-error")).toBeNull();
  });
});

describe("R4-R2G-R1 · failure clears busy", () => {
  it("a refused request leaves no busy state and offers a retry", async () => {
    mockRoom({ completeBehaviour: "error", snapshotAfter: BASE });
    render(<FoundryGuidanceClient token="tok" contentType="written_guidance" />);
    await fillAndComplete();

    await waitFor(() => expect(screen.getByTestId("guidance-submit-error")).toBeTruthy());
    expect(screen.getByTestId("guidance-submit-error").textContent).toBe("That didn’t go through. Tap again to try.");
    // The control is usable again — the learner is never stranded.
    const btn = screen.getByTestId("guidance-complete") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe("Complete");
  });
});

describe("R4-R2G-R1 · timeout clears busy — and never lies in either direction", () => {
  it("THE PRODUCTION CASE: the server did complete, so the learner sees their finished training", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // POST never answers; the SERVER, however, has completed the training.
    const room = mockRoom({ completeBehaviour: "hang", snapshotAfter: COMPLETED });
    render(<FoundryGuidanceClient token="tok" contentType="written_guidance" />);
    await fillAndComplete();

    // Still waiting, exactly as before the repair.
    expect(screen.getByTestId("guidance-complete").textContent).toBe("Completing…");

    await act(async () => {
      vi.advanceTimersByTime(REQUEST_TIMEOUT_MS + 100);
    });

    await waitFor(() => expect(screen.getByText("Training complete")).toBeTruthy());
    // No false failure over a training that is finished.
    expect(screen.queryByTestId("guidance-submit-error")).toBeNull();
    // It ASKED rather than guessing.
    expect(room.calls.filter((c) => c.startsWith("GET")).length).toBeGreaterThanOrEqual(2);
  });

  it("the server did NOT complete, so the learner gets one honest retryable sentence", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockRoom({ completeBehaviour: "hang", snapshotAfter: BASE });
    render(<FoundryGuidanceClient token="tok" contentType="written_guidance" />);
    await fillAndComplete();

    await act(async () => {
      vi.advanceTimersByTime(REQUEST_TIMEOUT_MS + 100);
    });

    await waitFor(() => expect(screen.getByTestId("guidance-submit-error")).toBeTruthy());
    const btn = screen.getByTestId("guidance-complete") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(screen.queryByText("Training complete")).toBeNull();
  });

  it("the UI is never left on 'Completing…' once the bound has passed", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockRoom({ completeBehaviour: "hang", snapshotAfter: BASE });
    render(<FoundryGuidanceClient token="tok" contentType="written_guidance" />);
    await fillAndComplete();

    await act(async () => {
      vi.advanceTimersByTime(REQUEST_TIMEOUT_MS + 100);
    });

    await waitFor(() => expect(screen.getByTestId("guidance-complete").textContent).toBe("Complete"));
  });
});

describe("R4-R2G-R1 · a repeated tap cannot duplicate completion or XP", () => {
  it("tapping Complete twice while one is in flight sends exactly ONE completion", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const room = mockRoom({ completeBehaviour: "hang", snapshotAfter: BASE });
    render(<FoundryGuidanceClient token="tok" contentType="written_guidance" />);

    const field = (await screen.findByLabelText("Before you finish")) as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(field, { target: { value: "I'll ask them to say it back." } });
    });
    const btn = screen.getByTestId("guidance-complete");
    await act(async () => {
      fireEvent.click(btn);
      fireEvent.click(btn);
      fireEvent.click(btn);
    });

    expect(room.calls.filter((c) => c.includes("/complete"))).toHaveLength(1);
  });

  it("after a successful completion the completion control is gone entirely", async () => {
    mockRoom({ completeBehaviour: "ok" });
    render(<FoundryGuidanceClient token="tok" contentType="written_guidance" />);
    await fillAndComplete();

    await waitFor(() => expect(screen.getByText("Training complete")).toBeTruthy());
    // There is no second tap to make: the form is not on screen once the room is finished.
    expect(screen.queryByTestId("guidance-complete")).toBeNull();
  });

  it("re-tapping after a timeout-then-reconcile sends a second completion, which the server makes idempotent", async () => {
    /*
      The client deliberately does NOT block a retry after an honest failure — a learner who was
      told to tap again must be able to. Safety comes from the server: `completeGuidanceTraining`
      returns early when `completed_at` is set and its update is guarded by `.is("completed_at",
      null)`, so a second call can neither overwrite the answer nor award XP twice. That rule is
      pinned in `guidanceRuntime.test.ts` ("is idempotent — a second completion neither re-awards
      nor overwrites the answer"); this test only proves the client stays usable.
    */
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const room = mockRoom({ completeBehaviour: "hang", snapshotAfter: BASE });
    render(<FoundryGuidanceClient token="tok" contentType="written_guidance" />);
    await fillAndComplete();
    await act(async () => {
      vi.advanceTimersByTime(REQUEST_TIMEOUT_MS + 100);
    });
    await waitFor(() => expect(screen.getByTestId("guidance-submit-error")).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByTestId("guidance-complete"));
    });
    expect(room.calls.filter((c) => c.includes("/complete"))).toHaveLength(2);
  });
});

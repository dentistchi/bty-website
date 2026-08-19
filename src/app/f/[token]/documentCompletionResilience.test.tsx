/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";

/**
 * A CONTROLLABLE READER. The real `PdfReader` renders a canvas and drives its own heartbeats;
 * these tests need to fire beats deliberately, so it is replaced by a button that emits one.
 * Everything under test — the bound, the reconcile, the busy contract — lives in the client.
 */
let emitBeat: ((b: { lastPage: number; viewedPages: number[]; activeMsDelta: number }) => void) | null = null;
vi.mock("./PdfReader", () => ({
  PdfReader: (props: { onHeartbeat: (b: { lastPage: number; viewedPages: number[]; activeMsDelta: number }) => void }) => {
    emitBeat = props.onHeartbeat;
    return null;
  },
}));

import FoundryDocumentClient from "./FoundryDocumentClient";

/**
 * R4-R2H — THE DOCUMENT ROOM MUST NOT BE ABLE TO STALL IN SILENCE.
 *
 * R4-R2G measured the shape of this defect on the guidance room: a completion whose durable
 * write had already landed left the screen saying "Completing…" for eleven and a half minutes,
 * because the UI's only notion of "done" was the HTTP response arriving. The document client
 * carried the same unbounded pattern, plus two failure modes the guidance room never had — a
 * silent auto-claim that took the global interaction lock, and a fire-and-forget reading
 * heartbeat that could lose the exposure evidence with nothing on screen to say so.
 *
 * These tests pin all three, and pin the restraint as well: a transient heartbeat failure that
 * recovers must never reach the learner.
 */

const REQUEST_TIMEOUT_MS = 20_000;

const res = (body: unknown, ok = true, status = ok ? 200 : 400) => ({ ok, status, json: async () => body });

function snap(over: Record<string, unknown> = {}) {
  return {
    content_type: "document",
    event: { title: "Establishing Action Ownership in Huddles", status: "open" },
    participant: { display_name: "테스터223" },
    document: {
      page_count: 2,
      min_read_seconds: 15,
      intro: null,
      last_page: 1,
      distinct_pages_viewed: 0,
      active_read_ms: 0,
      reading_complete: true,
      completion_prompt: "What two things should be clear before a huddle ends?",
      shared_question: null,
    },
    journey: null,
    reflection_required: false,
    stage: "read",
    xp_status: "none",
    ...over,
  };
}

const COMPLETED = snap({ stage: "completed_claimable", xp_status: "none" });

type Behaviour = "ok" | "error" | "hang";

/**
 * `snapshotAfter` is what a GET returns — what the SERVER believes, independent of whether a
 * POST's response ever arrived. That separation is the whole point of a reconcile.
 */
function mockRoom(opts: {
  complete?: Behaviour;
  reading?: Behaviour | Behaviour[];
  claim?: Behaviour;
  join?: Behaviour;
  initial?: Record<string, unknown>;
  snapshotAfter?: unknown;
}) {
  const calls: string[] = [];
  let gets = 0;
  let readingCall = 0;
  const hang = (init?: RequestInit) =>
    new Promise((_r, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    });

  const fn = vi.fn((url: string, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? "GET";
    calls.push(`${method} ${u.replace(/^.*\/public\/[^/]+/, "")}`);

    if (method === "POST" && u.includes("/join")) {
      if (opts.join === "hang") return hang(init);
      if (opts.join === "error") return Promise.resolve(res({ error: "join_failed" }, false, 500));
      return Promise.resolve(res({ ok: true }));
    }
    if (method === "POST" && u.includes("/doc/reading")) {
      const seq = Array.isArray(opts.reading) ? opts.reading : [opts.reading ?? "ok"];
      const b = seq[Math.min(readingCall, seq.length - 1)] ?? "ok";
      readingCall += 1;
      if (b === "hang") return hang(init);
      if (b === "error") return Promise.resolve(res({ error: "progress_failed" }, false, 500));
      return Promise.resolve(res({ ok: true, ...snap({ ...(opts.initial ?? {}) }) }));
    }
    if (method === "POST" && u.includes("/doc/complete")) {
      if (opts.complete === "hang") return hang(init);
      if (opts.complete === "error") return Promise.resolve(res({ error: "event_closed" }, false, 409));
      return Promise.resolve(res({ ok: true, ...COMPLETED }));
    }
    if (method === "POST" && u.includes("/doc/claim-xp")) {
      if (opts.claim === "hang") return hang(init);
      if (opts.claim === "error") return Promise.resolve(res({ error: "not_completed" }, false, 409));
      return Promise.resolve(res({ ok: true, ...COMPLETED, xp_status: "awarded" }));
    }
    if (u.includes("/doc/file")) return Promise.resolve(res({ ok: true, url: "blob:doc" }));

    gets += 1;
    const first = snap(opts.initial ?? {});
    return Promise.resolve(res(gets === 1 ? first : (opts.snapshotAfter ?? first)));
  });
  // @ts-expect-error test shim
  global.fetch = fn;
  return { calls, fn };
}

async function completeIt() {
  const field = (await screen.findByPlaceholderText(/Write what you will say/i)) as HTMLTextAreaElement;
  await act(async () => {
    fireEvent.change(field, { target: { value: "Owner and deadline." } });
  });
  await act(async () => {
    fireEvent.click(screen.getByText("Complete training"));
  });
}

beforeEach(() => {
  emitBeat = null;
  vi.useRealTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("R4-R2H · 1–2 · completion success and explicit failure both clear busy", () => {
  it("success reaches the finished state with no busy state left behind", async () => {
    mockRoom({ complete: "ok" });
    render(<FoundryDocumentClient token="tok" />);
    await completeIt();

    await waitFor(() => expect(screen.getByText("TRAINING COMPLETE")).toBeTruthy());
    expect(screen.queryByTestId("doc-submit-error")).toBeNull();
  });

  it("an explicit refusal shows one honest sentence and leaves the control usable", async () => {
    mockRoom({ complete: "error", snapshotAfter: snap() });
    render(<FoundryDocumentClient token="tok" />);
    await completeIt();

    await waitFor(() => expect(screen.getByTestId("doc-submit-error")).toBeTruthy());
    expect(screen.getByTestId("doc-submit-error").textContent).toBe("That didn’t go through. Tap again to try.");
    expect((screen.getByText("Complete training") as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("R4-R2H · 3–4 · completion timeout never lies in either direction", () => {
  it("THE PRODUCTION SHAPE: the server DID complete, so the learner sees their finished training", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockRoom({ complete: "hang", snapshotAfter: { ...COMPLETED } });
    render(<FoundryDocumentClient token="tok" />);
    await completeIt();

    await act(async () => {
      vi.advanceTimersByTime(REQUEST_TIMEOUT_MS + 100);
    });

    await waitFor(() => expect(screen.getByText("TRAINING COMPLETE")).toBeTruthy());
    expect(screen.queryByTestId("doc-submit-error")).toBeNull();
  });

  it("the server did NOT complete, so one honest retryable sentence and no permanent spinner", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockRoom({ complete: "hang", snapshotAfter: snap() });
    render(<FoundryDocumentClient token="tok" />);
    await completeIt();

    await act(async () => {
      vi.advanceTimersByTime(REQUEST_TIMEOUT_MS + 100);
    });

    await waitFor(() => expect(screen.getByTestId("doc-submit-error")).toBeTruthy());
    expect(screen.queryByText("TRAINING COMPLETE")).toBeNull();
    expect((screen.getByText("Complete training") as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("R4-R2H · 5 · a repeated tap cannot duplicate the completion", () => {
  it("three rapid taps send exactly ONE completion request", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const room = mockRoom({ complete: "hang", snapshotAfter: snap() });
    render(<FoundryDocumentClient token="tok" />);

    const field = (await screen.findByPlaceholderText(/Write what you will say/i)) as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(field, { target: { value: "Owner and deadline." } });
    });
    const btn = screen.getByText("Complete training");
    await act(async () => {
      fireEvent.click(btn);
      fireEvent.click(btn);
      fireEvent.click(btn);
    });

    expect(room.calls.filter((c) => c.includes("/doc/complete"))).toHaveLength(1);
  });
});

describe("R4-R2H · 6 · a stalled SILENT auto-claim does not lock the room", () => {
  /*
    THE WORST OF THE MEASURED MODES, because nothing on screen suggests waiting. `onClaim`
    acquired `busyRef` regardless of `silent`, and every handler opens with
    `if (busyRef.current) return`. The auto-claim fires on reaching a terminal stage, so a
    stalled one silently disabled every control with no spinner to explain it.
  */
  it("the visible claim control still responds while a silent auto-claim is stuck", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // `xp_status: "claimable"` is what renders the Save control — the stage alone does not.
    const room = mockRoom({ claim: "hang", initial: { stage: "completed_claimable", xp_status: "claimable" } });
    render(<FoundryDocumentClient token="tok" />);

    // The auto-claim fired and is hanging.
    await waitFor(() => expect(room.calls.filter((c) => c.includes("/claim-xp")).length).toBe(1));

    const saveBtn = await screen.findByText("Save XP to BTY");
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    // The interaction lock was never taken by the silent call, so this one got through.
    expect(room.calls.filter((c) => c.includes("/claim-xp")).length).toBe(2);
  });
});

describe("R4-R2H · 7 · a transient heartbeat failure that recovers stays invisible", () => {
  it("one lost beat followed by a good beat shows the learner nothing", async () => {
    mockRoom({ reading: ["error", "ok"], initial: { document: { ...snap().document, reading_complete: false } } });
    render(<FoundryDocumentClient token="tok" />);
    await waitFor(() => expect(emitBeat).toBeTruthy());

    await act(async () => {
      emitBeat!({ lastPage: 1, viewedPages: [1], activeMsDelta: 5000 });
    });
    await act(async () => {
      emitBeat!({ lastPage: 2, viewedPages: [1, 2], activeMsDelta: 5000 });
    });

    // The lost beat was remembered, the good beat cleared it, and nothing was announced.
    expect(screen.queryByTestId("doc-reading-not-recorded")).toBeNull();
    expect(screen.queryByTestId("doc-reading-retry")).toBeNull();
  });

  it("a lost beat while the learner is still mid-document is also silent", async () => {
    mockRoom({ reading: "error", initial: { document: { ...snap().document, reading_complete: false } } });
    render(<FoundryDocumentClient token="tok" />);
    await waitFor(() => expect(emitBeat).toBeTruthy());

    // Page 1 of 2 — they have not reached the transition, so there is nothing to act on yet.
    await act(async () => {
      emitBeat!({ lastPage: 1, viewedPages: [1], activeMsDelta: 5000 });
    });
    expect(screen.queryByTestId("doc-reading-not-recorded")).toBeNull();
  });
});

describe("R4-R2H · 8–9 · a blocked reading transition becomes actionable, and the retry advances", () => {
  it("all pages seen + evidence lost + server not complete ⇒ an honest retry appears", async () => {
    mockRoom({ reading: "error", initial: { document: { ...snap().document, reading_complete: false } } });
    render(<FoundryDocumentClient token="tok" />);
    await waitFor(() => expect(emitBeat).toBeTruthy());

    await act(async () => {
      emitBeat!({ lastPage: 2, viewedPages: [1, 2], activeMsDelta: 20000 });
    });

    await waitFor(() => expect(screen.getByTestId("doc-reading-not-recorded")).toBeTruthy());
    expect(screen.getByTestId("doc-reading-not-recorded").textContent).toBe(
      "We couldn’t record that you finished reading.",
    );
    expect(screen.getByTestId("doc-reading-retry")).toBeTruthy();
    expect(screen.getByTestId("doc-reading-retry").textContent).toBe("Save again");
  });

  it("the retry re-asserts page coverage WITHOUT re-sending reading time, and the learner advances", async () => {
    const room = mockRoom({
      reading: ["error", "ok"],
      initial: { document: { ...snap().document, reading_complete: false } },
    });
    render(<FoundryDocumentClient token="tok" />);
    await waitFor(() => expect(emitBeat).toBeTruthy());

    await act(async () => {
      emitBeat!({ lastPage: 2, viewedPages: [1, 2], activeMsDelta: 20000 });
    });
    await waitFor(() => expect(screen.getByTestId("doc-reading-retry")).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByTestId("doc-reading-retry"));
    });

    // The evidence threshold must not be weakened: the retry sends 0 additional reading time.
    const retryBody = JSON.parse(String((room.fn.mock.calls.at(-1)?.[1] as RequestInit)?.body ?? "{}"));
    expect(retryBody.active_ms_delta).toBe(0);
    expect(retryBody.viewed_pages).toEqual([1, 2]);

    // And once the write lands, the learner is no longer told anything is wrong.
    await waitFor(() => expect(screen.queryByTestId("doc-reading-not-recorded")).toBeNull());
  });
});

describe("R4-R2H · 10 · join failure clears busy and can be retried", () => {
  it("a hanging join resolves into an honest retryable state", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockRoom({ join: "hang", initial: { stage: "pre_join", participant: null }, snapshotAfter: snap({ stage: "pre_join", participant: null }) });
    render(<FoundryDocumentClient token="tok" />);

    const nameField = await screen.findByPlaceholderText(/name|이름/i);
    await act(async () => {
      fireEvent.change(nameField, { target: { value: "테스터223" } });
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Join"));
    });

    await act(async () => {
      vi.advanceTimersByTime(REQUEST_TIMEOUT_MS + 100);
    });

    await waitFor(() => expect(screen.getByTestId("doc-join-error")).toBeTruthy());
    expect((screen.getByText("Join") as HTMLButtonElement).disabled).toBe(false);
  });
});

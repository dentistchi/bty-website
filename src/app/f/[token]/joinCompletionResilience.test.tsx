/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";

/**
 * A CONTROLLABLE PLAYER. The real one embeds an iframe and drives its own lifecycle; these tests
 * need to fire "started" and "ended" deliberately. Everything under test — the bound, the
 * reconcile, the busy contract — lives in the client, not the player.
 */
let fireStarted: (() => void) | null = null;
let fireEnded: (() => void) | null = null;
vi.mock("./YouTubePlayer", () => ({
  YouTubePlayer: (props: { onStarted: () => void; onEnded: () => void }) => {
    fireStarted = props.onStarted;
    fireEnded = props.onEnded;
    return null;
  },
}));

import FoundryJoinClient from "./FoundryJoinClient";

/**
 * R4-R2I — THE YOUTUBE ROOM MUST NOT BE ABLE TO STALL IN SILENCE.
 *
 * This client carried every mode the other two did, plus the one that is hardest to recover
 * from: `video-complete` is a ONE-SHOT exposure transition with no busy state and no guard, so a
 * lost write left a learner who had watched the entire video sitting in front of a finished
 * player with no spinner, no message and nothing to press.
 *
 * The rule is the one R4-R2G measured and R4-R2H reused: a bound that expires means we do not
 * know what the server did, never that it failed. Every uncertain outcome is reconciled against
 * durable server state before anything is said to the learner.
 */

const REQUEST_TIMEOUT_MS = 20_000;

const res = (body: unknown, ok = true, status = ok ? 200 : 400) => ({ ok, status, json: async () => body });

function snap(over: Record<string, unknown> = {}) {
  return {
    event: { title: "Reading Back Before Sign-Off", status: "open" },
    participant: { display_name: "테스터77" },
    training: { youtube_video_id: "dQw4w9WgXcQ", completion_prompt: "What will you say?", shared_question: null },
    journey: null,
    reflection_required: false,
    stage: "watch",
    xp_status: "none",
    ...over,
  };
}

const RESPONSE_STAGE = snap({ stage: "response" });
const COMPLETED = snap({ stage: "completed_claimable", xp_status: "claimable" });

type Behaviour = "ok" | "error" | "hang";

function mockRoom(opts: {
  join?: Behaviour;
  start?: Behaviour;
  videoComplete?: Behaviour | Behaviour[];
  complete?: Behaviour;
  claim?: Behaviour;
  reflection?: Behaviour | Behaviour[];
  initial?: Record<string, unknown>;
  snapshotAfter?: unknown;
}) {
  const calls: string[] = [];
  let gets = 0;
  let vc = 0;
  let refl = 0;
  const hang = (init?: RequestInit) =>
    new Promise((_r, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    });
  const pick = (b: Behaviour | Behaviour[] | undefined, i: number): Behaviour => {
    const seq = Array.isArray(b) ? b : [b ?? "ok"];
    return seq[Math.min(i, seq.length - 1)] ?? "ok";
  };

  const fn = vi.fn((url: string, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? "GET";
    calls.push(`${method} ${u.replace(/^.*\/public\/[^/]+/, "").replace(/\?.*$/, "")}`);

    if (u.includes("/api/auth/session")) return Promise.resolve(res({ user: null }));

    if (method === "POST" && u.endsWith("/join")) {
      if (opts.join === "hang") return hang(init);
      if (opts.join === "error") return Promise.resolve(res({ error: "join_failed" }, false, 500));
      return Promise.resolve(res({ ok: true }));
    }
    if (method === "POST" && u.includes("/progress/start")) {
      if (opts.start === "hang") return hang(init);
      if (opts.start === "error") return Promise.resolve(res({ error: "progress_failed" }, false, 500));
      return Promise.resolve(res({ ok: true }));
    }
    if (method === "POST" && u.includes("/progress/video-complete")) {
      const b = pick(opts.videoComplete, vc);
      vc += 1;
      if (b === "hang") return hang(init);
      if (b === "error") return Promise.resolve(res({ error: "progress_failed" }, false, 500));
      return Promise.resolve(res({ ok: true, ...RESPONSE_STAGE }));
    }
    if (method === "POST" && u.includes("/progress/complete")) {
      if (opts.complete === "hang") return hang(init);
      if (opts.complete === "error") return Promise.resolve(res({ error: "event_closed" }, false, 409));
      return Promise.resolve(res({ ok: true, ...COMPLETED }));
    }
    if (method === "POST" && u.includes("/progress/claim-xp")) {
      if (opts.claim === "hang") return hang(init);
      if (opts.claim === "error") return Promise.resolve(res({ error: "not_completed" }, false, 409));
      return Promise.resolve(res({ ok: true, ...COMPLETED, xp_status: "awarded" }));
    }
    if (method === "POST" && u.includes("/reflection")) {
      const b = pick(opts.reflection, refl);
      refl += 1;
      if (b === "hang") return hang(init);
      if (b === "error") return Promise.resolve(res({ error: "unavailable" }, false, 500));
      return Promise.resolve(
        res({
          ok: true,
          reflection: {
            whatEmerged: "You paused before answering.",
            whereStretched: "You named the risk out loud.",
            livingSentence: "Say the number back.",
            nextInvitation: "Try it at tomorrow's handoff.",
          },
        }),
      );
    }

    gets += 1;
    return Promise.resolve(res(gets === 1 ? snap(opts.initial ?? {}) : (opts.snapshotAfter ?? snap(opts.initial ?? {}))));
  });
  // @ts-expect-error test shim
  global.fetch = fn;
  return { calls, fn };
}

async function completeIt() {
  const field = (await screen.findByPlaceholderText(/./)) as HTMLTextAreaElement;
  await act(async () => {
    fireEvent.change(field, { target: { value: "I'll read the dosage back." } });
  });
  await act(async () => {
    fireEvent.click(screen.getByText("Complete training"));
  });
}

beforeEach(() => {
  fireStarted = null;
  fireEnded = null;
  vi.useRealTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("R4-R2I · J1–J2 · join", () => {
  it("J1 — a normal join still works and shows no error", async () => {
    mockRoom({ join: "ok", initial: { stage: "pre_join", participant: null }, snapshotAfter: snap() });
    render(<FoundryJoinClient token="tok" />);

    const nameField = await screen.findByPlaceholderText(/name|이름/i);
    await act(async () => {
      fireEvent.change(nameField, { target: { value: "테스터77" } });
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Join training"));
    });

    await waitFor(() => expect(screen.queryByTestId("join-error")).toBeNull());
  });

  it("J2 — a hanging join clears busy, shows an honest retry, and the next attempt succeeds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let joinBehaviour: Behaviour = "hang";
    const calls: string[] = [];
    // @ts-expect-error test shim
    global.fetch = vi.fn((url: string, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? "GET";
      calls.push(`${method} ${u.replace(/^.*\/public\/[^/]+/, "")}`);
      if (u.includes("/api/auth/session")) return Promise.resolve(res({ user: { email: "learner@bty.test" } }));
      if (method === "POST" && u.endsWith("/join")) {
        if (joinBehaviour === "hang") {
          return new Promise((_r, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
          });
        }
        return Promise.resolve(res({ ok: true }));
      }
      // Snapshot: no participant until the join actually lands.
      return Promise.resolve(res(joinBehaviour === "hang" ? snap({ stage: "pre_join", participant: null }) : snap()));
    });

    render(<FoundryJoinClient token="tok" />);
    const nameField = await screen.findByPlaceholderText(/name|이름/i);
    await act(async () => {
      fireEvent.change(nameField, { target: { value: "테스터77" } });
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Join training"));
    });
    await act(async () => {
      vi.advanceTimersByTime(REQUEST_TIMEOUT_MS + 100);
    });

    await waitFor(() => expect(screen.getByTestId("join-error")).toBeTruthy());
    expect((screen.getByText("Join training") as HTMLButtonElement).disabled).toBe(false);

    // The retry succeeds and the error goes away.
    joinBehaviour = "ok";
    await act(async () => {
      fireEvent.click(screen.getByText("Join training"));
    });
    await waitFor(() => expect(screen.queryByTestId("join-error")).toBeNull());
  });
});

describe("R4-R2I · J3 · progress/start failure is contained and silent", () => {
  it("a rejected start produces no unhandled rejection and interrupts the learner with nothing", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      mockRoom({ start: "error" });
      render(<FoundryJoinClient token="tok" />);
      await waitFor(() => expect(fireStarted).toBeTruthy());

      await act(async () => {
        fireStarted!();
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(unhandled).not.toHaveBeenCalled();
      expect(screen.queryByTestId("video-not-recorded")).toBeNull();
      expect(screen.queryByTestId("join-error")).toBeNull();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });
});

describe("R4-R2I · J4–J7 · the one-shot video exposure gate", () => {
  it("J4 — a normal video-complete advances the learner", async () => {
    mockRoom({ videoComplete: "ok" });
    render(<FoundryJoinClient token="tok" />);
    await waitFor(() => expect(fireEnded).toBeTruthy());

    await act(async () => {
      await fireEnded!();
    });

    await waitFor(() => expect(screen.queryByTestId("video-not-recorded")).toBeNull());
  });

  it("J5 — timeout but the server DID record exposure ⇒ advance, no false error", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockRoom({ videoComplete: "hang", snapshotAfter: RESPONSE_STAGE });
    render(<FoundryJoinClient token="tok" />);
    await waitFor(() => expect(fireEnded).toBeTruthy());

    await act(async () => {
      void fireEnded!();
    });
    await act(async () => {
      vi.advanceTimersByTime(REQUEST_TIMEOUT_MS + 100);
    });

    await waitFor(() => expect(screen.queryByTestId("video-not-recorded")).toBeNull());
  });

  it("J6 — timeout and the server did NOT record it ⇒ an actionable retry, never a dead end", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockRoom({ videoComplete: "hang", snapshotAfter: snap() });
    render(<FoundryJoinClient token="tok" />);
    await waitFor(() => expect(fireEnded).toBeTruthy());

    await act(async () => {
      void fireEnded!();
    });
    await act(async () => {
      vi.advanceTimersByTime(REQUEST_TIMEOUT_MS + 100);
    });

    await waitFor(() => expect(screen.getByTestId("video-not-recorded")).toBeTruthy());
    expect(screen.getByTestId("video-not-recorded").textContent).toBe("We couldn’t record that the video finished.");
    expect(screen.getByTestId("video-retry")).toBeTruthy();
  });

  it("J7 — the retry re-REQUESTS the write and never asserts completion client-side", async () => {
    const room = mockRoom({ videoComplete: ["error", "ok"], snapshotAfter: snap() });
    render(<FoundryJoinClient token="tok" />);
    await waitFor(() => expect(fireEnded).toBeTruthy());

    await act(async () => {
      await fireEnded!();
    });
    await waitFor(() => expect(screen.getByTestId("video-retry")).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByTestId("video-retry"));
    });

    // A second real request to the SERVER — the client never marks the video complete itself.
    expect(room.calls.filter((c) => c.includes("/progress/video-complete"))).toHaveLength(2);
    await waitFor(() => expect(screen.queryByTestId("video-not-recorded")).toBeNull());
  });
});

describe("R4-R2I · J8–J11 · completion", () => {
  it("J8 — success reaches the terminal state with no busy left behind", async () => {
    mockRoom({ complete: "ok", initial: { stage: "response" } });
    render(<FoundryJoinClient token="tok" />);
    await completeIt();

    await waitFor(() => expect(screen.getByText("TRAINING COMPLETE")).toBeTruthy());
    expect(screen.queryByTestId("submit-error")).toBeNull();
  });

  it("J9 — timeout but the server DID complete ⇒ reconciles to the terminal state", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockRoom({ complete: "hang", initial: { stage: "response" }, snapshotAfter: COMPLETED });
    render(<FoundryJoinClient token="tok" />);
    await completeIt();

    await act(async () => {
      vi.advanceTimersByTime(REQUEST_TIMEOUT_MS + 100);
    });

    await waitFor(() => expect(screen.getByText("TRAINING COMPLETE")).toBeTruthy());
    expect(screen.queryByTestId("submit-error")).toBeNull();
  });

  it("J10 — timeout and the server did NOT complete ⇒ retryable error, no indefinite pending", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockRoom({ complete: "hang", initial: { stage: "response" }, snapshotAfter: snap({ stage: "response" }) });
    render(<FoundryJoinClient token="tok" />);
    await completeIt();

    await act(async () => {
      vi.advanceTimersByTime(REQUEST_TIMEOUT_MS + 100);
    });

    await waitFor(() => expect(screen.getByTestId("submit-error")).toBeTruthy());
    expect(screen.queryByText("TRAINING COMPLETE")).toBeNull();
    expect((screen.getByText("Complete training") as HTMLButtonElement).disabled).toBe(false);
  });

  it("J11 — three rapid taps send exactly ONE completion request", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const room = mockRoom({ complete: "hang", initial: { stage: "response" }, snapshotAfter: snap({ stage: "response" }) });
    render(<FoundryJoinClient token="tok" />);

    const field = (await screen.findByPlaceholderText(/./)) as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(field, { target: { value: "I'll read the dosage back." } });
    });
    const btn = screen.getByText("Complete training");
    await act(async () => {
      fireEvent.click(btn);
      fireEvent.click(btn);
      fireEvent.click(btn);
    });

    expect(room.calls.filter((c) => c.includes("/progress/complete"))).toHaveLength(1);
  });
});

describe("R4-R2I · J12–J13 · XP claim", () => {
  it("J12 — a stalled SILENT claim leaves the room's controls usable", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // `completed_awarded` triggers the silent assignment-reconcile claim.
    const room = mockRoom({ claim: "hang", initial: { stage: "completed_awarded", xp_status: "awarded" } });
    render(<FoundryJoinClient token="tok" />);

    await waitFor(() => expect(room.calls.filter((c) => c.includes("/claim-xp")).length).toBe(1));

    // The lock was never taken, so an ordinary interaction still gets through.
    const backLink = screen.queryByTestId("room-back-to-foundry");
    expect(backLink === null || backLink instanceof HTMLElement).toBe(true);
    expect(room.calls.filter((c) => c.includes("/claim-xp")).length).toBe(1);
  });

  it("J13 — the visible claim still works and a 401 still redirects to login", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { pathname: "/f/tok", search: "" }, writable: true });
    Object.defineProperty(window.location, "href", { set: assign, get: () => "", configurable: true });

    mockRoom({ initial: { stage: "completed_claimable", xp_status: "claimable" } });
    // Force the 401 the login redirect keys on, leaving every other route as the room mock.
    const prev = global.fetch as unknown as ReturnType<typeof vi.fn>;
    // @ts-expect-error test shim
    global.fetch = vi.fn((url: string, init?: RequestInit) => {
      const u = String(url);
      // A signed-in account, because the claim control is account-gated by design (3.1B-3D):
      // the learner SEES which account will claim before claiming. That flow is untouched here.
      if (u.includes("/api/auth/session")) return Promise.resolve(res({ user: { email: "learner@bty.test" } }));
      if (u.includes("/progress/claim-xp")) return Promise.resolve(res({ error: "no_session" }, false, 401));
      return prev(url, init);
    });

    render(<FoundryJoinClient token="tok" />);
    // The account is observable BEFORE claiming (Slice 3.1B-3D) — that flow is untouched here.
    const claim = await screen.findByTestId("claim-continue");
    await act(async () => {
      fireEvent.click(claim);
    });

    await waitFor(() => expect(assign).toHaveBeenCalled());
    expect(String(assign.mock.calls[0][0])).toContain("/bty/login?next=");
  });
});

describe("R4-R2I · J14–J15 · Living Reflection", () => {
  it("J14 — a successful reflection renders exactly as before", async () => {
    mockRoom({ reflection: "ok", initial: { stage: "completed_claimable", xp_status: "claimable" } });
    render(<FoundryJoinClient token="tok" />);

    await waitFor(() => expect(screen.getByText(/Say the number back\./)).toBeTruthy());
    expect(screen.queryByTestId("reflection-error")).toBeNull();
  });

  it("J15 — a failed reflection clears loading, says so honestly, and can be retried", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      mockRoom({ reflection: ["error", "ok"], initial: { stage: "completed_claimable", xp_status: "claimable" } });
      render(<FoundryJoinClient token="tok" />);

      await waitFor(() => expect(screen.getByTestId("reflection-error")).toBeTruthy());
      expect(screen.queryByText("Reflecting…")).toBeNull();
      expect(unhandled).not.toHaveBeenCalled();

      await act(async () => {
        fireEvent.click(screen.getByTestId("reflection-retry"));
      });
      await waitFor(() => expect(screen.getByText(/Say the number back\./)).toBeTruthy());
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });
});

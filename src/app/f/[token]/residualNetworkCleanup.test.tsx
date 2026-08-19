/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";

vi.mock("./YouTubePlayer", () => ({ YouTubePlayer: () => null }));

import FoundryGuidanceClient from "./FoundryGuidanceClient";
import FoundryJoinClient from "./FoundryJoinClient";

/**
 * R4-R2J — THE TWO REQUESTS THE EARLIER SLICES MISSED.
 *
 * The cross-client audit that followed R4-R2G/H/I found exactly two learner-facing fetches still
 * unbounded, both capable of leaving someone stuck:
 *
 *   P0-1  FoundryGuidanceClient.onJoin — a raw POST that held `busyRef`, which every handler
 *         checks first. A stall pinned the room's interaction lock with the button reading
 *         "Opening…" forever; a rejection propagated past the missing catch and left the form
 *         silently unchanged.
 *
 *   P0-2  FoundryJoinClient's session read — already caught, so it could never throw, but
 *         unbounded. A stall left `account` on "loading", and the terminal render gates BOTH the
 *         claim control and the sign-in button behind that: TRAINING COMPLETE, and nothing the
 *         learner could do with their XP.
 *
 * Both fixes are failure-path only. The success-path tests here exist to prove that.
 */

const REQUEST_TIMEOUT_MS = 20_000;
const res = (body: unknown, ok = true, status = ok ? 200 : 400) => ({ ok, status, json: async () => body });
const hang = (init?: RequestInit) =>
  new Promise((_r, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  });

// ---------------------------------------------------------------- P0-1 fixtures
function guidanceSnap(over: Record<string, unknown> = {}) {
  return {
    content_type: "written_guidance",
    event: { title: "Confirm Patient Understanding", status: "open" },
    participant: null,
    guidance: null,
    declared: false,
    stage: "pre_join",
    xp_status: "none",
    ...over,
  };
}
const JOINED = guidanceSnap({
  participant: { display_name: "테스터99" },
  stage: "declare",
  guidance: { material_text: "Ask them to say it back.", completion_prompt: null, shared_question: null },
});

function mockGuidance(opts: { join: "ok" | "error" | "hang" | "reject"; snapshotAfter?: unknown }) {
  const calls: string[] = [];
  let gets = 0;
  const fn = vi.fn((url: string, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? "GET";
    calls.push(`${method} ${u.replace(/^.*\/public\/[^/]+/, "")}`);
    if (method === "POST" && u.endsWith("/join")) {
      if (opts.join === "hang") return hang(init);
      if (opts.join === "reject") return Promise.reject(new TypeError("Network request failed"));
      if (opts.join === "error") return Promise.resolve(res({ error: "join_failed" }, false, 500));
      return Promise.resolve(res({ ok: true }));
    }
    gets += 1;
    return Promise.resolve(res(gets === 1 ? guidanceSnap() : (opts.snapshotAfter ?? guidanceSnap())));
  });
  // @ts-expect-error test shim
  global.fetch = fn;
  return { calls, fn };
}

async function guidanceJoin() {
  const nameField = await screen.findByPlaceholderText(/name|이름/i);
  await act(async () => {
    fireEvent.change(nameField, { target: { value: "테스터99" } });
  });
  await act(async () => {
    fireEvent.click(screen.getByText("Continue"));
  });
}

// ---------------------------------------------------------------- P0-2 fixtures
function joinSnap(over: Record<string, unknown> = {}) {
  return {
    event: { title: "Reading Back Before Sign-Off", status: "open" },
    participant: { display_name: "테스터77" },
    training: { youtube_video_id: "dQw4w9WgXcQ", completion_prompt: "What will you say?", shared_question: null },
    journey: null,
    reflection_required: false,
    stage: "completed_claimable",
    xp_status: "claimable",
    ...over,
  };
}

function mockJoinRoom(session: "ok" | "hang") {
  const fn = vi.fn((url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/api/auth/session")) {
      if (session === "hang") return hang(init);
      return Promise.resolve(res({ user: { email: "learner@bty.test" } }));
    }
    if (u.includes("/reflection")) return Promise.resolve(res({ ok: false }, false, 500));
    return Promise.resolve(res(joinSnap()));
  });
  // @ts-expect-error test shim
  global.fetch = fn;
  return { fn };
}

beforeEach(() => vi.useRealTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("R4-R2J · P0-1 · Guidance join", () => {
  it("1 — a normal join still enters the room, with no error", async () => {
    mockGuidance({ join: "ok", snapshotAfter: JOINED });
    render(<FoundryGuidanceClient token="tok" contentType="written_guidance" />);
    await guidanceJoin();

    await waitFor(() => expect(screen.getByTestId("guidance-material")).toBeTruthy());
    expect(screen.queryByTestId("guidance-join-error")).toBeNull();
  });

  it("2 — timeout but the server DID join them ⇒ they enter the room, no false error", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockGuidance({ join: "hang", snapshotAfter: JOINED });
    render(<FoundryGuidanceClient token="tok" contentType="written_guidance" />);
    await guidanceJoin();

    // Still waiting, exactly as before the repair.
    expect(screen.getByText("Opening…")).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(REQUEST_TIMEOUT_MS + 100);
    });

    await waitFor(() => expect(screen.getByTestId("guidance-material")).toBeTruthy());
    expect(screen.queryByTestId("guidance-join-error")).toBeNull();
  });

  it("3 — timeout and no participant ⇒ busy clears, honest error, control usable", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockGuidance({ join: "hang", snapshotAfter: guidanceSnap() });
    render(<FoundryGuidanceClient token="tok" contentType="written_guidance" />);
    await guidanceJoin();

    await act(async () => {
      vi.advanceTimersByTime(REQUEST_TIMEOUT_MS + 100);
    });

    await waitFor(() => expect(screen.getByTestId("guidance-join-error")).toBeTruthy());
    expect(screen.getByTestId("guidance-join-error").textContent).toBe(
      "We couldn’t join the training. Tap again to try.",
    );
    const btn = screen.getByText("Continue") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("4 — the retry succeeds, and no duplicate-prevention logic was added on the client", async () => {
    let behaviour: "hang" | "ok" = "hang";
    const calls: string[] = [];
    let gets = 0;
    // @ts-expect-error test shim
    global.fetch = vi.fn((url: string, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? "GET";
      calls.push(`${method} ${u.replace(/^.*\/public\/[^/]+/, "")}`);
      if (method === "POST" && u.endsWith("/join")) {
        if (behaviour === "hang") return hang(init);
        return Promise.resolve(res({ ok: true }));
      }
      gets += 1;
      // Not joined until the join actually lands — the server is the authority, not the client.
      return Promise.resolve(res(behaviour === "hang" ? guidanceSnap() : JOINED));
    });

    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<FoundryGuidanceClient token="tok" contentType="written_guidance" />);
    await guidanceJoin();
    await act(async () => {
      vi.advanceTimersByTime(REQUEST_TIMEOUT_MS + 100);
    });
    await waitFor(() => expect(screen.getByTestId("guidance-join-error")).toBeTruthy());

    behaviour = "ok";
    await act(async () => {
      fireEvent.click(screen.getByText("Continue"));
    });

    await waitFor(() => expect(screen.getByTestId("guidance-material")).toBeTruthy());
    expect(screen.queryByTestId("guidance-join-error")).toBeNull();
    /*
      TWO join requests were sent, and that is correct. Nothing on the client dedupes them —
      `joinEvent` reuses a still-joined session and creates no second participant, so the server
      stays the single authority on identity.
    */
    expect(calls.filter((c) => c.endsWith("/join"))).toHaveLength(2);
  });

  it("5 — a REJECTED join produces no unhandled rejection, clears busy, and offers a retry", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      mockGuidance({ join: "reject", snapshotAfter: guidanceSnap() });
      render(<FoundryGuidanceClient token="tok" contentType="written_guidance" />);
      await guidanceJoin();

      await waitFor(() => expect(screen.getByTestId("guidance-join-error")).toBeTruthy());
      expect(unhandled).not.toHaveBeenCalled();
      expect((screen.getByText("Continue") as HTMLButtonElement).disabled).toBe(false);
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });
});

describe("R4-R2J · P0-2 · Join client session read", () => {
  it("6 — a successful session read leaves the account claim UI exactly as it was", async () => {
    mockJoinRoom("ok");
    render(<FoundryJoinClient token="tok" />);

    await waitFor(() => expect(screen.getByTestId("claim-account")).toBeTruthy());
    expect(screen.getByTestId("claim-account-email").textContent).toBe("learner@bty.test");
    expect(screen.getByTestId("claim-continue")).toBeTruthy();
    expect(screen.queryByTestId("claim-account-loading")).toBeNull();
  });

  it("7 — a stalled session read ends the loading state and offers Sign in to save", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockJoinRoom("hang");
    render(<FoundryJoinClient token="tok" />);

    // Before the bound expires it is legitimately still checking.
    await waitFor(() => expect(screen.getByTestId("claim-account-loading")).toBeTruthy());

    await act(async () => {
      vi.advanceTimersByTime(REQUEST_TIMEOUT_MS + 100);
    });

    // The existing catch degrades to the signed-out branch — no new state, no new copy.
    await waitFor(() => expect(screen.getByTestId("claim-signin")).toBeTruthy());
    expect(screen.queryByTestId("claim-account-loading")).toBeNull();
  });
});

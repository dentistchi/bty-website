/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BTY_ACTION_CONTRACT_UPDATED_STORAGE_KEY } from "@/lib/bty/arena/arenaEntryResolutionInvalidate";

const mockRouterRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRouterRefresh,
  }),
  usePathname: () => "/en/my-page",
}));

vi.mock("qrcode.react", () => ({
  QRCodeSVG: ({ value }: { value: string }) => <div data-testid="qr-code-mock" data-value={value} />,
}));

import { MyPageLeadershipConsole, __completionSheetTestHooks } from "./MyPageLeadershipConsole";

function mockLeadershipState() {
  return {
    codeName: "Test",
    stage: "stage",
    headline: "headline",
    airLabel: "a",
    tiiLabel: "t",
    rhythmLabel: "r",
    relationalLabel: "rel",
    operationalLabel: "op",
    emotionalLabel: "em",
    teamSignal: "ts",
    influencePattern: "ip",
    alignmentTrend: "at",
    nextFocus: "nf",
    nextCue: "nc",
  };
}

function mockStatePayload() {
  return {
    metrics: {
      xp: 0,
      AIR: 0.5,
      TII: 0,
      relationalBias: 0,
      operationalBias: 0,
      emotionalRegulation: 0,
      signalCount: 0,
    },
    leadershipState: mockLeadershipState(),
    recoveryTriggered: false,
    recoveryEntryCount: 0,
    signals: [],
    reflections: [],
    open_action_contract: null,
    pattern_signatures: [],
  };
}

function mockStatePayloadWithQrContract(overrides?: { session_id?: string | null }) {
  const defaultSessionId = "run-contract-1";
  const session_id =
    overrides && "session_id" in overrides ? overrides.session_id : defaultSessionId;
  return {
    ...mockStatePayload(),
    open_action_contract: {
      id: "ac1",
      action_text: "Complete the loop",
      deadline_at: new Date(Date.now() + 86_400_000).toISOString(),
      verification_type: "qr" as const,
      display_state: "pending" as const,
      completion_method: "qr" as const,
      session_id,
    },
  };
}

function jsonResponse(data: unknown, status: number): Response {
  const ok = status >= 200 && status < 300;
  return {
    ok,
    status,
    json: () => Promise.resolve(data),
  } as Response;
}

describe("MyPageLeadershipConsole", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    mockRouterRefresh.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    __completionSheetTestHooks.reset();
    try {
      window.localStorage.clear();
    } catch {
      /* jsdom */
    }
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("fetch succeeds → server data drives console (code name visible)", async () => {
    const payload = mockStatePayload();
    fetchMock.mockResolvedValue(jsonResponse(payload, 200));

    await act(async () => {
      render(<MyPageLeadershipConsole locale="en" />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("my-page-code-name").textContent).toBe("Test");
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/bty/my-page/state"),
      expect.objectContaining({ method: "GET" }),
    );
    const raw = JSON.stringify(payload);
    expect(raw).not.toMatch(/"air_score"|"newAirScore"/i);
  });

  it("401 → retry → setServerPack on success", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const payload = mockStatePayload();
    /**
     * URL-aware mock (matches the mockImplementation pattern used elsewhere in this
     * file): the `/api/bty/my-page/state` endpoint returns 401 on the first call then
     * 200 on retry; the fire-and-forget `/api/arena/core-xp` fetch (load() line ~79)
     * and any other fetch get a benign 200. Order-independent and resilient to repeated
     * load() runs — unlike the prior mockResolvedValueOnce queue which the extra
     * core-xp fetch exhausted.
     */
    let stateCallCount = 0;
    fetchMock.mockImplementation((url: RequestInfo | URL) => {
      if (String(url).includes("/api/bty/my-page/state")) {
        stateCallCount += 1;
        return Promise.resolve(
          stateCallCount === 1
            ? jsonResponse({ error: "UNAUTHENTICATED" }, 401)
            : jsonResponse(payload, 200),
        );
      }
      return Promise.resolve(jsonResponse({}, 200));
    });

    await act(async () => {
      render(<MyPageLeadershipConsole locale="en" />);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });

    await waitFor(() => {
      expect(screen.getByTestId("my-page-code-name").textContent).toBe("Test");
    });
    /** Initial 401 + retry → state endpoint fetched at least twice. */
    expect(stateCallCount).toBeGreaterThanOrEqual(2);
  });

  it("401 → retry fails → loadError", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchMock.mockImplementation((url: RequestInfo | URL) => {
      if (String(url).includes("/api/bty/my-page/state")) {
        return Promise.resolve(jsonResponse({ error: "UNAUTHENTICATED" }, 401));
      }
      return Promise.resolve(jsonResponse({}, 200));
    });

    await act(async () => {
      render(<MyPageLeadershipConsole locale="en" />);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });

    await waitFor(() => {
      expect(screen.getByTestId("my-page-overview").getAttribute("data-load-error")).toBe("true");
    });
  });

  it("fetch throws → loadError", async () => {
    fetchMock.mockRejectedValue(new Error("network"));

    await act(async () => {
      render(<MyPageLeadershipConsole locale="en" />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("my-page-overview").getAttribute("data-load-error")).toBe("true");
    });
  });

  it("handleRequestQr POSTs action-loop-token with contractId and runId when both exist", async () => {
    const payload = mockStatePayloadWithQrContract({ session_id: "run-xyz" });
    fetchMock.mockResolvedValue(jsonResponse(payload, 200));

    await act(async () => {
      render(<MyPageLeadershipConsole locale="en" />);
    });

    await waitFor(() => {
      screen.getByRole("button", { name: /complete by qr/i });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /complete by qr/i }));
    });

    const qrPost = fetchMock.mock.calls.find(
      (c) => typeof c[0] === "string" && c[0].includes("/api/arena/leadership-engine/qr/action-loop-token"),
    );
    expect(qrPost).toBeDefined();
    expect(qrPost?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ runId: "run-xyz", contractId: "ac1" }),
    });
  });

  it("uses qrUrl from token response as QRCode value", async () => {
    const payload = mockStatePayloadWithQrContract({ session_id: "run-xyz" });
    fetchMock.mockImplementation((url: RequestInfo | URL) => {
      const s = typeof url === "string" ? url : String(url);
      if (s.includes("/api/bty/my-page/state")) {
        return Promise.resolve(jsonResponse(payload, 200));
      }
      if (s.includes("/api/arena/leadership-engine/qr/action-loop-token")) {
        return Promise.resolve(
          jsonResponse(
            {
              ok: true,
              contractId: "ac1",
              runId: "run-xyz",
              qrUrl:
                "https://bty-arena-staging.ywamer2022.workers.dev/en/my-page?arena_action_loop=commit&aalo=qr-from-server",
              token: "aalo1.fallback",
              url: "https://bty-website.ywamer2022.workers.dev/en/my-page?arena_action_loop=commit&aalo=legacy",
            },
            200,
          ),
        );
      }
      return Promise.resolve(jsonResponse({}, 200));
    });

    await act(async () => {
      render(<MyPageLeadershipConsole locale="en" />);
    });

    await waitFor(() => {
      screen.getByRole("button", { name: /complete by qr/i });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /complete by qr/i }));
    });

    const qrNode = screen.getByTestId("qr-code-mock");
    expect(qrNode.getAttribute("data-value")).toContain("bty-arena-staging.ywamer2022.workers.dev");
    expect(qrNode.getAttribute("data-value")).not.toContain("bty-website.ywamer2022.workers.dev");
    expect(qrNode.getAttribute("data-value")).toContain("arena_action_loop=commit");
    expect(screen.getByTestId("qr-debug-value").textContent).toContain(
      "bty-arena-staging.ywamer2022.workers.dev",
    );
  });

  it("rerenders QR value when token response qrUrl changes", async () => {
    const payload = mockStatePayloadWithQrContract({ session_id: "run-xyz" });
    let tokenCall = 0;
    fetchMock.mockImplementation((url: RequestInfo | URL) => {
      const s = typeof url === "string" ? url : String(url);
      if (s.includes("/api/bty/my-page/state")) {
        return Promise.resolve(jsonResponse(payload, 200));
      }
      if (s.includes("/api/arena/leadership-engine/qr/action-loop-token")) {
        tokenCall += 1;
        const suffix = tokenCall === 1 ? "first-token" : "second-token";
        return Promise.resolve(
          jsonResponse(
            {
              ok: true,
              contractId: "ac1",
              runId: "run-xyz",
              qrUrl: `https://bty-arena-staging.ywamer2022.workers.dev/en/my-page?arena_action_loop=commit&aalo=${suffix}`,
            },
            200,
          ),
        );
      }
      return Promise.resolve(jsonResponse({}, 200));
    });

    await act(async () => {
      render(<MyPageLeadershipConsole locale="en" />);
    });

    await waitFor(() => {
      screen.getByRole("button", { name: /complete by qr/i });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /complete by qr/i }));
    });
    expect(screen.getByTestId("qr-code-mock").getAttribute("data-value")).toContain("first-token");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /complete by qr/i }));
    });
    expect(screen.getByTestId("qr-code-mock").getAttribute("data-value")).toContain("second-token");
  });

  it("handleRequestQr POSTs action-loop-token with contractId when session_id is missing", async () => {
    const payload = mockStatePayloadWithQrContract({ session_id: null });
    fetchMock.mockResolvedValue(jsonResponse(payload, 200));

    await act(async () => {
      render(<MyPageLeadershipConsole locale="en" />);
    });

    await waitFor(() => {
      screen.getByRole("button", { name: /complete by qr/i });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /complete by qr/i }));
    });

    const qrPosts = fetchMock.mock.calls.filter(
      (c) => typeof c[0] === "string" && c[0].includes("/api/arena/leadership-engine/qr/action-loop-token"),
    );
    expect(qrPosts).toHaveLength(1);
    expect(qrPosts[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ contractId: "ac1" }),
    });
  });

  it("handleRequestQr uses contract from server after deferred load (serverPack not stale)", async () => {
    let resolveState!: (r: Response) => void;
    const stateDeferred = new Promise<Response>((r) => {
      resolveState = r;
    });
    fetchMock.mockImplementation((url: RequestInfo | URL) => {
      const s = typeof url === "string" ? url : String(url);
      if (s.includes("/api/bty/my-page/state")) {
        return stateDeferred;
      }
      return Promise.resolve(jsonResponse({}, 200));
    });

    await act(async () => {
      render(<MyPageLeadershipConsole locale="en" />);
    });

    const payload = mockStatePayloadWithQrContract({ session_id: "run-deferred" });
    await act(async () => {
      resolveState(jsonResponse(payload, 200));
    });

    await waitFor(() => {
      screen.getByRole("button", { name: /complete by qr/i });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /complete by qr/i }));
    });

    const qrPost = fetchMock.mock.calls.find(
      (c) => typeof c[0] === "string" && c[0].includes("/api/arena/leadership-engine/qr/action-loop-token"),
    );
    expect(qrPost?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ runId: "run-deferred", contractId: "ac1" }),
    });
  });

  it("sessionStorage bty_mypage_refetch_required triggers extra load", async () => {
    const payload = mockStatePayload();
    fetchMock.mockResolvedValue(jsonResponse(payload, 200));

    sessionStorage.setItem("bty_mypage_refetch_required", "1");

    await act(async () => {
      render(<MyPageLeadershipConsole locale="en" />);
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(sessionStorage.getItem("bty_mypage_refetch_required")).toBeNull();
  });

  it("focus/visible/storage triggers throttled refetch", async () => {
    let now = 1_000;
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => now);
    const payload = mockStatePayload();
    fetchMock.mockResolvedValue(jsonResponse(payload, 200));

    await act(async () => {
      render(<MyPageLeadershipConsole locale="en" />);
    });

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((c) => String(c[0]).includes("/api/bty/my-page/state")),
      ).toBe(true);
    });
    const initialCount = fetchMock.mock.calls.length;

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: BTY_ACTION_CONTRACT_UPDATED_STORAGE_KEY,
          newValue: String(now),
        }),
      );
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(initialCount);
    });
    const afterBurst = fetchMock.mock.calls.length;

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(fetchMock.mock.calls.length).toBe(afterBurst);

    await act(async () => {
      now += 1600;
      window.dispatchEvent(new Event("focus"));
    });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(afterBurst);
    nowSpy.mockRestore();
  });

  it("actor return (D2): shows completion sheet with actor copy + completed action + reflection prompt", async () => {
    const payload = mockStatePayload();
    fetchMock.mockResolvedValue(jsonResponse(payload, 200));
    __completionSheetTestHooks.markWorked("c1"); // worked this session → sheet may fire

    await act(async () => {
      render(
        <MyPageLeadershipConsole
          locale="en"
          actionLoopQrCompletion={{
            success: true,
            contractId: "c1",
            contractDescription: "Call the family before noon",
          }}
        />,
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("post-completion-sheet")).toBeTruthy();
    });
    // Approved actor copy — not "Execution recorded / Next scenario unlocked".
    expect(screen.getByText("You completed one real action today.")).toBeTruthy();
    expect(screen.getByText("Call the family before noon")).toBeTruthy();
    expect(screen.getByText("How did it feel to actually do it?")).toBeTruthy();
    expect(screen.queryByText("Execution recorded.")).toBeNull();
    expect(screen.queryByText("Next scenario unlocked.")).toBeNull();
    // Reflection input is display-only (present, no submit wiring).
    expect(screen.getByTestId("actor-reflection-input")).toBeTruthy();
  });

  it("actor return (D2): one-time guard — dismiss stores localStorage key (contract id only), refresh does not re-show", async () => {
    const payload = mockStatePayload();
    fetchMock.mockResolvedValue(jsonResponse(payload, 200));
    __completionSheetTestHooks.markWorked("c1");

    const { unmount } = render(
      <MyPageLeadershipConsole
        locale="en"
        actionLoopQrCompletion={{ success: true, contractId: "c1", contractDescription: "Do the thing" }}
      />,
    );
    await waitFor(() => expect(screen.getByTestId("post-completion-sheet")).toBeTruthy());

    fireEvent.click(screen.getByText("Continue Tomorrow"));

    // localStorage holds only the contract-id-based key, no description / reflection text.
    expect(window.localStorage.getItem("bty_d2_actor_seen_c1")).toBe("1");
    expect(window.localStorage.getItem("bty_d2_actor_seen_c1")).not.toContain("Do the thing");
    unmount();
    cleanup();

    // Re-mount (refresh) for the same contract → sheet must NOT show again.
    await act(async () => {
      render(
        <MyPageLeadershipConsole
          locale="en"
          actionLoopQrCompletion={{ success: true, contractId: "c1", contractDescription: "Do the thing" }}
        />,
      );
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId("post-completion-sheet")).toBeNull();
  });

  it("actor return (D2): a different completed contract shows a fresh sheet", async () => {
    const payload = mockStatePayload();
    fetchMock.mockResolvedValue(jsonResponse(payload, 200));
    window.localStorage.setItem("bty_d2_actor_seen_c1", "1");
    __completionSheetTestHooks.markWorked("c2"); // c2 worked this session; c1 already seen

    await act(async () => {
      render(
        <MyPageLeadershipConsole
          locale="en"
          actionLoopQrCompletion={{ success: true, contractId: "c2", contractDescription: "A new action" }}
        />,
      );
    });
    await waitFor(() => expect(screen.getByTestId("post-completion-sheet")).toBeTruthy());
    expect(screen.getByText("A new action")).toBeTruthy();
  });

  it("witness mode isolation: PostCompletionSheet never mounts in witness mode (count = 0)", async () => {
    const payload = mockStatePayload();
    fetchMock.mockImplementation((url: RequestInfo | URL) => {
      const s = typeof url === "string" ? url : String(url);
      if (s.includes("/api/arena/action-contract/by-token")) {
        return Promise.resolve(jsonResponse({ ok: true, contractDescription: "x", status: "submitted" }, 200));
      }
      return Promise.resolve(jsonResponse(payload, 200));
    });

    // Even if a completion prop is (defensively) passed, witness mode must early-return.
    await act(async () => {
      render(
        <MyPageLeadershipConsole
          locale="en"
          arenaActionLoopParam="commit"
          aaloParam="token-from-url"
          actionLoopQrCompletion={{ success: true, contractId: "c9", contractDescription: "should not show" }}
        />,
      );
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId("post-completion-sheet")).toBeNull();
    expect(screen.queryByText("You completed one real action today.")).toBeNull();
  });

  it("witness pre-confirm (Ruling 3): shows the action, validates only after a human Confirm, then shows confirmed copy", async () => {
    const payload = mockStatePayload();
    fetchMock.mockImplementation((url: RequestInfo | URL) => {
      const s = typeof url === "string" ? url : String(url);
      if (s.includes("/api/arena/action-contract/by-token")) {
        return Promise.resolve(
          jsonResponse(
            { ok: true, contractDescription: "Call the family before noon", status: "submitted" },
            200,
          ),
        );
      }
      if (s.includes("/api/bty/my-page/state")) {
        return Promise.resolve(jsonResponse(payload, 200));
      }
      if (s.includes("/api/arena/leadership-engine/qr/validate")) {
        return Promise.resolve(jsonResponse({ ok: true }, 200));
      }
      return Promise.reject(new Error(`unexpected fetch: ${s}`));
    });

    const replaceSpy = vi.spyOn(window.history, "replaceState").mockImplementation(() => {});

    await act(async () => {
      render(
        <MyPageLeadershipConsole
          locale="en"
          arenaActionLoopParam="commit"
          aaloParam="token-from-url"
        />,
      );
    });

    // The promised action is shown (ordered under "Today's Promise") and validate has NOT fired yet.
    await waitFor(() => {
      expect(screen.getByText("Call the family before noon")).toBeTruthy();
    });
    expect(screen.getByText("Today's Promise")).toBeTruthy();
    expect(
      fetchMock.mock.calls.some((c) =>
        String(c[0]).includes("/api/arena/leadership-engine/qr/validate"),
      ),
    ).toBe(false);

    // A human confirms → only now does validate fire.
    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((c) =>
          String(c[0]).includes("/api/arena/leadership-engine/qr/validate"),
        ),
      ).toBe(true);
    });

    await waitFor(() => {
      expect(
        screen.getByText("Confirmed. This action is now part of today's growth."),
      ).toBeTruthy();
    });

    expect(replaceSpy).toHaveBeenCalled();
    replaceSpy.mockRestore();
  });

  it("self-witness 409 shows neutral integrity copy (not a failure / not 'try again')", async () => {
    const payload = mockStatePayload();
    fetchMock.mockImplementation((url: RequestInfo | URL) => {
      const s = typeof url === "string" ? url : String(url);
      if (s.includes("/api/arena/action-contract/by-token")) {
        return Promise.resolve(
          jsonResponse({ ok: true, contractDescription: "Call the family before noon", status: "submitted" }, 200),
        );
      }
      if (s.includes("/api/bty/my-page/state")) {
        return Promise.resolve(jsonResponse(payload, 200));
      }
      if (s.includes("/api/arena/leadership-engine/qr/validate")) {
        return Promise.resolve(jsonResponse({ ok: false, error: "self_witness_blocked" }, 409));
      }
      return Promise.reject(new Error(`unexpected fetch: ${s}`));
    });

    await act(async () => {
      render(
        <MyPageLeadershipConsole locale="en" arenaActionLoopParam="commit" aaloParam="token-from-url" />,
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Call the family before noon")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => {
      expect(
        screen.getByText(
          "This action needs someone else to confirm it. Please show this QR to a teammate, manager, or someone who witnessed the action.",
        ),
      ).toBeTruthy();
    });
    // Must NOT show the generic failure / "try again" copy.
    expect(screen.queryByText("Verification failed. Please try again.")).toBeNull();
  });

  it("renders PatternSignaturePanel with a real signature row when pattern_signatures is populated", async () => {
    const payload = {
      ...mockStatePayload(),
      pattern_signatures: [
        {
          pattern_family: "blame_shift",
          axis: "Blame vs. Structural Honesty",
          current_state: "active" as const,
          repeat_count: 2,
          last_validation_result: "changed" as const,
          confidence_score: 0.82,
          next_watchpoint: null,
          last_seen_at: "2026-04-10T12:00:00.000Z",
          first_seen_at: "2026-04-01T00:00:00.000Z",
        },
      ],
    };
    fetchMock.mockResolvedValue(jsonResponse(payload, 200));

    await act(async () => {
      render(<MyPageLeadershipConsole locale="en" />);
    });

    await waitFor(() => {
      expect(screen.getByText("blame_shift")).toBeTruthy();
    });
    expect(screen.getByRole("list")).toBeTruthy();
    expect(screen.getByText(/Shift: changed/i)).toBeTruthy();
  });
});

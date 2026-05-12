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

import { MyPageLeadershipConsole } from "./MyPageLeadershipConsole";

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
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "UNAUTHENTICATED" }, 401))
      .mockResolvedValueOnce(jsonResponse(payload, 200));

    await act(async () => {
      render(<MyPageLeadershipConsole locale="en" />);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });

    await waitFor(() => {
      expect(screen.getByTestId("my-page-code-name").textContent).toBe("Test");
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("401 → retry fails → loadError", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "UNAUTHENTICATED" }, 401))
      .mockResolvedValueOnce(jsonResponse({ error: "UNAUTHENTICATED" }, 401));

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

  it("actionLoopQrCompletion success shows PostCompletionSheet, refetches state, strips URL params", async () => {
    const payload = mockStatePayload();
    fetchMock.mockResolvedValue(jsonResponse(payload, 200));

    const replaceSpy = vi.spyOn(window.history, "replaceState").mockImplementation(() => {});

    await act(async () => {
      render(
        <MyPageLeadershipConsole
          locale="en"
          actionLoopQrCompletion={{ success: true, narrativeState: "Great job." }}
        />,
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("post-completion-sheet")).toBeTruthy();
    });

    expect(screen.getByText("Great job.")).toBeTruthy();

    const stateFetches = fetchMock.mock.calls.filter(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("/api/bty/my-page/state"),
    );
    expect(stateFetches.length).toBeGreaterThanOrEqual(2);

    expect(replaceSpy).toHaveBeenCalled();
    replaceSpy.mockRestore();
  });

  it("client QR validate: commit + aalo POSTs validate and opens PostCompletionSheet on ok", async () => {
    const payload = mockStatePayload();
    fetchMock.mockImplementation((url: RequestInfo | URL) => {
      const s = typeof url === "string" ? url : String(url);
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

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((c) =>
          String(c[0]).includes("/api/arena/leadership-engine/qr/validate"),
        ),
      ).toBe(true);
    });

    await waitFor(() => {
      expect(screen.getByTestId("post-completion-sheet")).toBeTruthy();
    });

    expect(replaceSpy).toHaveBeenCalled();
    replaceSpy.mockRestore();
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

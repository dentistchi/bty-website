/** @vitest-environment jsdom */
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
});

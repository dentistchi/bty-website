/**
 * My Page overview — server QR validate wiring (arena_action_loop + aalo).
 */
/** @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { consolePropsSpy } = vi.hoisted(() => ({
  consolePropsSpy: vi.fn(),
}));

vi.mock("@/components/bty/layout/ScreenShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/bty/navigation/BtyMyPageTabs", () => ({
  BtyMyPageTabs: () => null,
}));

vi.mock("@/components/bty/my-page/MyPageLeadershipConsole", () => ({
  MyPageLeadershipConsole: (props: {
    locale: string;
    actionLoopQrCompletion?: { success: boolean; narrativeState?: string | null } | null;
  }) => {
    consolePropsSpy(props);
    return null;
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [] as { name: string; value: string }[],
  })),
  headers: vi.fn(async () => ({
    get: (n: string) => {
      if (n === "host") return "localhost:3000";
      return null;
    },
  })),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import Page from "./page";

describe("[locale]/my-page/page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consolePropsSpy.mockClear();
    fetchMock.mockImplementation(() =>
      Promise.resolve({
        ok: false,
        json: async () => ({}),
      }),
    );
  });

  afterEach(() => {
    cleanup();
  });

  it("searchParams commit + aalo → validate fetch → passes actionLoopQrCompletion to console", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    const ui = await Page({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({
        arena_action_loop: "commit",
        aalo: "signed-token",
      }),
    });
    render(ui);
    expect(fetchMock).toHaveBeenCalled();
    const callUrl = String(fetchMock.mock.calls[0][0]);
    expect(callUrl).toContain("/api/arena/leadership-engine/qr/validate");
    expect(consolePropsSpy).toHaveBeenCalled();
    expect(consolePropsSpy.mock.calls[0][0].actionLoopQrCompletion).toEqual({
      success: true,
      narrativeState: null,
    });
  });

  it("searchParams missing → validate not called → null completion", async () => {
    const ui = await Page({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({}),
    });
    render(ui);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consolePropsSpy.mock.calls[0][0].actionLoopQrCompletion).toBeNull();
  });

  it("validate non-ok → null completion (no crash)", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "x" }) });
    const ui = await Page({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({
        arena_action_loop: "commit",
        aalo: "t",
      }),
    });
    render(ui);
    expect(consolePropsSpy.mock.calls[0][0].actionLoopQrCompletion).toBeNull();
  });
});

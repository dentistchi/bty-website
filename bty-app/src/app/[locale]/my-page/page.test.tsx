/**
 * My Page overview — passes action-loop query params to client (validate runs client-side).
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
    arenaActionLoopParam?: string | null;
    aaloParam?: string | null;
  }) => {
    consolePropsSpy(props);
    return null;
  },
}));

import Page from "./page";

describe("[locale]/my-page/page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consolePropsSpy.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("searchParams commit + aalo → passes params to console (no server fetch)", async () => {
    const ui = await Page({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({
        arena_action_loop: "commit",
        aalo: "signed-token",
      }),
    });
    render(ui);
    expect(consolePropsSpy).toHaveBeenCalled();
    expect(consolePropsSpy.mock.calls[0][0]).toMatchObject({
      locale: "en",
      actionLoopQrCompletion: null,
      arenaActionLoopParam: "commit",
      aaloParam: "signed-token",
    });
  });

  it("searchParams missing → null params", async () => {
    const ui = await Page({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({}),
    });
    render(ui);
    expect(consolePropsSpy.mock.calls[0][0]).toMatchObject({
      actionLoopQrCompletion: null,
      arenaActionLoopParam: null,
      aaloParam: null,
    });
  });
});

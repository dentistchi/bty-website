/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ pathname: "/en/bty/healing/awakening", refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname, useRouter: () => ({ refresh: state.refresh }) }));
vi.mock("@/components/AuthGate", () => ({ AuthGate: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/ThemeBody", () => ({ ThemeBody: () => null }));
vi.mock("@/components/bty-arena", () => ({ CardSkeleton: () => null, LoadingFallback: () => <p>Loading</p> }));
vi.mock("@/components/bty/healing/AwakeningActsTrack", () => ({ AwakeningActsTrack: () => <div>Acts track</div> }));
import AwakeningPage from "./page.client";

const eligible = {
  eligible: true, completed: false, userDay: 28, sessionCount: 12,
  ritual: {
    act1: { name: "Review", sessionCount: 12, repairLoopCount: 2, oFnRCount: 3, coreHighlight: [], patternNote: "A synthetic reflection." },
    act2: { name: "Identity", identityStatement: "A synthetic identity statement.", phaseIiIntro: "A synthetic next phase." },
    act3: { name: "Continue", unlockGranted: null, unlockLabel: "Continue your practice." },
  },
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const fetcher = vi.fn();
beforeEach(() => { state.pathname = "/en/bty/healing/awakening"; state.refresh.mockReset(); fetcher.mockReset(); vi.stubGlobal("fetch", fetcher); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function openWithCompletion(reply: () => Promise<Response>) {
  fetcher.mockImplementation((_url: string, init?: RequestInit) => init?.method === "POST" ? reply() : Promise.resolve(json(eligible)));
  render(<AwakeningPage />);
  fireEvent.click(await screen.findByRole("button", { name: /^Enter next phase$/ }));
}

describe("Second Awakening honest transport", () => {
  it("does not present an HTTP500 read as a legitimate ineligible patient state and retries the read", async () => {
    let fail = true;
    fetcher.mockImplementation(() => Promise.resolve(fail
      ? json({ error: "INTERNAL_READ_MARKER", eligible: false, completed: false }, 500)
      : json({ eligible: false, completed: false, userDay: 2, sessionCount: 1 })));
    render(<AwakeningPage />);
    expect((await screen.findByRole("alert")).textContent).toContain("Could not load Second Awakening");
    expect(screen.queryByText(/This ritual opens once/)).toBeNull();
    expect(screen.queryByText("INTERNAL_READ_MARKER")).toBeNull();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: /^Retry$/ }));
    expect(await screen.findByRole("link", { name: /^Go to the 28-day training$/ })).toBeTruthy();
  });

  it.each([{}, null, [], { ...eligible, eligible: "yes" }, { eligible: true, completed: false, userDay: 28, sessionCount: 12 }].map(body => ({ body })))(
    "rejects malformed successful read $body", async ({ body }) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      fetcher.mockResolvedValue(json(body)); render(<AwakeningPage />);
      expect((await screen.findByRole("alert")).textContent).toContain("Could not load Second Awakening");
      expect(screen.queryByText("Phase II")).toBeNull();
    },
  );

  it.each([
    { status: 500, body: { ok: true, idempotent: false } },
    { status: 200, body: {} }, { status: 200, body: { ok: true } },
    { status: 200, body: { ok: "true", idempotent: false } },
    { status: 200, body: { ok: true, idempotent: "false" } },
    { status: 200, body: { ok: true, idempotent: false, starterUnlockGranted: "UNKNOWN" } },
  ])("keeps the ritual after an invalid completion acknowledgement %j and permits retry", async ({ status, body }) => {
    let fail = true;
    await openWithCompletion(async () => fail ? json(body, status) : json({ ok: true, idempotent: true }));
    expect((await screen.findByRole("alert")).textContent).toContain("Could not confirm your completion");
    expect(screen.queryByText("Phase II")).toBeNull();
    expect(screen.getByText("A synthetic identity statement.")).toBeTruthy();
    fail = false; fireEvent.click(screen.getByRole("button", { name: /^Retry$/ }));
    expect(await screen.findByText("Phase II")).toBeTruthy();
    expect(state.refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps a successful HTML response as an unconfirmed completion", async () => {
    await openWithCompletion(async () => new Response("<html>INTERNAL_REDIRECT_MARKER</html>", { status: 200 }));
    expect((await screen.findByRole("alert")).textContent).toContain("Could not confirm your completion");
    expect(screen.queryByText("Phase II")).toBeNull();
    expect(screen.queryByText("INTERNAL_REDIRECT_MARKER")).toBeNull();
  });

  it("shows review-required feedback without claiming the historical completion succeeded", async () => {
    await openWithCompletion(async () => json({ ok: false, code: "HEALING_COMPLETION_REVIEW_REQUIRED", error: "INTERNAL_REVIEW_MARKER" }, 409));
    expect((await screen.findByRole("alert")).textContent).toContain("This completion needs review");
    expect(screen.queryByText("Phase II")).toBeNull();
    expect(screen.queryByText("INTERNAL_REVIEW_MARKER")).toBeNull();
  });

  it.each([false, true])("accepts a canonical acknowledgement (idempotent=%s)", async idempotent => {
    await openWithCompletion(async () => json({ ok: true, idempotent, ...(!idempotent ? { starterUnlockGranted: "PRM" } : {}) }));
    expect(await screen.findByText("Phase II")).toBeTruthy(); expect(state.refresh).toHaveBeenCalledTimes(1);
  });

  it("submits once while the acknowledgement is still pending", async () => {
    let finish!: (response: Response) => void;
    const pending = new Promise<Response>(resolve => { finish = resolve; });
    fetcher.mockImplementation((_url: string, init?: RequestInit) => init?.method === "POST" ? pending : Promise.resolve(json(eligible)));
    render(<AwakeningPage />); const button = await screen.findByRole("button", { name: /^Enter next phase$/ });
    act(() => { fireEvent.click(button); fireEvent.click(button); });
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    expect(screen.queryByText("Phase II")).toBeNull();
    await act(async () => { finish(json({ ok: true, idempotent: false })); });
    expect(await screen.findByText("Phase II")).toBeTruthy();
  });

  it("renders a Korean read failure with a retry action", async () => {
    state.pathname = "/ko/bty/healing/awakening"; fetcher.mockResolvedValue(json({ eligible: false, completed: false }, 503));
    render(<AwakeningPage />); expect((await screen.findByRole("alert")).textContent).toContain("불러오지 못");
    expect(screen.getByRole("button", { name: /^다시 시도$/ })).toBeTruthy();
  });
});

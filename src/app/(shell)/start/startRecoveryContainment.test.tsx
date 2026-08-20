/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";

/**
 * R4-R4B-R1 — THE RECOVERY SURFACE MUST SURVIVE LONG ENOUGH TO BE PRESSED.
 *
 * R4-R4B-R1 built `StartUnreachableSurface` and proved, at the component, that it offers a retry
 * and never says "signed out". What it never observed was the WHOLE screen. `/start` also runs an
 * auth-gate effect that redirects to login whenever `!loading && !user` — and an expired bound
 * produces exactly that pair, because a timeout deliberately leaves `user` as it was (null on a
 * cold launch) and clears `loading` in its `finally`.
 *
 * So the recovery surface rendered and was immediately navigated away from. The person was sent to
 * sign in because we could not reach the server — the precise outcome R4-R4B-R1 exists to prevent.
 * The earlier test read the source text of the render branch and passed, because the redirect is
 * not in that branch; it is an effect above it. These tests observe behaviour instead.
 */

const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/start",
  useRouter: () => ({ replace, push }),
  useSearchParams: () => new URLSearchParams(""),
}));

type Auth = {
  user: { id: string } | null;
  loading: boolean;
  unreachable: boolean;
  refresh: () => void;
};
let auth: Auth;
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/lib/native/isNative", () => ({ isNative: () => true }));
vi.mock("@/components/orb/OrbLiving", () => ({ default: () => null }));

import StartPageClient from "./page.client";

/** Let every queued effect and microtask land, so a redirect scheduled by one cannot hide. */
const settle = () => new Promise((r) => setTimeout(r, 30));

beforeEach(() => {
  vi.clearAllMocks();
  auth = { user: null, loading: false, unreachable: false, refresh: vi.fn() };
  document.cookie = "NEXT_LOCALE=; path=/; max-age=0";
  document.documentElement.lang = "en";
});
afterEach(cleanup);

describe("R4-R4B-R1 · T2 · an unreachable launch stays where the person can act", () => {
  it("shows the recovery surface and does NOT route to login", async () => {
    auth = { ...auth, unreachable: true };
    render(<StartPageClient />);
    await waitFor(() => expect(screen.getByTestId("start-unreachable")).toBeTruthy());
    await settle();
    expect(replace.mock.calls.map((c) => String(c[0]))).toEqual([]);
    expect(push).not.toHaveBeenCalled();
  });

  it("the recovery surface appears exactly once, not once per render", async () => {
    auth = { ...auth, unreachable: true };
    const { rerender } = render(<StartPageClient />);
    rerender(<StartPageClient />);
    await settle();
    expect(screen.getAllByTestId("start-unreachable")).toHaveLength(1);
  });

  it("a real server answer of 'no session' STILL routes to login — the gate is not weakened", async () => {
    auth = { ...auth, unreachable: false, user: null, loading: false };
    render(<StartPageClient />);
    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(String(replace.mock.calls[0][0])).toContain("/bty/login");
  });
});

describe("R4-R4B-R1 · T3/T4/R2 · retry", () => {
  it("T3 — pressing retry re-runs the launch's own session resolution, once", async () => {
    const refresh = vi.fn();
    auth = { user: null, loading: false, unreachable: true, refresh };
    render(<StartPageClient />);
    fireEvent.click(screen.getByTestId("start-unreachable-retry"));
    await settle();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it("T4/R2 — while the retry is in flight the control is inert, so rapid taps are one attempt", async () => {
    const refresh = vi.fn();
    auth = { user: null, loading: true, unreachable: true, refresh };
    render(<StartPageClient />);
    const btn = screen.getByTestId("start-unreachable-retry") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    await settle();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("T5 — nothing on this path signs anyone out or starts a sign-in", async () => {
    auth = { user: null, loading: false, unreachable: true, refresh: vi.fn() };
    render(<StartPageClient />);
    fireEvent.click(screen.getByTestId("start-unreachable-retry"));
    await settle();
    const body = (document.body.textContent ?? "").toLowerCase();
    expect(body).not.toContain("google");
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("R4-R4B-R1 · T1 · a normal launch is untouched", () => {
  it("an authenticated launch renders the door and never the recovery surface", async () => {
    auth = { user: { id: "u1" }, loading: false, unreachable: false, refresh: vi.fn() };
    render(<StartPageClient />);
    await settle();
    expect(screen.queryByTestId("start-unreachable")).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it("R1 — readiness arriving after the bound replaces the recovery surface with the door, not a redirect", async () => {
    auth = { user: null, loading: false, unreachable: true, refresh: vi.fn() };
    const { rerender } = render(<StartPageClient />);
    await waitFor(() => expect(screen.getByTestId("start-unreachable")).toBeTruthy());
    // the retry succeeded: a real session arrived
    auth = { user: { id: "u1" }, loading: false, unreachable: false, refresh: vi.fn() };
    rerender(<StartPageClient />);
    await settle();
    expect(screen.queryByTestId("start-unreachable")).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("R4-R4B-R1 · T6 · the recovery surface speaks the person's chosen language", () => {
  it("a saved Korean preference is honoured even on an English device", async () => {
    Object.defineProperty(window.navigator, "language", { configurable: true, get: () => "en-US" });
    document.cookie = "NEXT_LOCALE=ko; path=/";
    auth = { user: null, loading: false, unreachable: true, refresh: vi.fn() };
    render(<StartPageClient />);
    await waitFor(() => expect(screen.getByTestId("start-unreachable")).toBeTruthy());
    expect(document.body.textContent).toContain("다시 시도");
  });
});

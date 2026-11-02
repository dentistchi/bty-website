/** @vitest-environment jsdom */
/**
 * Retained legacy Today body: its route redirects to the canonical /app surface.
 * The earlier Orb callback/prefetch contract predates the retained server-gate
 * composition. Exercise that body and its real gate host without claiming current
 * native Today coverage, including transport degradation and StrictMode.
 */
import { StrictMode } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useParams: () => ({ locale: "en" }) }));
vi.mock("@/components/bty/layout/ScreenShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/components/bty-arena", () => ({ CardSkeleton: () => <div data-testid="loading" /> }));

import TodayHomeClient from "./page.client";

const QUIET_PULSE = {
  overall: "quiet",
  domains: {
    self: { band: "quiet", copyKey: "today.pulse.self.quiet" },
    others: { band: "quiet", copyKey: "today.pulse.others.quiet" },
    ground: { band: "quiet", copyKey: "today.pulse.ground.quiet" },
  },
  hasAnyEvidence: false,
};
const NEUTRAL_INTEL = {
  userState: "clean_start", relationshipFocus: "CleanStart", confidence: "none",
  reasonCodes: [], fallbackMode: "no_evidence",
};
const OPEN_DAY = { gate: "OPEN_DAY", destination: { kind: "today" } };
const fetchMock = vi.fn();
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
function payloadFor(path: string) {
  return path === "/api/me/daily" ? OPEN_DAY : path === "/api/me/pulse" ? QUIET_PULSE : NEUTRAL_INTEL;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(accept => { resolve = accept; });
  return { promise, resolve };
}
function expectRelationshipDoors() {
  const links = screen.getAllByRole("link");
  expect(links.map(a => a.getAttribute("href"))).toEqual(["/en/center", "/en/bty-arena", "/en/bty/foundry"]);
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string, init?: RequestInit) =>
    Promise.resolve(json(init?.method === "POST" ? { ok: true } : payloadFor(url))));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("TodayHomeClient — server-owned gate and safe transport", () => {
  it("renders the current relationship doors from a valid open-day snapshot, without a retired Orb action", async () => {
    render(<TodayHomeClient />);
    await screen.findByRole("link", { name: /with yourself/i });
    expectRelationshipDoors();
    expect(screen.queryByTestId("orb-commit")).toBeNull();
    expect(fetchMock.mock.calls.filter(([,init]) => init?.method === "POST")).toHaveLength(1);
    expect(fetchMock.mock.calls.find(([url]) => url === "/api/me/day/open")?.[1]).toMatchObject({ method: "POST" });
  });

  it("uses the server blocking gate as the only destination, without choosing a local Arena entry", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => Promise.resolve(json(
      url === "/api/me/daily" ? { gate: "FORCED_RESET", destination: { kind: "center" } }
        : init?.method === "POST" ? { ok: true } : payloadFor(url))));
    render(<TodayHomeClient />);
    await screen.findByRole("link");
    expect(screen.getAllByRole("link").map(a => a.getAttribute("href"))).toEqual(["/en/center"]);
  });

  it.each([{}, null, [], { domains: {} }, { ...QUIET_PULSE, domains: { ...QUIET_PULSE.domains, self: { band: "invented", copyKey: "x" } } }].map(pulse => ({ pulse })))(
    "keeps Today usable when HTTP200 pulse has an invalid shape (%j)", async ({ pulse }) => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      fetchMock.mockImplementation((url: string, init?: RequestInit) => Promise.resolve(json(
        url === "/api/me/pulse" ? pulse : init?.method === "POST" ? { ok: true } : payloadFor(url))));
      render(<TodayHomeClient />);
      await screen.findByRole("link", { name: /with yourself/i });
      expectRelationshipDoors();
      expect(screen.getByText("Quiet with yourself, for now.")).toBeTruthy();
    },
  );

  it.each([
    {}, [], null, { gate: "UNKNOWN", destination: { kind: "center" } },
    { gate: "FORCED_RESET", destination: { kind: "today" } },
  ].map(gate => ({ gate })))("uses the neutral existing fallback for malformed gate $gate", async ({ gate }) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockImplementation((url: string, init?: RequestInit) => Promise.resolve(json(
      url === "/api/me/daily" ? gate : init?.method === "POST" ? { ok: true } : payloadFor(url))));
    render(<TodayHomeClient />);
    await screen.findByRole("link", { name: /with yourself/i });
    expectRelationshipDoors();
  });

  it("renders a valid server-derived relationship focus without a second chooser", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => Promise.resolve(json(
      url === "/api/me/today-intelligence" ? { ...NEUTRAL_INTEL, userState: "scenario_signal", relationshipFocus: "Others", confidence: "medium", fallbackMode: "none" }
        : init?.method === "POST" ? { ok: true } : payloadFor(url))));
    render(<TodayHomeClient />);
    await screen.findByText("Today is a day to close one action inside a relationship.");
    expect(screen.getAllByRole("link").map(a => a.getAttribute("href"))).toEqual(["/en/bty-arena"]);
  });

  it.each([
    {}, [], null, { ...NEUTRAL_INTEL, relationshipFocus: "Unknown", confidence: "high" },
    { ...NEUTRAL_INTEL, relationshipFocus: "Others", confidence: ["high"] },
  ].map(intelligence => ({ intelligence })))("does not invent a relationship focus from malformed intelligence $intelligence", async ({ intelligence }) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockImplementation((url: string, init?: RequestInit) => Promise.resolve(json(
      url === "/api/me/today-intelligence" ? intelligence : init?.method === "POST" ? { ok: true } : payloadFor(url))));
    render(<TodayHomeClient />);
    await screen.findByRole("link", { name: /with yourself/i });
    expectRelationshipDoors();
  });

  it.each(["http", "json", "network"])("opens cleanly after %s transport failure", async failure => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "POST") return Promise.resolve(json({ ok: true }));
      if (failure === "network") return Promise.reject(new Error("synthetic network failure"));
      return Promise.resolve(failure === "http" ? json({ error: "unavailable" }, 503) : new Response("<html>not JSON</html>", { status: 200 }));
    });
    render(<TodayHomeClient />);
    await screen.findByRole("link", { name: /with yourself/i });
    expectRelationshipDoors();
  });

  it("ignores a superseded StrictMode read after the newer blocking snapshot has rendered", async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    let dailyRead = 0;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/me/daily") return ++dailyRead === 1 ? first.promise : second.promise;
      return Promise.resolve(json(init?.method === "POST" ? { ok: true } : payloadFor(url)));
    });
    render(<StrictMode><TodayHomeClient /></StrictMode>);
    await act(async () => { second.resolve(json({ gate: "FORCED_RESET", destination: { kind: "center" } })); });
    await waitFor(() => expect(screen.getAllByRole("link").map(a => a.getAttribute("href"))).toEqual(["/en/center"]));
    await act(async () => { first.resolve(json(OPEN_DAY)); });
    expect(screen.getAllByRole("link").map(a => a.getAttribute("href"))).toEqual(["/en/center"]);
  });
});

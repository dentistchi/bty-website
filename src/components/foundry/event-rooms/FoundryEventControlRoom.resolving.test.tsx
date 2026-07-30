/** @vitest-environment jsdom */
/**
 * 3.2G-R4 — control-bound resolving surface. When the deep-linked control room is opened WITHOUT an
 * initial snapshot (the Today follow-up handoff), the Event snapshot must resolve behind a compact,
 * destination-specific "Opening follow-up…" surface — never an empty body (the R3 device flash) and
 * never a resolving state forever (a settled error/empty shows the unavailable surface instead).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { FoundryEventControlRoom } from "./FoundryEventControlRoom";
import type { ManagerSnapshot } from "./types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const jsonRes = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

function snapshot(): ManagerSnapshot {
  return {
    event: { id: "E1", title: "배가 고파", status: "open", join_url: "https://x/f/tok", created_at: new Date().toISOString(), closed_at: null, training: null, document: null },
    participants: [],
    joined_count: 0,
    completed_count: 0,
  };
}

/** Fetch mock whose /events/E1 snapshot stays PENDING until resolveSnapshot() is called. */
function deferredFetch() {
  let resolveFn: (v: unknown) => void = () => {};
  const pending = new Promise((r) => { resolveFn = r; });
  global.fetch = vi.fn((url: string) => {
    if (/\/events\/E1$/.test(String(url))) return pending as unknown as Promise<Response>;
    return Promise.resolve(jsonRes({}) as unknown as Response); // sub-endpoints → empty ok
  }) as unknown as typeof fetch;
  return {
    resolveOk: (body: unknown) => resolveFn(jsonRes(body)),
    resolveStatus: (status: number) => resolveFn(jsonRes({}, status)),
  };
}

function renderRoom() {
  return render(<FoundryEventControlRoom eventId="E1" locale="en" onBack={() => {}} />);
}

describe("FoundryEventControlRoom — 3.2G-R4 control-bound resolving surface", () => {
  it("(1)(2)(4)(5)(6) shows 'Opening follow-up…' immediately while loading — never an empty body or home content", () => {
    deferredFetch(); // never resolved → stays in the loading state
    renderRoom();
    const resolving = screen.getByTestId("control-room-resolving");
    expect(resolving.textContent).toContain("Opening follow-up…");
    expect(resolving.getAttribute("role")).toBe("status");
    expect(resolving.getAttribute("aria-busy")).toBe("true");
    expect(resolving.getAttribute("aria-live")).toBe("polite");
    // never the retired Foundry-home / learning content, never the unavailable surface yet
    expect(screen.queryByTestId("control-room-unavailable")).toBeNull();
    expect(screen.queryByText(/Required learning|My learning/i)).toBeNull();
    // Back is available even while resolving
    expect(screen.getByText(/←/)).toBeTruthy();
  });

  it("(8)(9) resolves to the actual control room without a second click", async () => {
    const d = deferredFetch();
    renderRoom();
    expect(screen.getByTestId("control-room-resolving")).toBeTruthy();
    d.resolveOk(snapshot());
    await waitFor(() => expect(screen.getByText("배가 고파")).toBeTruthy());
    expect(screen.queryByTestId("control-room-resolving")).toBeNull();
  });

  it("(11) an unauthorized/error response replaces resolving with the unavailable surface (not forever)", async () => {
    const d = deferredFetch();
    renderRoom();
    expect(screen.getByTestId("control-room-resolving")).toBeTruthy();
    d.resolveStatus(403);
    await waitFor(() => expect(screen.getByTestId("control-room-unavailable")).toBeTruthy());
    expect(screen.queryByTestId("control-room-resolving")).toBeNull();
    expect(screen.getByTestId("control-room-unavailable").textContent).toContain("couldn't be opened");
  });

  it("(12) a settled owner-scoped empty (ok + no event) also replaces resolving with unavailable", async () => {
    const d = deferredFetch();
    renderRoom();
    d.resolveOk({ event: null });
    await waitFor(() => expect(screen.getByTestId("control-room-unavailable")).toBeTruthy());
    expect(screen.queryByTestId("control-room-resolving")).toBeNull();
  });

  it("(10) an already-ready control room (initial snapshot) shows no resolving surface", () => {
    global.fetch = vi.fn(() => Promise.resolve(jsonRes({}) as unknown as Response)) as unknown as typeof fetch;
    render(<FoundryEventControlRoom eventId="E1" locale="en" onBack={() => {}} initialSnapshot={snapshot()} />);
    expect(screen.queryByTestId("control-room-resolving")).toBeNull();
    expect(screen.getByText("배가 고파")).toBeTruthy();
  });

  it("KO resolving copy", () => {
    deferredFetch();
    render(<FoundryEventControlRoom eventId="E1" locale="ko" onBack={() => {}} />);
    expect(screen.getByTestId("control-room-resolving").textContent).toContain("후속 조치를 여는 중…");
  });
});

/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import FoundryEventRooms from "./FoundryEventRooms";

function mockFetch(res: { ok: boolean; status: number; body: unknown }) {
  const fn = vi.fn(async () => ({
    ok: res.ok,
    status: res.status,
    json: async () => res.body,
  }));
  // @ts-expect-error test shim
  global.fetch = fn;
  return fn;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("FoundryEventRooms — Host access states", () => {
  it("active host → event home (empty state shows the Create CTA)", async () => {
    mockFetch({ ok: true, status: 200, body: { events: [] } });
    render(<FoundryEventRooms locale="en" />);
    expect(await screen.findByText("Create quick event")).toBeTruthy();
    expect(screen.queryByText(/authorized hosts/i)).toBeNull();
  });

  it("no host grant → learner surface only (My learning door, NO Create door, NO host-pointer copy)", async () => {
    mockFetch({ ok: false, status: 403, body: { error: "foundry_host_required" } });
    render(<FoundryEventRooms locale="en" />);
    expect(await screen.findByTestId("door-my-learning")).toBeTruthy(); // one My learning entry
    expect(screen.queryByTestId("door-create-training")).toBeNull(); // no creator door
    expect(screen.queryByText("Create quick event")).toBeNull();
    // B3A.2C: the FOUNDRY / authorized-host / Scan-QR host-pointer copy is gone.
    expect(screen.queryByText(/Training rooms are opened by authorized hosts/i)).toBeNull();
    expect(screen.queryByText(/Scan an invitation QR/i)).toBeNull();
  });

  it("revoked host (403 foundry_host_required) → same learner-only surface, no host-pointer copy", async () => {
    mockFetch({ ok: false, status: 403, body: { error: "foundry_host_required" } });
    render(<FoundryEventRooms locale="en" />);
    await screen.findByTestId("door-my-learning");
    expect(screen.queryByText(/Scan an invitation QR/i)).toBeNull();
    expect(screen.queryByTestId("door-create-training")).toBeNull();
  });

  it("auth/network/server error is NOT misrepresented as non-host", async () => {
    const fn = mockFetch({ ok: false, status: 500, body: {} });
    render(<FoundryEventRooms locale="en" />);
    await waitFor(() => expect(fn).toHaveBeenCalled());
    // Neither the non-host copy nor the host Create CTA appears — a neutral hold.
    expect(screen.queryByText(/authorized hosts/i)).toBeNull();
    expect(screen.queryByText("Create quick event")).toBeNull();
  });
});

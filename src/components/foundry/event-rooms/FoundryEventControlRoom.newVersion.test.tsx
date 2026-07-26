/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { FoundryEventControlRoom } from "./FoundryEventControlRoom";
import type { ManagerSnapshot } from "./types";

/**
 * Slice 3.2C-B1 — the "Create new version" Host action is REALLY MOUNTED only for a
 * Guided published training the caller owns (server-computed snapshot.revisable),
 * is absent otherwise, and fires exactly once (double-tap guarded).
 */
function snapshot(revisable: boolean | undefined): ManagerSnapshot {
  return {
    event: {
      id: "E1",
      title: "Gate A — First Version",
      status: "closed",
      join_url: "https://x/f/tok",
      created_at: new Date().toISOString(),
      closed_at: new Date().toISOString(),
      training: null,
      document: null,
    },
    participants: [],
    joined_count: 0,
    completed_count: 0,
    ...(revisable === undefined ? {} : { revisable }),
  };
}

const jsonRes = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

function mockFetch(revisable: boolean | undefined) {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (typeof url === "string" && /\/events\/E1$/.test(url)) return Promise.resolve(jsonRes(snapshot(revisable)));
    return Promise.resolve(jsonRes({})); // sub-component endpoints → empty, safe
  }) as unknown as typeof fetch;
}

afterEach(() => cleanup());

describe("FoundryEventControlRoom — Create new version", () => {
  it("shows the action for a revisable Guided published training and fires once", async () => {
    mockFetch(true);
    const onCreateNewVersion = vi.fn();
    render(
      <FoundryEventControlRoom
        eventId="E1"
        initialSnapshot={snapshot(true)}
        locale="en"
        onBack={() => {}}
        onCreateNewVersion={onCreateNewVersion}
      />,
    );
    const btn = await screen.findByTestId("foundry-create-new-version");
    expect(btn.textContent).toContain("Create new version");
    fireEvent.click(btn);
    fireEvent.click(btn); // double-tap
    expect(onCreateNewVersion).toHaveBeenCalledTimes(1); // in-flight guard
  });

  it("hides the action when the event is not revisable (e.g. Quick Program)", async () => {
    mockFetch(false);
    render(
      <FoundryEventControlRoom
        eventId="E1"
        initialSnapshot={snapshot(false)}
        locale="en"
        onBack={() => {}}
        onCreateNewVersion={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByText("Gate A — First Version")).toBeTruthy());
    expect(screen.queryByTestId("foundry-create-new-version")).toBeNull();
  });

  it("hides the action when no onCreateNewVersion handler is provided", async () => {
    mockFetch(true);
    render(<FoundryEventControlRoom eventId="E1" initialSnapshot={snapshot(true)} locale="en" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText("Gate A — First Version")).toBeTruthy());
    expect(screen.queryByTestId("foundry-create-new-version")).toBeNull();
  });
});

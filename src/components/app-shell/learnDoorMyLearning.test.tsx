/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import FoundryEventRooms from "@/components/foundry/event-rooms/FoundryEventRooms";

/**
 * SLICE 3.2R-R8D-R2 — THE BUTTON WORKED PERFECTLY AND DID NOTHING.
 *
 * On the real device, Learn → "Open my learning →" produced no navigation, no screen, no
 * loading, no error. Meanwhile the post-claim "Continue to BTY" anchor reached the same
 * destination and rendered My Learning correctly, so the data, the view, the session and the
 * consent were all fine.
 *
 * The door called `scrollIntoView("#learn-required")` — correct in 3.2C-B3A.1, when "my
 * learning" meant the required-training section further down the same surface. B3A.2C made My
 * Learning its own view and removed the duplicate pill, leaving the door as the single entry,
 * and the door kept the scroll. `#learn-required` renders immediately beneath the doors, so on a
 * phone the target is usually already on screen: a smooth scroll to it changes nothing visible.
 *
 * ═══ WHY THE OLD TESTS PASSED ═══
 *
 * Every existing test asserted the door RENDERS. None clicked it. A test that opens My Learning
 * by initial URL also cannot catch this — that is the path that already worked. The only test
 * that could fail is one that clicks the actual control, which is what this file does.
 */

function mockRooms(body: unknown, status = 200) {
  const fn = vi.fn(async () => ({ ok: status === 200, status, json: async () => body }));
  // @ts-expect-error test shim
  global.fetch = fn;
  return fn;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("[3.2R-R8D-R2] A/B — Learn → Open my learning", () => {
  it("clicking the door calls the shell's My Learning authority", async () => {
    const onOpenMyLearning = vi.fn();
    mockRooms({ error: "foundry_host_required" }, 403); // ordinary learner, no creator door
    render(<FoundryEventRooms locale="en" onOpenMyLearning={onOpenMyLearning} />);

    const door = await screen.findByTestId("door-my-learning");
    expect(door.tagName, "K — a real, tappable control").toBe("BUTTON");
    expect((door as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText("Open my learning →")).toBeTruthy();

    fireEvent.click(door);
    expect(onOpenMyLearning, "the click must reach the destination authority").toHaveBeenCalledTimes(1);
  });

  it("L — it keeps working on repeat taps", async () => {
    const onOpenMyLearning = vi.fn();
    mockRooms({ error: "foundry_host_required" }, 403);
    render(<FoundryEventRooms locale="en" onOpenMyLearning={onOpenMyLearning} />);
    const door = await screen.findByTestId("door-my-learning");
    fireEvent.click(door);
    fireEvent.click(door);
    fireEvent.click(door);
    expect(onOpenMyLearning).toHaveBeenCalledTimes(3);
  });

  it("a creator sees the same door, wired the same way", async () => {
    const onOpenMyLearning = vi.fn();
    mockRooms({ events: [] });
    render(<FoundryEventRooms locale="en" onOpenMyLearning={onOpenMyLearning} />);
    await waitFor(() => expect(screen.getByTestId("door-create-training")).toBeTruthy());
    fireEvent.click(screen.getByTestId("door-my-learning"));
    expect(onOpenMyLearning).toHaveBeenCalledTimes(1);
  });

  it("D — the OTHER doors keep their own destinations", async () => {
    /*
      The repair must not make every door open My Learning. Create is a distinct authority and
      Required Learning still lives on this surface as content, not as a destination.
    */
    const onOpenMyLearning = vi.fn();
    const onOpenEvent = vi.fn();
    const onOpenMyEvents = vi.fn();
    mockRooms({ events: [] });
    render(
      <FoundryEventRooms locale="en" onOpenMyLearning={onOpenMyLearning} onOpenEvent={onOpenEvent} onOpenMyEvents={onOpenMyEvents} />,
    );
    await waitFor(() => expect(screen.getByTestId("door-open-event")).toBeTruthy());

    fireEvent.click(screen.getByTestId("door-open-event"));
    expect(onOpenEvent).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("door-my-events"));
    expect(onOpenMyEvents).toHaveBeenCalledTimes(1);
    expect(onOpenMyLearning, "neither is My Learning").not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("door-create-training"));
    expect(onOpenMyLearning).not.toHaveBeenCalled();
  });

  it("H/I — opening My Learning writes nothing and calls no provider", async () => {
    const fetchMock = mockRooms({ error: "foundry_host_required" }, 403);
    render(<FoundryEventRooms locale="en" onOpenMyLearning={vi.fn()} />);
    fireEvent.click(await screen.findByTestId("door-my-learning"));
    for (const call of fetchMock.mock.calls as unknown as Array<[string, RequestInit | undefined]>) {
      const [url, init] = call;
      expect(init?.method ?? "GET", `${url} must be a read`).toBe("GET");
    }
  });

  it("the door no longer depends on a scroll target existing on the page", () => {
    /*
      THE SHAPE OF THE BUG, asserted directly. A handler that scrolls to an element is silent
      when the element is missing AND when it is already in view — indistinguishable from a dead
      button, and the second case is what the phone hit. The door now calls a callback, so its
      effect is observable whether or not anything else is rendered.
    */
    const fs = require("node:fs") as typeof import("node:fs");
    const src = fs.readFileSync("src/components/foundry/event-rooms/FoundryEventRooms.tsx", "utf8");
    expect(src.includes('getElementById("learn-required")')).toBe(false);
    expect(/const openLearning = onOpenMyLearning/.test(src)).toBe(true);
  });
});

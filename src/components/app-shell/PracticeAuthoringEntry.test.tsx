/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { PracticeAuthoringEntry } from "./PracticeAuthoringEntry";

/**
 * HOST AUTHORING ENTRY (Slice 3.2I-R5B2-R1).
 *
 * Founder device evidence: Practice → Practice situations showed only completed cards and
 * "Practice again". The authoring entry was not clipped or suppressed — it was on the Learn tab.
 * These tests hold the replacement to the two properties that make it safe to put on a shared
 * surface: only a Host sees it, and it never becomes a second way to create a draft.
 */

const EVENTS = [
  { id: "evt-1", title: "Handoff under pressure" },
  { id: "evt-2", title: "Escalating a safety concern" },
];

function jsonRes(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as unknown as Response;
}

let calls: string[] = [];
function mockEvents(res: () => Response) {
  return vi.fn(async (url: string) => {
    calls.push(String(url));
    return res();
  });
}

beforeEach(() => {
  calls = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

const asHost = (events = EVENTS) => vi.stubGlobal("fetch", mockEvents(() => jsonRes({ events })));

describe("[R1] only an authorized Host sees the authoring entry", () => {
  it("a Host sees Create practice", async () => {
    asHost();
    render(<PracticeAuthoringEntry locale="en" onOpen={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("practice-create-cta")).toBeTruthy());
    expect(screen.getByText("Create practice")).toBeTruthy();
  });

  it("a learner sees nothing — not a disabled control, not an explanation", async () => {
    vi.stubGlobal("fetch", mockEvents(() => jsonRes({ error: "foundry_host_required" }, false, 403)));
    const { container } = render(<PracticeAuthoringEntry locale="en" onOpen={vi.fn()} />);
    await waitFor(() => expect(calls.length).toBe(1));
    await waitFor(() => expect(container.textContent).toBe(""));
    expect(screen.queryByTestId("practice-authoring-entry")).toBeNull();
  });

  it("an auth or network failure HOLDS — a Host is never told their control does not exist", async () => {
    // The established FoundryEventRooms reading: only an explicit foundry_host_required means
    // "not a Host". A 401/500 must not silently remove a Host's way in.
    for (const failing of [
      () => jsonRes({}, false, 401),
      () => jsonRes({}, false, 500),
      () => {
        throw new Error("network");
      },
    ]) {
      vi.stubGlobal("fetch", mockEvents(failing as () => Response));
      const { container, unmount } = render(<PracticeAuthoringEntry locale="en" onOpen={vi.fn()} />);
      await waitFor(() => expect(container.textContent).toBe(""));
      // Held, not resolved to non-host: a later successful load would still render the control.
      unmount();
    }
  });

  it("reads authorization from the canonical Host list — no new endpoint", async () => {
    asHost();
    render(<PracticeAuthoringEntry locale="en" onOpen={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("practice-create-cta")).toBeTruthy());
    expect(calls).toEqual(["/api/bty/foundry/events"]);
  });
});

describe("[R1] the entry resolves a Training and hands it to the existing flow", () => {
  it("one Training is not a decision — a single tap goes straight through", async () => {
    const onOpen = vi.fn();
    asHost([EVENTS[0]]);
    render(<PracticeAuthoringEntry locale="en" onOpen={onOpen} />);
    await waitFor(() => expect(screen.getByTestId("practice-create-cta")).toBeTruthy());
    fireEvent.click(screen.getByTestId("practice-create-cta"));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith("evt-1");
  });

  it("several Trainings are asked about rather than guessed", async () => {
    const onOpen = vi.fn();
    asHost();
    render(<PracticeAuthoringEntry locale="en" onOpen={onOpen} />);
    await waitFor(() => expect(screen.getByTestId("practice-create-cta")).toBeTruthy());
    fireEvent.click(screen.getByTestId("practice-create-cta"));
    // Nothing was opened by revealing the choice — authoring against the wrong Training is worse
    // than one extra tap.
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.getByText("Which training is this practice for?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Escalating a safety concern" }));
    expect(onOpen).toHaveBeenCalledWith("evt-2");
  });

  it("rapid duplicate taps open the flow once", async () => {
    const onOpen = vi.fn();
    asHost([EVENTS[0]]);
    render(<PracticeAuthoringEntry locale="en" onOpen={onOpen} />);
    await waitFor(() => expect(screen.getByTestId("practice-create-cta")).toBeTruthy());
    const cta = screen.getByTestId("practice-create-cta");
    fireEvent.click(cta);
    fireEvent.click(cta);
    fireEvent.click(cta);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("the choice can be abandoned without opening anything", async () => {
    const onOpen = vi.fn();
    asHost();
    render(<PracticeAuthoringEntry locale="en" onOpen={onOpen} />);
    await waitFor(() => expect(screen.getByTestId("practice-create-cta")).toBeTruthy());
    fireEvent.click(screen.getByTestId("practice-create-cta"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByTestId("practice-create-cta")).toBeTruthy();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("creates nothing itself — no draft request is ever issued from this surface", async () => {
    asHost([EVENTS[0]]);
    render(<PracticeAuthoringEntry locale="en" onOpen={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("practice-create-cta")).toBeTruthy());
    fireEvent.click(screen.getByTestId("practice-create-cta"));
    expect(calls.filter((c) => c.includes("arena-drafts"))).toEqual([]);
    expect(calls).toEqual(["/api/bty/foundry/events"]);
  });
});

describe("[R1] a Host with no Training is told the truth, not given a dead control", () => {
  it("explains that a practice is always built from a training", async () => {
    asHost([]);
    render(<PracticeAuthoringEntry locale="en" onOpen={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("practice-authoring-entry")).toBeTruthy());
    expect(screen.getByText("No training to practice yet.")).toBeTruthy();
    expect(screen.queryByTestId("practice-create-cta")).toBeNull();
  });
});

describe("[R1] language and tap target", () => {
  it("renders Korean with no user-visible internal terminology", async () => {
    asHost([EVENTS[0]]);
    render(<PracticeAuthoringEntry locale="ko" onOpen={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("연습 만들기")).toBeTruthy());
    expect(document.body.textContent).not.toMatch(/Arena|아레나/);
  });

  it("the control is a comfortable tap target", async () => {
    asHost([EVENTS[0]]);
    render(<PracticeAuthoringEntry locale="en" onOpen={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("practice-create-cta")).toBeTruthy());
    expect(screen.getByTestId("practice-create-cta").className).toMatch(/min-h-\[3rem\]/);
  });
});

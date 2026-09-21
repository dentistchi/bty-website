/** @vitest-environment jsdom */
/**
 * THE TRAINING, INSIDE THE BTY SHELL. Slice Teams-Native Delivery V1.
 *
 * The claims:
 *   - the room is opened AS THE ACCOUNT, and the learner is never asked who they are;
 *   - the participant session travels as a HEADER, scoped to this one room, because the cookie the
 *     public path uses cannot cross a third-party frame;
 *   - one runtime serves video, PDF and text — there is no second quiz engine;
 *   - the terminal exit is IN-SHELL: no anchor, no browser, no Safari.
 */
import type React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";

const H = vi.hoisted(() => ({ rendered: [] as Array<{ which: string; props: Record<string, unknown> }> }));

function stubClient(which: string) {
  return (props: Record<string, unknown>) => {
    H.rendered.push({ which, props });
    const exit = props.onExit as { label: string; run: () => void } | null;
    return (
      <div data-testid={`client-${which}`}>
        {exit ? (
          <button type="button" data-testid="terminal-exit" onClick={exit.run}>
            {exit.label}
          </button>
        ) : null}
      </div>
    );
  };
}
vi.mock("@/app/f/[token]/FoundryJoinClient", () => ({ default: stubClient("video") }));
vi.mock("@/app/f/[token]/FoundryDocumentClient", () => ({ default: stubClient("document") }));
vi.mock("@/app/f/[token]/FoundryGuidanceClient", () => ({ default: stubClient("guidance") }));
// next/dynamic resolves lazily in a way jsdom tests cannot flush deterministically; render directly.
vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<{ default: unknown }>) => {
    let C: unknown = null;
    void loader().then((m) => (C = m.default));
    return (props: Record<string, unknown>) => {
      const Comp = C as ((p: Record<string, unknown>) => React.ReactElement) | null;
      return Comp ? Comp(props) : null;
    };
  },
}));

import InShellLearnerRoom from "./InShellLearnerRoom";

const TOKEN = "btyfr1.eyJ0eXBlIjoiZm91bmRyeV9yb29tIn0.c2lnbmF0dXJlLXZhbHVl";
let fetchSpy: ReturnType<typeof vi.fn>;
let openResponse: () => Response;

function openOk(contentType: string) {
  return () =>
    new Response(
      JSON.stringify({
        ok: true,
        joinToken: TOKEN,
        contentType,
        title: "Morning Office Opening",
        displayName: "Ari Kim",
        participantSession: "session-secret",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
}

beforeEach(() => {
  H.rendered.length = 0;
  openResponse = openOk("written_guidance");
  fetchSpy = vi.fn(async (url: unknown) => {
    if (String(url).includes("/api/bty/foundry/teams/room/open")) return openResponse();
    return new Response("{}", { status: 200 });
  });
  vi.stubGlobal("fetch", fetchSpy);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the room is opened as the signed-in account", () => {
  it("asks the server, sending ONLY the target — never a name, a user or an event", async () => {
    render(<InShellLearnerRoom target={{ joinToken: TOKEN }} locale="en" onExit={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("client-guidance")).toBeTruthy());

    const call = fetchSpy.mock.calls.find((c) => String(c[0]).includes("/teams/room/open"))!;
    expect(String(call[0])).toBe("/api/bty/foundry/teams/room/open");
    const body = JSON.parse(String((call[1] as RequestInit).body));
    expect(body).toEqual({ target: `foundry-training:${TOKEN}` });
    expect(JSON.stringify(body)).not.toMatch(/name|user|email|oid|tid|participant/i);
  });

  it("never renders a join/name screen — Teams already answered who this is", async () => {
    render(<InShellLearnerRoom target={{ joinToken: TOKEN }} locale="en" onExit={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("client-guidance")).toBeTruthy());
    expect(screen.queryByLabelText(/your name/i)).toBeNull();
    expect(document.querySelector('input[type="text"]')).toBeNull();
  });
});

describe("ONE runtime, three materials", () => {
  it.each([
    ["youtube", "video"],
    ["document", "document"],
    ["written_guidance", "guidance"],
  ])("%s renders the existing %s client", async (contentType, which) => {
    openResponse = openOk(contentType);
    render(<InShellLearnerRoom target={{ joinToken: TOKEN }} locale="en" onExit={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId(`client-${which}`)).toBeTruthy());
    expect(H.rendered.map((r) => r.which)).toEqual([which]);
  });
});

describe("the participant session travels as a scoped header", () => {
  it("attaches it to THIS room's public calls and to nothing else", async () => {
    render(<InShellLearnerRoom target={{ joinToken: TOKEN }} locale="en" onExit={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("client-guidance")).toBeTruthy());

    const read = (init?: RequestInit) =>
      new Headers(init?.headers ?? {}).get("x-bty-foundry-participant");

    await fetch(`/api/bty/foundry/public/${encodeURIComponent(TOKEN)}/snapshot`);
    expect(read(fetchSpy.mock.calls.at(-1)![1] as RequestInit)).toBe("session-secret");

    // A DIFFERENT room, the rest of the API, and a third party all get nothing.
    await fetch("/api/bty/foundry/public/btyfr1.other.room/snapshot");
    expect(read(fetchSpy.mock.calls.at(-1)![1] as RequestInit)).toBeNull();
    await fetch("/api/bty/today");
    expect(read(fetchSpy.mock.calls.at(-1)![1] as RequestInit)).toBeNull();
    await fetch("https://evil.example/collect");
    expect(read(fetchSpy.mock.calls.at(-1)![1] as RequestInit)).toBeNull();
  });

  it("uninstalls cleanly, leaving fetch exactly as it found it", async () => {
    const before = globalThis.fetch;
    const { unmount } = render(<InShellLearnerRoom target={{ joinToken: TOKEN }} locale="en" onExit={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("client-guidance")).toBeTruthy());
    unmount();
    expect(globalThis.fetch).toBe(before);
  });
});

describe("the way out is in-shell", () => {
  it("the terminal offers a BUTTON that returns to Learn, never an anchor", async () => {
    const onExit = vi.fn();
    render(<InShellLearnerRoom target={{ joinToken: TOKEN }} locale="en" onExit={onExit} />);
    await waitFor(() => expect(screen.getByTestId("client-guidance")).toBeTruthy());
    const exit = screen.getByTestId("terminal-exit");
    expect(exit.tagName).toBe("BUTTON");
    expect(exit.textContent).toBe("Back to Learn");
    fireEvent.click(exit);
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(document.querySelector("a")).toBeNull();
  });
});

describe("an honest refusal, never a dead end", () => {
  it.each([
    ["unauthenticated", "Sign in to BTY to open this training."],
    ["event_closed", "This training is no longer open."],
    ["target_invalid", "This training can't be opened right now."],
  ])("%s → %s, with a way back", async (error, message) => {
    openResponse = () =>
      new Response(JSON.stringify({ ok: false, error }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    const onExit = vi.fn();
    render(<InShellLearnerRoom target={{ joinToken: TOKEN }} locale="en" onExit={onExit} />);
    await waitFor(() => expect(screen.getByTestId("in-shell-room-gate")).toBeTruthy());
    expect(screen.getByTestId("in-shell-room-gate").textContent).toContain(message);
    fireEvent.click(screen.getByTestId("in-shell-room-back"));
    expect(onExit).toHaveBeenCalled();
  });
});

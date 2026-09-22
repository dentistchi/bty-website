/** @vitest-environment jsdom */
/**
 * The SHELL's half of the resume fix. Slice Teams iOS Deep-Link Resume.
 *
 * `BtyDailyAppShell` used to copy the deep-link target into state in a mount-time initialiser, so a
 * training arriving after mount — which is every training on a resumed Teams iOS tab — was ignored.
 * These tests drive the real shell with the real request contract.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

const H = vi.hoisted(() => ({ roomProps: [] as Array<Record<string, unknown>> }));

vi.mock("@/components/foundry/learner/InShellLearnerRoom", () => ({
  default: (props: Record<string, unknown>) => {
    H.roomProps.push(props);
    const target = props.target as { joinToken: string };
    return (
      <div data-testid="room" data-token={target.joinToken}>
        <button type="button" data-testid="room-exit" onClick={props.onExit as () => void}>
          exit
        </button>
      </div>
    );
  },
}));

import BtyDailyAppShell from "./BtyDailyAppShell";

const TOKEN = "btyfr1.eyJ0eXBlIjoiZm91bmRyeV9yb29tIn0.c2lnbmF0dXJlLXZhbHVl";
const TOKEN_B = "btyfr1.eyJiIjoxfQ.c2Vjb25kLXNpZ25hdHVyZQ";
const request = (joinToken: string, requestKey: string) =>
  ({ target: { joinToken }, requestKey, transport: "context" }) as const;

beforeEach(() => {
  H.roomProps.length = 0;
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("a request arriving AFTER mount opens the room", () => {
  it("mounts on ordinary shell, then opens when a request appears", async () => {
    const { rerender } = render(<BtyDailyAppShell locale="en" trainingRequest={null} />);
    expect(screen.queryByTestId("room")).toBeNull();

    rerender(<BtyDailyAppShell locale="en" trainingRequest={request(TOKEN, "refresh:1")} />);
    await waitFor(() => expect(screen.getByTestId("room")).toBeTruthy());
    expect(screen.getByTestId("room").getAttribute("data-token")).toBe(TOKEN);
    expect(screen.getByTestId("in-shell-training")).toBeTruthy();
  });

  it("a COLD request is committed on the first render — no ordinary-shell flash", () => {
    render(<BtyDailyAppShell locale="en" trainingRequest={request(TOKEN, "bootstrap:0")} />);
    expect(screen.getByTestId("room")).toBeTruthy();
    expect(H.roomProps).toHaveLength(1);
  });
});

describe("occurrence semantics inside the shell", () => {
  it("re-delivering the SAME occurrence is inert", async () => {
    const req = request(TOKEN, "refresh:1");
    const { rerender } = render(<BtyDailyAppShell locale="en" trainingRequest={null} />);
    rerender(<BtyDailyAppShell locale="en" trainingRequest={req} />);
    await waitFor(() => expect(screen.getByTestId("room")).toBeTruthy());
    const node = screen.getByTestId("room");

    rerender(<BtyDailyAppShell locale="en" trainingRequest={{ ...req }} />);
    rerender(<BtyDailyAppShell locale="en" trainingRequest={{ ...req }} />);
    expect(screen.getByTestId("room")).toBe(node);
  });

  it("★ a NEW occurrence for the training already open does not remount it", async () => {
    const { rerender } = render(
      <BtyDailyAppShell locale="en" trainingRequest={request(TOKEN, "bootstrap:0")} />,
    );
    const node = screen.getByTestId("room");
    rerender(<BtyDailyAppShell locale="en" trainingRequest={request(TOKEN, "refresh:1")} />);
    rerender(<BtyDailyAppShell locale="en" trainingRequest={request(TOKEN, "refresh:2")} />);
    await waitFor(() => expect(screen.getByTestId("room")).toBe(node));
    /*
      The room never changed WHICH training it is showing. (`roomProps` records every render of the
      stand-in, not every mount, so node identity above is what proves nothing remounted.)
    */
    expect(new Set(H.roomProps.map((p) => (p.target as { joinToken: string }).joinToken))).toEqual(
      new Set([TOKEN]),
    );
  });

  it("★ the SAME training reopens after Back to Learn", async () => {
    const { rerender } = render(
      <BtyDailyAppShell locale="en" trainingRequest={request(TOKEN, "bootstrap:0")} />,
    );
    expect(screen.getByTestId("room")).toBeTruthy();

    fireEvent.click(screen.getByTestId("room-exit"));
    await waitFor(() => expect(screen.queryByTestId("room")).toBeNull());

    rerender(<BtyDailyAppShell locale="en" trainingRequest={request(TOKEN, "refresh:5")} />);
    await waitFor(() => expect(screen.getByTestId("room")).toBeTruthy());
    expect(screen.getByTestId("room").getAttribute("data-token")).toBe(TOKEN);
  });

  it("a different training replaces the open one", async () => {
    const { rerender } = render(
      <BtyDailyAppShell locale="en" trainingRequest={request(TOKEN, "bootstrap:0")} />,
    );
    rerender(<BtyDailyAppShell locale="en" trainingRequest={request(TOKEN_B, "refresh:1")} />);
    await waitFor(() => expect(screen.getByTestId("room").getAttribute("data-token")).toBe(TOKEN_B));
  });
});

describe("Back to Learn", () => {
  it("closes the room locally and reports the exit to the host", async () => {
    const onTrainingExit = vi.fn();
    render(
      <BtyDailyAppShell
        locale="en"
        trainingRequest={request(TOKEN, "bootstrap:0")}
        onTrainingExit={onTrainingExit}
      />,
    );
    fireEvent.click(screen.getByTestId("room-exit"));
    await waitFor(() => expect(screen.queryByTestId("in-shell-training")).toBeNull());
    expect(onTrainingExit).toHaveBeenCalledTimes(1);
  });

  it("works without a host handler — the web shell has no subpage to clear", async () => {
    render(<BtyDailyAppShell locale="en" trainingRequest={request(TOKEN, "bootstrap:0")} />);
    fireEvent.click(screen.getByTestId("room-exit"));
    await waitFor(() => expect(screen.queryByTestId("room")).toBeNull());
  });
});

describe("the ordinary web shell is unaffected", () => {
  it("renders normally with no training props at all", () => {
    render(<BtyDailyAppShell locale="en" />);
    expect(screen.queryByTestId("room")).toBeNull();
    expect(screen.queryByTestId("in-shell-training")).toBeNull();
    // The ordinary app root is what rendered instead.
    expect(document.querySelector("[data-bty-app-root]")).toBeTruthy();
  });
});

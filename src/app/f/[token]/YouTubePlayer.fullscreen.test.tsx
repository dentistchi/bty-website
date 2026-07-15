/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { YouTubePlayer } from "./YouTubePlayer";

/* eslint-disable @typescript-eslint/no-explicit-any */

let YTPlayer: ReturnType<typeof vi.fn>;

function installYT() {
  YTPlayer = vi.fn(function (this: any) {
    this.getIframe = () => document.createElement("iframe");
    this.getCurrentTime = () => 0;
    this.getDuration = () => 100;
    this.getPlaybackRate = () => 1;
    this.seekTo = vi.fn();
    this.playVideo = vi.fn();
    this.pauseVideo = vi.fn();
    this.destroy = vi.fn();
  });
  (window as any).YT = { Player: YTPlayer, PlayerState: { PLAYING: 1, PAUSED: 2, BUFFERING: 3, ENDED: 0 } };
}

beforeEach(() => {
  installYT();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (window as any).YT;
  document.body.style.overflow = "";
});

async function renderPlayer() {
  render(<YouTubePlayer videoId="abcdefghijk" enableResume={false} />);
  await waitFor(() => expect(YTPlayer).toHaveBeenCalledTimes(1));
  const btn = screen.getByLabelText("Enter immersive mode");
  const container = btn.parentElement as HTMLElement;
  return { btn, container };
}

describe("YouTubePlayer — BTY Immersive Mode (no native fullscreen dependency)", () => {
  it("enters immersive mode IMMEDIATELY on tap, without calling any browser fullscreen API", async () => {
    const { btn, container } = await renderPlayer();
    // Spy on both fullscreen APIs — neither must ever be invoked.
    const req = vi.fn(() => Promise.resolve());
    const webkitReq = vi.fn();
    Object.defineProperty(container, "requestFullscreen", { value: req, configurable: true });
    Object.defineProperty(container, "webkitRequestFullscreen", { value: webkitReq, configurable: true });

    fireEvent.click(btn);

    // Immediate (synchronous) immersive state — no async wait, no API branch.
    expect(container.getAttribute("data-immersive")).toBe("true");
    expect(req).not.toHaveBeenCalled();
    expect(webkitReq).not.toHaveBeenCalled();
  });

  it("immersive container fills the viewport and covers the whole application", async () => {
    const { btn, container } = await renderPlayer();
    fireEvent.click(btn);
    expect(container.className).toContain("fixed");
    expect(container.className).toContain("inset-0");
    expect(container.style.width).toBe("100vw");
    expect(container.style.height).toBe("100dvh");
    // Highest z-index so header / bottom nav / page chrome are all covered.
    expect(container.className).toContain("z-[2147483647]");
    // Body scroll locked.
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("does NOT remount the player when entering/exiting immersive (playback preserved)", async () => {
    const { btn, container } = await renderPlayer();
    fireEvent.click(btn); // enter
    expect(container.getAttribute("data-immersive")).toBe("true");
    fireEvent.click(btn); // exit
    expect(container.getAttribute("data-immersive")).toBeNull();
    expect(YTPlayer).toHaveBeenCalledTimes(1); // constructed exactly once
    expect(YTPlayer.mock.instances[0].destroy).not.toHaveBeenCalled();
  });

  it("exit restores the normal layout and releases the body scroll lock", async () => {
    const { btn, container } = await renderPlayer();
    fireEvent.click(btn); // enter
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(btn); // exit
    expect(container.getAttribute("data-immersive")).toBeNull();
    expect(container.className).toContain("relative");
    expect(container.className).not.toContain("fixed");
    expect(container.style.aspectRatio).toBe("16 / 9");
    expect(document.body.style.overflow).toBe("");
  });

  it("exposes an Exit control while immersive", async () => {
    const { btn } = await renderPlayer();
    fireEvent.click(btn);
    expect(screen.getByLabelText("Exit immersive mode")).toBeTruthy();
  });
});

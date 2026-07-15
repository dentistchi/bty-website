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
});

async function renderPlayer() {
  render(<YouTubePlayer videoId="abcdefghijk" enableResume={false} />);
  await waitFor(() => expect(YTPlayer).toHaveBeenCalledTimes(1));
  const btn = screen.getByLabelText("Enter fullscreen");
  const container = btn.parentElement as HTMLElement;
  return { btn, container };
}

describe("YouTubePlayer fullscreen — capability strategy", () => {
  it("uses NATIVE fullscreen when the element supports requestFullscreen", async () => {
    const { btn, container } = await renderPlayer();
    const req = vi.fn(() => Promise.resolve());
    Object.defineProperty(container, "requestFullscreen", { value: req, configurable: true });

    fireEvent.click(btn);
    expect(req).toHaveBeenCalledOnce();
    // No immersive fallback when native is available.
    expect(container.getAttribute("data-immersive")).toBeNull();
  });

  it("activates the in-app IMMERSIVE fallback when no element-fullscreen API exists (iPhone/WKWebView)", async () => {
    const { btn, container } = await renderPlayer();
    Object.defineProperty(container, "requestFullscreen", { value: undefined, configurable: true });
    Object.defineProperty(container, "webkitRequestFullscreen", { value: undefined, configurable: true });

    fireEvent.click(btn);
    await waitFor(() => expect(container.getAttribute("data-immersive")).toBe("true"));
    // Fills the viewport and covers the page.
    expect(container.className).toContain("fixed");
    expect(container.className).toContain("inset-0");
    expect(container.style.height).toBe("100dvh");
    // Body scroll is locked while immersive.
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("does NOT remount the player when entering/exiting immersive (playback preserved)", async () => {
    const { btn, container } = await renderPlayer();
    Object.defineProperty(container, "requestFullscreen", { value: undefined, configurable: true });

    fireEvent.click(btn); // enter immersive
    await waitFor(() => expect(container.getAttribute("data-immersive")).toBe("true"));
    fireEvent.click(btn); // exit immersive
    await waitFor(() => expect(container.getAttribute("data-immersive")).toBeNull());

    // The YT player was constructed exactly once across both transitions.
    expect(YTPlayer).toHaveBeenCalledTimes(1);
  });

  it("exit restores the normal layout and releases the body scroll lock", async () => {
    const { btn, container } = await renderPlayer();
    Object.defineProperty(container, "requestFullscreen", { value: undefined, configurable: true });

    fireEvent.click(btn); // enter
    await waitFor(() => expect(container.getAttribute("data-immersive")).toBe("true"));
    fireEvent.click(btn); // exit
    await waitFor(() => expect(container.getAttribute("data-immersive")).toBeNull());

    expect(container.className).toContain("relative");
    expect(container.className).not.toContain("fixed");
    expect(container.style.aspectRatio).toBe("16 / 9");
    expect(document.body.style.overflow).toBe("");
  });

  it("the fullscreen control is always inside the tap handler (single click, no async gap)", async () => {
    const { btn, container } = await renderPlayer();
    const req = vi.fn(() => Promise.resolve());
    Object.defineProperty(container, "requestFullscreen", { value: req, configurable: true });
    fireEvent.click(btn);
    // Called synchronously within the click dispatch.
    expect(req).toHaveBeenCalledOnce();
  });
});

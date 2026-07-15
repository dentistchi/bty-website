/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  enterFullscreen,
  exitNativeFullscreen,
  currentFullscreenElement,
  isNativeFullscreenActive,
  type FullscreenResult,
} from "./fullscreen";

/** Build a bare element with only the fullscreen methods we want present. */
function makeEl(opts: { standard?: () => Promise<void> | void; webkit?: () => void }): HTMLElement {
  const el = document.createElement("div");
  // jsdom defines requestFullscreen on the prototype; override on the instance so
  // only what the case wants is a function (undefined otherwise).
  Object.defineProperty(el, "requestFullscreen", {
    value: opts.standard ? vi.fn(opts.standard) : undefined,
    configurable: true,
  });
  Object.defineProperty(el, "webkitRequestFullscreen", {
    value: opts.webkit ? vi.fn(opts.webkit) : undefined,
    configurable: true,
  });
  return el;
}

afterEach(() => {
  vi.restoreAllMocks();
  // reset any faked document fullscreen state
  Object.defineProperty(document, "fullscreenElement", { value: null, configurable: true });
});

describe("enterFullscreen — capability strategy", () => {
  it("1) standard requestFullscreen succeeds → native_fullscreen, no fallback", async () => {
    const onFallback = vi.fn();
    const el = makeEl({ standard: () => Promise.resolve() });
    const res: FullscreenResult = await enterFullscreen(el, onFallback);
    expect(res).toBe("native_fullscreen");
    expect(onFallback).not.toHaveBeenCalled();
    expect((el as unknown as { requestFullscreen: ReturnType<typeof vi.fn> }).requestFullscreen).toHaveBeenCalledOnce();
  });

  it("2) standard absent, webkitRequestFullscreen present → native_fullscreen", async () => {
    const onFallback = vi.fn();
    const webkit = vi.fn();
    const el = makeEl({ webkit });
    const res = await enterFullscreen(el, onFallback);
    expect(res).toBe("native_fullscreen");
    expect(webkit).toHaveBeenCalledOnce();
    expect(onFallback).not.toHaveBeenCalled();
  });

  it("3) native rejects → immersive_fallback (onFallback fired once)", async () => {
    const onFallback = vi.fn();
    const el = makeEl({ standard: () => Promise.reject(new Error("not allowed")) });
    const res = await enterFullscreen(el, onFallback);
    expect(res).toBe("immersive_fallback");
    expect(onFallback).toHaveBeenCalledOnce();
  });

  it("4) no native API at all (iPhone/WKWebView) → immersive_fallback", async () => {
    const onFallback = vi.fn();
    const el = makeEl({});
    const res = await enterFullscreen(el, onFallback);
    expect(res).toBe("immersive_fallback");
    expect(onFallback).toHaveBeenCalledOnce();
  });

  it("null element → failed, no fallback", async () => {
    const onFallback = vi.fn();
    const res = await enterFullscreen(null, onFallback);
    expect(res).toBe("failed");
    expect(onFallback).not.toHaveBeenCalled();
  });

  it("initiates the request synchronously (gesture preserved) before awaiting", () => {
    const standard = vi.fn(() => Promise.resolve());
    const el = makeEl({ standard });
    void enterFullscreen(el, vi.fn()); // not awaited
    expect(standard).toHaveBeenCalledOnce(); // called on the same tick as the tap
  });
});

describe("native fullscreen state + exit", () => {
  it("currentFullscreenElement / isNativeFullscreenActive reflect document state", () => {
    const node = document.createElement("div");
    Object.defineProperty(document, "fullscreenElement", { value: node, configurable: true });
    expect(currentFullscreenElement()).toBe(node);
    expect(isNativeFullscreenActive()).toBe(true);
    Object.defineProperty(document, "fullscreenElement", { value: null, configurable: true });
    expect(isNativeFullscreenActive()).toBe(false);
  });

  it("exitNativeFullscreen calls document.exitFullscreen only when in fullscreen", () => {
    const exit = vi.fn(() => Promise.resolve());
    Object.defineProperty(document, "exitFullscreen", { value: exit, configurable: true });

    Object.defineProperty(document, "fullscreenElement", { value: null, configurable: true });
    exitNativeFullscreen();
    expect(exit).not.toHaveBeenCalled();

    Object.defineProperty(document, "fullscreenElement", { value: document.createElement("div"), configurable: true });
    exitNativeFullscreen();
    expect(exit).toHaveBeenCalledOnce();
  });
});

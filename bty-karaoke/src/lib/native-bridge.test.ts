import { describe, it, expect, vi, afterEach } from 'vitest';
import { isNativeHost, nativeOpenYouTube } from './native-bridge';

// The module reads `window`; in the node test env there is none by default. Each test sets a
// fake global window to a specific capability shape, then restores it.
const realWindow = (globalThis as { window?: unknown }).window;
function setWindow(w: unknown) {
  (globalThis as { window?: unknown }).window = w;
}
afterEach(() => {
  setWindow(realWindow);
  vi.restoreAllMocks();
});

const PAYLOAD = { videoId: 'dQw4w9WgXcQ', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' };

describe('isNativeHost — capability detection (never user-agent)', () => {
  it('false when there is no window (SSR)', () => {
    setWindow(undefined);
    expect(isNativeHost()).toBe(false);
  });

  it('false in a plain web browser (no bridge, no webkit handlers)', () => {
    setWindow({}); // a bare window — this is desktop/mobile Safari
    expect(isNativeHost()).toBe(false);
  });

  it('false when webkit exists but exposes no messageHandlers (mobile Safari)', () => {
    setWindow({ webkit: {} });
    expect(isNativeHost()).toBe(false);
  });

  it('true when the explicit native capability object is injected', () => {
    setWindow({ __BTY_NATIVE__: { openYouTube: () => {} } });
    expect(isNativeHost()).toBe(true);
  });

  it('true when a WKWebView btyYouTube message handler is present', () => {
    setWindow({ webkit: { messageHandlers: { btyYouTube: { postMessage: () => {} } } } });
    expect(isNativeHost()).toBe(true);
  });
});

describe('nativeOpenYouTube — dispatch through the bridge', () => {
  it('calls the injected __BTY_NATIVE__.openYouTube and returns true', () => {
    const openYouTube = vi.fn();
    setWindow({ __BTY_NATIVE__: { openYouTube } });
    expect(nativeOpenYouTube(PAYLOAD)).toBe(true);
    expect(openYouTube).toHaveBeenCalledTimes(1);
    expect(openYouTube).toHaveBeenCalledWith(PAYLOAD);
  });

  it('posts to the WKWebView message handler and returns true', () => {
    const postMessage = vi.fn();
    setWindow({ webkit: { messageHandlers: { btyYouTube: { postMessage } } } });
    expect(nativeOpenYouTube(PAYLOAD)).toBe(true);
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(PAYLOAD);
  });

  it('returns false in a web browser (no bridge) — caller uses the BTY Player instead', () => {
    setWindow({});
    expect(nativeOpenYouTube(PAYLOAD)).toBe(false);
  });

  it('never throws if the bridge itself throws (returns false)', () => {
    setWindow({ __BTY_NATIVE__: { openYouTube: () => { throw new Error('boom'); } } });
    expect(nativeOpenYouTube(PAYLOAD)).toBe(false);
  });
});

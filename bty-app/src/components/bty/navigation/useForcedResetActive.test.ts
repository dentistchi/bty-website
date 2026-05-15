/** @vitest-environment jsdom */
/**
 * useForcedResetActive hook — Stage 2 step 4 sub-phase 2D.
 *
 * Tests the 2C-2 client-side FORCED_RESET signal at
 * `src/components/bty/navigation/useForcedResetActive.ts`. Covers:
 * - true/false return from `GET /api/arena/leadership-engine/state`
 * - loading default (NOT-suppressed initial render)
 * - error / 401 fallback (open-on-failure parity with 2C-1 server helper)
 * - module-level dedup: 60s TTL cache + in-flight singleton
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useForcedResetActive,
  __resetForcedResetActiveCacheForTests,
} from "./useForcedResetActive";

beforeEach(() => {
  __resetForcedResetActiveCacheForTests();
  vi.useRealTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(impl: typeof fetch): ReturnType<typeof vi.fn> {
  const spy = vi.fn(impl);
  vi.stubGlobal("fetch", spy);
  return spy;
}

describe("useForcedResetActive — return value from leadership-engine state", () => {
  it("returns true when forcedResetTriggeredAt is non-null", async () => {
    stubFetch(async () =>
      ({
        ok: true,
        json: async () => ({ forcedResetTriggeredAt: "2026-05-14T00:00:00Z" }),
      }) as unknown as Response,
    );
    const { result } = renderHook(() => useForcedResetActive());
    expect(result.current).toBe(false); // initial render — NOT-suppressed default
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("returns false when forcedResetTriggeredAt is null", async () => {
    stubFetch(async () =>
      ({
        ok: true,
        json: async () => ({ forcedResetTriggeredAt: null }),
      }) as unknown as Response,
    );
    const { result } = renderHook(() => useForcedResetActive());
    expect(result.current).toBe(false);
    /** Wait for fetch to resolve and re-render; value stays false. */
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current).toBe(false);
  });

  it("loading state returns false initially (NOT-suppressed during load)", () => {
    /** Fetch never resolves — hook stays in initial state. */
    stubFetch(() => new Promise<Response>(() => {}));
    const { result } = renderHook(() => useForcedResetActive());
    expect(result.current).toBe(false);
  });

  it("returns false on !r.ok (e.g. 401 unauthenticated) — open-on-failure", async () => {
    stubFetch(async () =>
      ({ ok: false, status: 401, json: async () => ({}) }) as unknown as Response,
    );
    const { result } = renderHook(() => useForcedResetActive());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current).toBe(false);
  });

  it("returns false on network error — open-on-failure parity with server helper", async () => {
    stubFetch(async () => {
      throw new Error("network down");
    });
    const { result } = renderHook(() => useForcedResetActive());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current).toBe(false);
  });
});

describe("useForcedResetActive — module-level dedup", () => {
  it("two hook calls within TTL share a single fetch (cache hit)", async () => {
    const spy = stubFetch(async () =>
      ({
        ok: true,
        json: async () => ({ forcedResetTriggeredAt: "2026-05-14T00:00:00Z" }),
      }) as unknown as Response,
    );
    const { result: r1 } = renderHook(() => useForcedResetActive());
    await waitFor(() => expect(r1.current).toBe(true));
    expect(spy).toHaveBeenCalledTimes(1);

    /** Second hook mount — cached entry should serve, no new fetch. */
    const { result: r2 } = renderHook(() => useForcedResetActive());
    await waitFor(() => expect(r2.current).toBe(true));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("concurrent hook mounts share the in-flight singleton (1 fetch, not N)", async () => {
    /** Hold the fetch promise so both hooks mount while it's pending. */
    let resolveFetch: ((res: Response) => void) | null = null;
    const spy = stubFetch(
      () =>
        new Promise<Response>((res) => {
          resolveFetch = res;
        }),
    );

    const { result: r1 } = renderHook(() => useForcedResetActive());
    const { result: r2 } = renderHook(() => useForcedResetActive());
    /** Both mounted, both pending — exactly one fetch in flight. */
    expect(spy).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch?.({
        ok: true,
        json: async () => ({ forcedResetTriggeredAt: "2026-05-14T00:00:00Z" }),
      } as unknown as Response);
    });

    await waitFor(() => {
      expect(r1.current).toBe(true);
      expect(r2.current).toBe(true);
    });
    /** Still only 1 fetch — singleton dedup worked. */
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("cache reset (test-only export) forces a fresh fetch on next mount", async () => {
    const spy = stubFetch(async () =>
      ({
        ok: true,
        json: async () => ({ forcedResetTriggeredAt: null }),
      }) as unknown as Response,
    );
    const { result: r1 } = renderHook(() => useForcedResetActive());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(r1.current).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);

    __resetForcedResetActiveCacheForTests();

    const { result: r2 } = renderHook(() => useForcedResetActive());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(r2.current).toBe(false);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

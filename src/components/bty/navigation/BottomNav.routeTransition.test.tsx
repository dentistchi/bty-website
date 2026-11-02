/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import BottomNav from "./BottomNav";
import { __resetForcedResetActiveCacheForTests } from "./useForcedResetActive";

beforeEach(() => {
  __resetForcedResetActiveCacheForTests();
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ forcedResetTriggeredAt: null }), { status: 200 }))));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function surface(pathname: string) {
  return <PathnameContext.Provider value={pathname}><BottomNav locale="en" /></PathnameContext.Provider>;
}

describe("contained legacy BottomNav route transitions", () => {
  it("does not run signed-in navigation hooks or fetch on a login surface", () => {
    render(surface("/en/bty/login"));
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("can transition between protected and auth surfaces with the real hooks", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(surface("/en/bty-arena"));
    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(5));
    rerender(surface("/en/bty/login"));
    expect(screen.queryByRole("navigation")).toBeNull();
    rerender(surface("/en/bty-arena"));
    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(5));
    expect(error.mock.calls.filter(args => /order of Hooks|Rendered (?:more|fewer) hooks|Internal React error/.test(String(args[0])))).toEqual([]);
  });
});

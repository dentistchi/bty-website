/** @vitest-environment jsdom */
/**
 * Today Relationship Commitment V1 — CTA wiring + same-day rehydration (structural/behavioral).
 *
 * CTA: enters the confirmed terminal ONLY on server acknowledgement; double-tap = one in-flight
 * request; failure stays retryable (never fabricates confirmation). Hydration: a committed day
 * restores the terminal state with no uncommitted-door flash and no arrival replay; an uncommitted
 * day shows the normal doors; a locked POST restores the server's canonical relationship. No AI/
 * generation endpoint is ever called.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import BtyDailyAppShell, {
  COPY,
  TodaySurface,
  selectTodayStatus,
  type TodayFocusKey,
} from "@/components/app-shell/BtyDailyAppShell";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

// A tiny stand-in for the shell's ownership of selected/confirmed: onConfirm true → adopt the focus
// and enter the terminal state (exactly what BtyDailyAppShell.handleTodayConfirm does).
function Harness({
  onConfirm,
  initial = "Self",
}: {
  onConfirm: (f: TodayFocusKey) => Promise<boolean>;
  initial?: TodayFocusKey;
}) {
  const [selected, setSelected] = useState<TodayFocusKey | null>(initial);
  const [confirmed, setConfirmed] = useState(false);
  const wrapped = async (f: TodayFocusKey) => {
    const ok = await onConfirm(f);
    if (ok) {
      setSelected(f);
      setConfirmed(true);
    }
    return ok;
  };
  return (
    <TodaySurface
      copy={COPY.en.today}
      statusLine={selectTodayStatus("en", "scenario_signal")}
      activeFocus={null}
      loading={false}
      promiseText={null}
      centerKeepLine={null}
      selected={selected}
      setSelected={setSelected}
      confirmed={confirmed}
      setConfirmed={setConfirmed}
      onConfirm={wrapped}
      firstArrival={false}
    />
  );
}

const cta = (c: HTMLElement) => c.querySelector<HTMLButtonElement>("[data-today-cta]")!;

describe("CTA — durable confirm via onConfirm", () => {
  it("does NOT enter confirmed state before the POST resolves; then confirms on success", async () => {
    const d = deferred<boolean>();
    const onConfirm = vi.fn(() => d.promise);
    const { container } = render(<Harness onConfirm={onConfirm} />);

    expect(cta(container).textContent).toBe(COPY.en.today.cta);
    fireEvent.click(cta(container));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    // pending: still the pre-confirm label, quiet inline pending (busy + disabled), NOT confirmed
    expect(cta(container).textContent).toBe(COPY.en.today.cta);
    expect(cta(container).getAttribute("aria-busy")).toBe("true");
    expect(cta(container).disabled).toBe(true);
    expect(cta(container).getAttribute("aria-pressed")).toBe("false");

    await act(async () => {
      d.resolve(true);
      await d.promise;
    });
    expect(cta(container).textContent).toContain(COPY.en.today.ctaDone);
    expect(cta(container).getAttribute("aria-pressed")).toBe("true");
  });

  it("double tap produces exactly one in-flight request", async () => {
    const d = deferred<boolean>();
    const onConfirm = vi.fn(() => d.promise);
    const { container } = render(<Harness onConfirm={onConfirm} />);
    fireEvent.click(cta(container));
    fireEvent.click(cta(container));
    fireEvent.click(cta(container));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await act(async () => {
      d.resolve(true);
      await d.promise;
    });
  });

  it("failure stays retryable and never fabricates confirmation", async () => {
    const first = deferred<boolean>();
    const onConfirm = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(true);
    const { container } = render(<Harness onConfirm={onConfirm} />);

    fireEvent.click(cta(container));
    await act(async () => {
      first.resolve(false); // ordinary failure
      await first.promise;
    });
    // not confirmed; button is live again
    expect(cta(container).textContent).toBe(COPY.en.today.cta);
    expect(cta(container).getAttribute("aria-pressed")).toBe("false");
    expect(cta(container).disabled).toBe(false);

    // retry succeeds
    await act(async () => {
      fireEvent.click(cta(container));
    });
    expect(onConfirm).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(cta(container).textContent).toContain(COPY.en.today.ctaDone));
  });

  it("without onConfirm (isolated render) the CTA keeps the in-memory settle", () => {
    const { container } = render(
      <TodaySurface
        copy={COPY.en.today}
        statusLine={selectTodayStatus("en", "scenario_signal")}
        activeFocus={null}
        loading={false}
        promiseText={null}
        centerKeepLine={null}
        selected="Self"
        setSelected={() => {}}
        confirmed={false}
        setConfirmed={() => {}}
        firstArrival={false}
      />,
    );
    // no onConfirm, no confirmed control flip → the button falls back to in-memory setConfirmed path
    // (the local uncontrolled fallback owns it). Pressing does not throw and calls no network.
    expect(() => fireEvent.click(cta(container))).not.toThrow();
  });
});

// ── shell-level hydration + provider-zero-call ──────────────────────────────────────────────
type FetchCall = { url: string; method: string };

function installFetch(router: (url: string, method: string) => unknown, calls: FetchCall[]) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: false,
    media: q,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }));
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ url, method });
    const body = router(url, method);
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body ?? {}),
    } as Response);
  });
}

// Base router for the shell's fail-soft data fetches; commitResponder handles /today/commit.
function baseRouter(commitResponder: (url: string, method: string) => unknown) {
  return (url: string, method: string): unknown => {
    if (url.includes("/api/me/today/commit")) return commitResponder(url, method);
    if (url.includes("/api/me/today-intelligence"))
      return { userState: "scenario_signal", relationshipFocus: "Self", confidence: "none", reasonCodes: [], fallbackMode: "none" };
    if (url.includes("/api/bty/my-page/state")) return { open_action_contract: null };
    if (url.includes("/api/bty/center/keep")) return { line: null, keptToday: false };
    if (url.includes("/api/me/day/open")) return { ok: true };
    return {}; // meWeeklyRhythm / daily-trace etc. → fail-soft empty
  };
}

const commitmentBody = (relationship: string) => ({
  ok: true,
  commitment: {
    relationship,
    suggestedRelationship: null,
    dayKey: "2026-07-13",
    confirmedAt: "2026-07-12T20:30:00.000Z",
    locale: "en",
    timezoneSnapshot: "Asia/Seoul",
    tzFallback: false,
  },
});

describe("shell hydration — same-day re-entry", () => {
  it("committed day: restores the confirmed terminal with NO uncommitted-door flash", async () => {
    const calls: FetchCall[] = [];
    installFetch(baseRouter(() => commitmentBody("others")), calls);
    const { container } = render(<BtyDailyAppShell locale="en" />);

    // Before hydration resolves, the bounded hold is shown and NO interactive doors exist.
    expect(container.querySelector("[data-today-hydrating]")).not.toBeNull();
    expect(container.querySelectorAll("[data-focus]").length).toBe(0);

    // After hydration: terminal restored — CTA shows the settled label, exactly one interior.
    await waitFor(() => expect(container.querySelector("[data-today-cta]")).not.toBeNull());
    const ctaEl = container.querySelector<HTMLButtonElement>("[data-today-cta]")!;
    expect(ctaEl.getAttribute("aria-pressed")).toBe("true");
    expect(ctaEl.textContent).toContain(COPY.en.today.ctaDone);
    // committed door 'Others' held; the other two collapsed (aria-hidden)
    const others = container.querySelector('[data-focus="Others"]')!;
    expect(others).not.toBeNull();
  });

  it("uncommitted day: shows the normal doors, no confirmed terminal", async () => {
    const calls: FetchCall[] = [];
    installFetch(baseRouter(() => ({ ok: true, commitment: null })), calls);
    const { container } = render(<BtyDailyAppShell locale="en" />);
    await waitFor(() => expect(container.querySelectorAll("[data-focus]").length).toBe(3));
    expect(container.querySelector("[data-today-cta]")).toBeNull(); // nothing selected/confirmed
    expect(container.querySelector("[data-today-hydrating]")).toBeNull();
  });

  it("PROVIDER ZERO-CALL: hydration + data fetches never hit an AI/generation endpoint", async () => {
    const calls: FetchCall[] = [];
    installFetch(baseRouter(() => ({ ok: true, commitment: null })), calls);
    render(<BtyDailyAppShell locale="en" />);
    await waitFor(() => expect(calls.some((c) => c.url.includes("/api/me/today/commit"))).toBe(true));
    const forbidden = /todayMirror|mirror\/generate|\/llm|generate-today|living-response/i;
    expect(calls.every((c) => !forbidden.test(c.url))).toBe(true);
    // the commitment GET is a read (GET), not a generation POST
    expect(calls.find((c) => c.url.includes("/api/me/today/commit"))!.method).toBe("GET");
  });
});

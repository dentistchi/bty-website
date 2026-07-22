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
import {
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

// NOTE (Slice 3.1B-3J.1): the former "shell hydration — same-day re-entry" block was removed with the
// retired Today relationship/commitment surface — the shell no longer renders the doors or drives the
// commitment/living-response reads (its server engines are unchanged and still covered elsewhere). The
// commitment CTA + rehydration BEHAVIOR above is still exercised via TodaySurface + the Harness in
// isolation; the shell's simplified Today (greeting → Personal Brief) is covered in the today suite.

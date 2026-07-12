/** @vitest-environment jsdom */
/**
 * Today Living Response V1 — UI wiring. The perspective line renders in ONE bounded slot only when
 * confirmed + settled (ready|fallback); pending/null render nothing. Commitment confirmation never
 * waits on the Living Response POST; the POST fires only AFTER the commitment; failure leaves the
 * terminal intact; same-day re-entry restores the line. The client never calls any generation endpoint.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import BtyDailyAppShell, { COPY, TodaySurface, selectTodayStatus, type LivingResponseView } from "@/components/app-shell/BtyDailyAppShell";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const view = (over: Partial<LivingResponseView> = {}): LivingResponseView => ({ status: "ready", relationship: "self", perspective: "A quiet return still counts today.", source: "generated", confidence: "grounded", ...over });

function renderSurface(livingResponse: LivingResponseView | null) {
  return render(
    <TodaySurface
      copy={COPY.en.today}
      statusLine={selectTodayStatus("en", "scenario_signal")}
      activeFocus={null}
      loading={false}
      promiseText={null}
      centerKeepLine={null}
      selected="Self"
      setSelected={() => {}}
      confirmed
      setConfirmed={() => {}}
      livingResponse={livingResponse}
      firstArrival={false}
    />,
  );
}

describe("TodaySurface — living response line", () => {
  it("renders exactly one line when ready", () => {
    const { container } = renderSurface(view());
    const els = container.querySelectorAll("[data-living-response]");
    expect(els.length).toBe(1);
    expect(els[0].textContent).toBe("A quiet return still counts today.");
    expect(els[0].getAttribute("data-living-response-source")).toBe("generated");
  });

  it("renders the fallback line (source=fallback)", () => {
    const { container } = renderSurface(view({ status: "fallback", source: "fallback", confidence: "limited", perspective: "Returning to yourself is quiet work." }));
    expect(container.querySelector('[data-living-response][data-living-response-source="fallback"]')).not.toBeNull();
  });

  it("renders NOTHING while pending", () => {
    const { container } = renderSurface(view({ status: "pending", perspective: null, source: null, confidence: null }));
    expect(container.querySelector("[data-living-response]")).toBeNull();
  });

  it("renders nothing when there is no living response", () => {
    const { container } = renderSurface(null);
    expect(container.querySelector("[data-living-response]")).toBeNull();
  });
});

// ── shell-level ──
type Call = { url: string; method: string };
function installFetch(handlers: { commitPost?: () => unknown; livingPost?: () => Promise<unknown> | unknown; commitGet?: () => unknown; livingGet?: () => unknown }, calls: Call[]) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }));
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ url, method });
    const json = (async (): Promise<unknown> => {
      if (url.includes("/api/me/today/living-response")) return method === "POST" ? handlers.livingPost?.() ?? { ok: true, response: null } : handlers.livingGet?.() ?? { ok: true, committed: false, response: null };
      if (url.includes("/api/me/today/commit")) return method === "POST" ? handlers.commitPost?.() ?? { ok: true, created: true, commitment: null } : handlers.commitGet?.() ?? { ok: true, commitment: null };
      if (url.includes("/api/me/today-intelligence")) return { userState: "scenario_signal", relationshipFocus: "Self", confidence: "none", reasonCodes: [], fallbackMode: "none" };
      if (url.includes("/api/bty/my-page/state")) return { open_action_contract: null };
      if (url.includes("/api/bty/center/keep")) return { line: null, keptToday: false };
      return {};
    })();
    return Promise.resolve({ ok: true, status: 200, json: () => json } as Response);
  });
}
const commitment = (relationship: string) => ({ relationship, suggestedRelationship: null, dayKey: "2026-07-13", confirmedAt: "x", locale: "en", timezoneSnapshot: "Asia/Seoul", tzFallback: false });

describe("shell — POST after commit, re-entry, provider zero-call", () => {
  it("fresh commit: confirmation is immediate; the LR POST fires AFTER the commit and the line appears", async () => {
    const calls: Call[] = [];
    installFetch({
      commitGet: () => ({ ok: true, commitment: null }), // uncommitted → doors show
      commitPost: () => ({ ok: true, created: true, commitment: commitment("self") }),
      livingPost: () => ({ ok: true, response: view() }),
    }, calls);
    const { container } = render(<BtyDailyAppShell locale="en" />);
    await waitFor(() => expect(container.querySelectorAll("[data-focus]").length).toBe(3));

    fireEvent.click(container.querySelector('[data-focus="Self"]')!);
    await act(async () => {
      fireEvent.click(container.querySelector("[data-today-cta]")!);
    });
    // confirmation reached the terminal
    await waitFor(() => expect(container.querySelector("[data-today-cta]")!.getAttribute("aria-pressed")).toBe("true"));
    // the LR POST happened only after the commit POST
    const commitPostIdx = calls.findIndex((c) => c.url.includes("/api/me/today/commit") && c.method === "POST");
    const livingPostIdx = calls.findIndex((c) => c.url.includes("/api/me/today/living-response") && c.method === "POST");
    expect(commitPostIdx).toBeGreaterThanOrEqual(0);
    expect(livingPostIdx).toBeGreaterThan(commitPostIdx);
    // the line fades in
    await waitFor(() => expect(container.querySelector("[data-living-response]")).not.toBeNull());
  });

  it("generation failure (LR POST null) leaves the terminal intact and shows no line", async () => {
    const calls: Call[] = [];
    installFetch({
      commitGet: () => ({ ok: true, commitment: null }),
      commitPost: () => ({ ok: true, created: true, commitment: commitment("self") }),
      livingPost: () => ({ ok: true, response: null }),
    }, calls);
    const { container } = render(<BtyDailyAppShell locale="en" />);
    await waitFor(() => expect(container.querySelectorAll("[data-focus]").length).toBe(3));
    fireEvent.click(container.querySelector('[data-focus="Self"]')!);
    await act(async () => { fireEvent.click(container.querySelector("[data-today-cta]")!); });
    await waitFor(() => expect(container.querySelector("[data-today-cta]")!.getAttribute("aria-pressed")).toBe("true"));
    expect(container.querySelector("[data-living-response]")).toBeNull(); // terminal intact, no line
  });

  it("same-day re-entry restores the settled line via hydration GET", async () => {
    const calls: Call[] = [];
    installFetch({
      commitGet: () => ({ ok: true, commitment: commitment("self") }), // already committed
      livingGet: () => ({ ok: true, committed: true, response: view({ perspective: "You've kept returning, quietly." }) }),
    }, calls);
    const { container } = render(<BtyDailyAppShell locale="en" />);
    await waitFor(() => expect(container.querySelector("[data-living-response]")).not.toBeNull());
    expect(container.querySelector("[data-living-response]")!.textContent).toBe("You've kept returning, quietly.");
    // never played arrival (committed re-entry) → no three-door affordance surface
    expect(container.querySelectorAll("[data-aurora-wrapper]").length).toBe(0);
  });

  it("client PROVIDER ZERO-CALL: no generation endpoint is ever hit", async () => {
    const calls: Call[] = [];
    installFetch({ commitGet: () => ({ ok: true, commitment: commitment("self") }), livingGet: () => ({ ok: true, committed: true, response: view() }) }, calls);
    render(<BtyDailyAppShell locale="en" />);
    await waitFor(() => expect(calls.some((c) => c.url.includes("/api/me/today/living-response"))).toBe(true));
    const forbidden = /todayMirror|mirror\/generate|\/llm|generate-today|living-response\/generate/i;
    expect(calls.every((c) => !forbidden.test(c.url))).toBe(true);
  });
});

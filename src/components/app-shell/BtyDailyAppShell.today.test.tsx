/** @vitest-environment jsdom */
/**
 * Phase 3 Today wire + A/A+ ritual beat.
 *
 * Renders TodaySurface in isolation (NOT the whole shell) so the OrbLiving
 * canvas / rAF loop is never mounted. Asserts: fail-soft reads (today-intelligence +
 * open-promise), selection reveals the confirmation + CTA, the promise surface uses
 * action_text only (else the chosen-relationship fallback line), and no internal token
 * ever reaches output.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import BtyDailyAppShell, {
  COPY,
  FALLBACK_INTEL,
  TodaySurface,
  fetchOpenPromise,
  fetchTodayCenterKeep,
  fetchTodayIntelligence,
  fetchYesterdayMemory,
  greetingBand,
  pickGreeting,
  resolveActiveFocus,
  selectTodayStatus,
} from "@/components/app-shell/BtyDailyAppShell";
import type { TodayIntelligence } from "@/domain/daily/todayIntelligence";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// Internal tokens that must NEVER appear in user-facing output.
const INTERNAL_TOKENS = [
  "READ_ERROR",
  "YESTERDAY_EVIDENCE",
  "AXIS_UNKNOWN",
  "NO_AXIS_SIGNAL",
  "safe_fallback",
  "clean_start",
  "new_user",
  "pending_action",
  "missed_action",
  "verified_action",
  "scenario_signal",
  "returning_no_yesterday_activity",
  "CleanStart",
  "ContinuePending",
  "read_error",
  "no_evidence",
  "unknown_axis",
  "ai_unavailable",
  "confidence",
  "reasonCode",
  "fallbackMode",
  "coreXp",
  "weeklyXp",
  "pattern_family",
];

function renderToday(over: Partial<React.ComponentProps<typeof TodaySurface>> = {}) {
  return render(
    <TodaySurface
      copy={COPY.en.today}
      statusLine={selectTodayStatus("en", "safe_fallback")}
      activeFocus={null}
      loading={false}
      promiseText={null}
      centerKeepLine={null}
      {...over}
    />,
  );
}

describe("app-shell Today reads (fail-soft)", () => {
  it("fetchTodayIntelligence fails soft to FALLBACK_INTEL on HTTP error, with a [app-shell/today] warn", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));

    const out = await fetchTodayIntelligence();

    expect(out).toEqual(FALLBACK_INTEL);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("[app-shell/today]"),
      expect.anything(),
    );
  });

  it("fetchYesterdayMemory returns the remembered line, and null (fail-soft) on error/empty", async () => {
    // 200 with a memory line → the trimmed line is returned.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: true, memory: { line: "Yesterday, you chose to meet the world." } }), {
          status: 200,
        }),
      ),
    );
    expect(await fetchYesterdayMemory()).toBe("Yesterday, you chose to meet the world.");

    // 200 with memory:null (no yesterday evidence) → null (the existing trace stays unchanged).
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true, memory: null }), { status: 200 })),
    );
    expect(await fetchYesterdayMemory()).toBeNull();

    // HTTP error → null, fail-soft (never breaks Today's arrival).
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 503 })));
    expect(await fetchYesterdayMemory()).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[app-shell/today]"), expect.anything());
  });

  it("fetchOpenPromise returns action_text only, and null on HTTP error (with warn)", async () => {
    // 200 with a populated payload incl. banned fields → only action_text is read.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            open_action_contract: { action_text: "Ship the draft" },
            metrics: { coreXp: 999, weeklyXp: 5 },
            pattern_signatures: [{ pattern_family: "ownership" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    expect(await fetchOpenPromise("en")).toBe("Ship the draft");

    // No open contract → null.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ open_action_contract: null }), { status: 200 })),
    );
    expect(await fetchOpenPromise("en")).toBeNull();

    // HTTP error → null + warn.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    expect(await fetchOpenPromise("en")).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("[app-shell/today]"),
      expect.anything(),
    );
  });
});

describe("app-shell Today Center keep (STEP 1B — read-only surface)", () => {
  it("fetchTodayCenterKeep hits /api/bty/center/keep (never Arena), returns line only when keptToday", async () => {
    const calls: string[] = [];
    // keptToday true → returns the line.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(String(url));
        return new Response(
          JSON.stringify({ line: "Deeper relationship", keptToday: true }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }),
    );
    expect(await fetchTodayCenterKeep()).toBe("Deeper relationship");
    expect(calls.every((u) => u.includes("/api/bty/center/keep"))).toBe(true);
    // Center keep never routes through an Arena / action-contract endpoint.
    expect(calls.some((u) => /arena|action-contract/.test(u))).toBe(false);

    // keptToday false → null (nothing to surface).
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ line: "stale", keptToday: false }), { status: 200 })),
    );
    expect(await fetchTodayCenterKeep()).toBeNull();

    // HTTP error → null + [app-shell/today] warn (fail-soft).
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    expect(await fetchTodayCenterKeep()).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("[app-shell/today]"),
      expect.anything(),
    );
  });

  // THE HELD ARC V0.1 — production default is anchor-only: label + anchor, NO release line.
  it("Variant A (default): renders label + anchor after the relationship section, with the release line absent from the DOM", () => {
    renderToday({ centerKeepLine: "Deeper relationship" });
    const keep = document.querySelector("[data-today-center-keep]");
    expect(keep).toBeTruthy();
    expect(keep!.getAttribute("data-held-variant")).toBe("anchor-only");
    expect(screen.getByText("Held in Center")).toBeTruthy();
    expect(screen.getByText(/Deeper relationship/)).toBeTruthy();
    // The secondary release line is not rendered at all (not hidden, not reserved height).
    expect(screen.queryByText("Carry it quietly today.")).toBeNull();
    // The section holds exactly two lines: the label + the anchor (no empty secondary wrapper).
    expect(keep!.querySelectorAll("p").length).toBe(1);
    // Arrival sequence intact: greeting + status + doors still render alongside the keep.
    expect(document.querySelector("[data-today-status]")).toBeTruthy();
    expect(document.querySelectorAll("[data-focus]").length).toBe(3);
  });

  // Variant B is the comparison baseline — restorable in code (flip HELD_IN_CENTER_VARIANT).
  // Overriding the prop proves the approved copy still renders EXACTLY when B is selected.
  it("Variant B (baseline): renders the approved release line exactly when anchor-with-release is selected", () => {
    renderToday({ centerKeepLine: "Deeper relationship", heldVariant: "anchor-with-release" });
    const keep = document.querySelector("[data-today-center-keep]")!;
    expect(keep.getAttribute("data-held-variant")).toBe("anchor-with-release");
    expect(screen.getByText("Held in Center")).toBeTruthy();
    expect(screen.getByText(/Deeper relationship/)).toBeTruthy();
    // Approved copy, unchanged and exact.
    expect(screen.getByText("Carry it quietly today.")).toBeTruthy();
    expect(keep.querySelectorAll("p").length).toBe(2);
  });

  // THE HELD ARC V0 — read-only projection, quiet presence (not a quote card / not a widget).
  it("Held V0: anchor carries no quotation marks and the section is non-interactive (no CTA/icon/button)", () => {
    renderToday({ centerKeepLine: "Live as a child of God" });
    const keep = document.querySelector("[data-today-center-keep]")!;
    expect(keep.tagName.toLowerCase()).toBe("section"); // semantic grouping
    const anchor = keep.querySelector("[data-center-keep-line]")!;
    expect(anchor.textContent).toBe("Live as a child of God"); // exact — no wrapping quotes
    expect(anchor.textContent).not.toMatch(/["“”]/);
    // no interaction affordance anywhere in the held section
    expect(keep.querySelector("button, a, [role='button'], svg, img")).toBeNull();
    // not a card: no filled/rounded/border-box/shadow container classes on the section
    expect(keep.className).not.toMatch(/rounded|border|bg-|shadow/);
  });

  it("Held V0: does not expose the Dr. Chi name or any AI/companion framing", () => {
    renderToday({ centerKeepLine: "Live as a child of God" });
    const keep = document.querySelector("[data-today-center-keep]")!;
    expect(keep.textContent).not.toMatch(/Dr\.?\s*Chi|AI|companion|reflection/i);
  });

  it("renders nothing quietly when there is no keep for today", () => {
    renderToday({ centerKeepLine: null });
    expect(document.querySelector("[data-today-center-keep]")).toBeFalsy();
    // Arrival sequence unaffected.
    expect(document.querySelector("[data-today-status]")).toBeTruthy();
    expect(document.querySelectorAll("[data-focus]").length).toBe(3);
  });

  it("keeps the Center keep separate from the Arena promise (distinct labels, both can show)", () => {
    // A door is selected so the Arena promise (promiseText) is visible, plus a Center keep.
    renderToday({ activeFocus: "Self", promiseText: "Ship the draft", centerKeepLine: "Deeper relationship" });
    fireEvent.click(document.querySelector('[data-focus="Self"]')!);
    // Arena promise label + text (inside the chosen door).
    expect(screen.getByText(COPY.en.today.promiseLabel)).toBeTruthy();
    expect(screen.getByText("Ship the draft")).toBeTruthy();
    // Center keep label + line (its own section) — a different label, not conflated.
    expect(screen.getByText("Held in Center")).toBeTruthy();
    expect(screen.getByText(/Deeper relationship/)).toBeTruthy();
    expect(COPY.en.today.promiseLabel).not.toBe(COPY.en.today.centerKeep.label);
  });
});

describe("app-shell Today ritual beat (A / A+)", () => {
  it("shows NO confirmation/CTA until a relationship is selected, then reveals it", () => {
    renderToday();
    expect(screen.queryByText("I’ll live this relationship today")).toBeNull();
    expect(document.querySelector("[data-today-confirm]")).toBeNull();

    fireEvent.click(screen.getByText("SELF"));

    expect(screen.getByText("I’ll live this relationship today")).toBeTruthy();
    expect(document.querySelector("[data-today-confirm]")).not.toBeNull();
  });

  it("renders the 3-layer hierarchy in order: path label → selection → promise label → promise → CTA", () => {
    const { container } = renderToday({ promiseText: "Call my mentor before noon" });
    fireEvent.click(screen.getByText("SELF"));
    const text = container.querySelector("[data-today-confirm]")?.textContent ?? "";
    const iPath = text.indexOf("TODAY'S PATH");
    const iSelect = text.indexOf("Self — Return to yourself with honesty.");
    const iPromiseLabel = text.indexOf("PROMISE TO CARRY");
    const iPromise = text.indexOf("Call my mentor before noon");
    const iCta = text.indexOf("I’ll live this relationship today");
    expect(iPath).toBeGreaterThanOrEqual(0);
    expect(iPath).toBeLessThan(iSelect);
    expect(iSelect).toBeLessThan(iPromiseLabel);
    expect(iPromiseLabel).toBeLessThan(iPromise);
    expect(iPromise).toBeLessThan(iCta);
  });

  it("promise layers appear only with a promise; fallback keeps the selection line alone", () => {
    // With a promise → promise label + action_text present.
    renderToday({ promiseText: "Ship the draft" });
    fireEvent.click(screen.getByText("OTHERS"));
    expect(document.querySelector("[data-promise-label]")).not.toBeNull();
    expect(document.querySelector("[data-carry-line]")?.textContent).toBe("Ship the draft");
    cleanup();

    // No promise → promise label + carry line absent; the selection line stands as fallback.
    const { container } = renderToday({ promiseText: null });
    fireEvent.click(screen.getByText("SELF"));
    expect(container.querySelector("[data-promise-label]")).toBeNull();
    expect(container.querySelector("[data-carry-line]")).toBeNull();
    expect(container.querySelector("[data-select-line]")?.textContent).toBe(
      "Self — Return to yourself with honesty.",
    );
  });

  it("CTA reverses on press: strong pre-copy → settled post-copy + ✓, aria-pressed, no routing", () => {
    renderToday();
    fireEvent.click(screen.getByText("WORLD"));
    const cta = document.querySelector("[data-today-cta]") as HTMLButtonElement;
    expect(cta.getAttribute("aria-pressed")).toBe("false");
    expect(cta.textContent).toContain("I’ll live this relationship today");
    expect(cta.textContent).not.toContain("✓");

    fireEvent.click(cta);
    expect(cta.getAttribute("aria-pressed")).toBe("true");
    expect(cta.textContent).toContain("I’m living this relationship today");
    expect(cta.textContent).toContain("✓");
  });

  it("never leaks internal/raw tokens into the confirmation output (with a promise present)", () => {
    const { container } = renderToday({ promiseText: "Follow up with the team" });
    fireEvent.click(screen.getByText("SELF"));
    const text = container.textContent ?? "";
    for (const tok of INTERNAL_TOKENS) expect(text).not.toContain(tok);
  });

  it("resolveActiveFocus is a claim only when confidence !== none", () => {
    const claim: TodayIntelligence = {
      userState: "verified_action",
      relationshipFocus: "Self",
      confidence: "high",
      reasonCodes: ["YESTERDAY_EVIDENCE"],
      fallbackMode: "none",
    };
    expect(resolveActiveFocus(claim)).toBe("Self");
    expect(resolveActiveFocus({ ...claim, confidence: "none" })).toBeNull();
    expect(resolveActiveFocus({ ...claim, relationshipFocus: "ContinuePending" })).toBeNull();
  });
});

describe("app-shell Today Chosen Path Rest State (STEP 3, session-only)", () => {
  function confirmSelf(over: Partial<React.ComponentProps<typeof TodaySurface>> = {}) {
    renderToday(over);
    fireEvent.click(screen.getByText("SELF"));
    fireEvent.click(document.querySelector("[data-today-cta]") as HTMLButtonElement);
  }

  it("benediction REPLACES the select-line after confirm (EN, per-focus), ✓ mark + promise remain", () => {
    confirmSelf({ promiseText: "Call my mentor before noon" });
    // The select sentence is gone; the present-tense benediction stands in its place.
    expect(document.querySelector("[data-select-line]")?.textContent).toBe(
      "You have entered the relationship with yourself today.",
    );
    expect(screen.queryByText("Self — Return to yourself with honesty.")).toBeNull();
    // Promise (action_text) unchanged; ✓ settled mark remains.
    expect(document.querySelector("[data-carry-line]")?.textContent).toBe("Call my mentor before noon");
    const cta = document.querySelector("[data-today-cta]") as HTMLButtonElement;
    expect(cta.textContent).toContain("I’m living this relationship today");
    expect(cta.textContent).toContain("✓");
  });

  it("unselected doors collapse away (aria-hidden), not merely dimmed", () => {
    confirmSelf();
    // The two unselected doors are still in the DOM but inside an aria-hidden collapsed wrapper.
    expect(screen.getByText("OTHERS").closest("[aria-hidden]")).not.toBeNull();
    expect(screen.getByText("WORLD").closest("[aria-hidden]")).not.toBeNull();
    // The held door is NOT inside an aria-hidden wrapper.
    expect(screen.getByText("SELF").closest("[aria-hidden]")).toBeNull();
  });

  it("NO undo: tapping the held door after confirm does not re-open (benediction + ✓ persist)", () => {
    confirmSelf();
    fireEvent.click(screen.getByText("SELF"));
    expect(document.querySelector("[data-select-line]")?.textContent).toBe(
      "You have entered the relationship with yourself today.",
    );
    expect((document.querySelector("[data-today-cta]") as HTMLButtonElement).textContent).toContain("✓");
  });

  it("renders the KO benediction after confirm", () => {
    render(
      <TodaySurface
        copy={COPY.ko.today}
        statusLine={selectTodayStatus("ko", "safe_fallback")}
        activeFocus={null}
        loading={false}
        promiseText={null}
        centerKeepLine={null}
      />,
    );
    fireEvent.click(screen.getByText("이웃"));
    fireEvent.click(document.querySelector("[data-today-cta]") as HTMLButtonElement);
    expect(document.querySelector("[data-select-line]")?.textContent).toBe(
      "오늘 당신은 이웃과의 관계 안으로 들어갔습니다.",
    );
  });
});

describe("app-shell Today time-aware greeting (client-local, Arrival Warmth STEP 1)", () => {
  it("greetingBand maps local hours to bands at the boundaries", () => {
    expect(greetingBand(5)).toBe("morning");
    expect(greetingBand(11)).toBe("morning");
    expect(greetingBand(12)).toBe("afternoon");
    expect(greetingBand(16)).toBe("afternoon");
    expect(greetingBand(17)).toBe("evening");
    expect(greetingBand(22)).toBe("evening");
    expect(greetingBand(23)).toBe("lateNight");
    expect(greetingBand(0)).toBe("lateNight");
    expect(greetingBand(4)).toBe("lateNight");
  });

  it("pickGreeting returns the EN band copy (all four bands)", () => {
    const g = COPY.en.today.greetings;
    expect(pickGreeting(g, 9)).toBe("Good morning.");
    expect(pickGreeting(g, 14)).toBe("Good afternoon.");
    expect(pickGreeting(g, 20)).toBe("Good evening.");
    expect(pickGreeting(g, 2)).toBe("Still awake?");
  });

  it("pickGreeting returns KO band copy (non-morning bands)", () => {
    const g = COPY.ko.today.greetings;
    expect(pickGreeting(g, 14)).toBe("좋은 오후입니다.");
    expect(pickGreeting(g, 20)).toBe("좋은 저녁입니다.");
    expect(pickGreeting(g, 2)).toBe("아직 깨어 계시군요.");
  });

  it("TodaySurface resolves the local-time band after mount (evening → 'Good evening.')", async () => {
    // Fake ONLY Date so RTL's real-timer polling (findByText) still works.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 0, 1, 20, 0, 0)); // 20:00 local → evening
    renderToday();
    expect(await screen.findByText("Good evening.")).toBeTruthy();
    // The SSR/first-paint default greeting is replaced (no stale "Good morning.").
    expect(screen.queryByText("Good morning.")).toBeNull();
  });
});

describe("app-shell Today arrival header hierarchy (Arrival Warmth STEP 2)", () => {
  it("loading state reserves the status line SILENTLY — no pulse, no data-today-status yet", () => {
    const { container } = renderToday({ loading: true });
    expect(container.querySelector(".animate-pulse")).toBeNull();
    expect(container.querySelector("[data-today-status]")).toBeNull();
  });

  it("resolved status keeps data-today-status and renders the (unchanged) status copy", () => {
    renderToday({ loading: false, statusLine: selectTodayStatus("en", "verified_action") });
    const s = document.querySelector("[data-today-status]");
    expect(s).not.toBeNull();
    expect(s?.textContent).toBe("You followed through. Carry it into today.");
  });

  it("keeps the (unchanged) sub copy present under the greeting", () => {
    renderToday();
    expect(screen.getByText("Where will you show up today?")).toBeTruthy();
  });
});

// Yesterday → Today Memory Bridge V1 (+ Arrival Order Patch V1) — the evidence-backed remembered
// line PROMOTES the existing arrival trace (same slot, single line) and, once present, rides its own
// arrival beat WITHOUT waiting on the intel read. No evidence → the trace is byte-identical to before.
describe("app-shell Today yesterday memory (Memory Bridge V1 / Arrival Order Patch V1)", () => {
  it("renders the remembered line in the SAME trace slot when yesterday evidence exists", () => {
    renderToday({
      loading: false,
      yesterdayMemory: "Yesterday, you chose to return to yourself.",
      statusLine: selectTodayStatus("en", "safe_fallback"),
    });
    const s = document.querySelector("[data-today-status]");
    expect(s).not.toBeNull();
    // The memory occupies the trace slot (not a second trace) and carries the memory marker.
    expect(s?.textContent).toBe("Yesterday, you chose to return to yourself.");
    expect(s?.getAttribute("data-today-memory")).toBe("");
    // The generic status copy is NOT also shown.
    expect(document.body.textContent).not.toContain("Today is open. Choose the relationship you will live.");
    // Still exactly one trace line — no extra bordered card/panel introduced.
    expect(document.querySelectorAll("[data-today-status]").length).toBe(1);
  });

  it("shows the remembered line IMMEDIATELY even while intel is still loading (rides its own beat)", () => {
    // ARRIVAL ORDER PATCH V1: a present memory no longer waits on the intel read — it occupies the
    // trace beat right away, ahead of the doors, instead of appearing late after a separate fetch.
    renderToday({ loading: true, yesterdayMemory: "Yesterday, you chose to meet the world." });
    const s = document.querySelector("[data-today-status]");
    expect(s).not.toBeNull();
    expect(s?.textContent).toBe("Yesterday, you chose to meet the world.");
    expect(s?.getAttribute("data-today-memory")).toBe("");
  });

  it("renders the unchanged status line (no memory marker) when there is no yesterday evidence", () => {
    renderToday({
      loading: false,
      yesterdayMemory: null,
      statusLine: selectTodayStatus("en", "verified_action"),
    });
    const s = document.querySelector("[data-today-status]");
    expect(s?.textContent).toBe("You followed through. Carry it into today.");
    expect(s?.getAttribute("data-today-memory")).toBeNull();
  });

  it("still reserves the line height (no trace yet) while intel loads and there is NO memory", () => {
    // Unchanged for no-memory users: the status line waits for intel, reserving one line silently.
    const { container } = renderToday({ loading: true, yesterdayMemory: null });
    expect(container.querySelector("[data-today-status]")).toBeNull();
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });
});

describe("app-shell Today suggested-door transition-in (Arrival Warmth STEP 3)", () => {
  // The invited door's glow must lean in gently (700ms ease-out) and snap under reduced
  // motion — while the parent button stays crisp (300ms) for hover/press/active feedback.
  it("decorative glow spans use duration-700 ease-out + motion-reduce:transition-none", () => {
    const { container } = renderToday();
    const glowSpans = Array.from(container.querySelectorAll("span")).filter((s) =>
      s.className.includes("transition-opacity"),
    );
    // 3 doors × 2 decorative spans (seam + interior warmth).
    expect(glowSpans.length).toBe(6);
    for (const s of glowSpans) {
      expect(s.className).toContain("duration-700");
      expect(s.className).toContain("ease-out");
      expect(s.className).toContain("motion-reduce:transition-none");
      expect(s.className).not.toContain("duration-300");
    }
  });

  it("keeps the parent door button crisp (duration-300, not slowed)", () => {
    const { container } = renderToday();
    const buttons = Array.from(container.querySelectorAll("button[data-focus]"));
    expect(buttons.length).toBe(3);
    for (const b of buttons) {
      expect(b.className).toContain("duration-300");
      expect(b.className).toContain("active:scale-[0.99]");
      expect(b.className).not.toContain("duration-700");
    }
  });
});

// APP SHELL + TODAY SIMPLIFICATION V1: the whole shell renders greeting → TodayHome (the calm
// hierarchy: Better Than Yesterday header · measured yesterday · ONE primary action · attention ·
// Show everything). The detailed projections (TodayPersonalBrief) are collapsed by default and
// revealed only under "Show everything". The old relationship/commitment presentation stays gone.
describe("app-shell Today — simplified hierarchy (App Shell V1)", () => {
  type BriefDto = { yesterdayObservation: string; todaySuggestion: string } | null;
  function stubShellFetch(over: { brief?: BriefDto; reminders?: unknown[]; yesterdayReturned?: boolean } = {}) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes("/api/me/today/brief")) {
          return new Response(
            JSON.stringify({ ok: true, consent: !!over.brief, brief: over.brief ?? null, reminders: over.reminders ?? [] }),
            { status: 200 },
          );
        }
        if (u.includes("/api/me/daily-trace")) {
          // 7-day series; the second-to-last day is "yesterday".
          const y = over.yesterdayReturned ? 1 : 0;
          return new Response(JSON.stringify({ dailyTrace: [{ date: "d6", intensity: y }, { date: "d7", intensity: 1 }] }), { status: 200 });
        }
        return new Response("{}", { status: 200 });
      }),
    );
  }
  // Every retired presentation string that must never appear on the simplified Today.
  const OLD_TODAY_STRINGS = [
    "Return to myself",
    "TODAY'S PATH",
    "PROMISE TO CARRY",
    "I’m living this relationship today",
    "I’ll live this relationship today",
    "Yesterday left a trace worth noticing.",
    "Where will you show up today?",
  ];
  const aReminder = {
    stableId: "req:a1",
    category: "REQUIRED_LEARNING",
    title: "OSHA basics",
    state: "incomplete_required",
    canonicalDeepLink: "/en/app?tab=foundry",
  };

  it("greeting renders and comes BEFORE the Today hierarchy (greeting opens the screen)", async () => {
    stubShellFetch({ reminders: [aReminder] });
    const { container } = render(<BtyDailyAppShell locale="en" />);
    await screen.findByText("Learn"); // shell mounted (new tab label)
    const greeting = await waitFor(() => {
      const g = container.querySelector("[data-today-greeting]");
      expect(g).not.toBeNull();
      return g!;
    });
    const home = await screen.findByTestId("today-home");
    expect(greeting.compareDocumentPosition(home) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("the old relationship/commitment presentation is entirely absent (no doors, no legacy copy)", async () => {
    stubShellFetch({ reminders: [aReminder] });
    const { container } = render(<BtyDailyAppShell locale="en" />);
    await screen.findByText("Learn");
    await screen.findByTestId("today-home");
    expect(container.querySelectorAll("[data-focus]").length).toBe(0); // no relationship doors
    expect(container.querySelector("[data-today-confirm]")).toBeNull();
    expect(container.querySelector("[data-today-center-keep]")).toBeNull();
    expect(container.querySelector("[data-today-status]")).toBeNull(); // no yesterday-trace slot
    for (const s of OLD_TODAY_STRINGS) expect(container.textContent).not.toContain(s);
  });

  it("shows the Better Than Yesterday header + a yesterday summary in the first viewport", async () => {
    stubShellFetch({ reminders: [], yesterdayReturned: true });
    render(<BtyDailyAppShell locale="en" />);
    await screen.findByText("Learn");
    expect(await screen.findByTestId("today-header")).toBeTruthy();
    const yesterday = await screen.findByTestId("today-yesterday");
    await waitFor(() => expect(yesterday.textContent).toContain("You showed up yesterday."));
  });

  it("projects EXACTLY ONE primary action and routes it directly (deep link preserved)", async () => {
    stubShellFetch({
      reminders: [
        aReminder,
        { stableId: "rev:1", category: "ACTION_REVISION", title: "fix your action", state: "needs_revision", canonicalDeepLink: "/en/app?tab=today&fieldActionContract=abc" },
        { stableId: "act:1", category: "ACTION_DUE", title: "submit proof", state: "due_today", canonicalDeepLink: "/en/bty-arena" },
      ],
    });
    render(<BtyDailyAppShell locale="en" />);
    await screen.findByText("Learn");
    // Exactly one primary-action node — needs_revision wins (blocking correction). Wait for the
    // reminder kind to settle (the pre-fetch first paint shows the deterministic fallback CTA).
    await waitFor(() =>
      expect(screen.getByTestId("today-primary-action").getAttribute("data-kind")).toBe("reminder"),
    );
    const primaries = screen.getAllByTestId("today-primary-action");
    expect(primaries.length).toBe(1);
    expect(primaries[0].getAttribute("data-category")).toBe("ACTION_REVISION");
    expect(primaries[0].getAttribute("href")).toBe("/en/app?tab=today&fieldActionContract=abc");
    expect(primaries[0].textContent).toContain("fix your action");
  });

  it("collapses the detailed projections by default; Show everything reveals the full brief", async () => {
    stubShellFetch({ brief: { yesterdayObservation: "y", todaySuggestion: "t" }, reminders: [aReminder] });
    render(<BtyDailyAppShell locale="en" />);
    await screen.findByTestId("today-home");
    // Detailed brief NOT rendered on the first viewport.
    expect(screen.queryByTestId("today-personal-brief")).toBeNull();
    // Tapping "Show everything" reveals it (all detailed sections preserved).
    fireEvent.click(await screen.findByTestId("today-show-everything-toggle"));
    expect(await screen.findByTestId("today-personal-brief")).toBeTruthy();
  });

  it("no fabricated yesterday: a quiet yesterday reads as the calm invitation, never invented progress", async () => {
    stubShellFetch({ reminders: [], yesterdayReturned: false });
    render(<BtyDailyAppShell locale="en" />);
    await screen.findByText("Learn");
    const yesterday = await screen.findByTestId("today-yesterday");
    await waitFor(() => expect(yesterday.textContent).toContain("Yesterday was quiet."));
    expect(yesterday.textContent).not.toContain("You showed up yesterday.");
  });

  it("POSTs /api/me/day/open on native Today mount (device tz only, no client day-key)", async () => {
    stubShellFetch({ reminders: [] });
    render(<BtyDailyAppShell locale="en" />);
    await screen.findByText("Learn");
    await waitFor(() => {
      const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls as Array<[string, RequestInit?]>;
      expect(calls.some(([u]) => String(u).includes("/api/me/day/open"))).toBe(true);
    });
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls as Array<[string, RequestInit?]>;
    const dayOpen = calls.find(([u]) => String(u).includes("/api/me/day/open"))!;
    expect(dayOpen[1]?.method).toBe("POST");
    expect(Object.keys(JSON.parse(String(dayOpen[1]?.body ?? "{}")))).toEqual(["tz"]);
  });

  it("renders no 'Dr. Chi' companion line or avatar glyph", async () => {
    stubShellFetch({ reminders: [] });
    const { container } = render(<BtyDailyAppShell locale="en" />);
    await screen.findByText("Learn");
    expect(container.textContent).not.toContain("Dr. Chi");
    expect(container.textContent).not.toContain("치");
  });
});

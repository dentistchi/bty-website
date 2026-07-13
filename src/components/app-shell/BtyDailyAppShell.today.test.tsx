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
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import BtyDailyAppShell, {
  COPY,
  FALLBACK_INTEL,
  TodaySurface,
  fetchOpenPromise,
  fetchTodayCenterKeep,
  fetchTodayIntelligence,
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

  it("renders the held keep (label + quoted line + support) after the relationship section when present", () => {
    renderToday({ centerKeepLine: "Deeper relationship" });
    const keep = document.querySelector("[data-today-center-keep]");
    expect(keep).toBeTruthy();
    expect(screen.getByText("Held in Center")).toBeTruthy();
    expect(screen.getByText(/Deeper relationship/)).toBeTruthy();
    expect(screen.getByText("Carry it quietly today.")).toBeTruthy();
    // Arrival sequence intact: greeting + status + doors still render alongside the keep.
    expect(document.querySelector("[data-today-status]")).toBeTruthy();
    expect(document.querySelectorAll("[data-focus]").length).toBe(3);
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

describe("app-shell renders Today directly (no shell threshold / no double-door)", () => {
  function stubShellFetch(promise: string | null = null) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes("today-intelligence")) {
          return new Response(JSON.stringify(FALLBACK_INTEL), { status: 200 });
        }
        if (u.includes("my-page/state")) {
          return new Response(JSON.stringify({ open_action_contract: promise ? { action_text: promise } : null }), {
            status: 200,
          });
        }
        return new Response("{}", { status: 200 });
      }),
    );
  }

  it("shows Today (no 'Hold to begin' Orb threshold) on mount, with the bottom tabs", async () => {
    stubShellFetch();
    render(<BtyDailyAppShell locale="en" />);
    // Today surface is present immediately — no second threshold gate.
    // Anchor on the (time-independent) sub line so the assertion never depends on wall-clock.
    await screen.findByText("Where will you show up today?");
    expect(screen.queryByText("Hold to begin.")).toBeNull();
    expect(screen.queryByText("누르고 있으면 열립니다.")).toBeNull();
    // Native app shell intact: bottom tab bar renders.
    expect(screen.getByText("Foundry")).toBeTruthy();
    expect(screen.getByText("Me")).toBeTruthy();
  });

  it("relationship selection still reveals confirmation + CTA inside the full shell", async () => {
    stubShellFetch("Send the summary");
    render(<BtyDailyAppShell locale="en" />);
    // Anchor on the (time-independent) sub line so the assertion never depends on wall-clock.
    await screen.findByText("Where will you show up today?");
    // Select the Self relationship card (the ritual selection, not navigation).
    fireEvent.click(screen.getByText("SELF"));
    expect(document.querySelector("[data-today-confirm]")).not.toBeNull();
    expect(screen.getByText("I’ll live this relationship today")).toBeTruthy();
  });

  // Center Daily Trace STEP 1A — native Today arrival records a quiet self-return.
  it("POSTs /api/me/day/open on native Today mount, device tz only, no client day-key", async () => {
    stubShellFetch();
    render(<BtyDailyAppShell locale="en" />);
    await screen.findByText("Where will you show up today?");
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls as Array<[string, RequestInit?]>;
    const dayOpen = calls.find(([u]) => String(u).includes("/api/me/day/open"));
    expect(dayOpen).toBeTruthy();
    expect(dayOpen?.[1]?.method).toBe("POST");
    // The client sends ONLY the device tz for server-side capture — no day-key is computed here.
    const body = JSON.parse(String(dayOpen?.[1]?.body ?? "{}")) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(["tz"]);
  });

  it("self-return capture is fire-and-forget: a day/open failure never blocks Today", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes("/api/me/day/open")) throw new Error("network down");
        if (u.includes("today-intelligence")) {
          return new Response(JSON.stringify(FALLBACK_INTEL), { status: 200 });
        }
        return new Response("{}", { status: 200 });
      }),
    );
    render(<BtyDailyAppShell locale="en" />);
    // Today still renders despite the rejected self-return call.
    await screen.findByText("Where will you show up today?");
  });
});

describe("app-shell — no explicit AI companion announcement", () => {
  it("the shell renders no 'Dr. Chi is with you today.' companion line or avatar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes("today-intelligence")) return new Response(JSON.stringify(FALLBACK_INTEL), { status: 200 });
        return new Response("{}", { status: 200 });
      }),
    );
    const { container } = render(<BtyDailyAppShell locale="en" />);
    await screen.findByText("Where will you show up today?"); // shell mounted (all tabs share the bottom dock)
    expect(screen.queryByText("Dr. Chi is with you today.")).toBeNull();
    expect(container.textContent).not.toContain("Dr. Chi");
    expect(container.textContent).not.toContain("치"); // the removed avatar glyph
  });
});

/** @vitest-environment jsdom */
/**
 * Phase 3 Today wire + A/A+ ritual beat.
 *
 * Renders TodaySurface / CompanionBar in isolation (NOT the whole shell) so the OrbLiving
 * canvas / rAF loop is never mounted. Asserts: fail-soft reads (today-intelligence +
 * open-promise), selection reveals the confirmation + CTA, the promise surface uses
 * action_text only (else the chosen-relationship fallback line), no internal token ever
 * reaches output, and the companion bar is status-only with the pulse dot removed.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import BtyDailyAppShell, {
  COPY,
  CompanionBar,
  FALLBACK_INTEL,
  TodaySurface,
  fetchOpenPromise,
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

describe("app-shell Today ritual beat (A / A+)", () => {
  it("shows NO confirmation/CTA until a relationship is selected, then reveals it", () => {
    renderToday();
    expect(screen.queryByText("Carry this into today")).toBeNull();
    expect(document.querySelector("[data-today-confirm]")).toBeNull();

    fireEvent.click(screen.getByText("Self"));

    expect(screen.getByText("Carry this into today")).toBeTruthy();
    expect(document.querySelector("[data-today-confirm]")).not.toBeNull();
  });

  it("renders the 3-layer hierarchy in order: path label → selection → promise label → promise → CTA", () => {
    const { container } = renderToday({ promiseText: "Call my mentor before noon" });
    fireEvent.click(screen.getByText("Self"));
    const text = container.querySelector("[data-today-confirm]")?.textContent ?? "";
    const iPath = text.indexOf("TODAY'S PATH");
    const iSelect = text.indexOf("Self — Return to yourself with honesty.");
    const iPromiseLabel = text.indexOf("PROMISE TO CARRY");
    const iPromise = text.indexOf("Call my mentor before noon");
    const iCta = text.indexOf("Carry this into today");
    expect(iPath).toBeGreaterThanOrEqual(0);
    expect(iPath).toBeLessThan(iSelect);
    expect(iSelect).toBeLessThan(iPromiseLabel);
    expect(iPromiseLabel).toBeLessThan(iPromise);
    expect(iPromise).toBeLessThan(iCta);
  });

  it("promise layers appear only with a promise; fallback keeps the selection line alone", () => {
    // With a promise → promise label + action_text present.
    renderToday({ promiseText: "Ship the draft" });
    fireEvent.click(screen.getByText("Others"));
    expect(document.querySelector("[data-promise-label]")).not.toBeNull();
    expect(document.querySelector("[data-carry-line]")?.textContent).toBe("Ship the draft");
    cleanup();

    // No promise → promise label + carry line absent; the selection line stands as fallback.
    const { container } = renderToday({ promiseText: null });
    fireEvent.click(screen.getByText("Self"));
    expect(container.querySelector("[data-promise-label]")).toBeNull();
    expect(container.querySelector("[data-carry-line]")).toBeNull();
    expect(container.querySelector("[data-select-line]")?.textContent).toBe(
      "Self — Return to yourself with honesty.",
    );
  });

  it("CTA reverses on press: strong pre-copy → settled post-copy + ✓, aria-pressed, no routing", () => {
    renderToday();
    fireEvent.click(screen.getByText("World"));
    const cta = document.querySelector("[data-today-cta]") as HTMLButtonElement;
    expect(cta.getAttribute("aria-pressed")).toBe("false");
    expect(cta.textContent).toContain("Carry this into today");
    expect(cta.textContent).not.toContain("✓");

    fireEvent.click(cta);
    expect(cta.getAttribute("aria-pressed")).toBe("true");
    expect(cta.textContent).toContain("Carried into today");
    expect(cta.textContent).toContain("✓");
  });

  it("never leaks internal/raw tokens into the confirmation output (with a promise present)", () => {
    const { container } = renderToday({ promiseText: "Follow up with the team" });
    fireEvent.click(screen.getByText("Self"));
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
    fireEvent.click(screen.getByText("Self"));
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
    expect(cta.textContent).toContain("Carried into today");
    expect(cta.textContent).toContain("✓");
  });

  it("unselected doors collapse away (aria-hidden), not merely dimmed", () => {
    confirmSelf();
    // The two unselected doors are still in the DOM but inside an aria-hidden collapsed wrapper.
    expect(screen.getByText("Others").closest("[aria-hidden]")).not.toBeNull();
    expect(screen.getByText("World").closest("[aria-hidden]")).not.toBeNull();
    // The held door is NOT inside an aria-hidden wrapper.
    expect(screen.getByText("Self").closest("[aria-hidden]")).toBeNull();
  });

  it("NO undo: tapping the held door after confirm does not re-open (benediction + ✓ persist)", () => {
    confirmSelf();
    fireEvent.click(screen.getByText("Self"));
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
      />,
    );
    fireEvent.click(screen.getByText("이웃과의 관계"));
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
    expect(screen.getByText("Choose the relationship you will live today.")).toBeTruthy();
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
    await screen.findByText("Choose the relationship you will live today.");
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
    await screen.findByText("Choose the relationship you will live today.");
    // Select the Self relationship card (the ritual selection, not navigation).
    fireEvent.click(screen.getByText("Self"));
    expect(document.querySelector("[data-today-confirm]")).not.toBeNull();
    expect(screen.getByText("Carry this into today")).toBeTruthy();
  });
});

describe("app-shell companion bar (status-only)", () => {
  it("renders the approved status copy and has NO ambiguous pulse dot", () => {
    const { container } = render(<CompanionBar label={COPY.en.companion} />);
    expect(screen.getByText("Dr. Chi is with you today.")).toBeTruthy();
    // The removed pulse used the btyPulse keyframe + an inline animation style.
    expect(container.innerHTML).not.toContain("btyPulse");
    expect(container.innerHTML).not.toContain("animation");
  });

  it("carries the ko status copy too", () => {
    render(<CompanionBar label={COPY.ko.companion} />);
    expect(screen.getByText("Dr. Chi가 오늘 함께합니다.")).toBeTruthy();
  });
});

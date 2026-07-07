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
import {
  COPY,
  CompanionBar,
  FALLBACK_INTEL,
  TodaySurface,
  fetchOpenPromise,
  fetchTodayIntelligence,
  resolveActiveFocus,
  selectTodayStatus,
} from "@/components/app-shell/BtyDailyAppShell";
import type { TodayIntelligence } from "@/domain/daily/todayIntelligence";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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

  it("CTA settles the selection in-shell (aria-pressed) without routing", () => {
    renderToday();
    fireEvent.click(screen.getByText("Others"));
    const cta = document.querySelector("[data-today-cta]") as HTMLButtonElement;
    expect(cta.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(cta);
    expect(cta.getAttribute("aria-pressed")).toBe("true");
  });

  it("promise surface shows the user's action_text when present", () => {
    const { container } = renderToday({ promiseText: "Call my mentor before noon" });
    fireEvent.click(screen.getByText("Others"));
    const confirm = container.querySelector("[data-today-confirm]");
    expect(confirm?.textContent).toContain("Call my mentor before noon");
  });

  it("promise surface falls back to the chosen relationship line when there is no promise", () => {
    const { container } = renderToday({ promiseText: null });
    fireEvent.click(screen.getByText("Self"));
    const carry = container.querySelector("[data-carry-line]");
    expect(carry?.textContent).toBe("Return to yourself."); // Self's existing approved line
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

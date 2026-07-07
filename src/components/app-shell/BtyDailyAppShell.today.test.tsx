/** @vitest-environment jsdom */
/**
 * Phase 3 Today wire — fail-soft + no raw-token exposure.
 *
 * Renders TodaySurface in isolation (NOT the whole shell) so the OrbLiving canvas /
 * rAF loop is never mounted. Asserts (a) the fetch fails soft to FALLBACK_INTEL with a
 * developer warn, and (b) no internal token (confidence / reasonCodes / state literals)
 * ever reaches the rendered output.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  COPY,
  FALLBACK_INTEL,
  TodaySurface,
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
];

describe("app-shell Today wire", () => {
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

  it("fetchTodayIntelligence fails soft on a network throw", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    expect(await fetchTodayIntelligence()).toEqual(FALLBACK_INTEL);
  });

  it("renders the calm fallback status with NO card highlighted (confidence none)", () => {
    render(
      <TodaySurface
        copy={COPY.en.today}
        statusLine={selectTodayStatus("en", FALLBACK_INTEL.userState)}
        activeFocus={resolveActiveFocus(FALLBACK_INTEL)}
        loading={false}
        onChoose={() => {}}
      />,
    );
    expect(screen.getByText(selectTodayStatus("en", "safe_fallback"))).toBeTruthy();
    expect(document.querySelector('[aria-current="true"]')).toBeNull();
  });

  it("highlights the focus card only when confidence !== none", () => {
    const claim: TodayIntelligence = {
      userState: "verified_action",
      relationshipFocus: "Self",
      confidence: "high",
      reasonCodes: ["YESTERDAY_EVIDENCE"],
      fallbackMode: "none",
    };
    expect(resolveActiveFocus(claim)).toBe("Self");
    expect(resolveActiveFocus({ ...claim, confidence: "none" })).toBeNull();
    // Non-relationship focuses never highlight, even at high confidence.
    expect(resolveActiveFocus({ ...claim, relationshipFocus: "ContinuePending" })).toBeNull();

    render(
      <TodaySurface
        copy={COPY.en.today}
        statusLine={selectTodayStatus("en", claim.userState)}
        activeFocus={resolveActiveFocus(claim)}
        loading={false}
        onChoose={() => {}}
      />,
    );
    const active = document.querySelector('[aria-current="true"]');
    expect(active?.getAttribute("data-focus")).toBe("Self");
  });

  it("never leaks internal tokens into rendered output (both locales, populated claim)", () => {
    const claim: TodayIntelligence = {
      userState: "verified_action",
      relationshipFocus: "Self",
      confidence: "high",
      reasonCodes: ["YESTERDAY_EVIDENCE", "READ_ERROR"],
      fallbackMode: "read_error",
    };
    for (const loc of ["en", "ko"] as const) {
      const { container } = render(
        <TodaySurface
          copy={COPY[loc].today}
          statusLine={selectTodayStatus(loc, claim.userState)}
          activeFocus={resolveActiveFocus(claim)}
          loading={false}
          onChoose={() => {}}
        />,
      );
      const text = container.textContent ?? "";
      for (const tok of INTERNAL_TOKENS) expect(text).not.toContain(tok);
      cleanup();
    }
  });
});

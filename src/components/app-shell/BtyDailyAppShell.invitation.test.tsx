/** @vitest-environment jsdom */
/**
 * Invitation Strength Alignment STEP 1 — the invited-door visual authority (gold ring + "begin
 * here" heartbeat) is gated on MEDIUM/HIGH confidence. At NONE/LOW the three doors are equal; the
 * derived relationshipFocus is NOT mutated. User selection always wins and is unaffected.
 *
 * The invited-door cue is the `.btyHeart` pulse, applied only to the highlighted door before any
 * selection — so counting `.btyHeart` counts invited doors.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import {
  COPY,
  TodaySurface,
  isEvidenceStrongEnoughForInvitation,
  resolveActiveFocus,
  resolveInvitedFocus,
  selectTodayStatus,
  type TodayFocusKey,
} from "@/components/app-shell/BtyDailyAppShell";
import type { TodayConfidence, TodayIntelligence, TodayRelationshipFocus } from "@/domain/daily/todayIntelligence";

afterEach(cleanup);

function intel(confidence: TodayConfidence, relationshipFocus: TodayRelationshipFocus): TodayIntelligence {
  return { userState: "scenario_signal", relationshipFocus, confidence, reasonCodes: [], fallbackMode: "none" };
}
function renderToday(over: Partial<React.ComponentProps<typeof TodaySurface>> = {}) {
  return render(
    <TodaySurface copy={COPY.en.today} statusLine={selectTodayStatus("en", "scenario_signal")} activeFocus={null} loading={false} promiseText={null} centerKeepLine={null} {...over} />,
  );
}
const invitedCount = (c: HTMLElement) => c.querySelectorAll(".btyHeart").length;

describe("invitation-strength gate (pure)", () => {
  it("isEvidenceStrongEnoughForInvitation: none/low false, medium/high true", () => {
    expect(isEvidenceStrongEnoughForInvitation("none")).toBe(false);
    expect(isEvidenceStrongEnoughForInvitation("low")).toBe(false);
    expect(isEvidenceStrongEnoughForInvitation("medium")).toBe(true);
    expect(isEvidenceStrongEnoughForInvitation("high")).toBe(true);
  });

  it("resolveInvitedFocus gates NONE/LOW → null, MEDIUM/HIGH → focus, invalid focus → null", () => {
    expect(resolveInvitedFocus(intel("none", "Self"))).toBeNull();
    expect(resolveInvitedFocus(intel("low", "Others"))).toBeNull();
    expect(resolveInvitedFocus(intel("medium", "Others"))).toBe("Others");
    expect(resolveInvitedFocus(intel("high", "World"))).toBe("World");
    expect(resolveInvitedFocus(intel("high", "CleanStart"))).toBeNull(); // invalid focus, fail-soft
  });

  it("LOW does NOT mutate/erase relationshipFocus (still a claim via resolveActiveFocus)", () => {
    const low = intel("low", "Others");
    expect(resolveInvitedFocus(low)).toBeNull(); // no invitation
    expect(resolveActiveFocus(low)).toBe("Others"); // focus preserved in the model
    expect(low.relationshipFocus).toBe("Others"); // payload untouched
  });
});

describe("invited-door rendering follows the gate", () => {
  it("1. NONE + null focus → zero invited doors", () => {
    const { container } = renderToday({ activeFocus: resolveInvitedFocus(intel("none", "CleanStart")) });
    expect(container.querySelectorAll("[data-focus]").length).toBe(3);
    expect(invitedCount(container)).toBe(0);
  });

  it("2. LOW + valid focus → zero invited doors (three equal)", () => {
    const { container } = renderToday({ activeFocus: resolveInvitedFocus(intel("low", "Self")) });
    expect(invitedCount(container)).toBe(0);
  });

  it("3. MEDIUM + valid focus → exactly one invited door", () => {
    const { container } = renderToday({ activeFocus: resolveInvitedFocus(intel("medium", "Others")) });
    expect(invitedCount(container)).toBe(1);
  });

  it("4. HIGH + valid focus → exactly one invited door", () => {
    const { container } = renderToday({ activeFocus: resolveInvitedFocus(intel("high", "World")) });
    expect(invitedCount(container)).toBe(1);
  });

  it("5. MEDIUM/HIGH + missing/invalid focus → zero invited doors (fail-soft)", () => {
    const { container } = renderToday({ activeFocus: resolveInvitedFocus(intel("high", "ContinuePending")) });
    expect(invitedCount(container)).toBe(0);
  });

  it("8. loading (intel unresolved) → doors render immediately, zero invited (no flash)", () => {
    // Nonblocking arrival: doors are present from the first frame; the unresolved read is neutral
    // (FALLBACK confidence none → no invited focus), so no gold flash appears.
    const { container } = renderToday({ loading: true, activeFocus: resolveInvitedFocus(intel("none", "CleanStart")) });
    expect(container.querySelectorAll("[data-focus]").length).toBe(3);
    expect(invitedCount(container)).toBe(0);
  });
});

describe("user selection is independent of the gate", () => {
  it("6. LOW-confidence user selects a door → selected interior + CTA still work", () => {
    const { container } = renderToday({ activeFocus: resolveInvitedFocus(intel("low", "Self")) });
    expect(invitedCount(container)).toBe(0);
    fireEvent.click(container.querySelector('[data-focus="Self"]')!);
    expect(container.querySelector("[data-today-confirm]")).not.toBeNull();
    expect(container.querySelector("[data-today-cta]")).not.toBeNull();
    expect(container.querySelector('[data-focus="Self"]')!.getAttribute("aria-pressed")).toBe("true");
  });

  it("7. invited door (MEDIUM=Self) but user picks Others → user's choice wins", () => {
    const { container } = renderToday({ activeFocus: resolveInvitedFocus(intel("medium", "Self")) as TodayFocusKey });
    fireEvent.click(container.querySelector('[data-focus="Others"]')!);
    // Selected interior renders under Others, not the system-invited Self.
    const others = container.querySelector('[data-focus="Others"]')!;
    expect(others.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector('[data-focus="Self"]')!.getAttribute("aria-pressed")).toBe("false");
    // After selection the heartbeat is gone (selection settles the day).
    expect(invitedCount(container)).toBe(0);
  });
});

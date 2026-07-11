/** @vitest-environment jsdom */
/**
 * Intuitive Door Language + Living Selection Motion STEP 1.
 *
 * Action-first door hierarchy (ontology noun = quiet eyebrow, lived action = primary), the left-rail
 * artifact removed, the affordance replaced with an EQUAL full-door bloom, and a staged selected-
 * door content entrance. Internal focus keys + protected interior copy are unchanged.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { COPY, TodaySurface, resolveInvitedFocus, selectTodayStatus } from "@/components/app-shell/BtyDailyAppShell";
import type { TodayConfidence, TodayIntelligence, TodayRelationshipFocus } from "@/domain/daily/todayIntelligence";

afterEach(cleanup);

function intel(confidence: TodayConfidence, relationshipFocus: TodayRelationshipFocus): TodayIntelligence {
  return { userState: "scenario_signal", relationshipFocus, confidence, reasonCodes: [], fallbackMode: "none" };
}
function renderToday(over: Partial<React.ComponentProps<typeof TodaySurface>> = {}, locale: "en" | "ko" = "en") {
  return render(
    <TodaySurface copy={COPY[locale].today} statusLine={selectTodayStatus(locale, "scenario_signal")} activeFocus={null} loading={false} promiseText={null} centerKeepLine={null} firstArrival {...over} />,
  );
}

describe("meaning hierarchy (action-first)", () => {
  it("1. EN: action phrase is the primary label; ontology noun is the quiet eyebrow", () => {
    const { getByText } = renderToday();
    for (const action of ["Return to myself", "Be there for someone", "Move what matters forward"]) {
      const el = getByText(action);
      expect(el.className).toContain("text-lg"); // primary, strong
      expect(el.className).toContain("font-semibold");
    }
    for (const noun of ["SELF", "OTHERS", "WORLD"]) {
      const el = getByText(noun);
      expect(el.className).toContain("uppercase"); // quiet eyebrow
      expect(el.className).toContain("text-[0.7rem]");
      expect(el.className).not.toContain("text-lg"); // weaker than the action
    }
  });

  it("2. KO: action-first copy renders", () => {
    const { getByText } = renderToday({}, "ko");
    for (const action of ["나에게 돌아오기", "누군가의 곁에 서기", "중요한 일을 한 걸음 앞으로"]) expect(getByText(action).className).toContain("text-lg");
    for (const noun of ["나", "이웃", "세상"]) expect(getByText(noun).className).toContain("uppercase");
  });

  it("3/4. ontology nouns present as secondary labels; internal focus keys unchanged (Self/Others/World)", () => {
    const { container, getByText } = renderToday();
    expect(getByText("SELF")).toBeTruthy();
    const focusKeys = Array.from(container.querySelectorAll("[data-focus]")).map((n) => n.getAttribute("data-focus"));
    expect(focusKeys).toEqual(["Self", "Others", "World"]);
  });

  it("framing sub uses the new question copy (EN + KO)", () => {
    expect(renderToday().getByText("Where will you show up today?")).toBeTruthy();
    cleanup();
    expect(renderToday({}, "ko").getByText("오늘, 어디에 마음을 둘까요?")).toBeTruthy();
  });
});

describe("full-door bloom replaces the left rail", () => {
  it("7. no descending left-rail element remains (btySpine/btySpark)", () => {
    const { container } = renderToday({ activeFocus: resolveInvitedFocus(intel("high", "Self")) });
    expect(container.querySelectorAll(".btySpine, .btySpark").length).toBe(0);
  });

  it("5. all three affordance surfaces are equal FULL-DOOR blooms (inset-0, ring, radial bg, one class)", () => {
    const { container } = renderToday({ activeFocus: resolveInvitedFocus(intel("high", "Self")) });
    const spans = Array.from(container.querySelectorAll<HTMLElement>("[data-afford]"));
    expect(spans.length).toBe(3);
    for (const s of spans) {
      expect(s.className).toContain("btyAfford");
      expect(s.className).toContain("inset-0"); // full door, not a left seam
      expect(s.className).toContain("ring-inset"); // brief border warmth
      expect(s.style.background).toContain("radial-gradient"); // full-surface warmth, not left→right smear
      expect(s.className).not.toContain("bg-gradient-to-r"); // the old left-anchored smear is gone
    }
    // Identical class string across all three (equal intensity/duration/easing).
    expect(new Set(spans.map((s) => s.className)).size).toBe(1);
  });
});

describe("living selected-door transition", () => {
  it("11/13. selection opens immediately with staged content entrance (btySettle), CTA settles last", () => {
    const { container } = renderToday({ promiseText: "Ship the draft" });
    fireEvent.click(container.querySelector('[data-focus="Self"]')!);
    // Interior is present immediately (no artificial delay before responding to the tap).
    const interior = container.querySelector("[data-today-confirm]")!;
    expect(interior).not.toBeNull();
    expect(container.querySelector("[data-path-label]")!.className).toContain("btySettle");
    expect(container.querySelector("[data-carry-line]")!.textContent).toBe("Ship the draft"); // action_text verbatim
    const cta = container.querySelector<HTMLElement>("[data-today-cta]")!;
    expect(cta.className).toContain("btySettle");
    expect(cta.style.animationDelay).toBe("140ms"); // settles last
    // Confirmation still works.
    fireEvent.click(cta);
    expect(cta.getAttribute("aria-pressed")).toBe("true");
  });
});

/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { useRef, useCallback } from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { classifyRealityIntentReadiness } from "@/domain/foundry/module/reality-intent";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

/**
 * R4-R7A-R2 — the repair CTA has to actually take the Host somewhere.
 *
 * FOUNDER-OBSERVED: Review said what was missing, showed "Complete this part", and tapping it did
 * nothing. Not a broken handler — there was no control. It shipped as a styled `<span>`.
 *
 * These tests assert the OBSERVABLE transition (the authoring surface is revealed), never merely
 * that an `onClick` prop exists, because the prop's presence is what the defect looked like from
 * the source's point of view.
 */

const SHELL = join(process.cwd(), "src/components/foundry/event-rooms/ModuleBuilderShell.tsx");
const src = () => readFileSync(SHELL, "utf8");
const code = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const A = (o: Partial<BuilderAnswers>) => o as BuilderAnswers;

/**
 * The shipped wiring, reproduced exactly: a repair surface high on the page, the gap block far
 * below it, and the same handler the shell passes down.
 */
function ReviewHarness({ answers }: { answers: BuilderAnswers }) {
  const programAuthoringRef = useRef<HTMLElement | null>(null);
  const revealProgramAuthoring = useCallback(() => {
    programAuthoringRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, []);
  const realityIntent = classifyRealityIntentReadiness(answers, answers.realityGroundedJourneyV1);
  return (
    <div>
      <div data-testid="program-authoring">
        <section ref={programAuthoringRef} data-testid="program-authorship-entry">authoring surface</section>
      </div>
      {realityIntent.missing.length > 0 ? (
        <div data-testid="reality-intent-gap">
          {realityIntent.missing.includes("field_action") ? <p data-testid="reality-gap-field-action">fa</p> : null}
          {realityIntent.missing.includes("decision") ? <p data-testid="reality-gap-decision">d</p> : null}
          <button type="button" onClick={revealProgramAuthoring} data-testid="reality-gap-fix">
            Complete this part →
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** jsdom implements no scrolling; spy on the element method the browser would run. */
function spyScroll() {
  const fn = vi.fn();
  Element.prototype.scrollIntoView = fn as unknown as Element["scrollIntoView"];
  return fn;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("T1/T2/T3 — one tap reveals the authoring surface", () => {
  it("T1 — follow-up mismatch: tapping the CTA scrolls the existing surface into view", () => {
    const scroll = spyScroll();
    render(<ReviewHarness answers={A({ followUpDays: 7 })} />);
    expect(screen.getByTestId("reality-gap-field-action")).toBeTruthy();
    fireEvent.click(screen.getByTestId("reality-gap-fix"));
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.instances[0]).toBe(screen.getByTestId("program-authorship-entry"));
  });

  it("T2 — decision mismatch reaches the SAME authoring surface", () => {
    const scroll = spyScroll();
    render(<ReviewHarness answers={A({ learningNeeds: ["decide"], followUpDays: 0 })} />);
    expect(screen.getByTestId("reality-gap-decision")).toBeTruthy();
    fireEvent.click(screen.getByTestId("reality-gap-fix"));
    expect(scroll).toHaveBeenCalledTimes(1);
  });

  it("T3 — both missing: ONE CTA, one deterministic target", () => {
    const scroll = spyScroll();
    render(<ReviewHarness answers={A({ learningNeeds: ["decide"], followUpDays: 7 })} />);
    expect(screen.getAllByTestId("reality-gap-fix")).toHaveLength(1);
    fireEvent.click(screen.getByTestId("reality-gap-fix"));
    expect(scroll).toHaveBeenCalledTimes(1);
  });
});

describe("T4/T5 — incompleteness elsewhere must never disable the repair", () => {
  it("the control carries no disabled state at all", () => {
    render(<ReviewHarness answers={A({ followUpDays: 7 })} />);
    const btn = screen.getByTestId("reality-gap-fix") as HTMLButtonElement;
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.disabled).toBe(false);
    expect(btn.getAttribute("aria-disabled")).toBeNull();
  });

  it("T4/T5 — the shipped element is never given `disabled`, and sits outside any disabled container", () => {
    const c = code(src());
    const at = c.indexOf('data-testid="reality-gap-fix"');
    const block = c.slice(Math.max(0, at - 400), at + 260);
    expect(block).toContain("<button");
    expect(block).toContain("onClick={onRepairReality}");
    expect(block).not.toMatch(/disabled|pointer-events-none|aria-disabled/);
  });
});

describe("T6/T7 — the CTA exists only while a gap does", () => {
  it("T6 — knowledge-only renders no gap and no repair control", () => {
    render(<ReviewHarness answers={A({ learningNeeds: ["know", "shared_standard"], followUpDays: 0 })} />);
    expect(screen.queryByTestId("reality-intent-gap")).toBeNull();
    expect(screen.queryByTestId("reality-gap-fix")).toBeNull();
  });

  it("T7 — once repaired, warning and CTA both disappear", () => {
    const journey = {
      displayTitle: "t",
      elements: [
        { id: "e", kind: "field_application", content: "Ask the next patient to say it back", grounding: [], confirmationStatus: "grounded" },
      ],
    } as unknown as BuilderAnswers["realityGroundedJourneyV1"];
    render(<ReviewHarness answers={A({ followUpDays: 7, realityGroundedJourneyV1: journey })} />);
    expect(screen.queryByTestId("reality-intent-gap")).toBeNull();
  });
});

describe("T8 — the shipped wiring, and mobile reachability", () => {
  it("the shell attaches the ref to the surface and passes ONE handler down", () => {
    const c = code(src());
    /*
      The ref sits on ProgramAuthorship's OWN section, not on the `lg:col-span-2` wrapper —
      `managerResponsiveLayout` pins those wrappers as layout-only, and it caught the first
      attempt at this fix.
    */
    expect(c).toContain("sectionRef={programAuthoringRef}");
    expect(c).toContain("const programAuthoringRef = useRef<HTMLElement | null>(null);");
    const auth = readFileSync(join(process.cwd(), "src/components/foundry/event-rooms/ProgramAuthorship.tsx"), "utf8");
    expect(auth).toContain('<section ref={sectionRef}');
    expect(auth).toContain('data-testid="program-authorship-entry"');
    expect(c).toContain("programAuthoringRef.current?.scrollIntoView?.({ behavior: \"smooth\", block: \"start\" });");
    expect(c).toContain("onRepairReality={revealProgramAuthoring}");
  });

  it("T8 — it scrolls rather than assuming visibility, which is what failed on the phone", () => {
    // `block: "start"` brings the surface to the top of a narrow viewport; the surface sits far
    // above the publish panel, which is why a state-only change would still have looked inert.
    const c = code(src());
    expect(c).toMatch(/scrollIntoView\?\.\(\{ behavior: "smooth", block: "start" \}\)/);
  });

  it("the optional-call form survives environments without scrollIntoView", () => {
    render(<ReviewHarness answers={A({ followUpDays: 7 })} />);
    // No spy installed: jsdom has no implementation, and the click must still not throw.
    const original = Element.prototype.scrollIntoView;
    // @ts-expect-error deliberately removing the method
    delete Element.prototype.scrollIntoView;
    expect(() => fireEvent.click(screen.getByTestId("reality-gap-fix"))).not.toThrow();
    Element.prototype.scrollIntoView = original;
  });
});

describe("T9–T12 — containment", () => {
  it("T9 — no internal vocabulary was added to Host copy", () => {
    const copy = readFileSync(join(process.cwd(), "src/components/foundry/event-rooms/moduleBuilderCopy.ts"), "utf8");
    const mine = [...copy.matchAll(/reality(?:Missing\w+|FixCta): ?\n?\s*"((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1] ?? "");
    expect(mine.length).toBe(6);
    expect(mine.filter((v) => /journey|grounded|field_application|action_decision|여정/i.test(v))).toEqual([]);
    expect(copy).toContain('realityFixCta: "Complete this part"');
    expect(copy).toContain('realityFixCta: "이 부분 완성하기"');
  });

  it("T10/T11 — the classifier and the publish rule are untouched", () => {
    const rule = readFileSync(join(process.cwd(), "src/domain/foundry/module/reality-intent.ts"), "utf8");
    expect(rule).toContain("export function classifyRealityIntentReadiness(");
    const pub = readFileSync(join(process.cwd(), "src/lib/bty/foundry/events/foundryPublishService.ts"), "utf8");
    expect(pub).toContain('return { ok: false, reason: "field_action_missing" }');
    expect(pub).toContain('return { ok: false, reason: "decision_missing" }');
    expect(code(pub)).not.toMatch(/scrollIntoView|onRepairReality/);
  });

  it("T12 — no second authoring surface was created", () => {
    const c = code(src());
    expect((c.match(/<ProgramAuthorship/g) ?? []).length).toBe(1);
    expect(c).not.toMatch(/Create Journey|Configure Reality|Advanced settings/i);
  });
});

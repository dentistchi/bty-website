/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { useState } from "react";
import { ManagerCanvas } from "./ManagerCanvas";
import { TrainingOutcomeBody } from "./FoundryTrainingOutcome";
import { FoundryParticipantRoster } from "./FoundryParticipantRoster";
import { EVENT_ROOMS_COPY } from "./copy";
import type { ManagerOutcome, ManagerParticipant } from "./types";

/**
 * R4-R4B — THE MANAGER SURFACES ADAPT TO THE SCREEN THEY ARE ON.
 *
 * A real Manager asked whether they could use this on a computer. Measured answer before this
 * slice: the repo carried 258 Tailwind breakpoints and NOT ONE was in a Foundry Manager surface,
 * while the app shell's scroll container (`px-5`, no max-width) let every one of them stretch the
 * full width of the display. A Builder question and its help text ran ~220 characters a line.
 *
 * These are STRUCTURE assertions, not pixels. jsdom does not evaluate Tailwind, so a screenshot
 * test here would prove nothing and break on every visual tweak; what is worth pinning is that the
 * responsive intent EXISTS, that the phone structure survives it, and that the one layout with a
 * semantic obligation — the evidence levels — cannot be flattened into a single number.
 */

afterEach(cleanup);

const t = EVENT_ROOMS_COPY.en;
const SRC = (f: string) => readFileSync(join(process.cwd(), "src/components/foundry/event-rooms", f), "utf8");

/* ------------------------------------------------------------------ 1 / 3 */

describe("R4-R4B · 1/3 · Manager surfaces carry responsive intent", () => {
  const SURFACES = [
    "ModuleBuilderShell.tsx",
    "FoundryEventControlRoom.tsx",
    "FoundryTrainingOutcome.tsx",
    "FilesAndDocuments.tsx",
    "FoundryParticipantRoster.tsx",
  ];

  it("every surface in scope now adapts, directly or through the shared canvas", () => {
    for (const f of SURFACES) {
      const src = SRC(f);
      const hasBreakpoint = /\b(sm|md|lg|xl):[a-z-]/.test(src);
      const usesCanvas = src.includes("ManagerCanvas");
      expect(hasBreakpoint || usesCanvas, `${f} has no responsive intent`).toBe(true);
    }
  });

  it("3 — the Builder is no longer bound to a phone-width measure on Review", () => {
    // Review is a work surface and takes the wide canvas; a question keeps a reading measure.
    expect(SRC("ModuleBuilderShell.tsx")).toContain('width={isReview ? "wide" : "measure"}');
  });

  it("the canvas widths grow by breakpoint, and the reading measure deliberately does not", () => {
    const src = SRC("ManagerCanvas.tsx");
    expect(src).toMatch(/measure:\s*"max-w-\[34rem\]"/); // no breakpoints: prose stops benefiting
    expect(src).toMatch(/wide:[\s\S]*md:max-w-[\s\S]*lg:max-w-/);
    expect(src).toMatch(/workspace:[\s\S]*md:max-w-[\s\S]*lg:max-w-[\s\S]*xl:max-w-/);
  });
});

/* -------------------------------------------------------------------- 2 */

describe("R4-R4B · 2 · the phone structure survives", () => {
  it("every canvas is a single centred column before the first breakpoint", () => {
    const { container } = render(
      <ManagerCanvas width="workspace">
        <p>x</p>
      </ManagerCanvas>,
    );
    const el = container.querySelector("[data-manager-canvas]")!;
    expect(el.className).toContain("mx-auto");
    expect(el.className).toContain("w-full");
    // The base (phone) width is unconditional; the growth is all breakpoint-prefixed.
    expect(el.className).toContain("max-w-[34rem]");
  });

  it("the roster is a one-column list on a phone and only reflows later", () => {
    const src = SRC("FoundryParticipantRoster.tsx");
    expect(src).toContain("grid-cols-1");
    expect(src).toMatch(/md:grid-cols-2/);
    expect(src).toMatch(/lg:grid-cols-3/);
  });

  it("the roster still renders each participant as one row, unchanged", () => {
    const participants: ManagerParticipant[] = [
      { id: "p1", display_name: "Hojin", joined_at: "2026-08-01T00:00:00Z", training_status: "complete" },
      { id: "p2", display_name: "Aileen", joined_at: "2026-08-01T00:00:00Z", training_status: "joined" },
    ];
    render(
      <FoundryParticipantRoster participants={participants} eventOpen onRemove={() => {}} removingId={null} t={t} />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Hojin")).toBeTruthy();
    expect(screen.getByText("Aileen")).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ 5 / 6 */

describe("R4-R4B · 5/6 · document work and the roster get the room they need", () => {
  it("5 — PDF setup takes the widest canvas of any Manager surface", () => {
    expect(SRC("FilesAndDocuments.tsx")).toContain('width="workspace"');
  });

  it("6 — the Control Room takes the wide canvas", () => {
    expect(SRC("FoundryEventControlRoom.tsx")).toContain('width="wide"');
  });
});

/* ------------------------------------------------- R1 · Review scan layout */

describe("R4-R4B-R1 · Review scans in two columns without two columns of prose", () => {
  const SRC_B = SRC("ModuleBuilderShell.tsx");

  it("1/2 — the eight answers are ONE column on mobile and TWO from lg", () => {
    // The rows section is what a Host actually reads on Review.
    expect(SRC_B).toMatch(/data-testid="review-answers"/);
    const section = SRC_B.slice(SRC_B.indexOf('className="grid grid-cols-1 gap-2 lg:grid-cols-2'));
    expect(section.slice(0, 80)).toContain("grid-cols-1");
    expect(section.slice(0, 80)).toContain("lg:grid-cols-2");
    // Deliberately NOT md: a second column at 768px would be ~40ch and worse than one.
    expect(section.slice(0, 80)).not.toContain("md:grid-cols-2");
  });

  it("2 — the Review body itself becomes a two-column scan grid at lg", () => {
    expect(SRC_B).toMatch(/data-testid="review-scan-grid"/);
    const grid = SRC_B.slice(SRC_B.indexOf('data-testid="review-scan-grid"') - 120, SRC_B.indexOf('data-testid="review-scan-grid"'));
    expect(grid).toContain("lg:grid");
    expect(grid).toContain("lg:grid-cols-2");
    expect(grid).toContain("lg:items-start"); // a short card must not stretch to a tall neighbour
  });

  it("3 — narrative sections and the details block span both columns", () => {
    // ProgramAuthorship, the learner preview and AllTrainingDetails are reading surfaces:
    // side by side they would recreate the comparison problem this change removes.
    const spans = SRC_B.match(/lg:col-span-2/g) ?? [];
    expect(spans.length).toBeGreaterThanOrEqual(4);
    const at = SRC_B.indexOf("<AllTrainingDetails");
    expect(SRC_B.slice(Math.max(0, at - 120), at)).toContain("lg:col-span-2");
  });

  it("4 — Publish stays singular and spans the full width, never a column", () => {
    const i = SRC_B.indexOf("<PublishAction");
    expect(SRC_B.slice(Math.max(0, i - 160), i)).toContain("lg:col-span-2");
  });

  it("5 — nothing was added, removed or reordered: the same components in the same order", () => {
    const order = ["<ProgramAuthorship", "<JourneyPreview", "<MaterialReviewPanel", "<AllTrainingDetails", "<ParticipationModeChooser", "<PublishAction"];
    let cursor = SRC_B.indexOf("isReview ? (");
    expect(cursor).toBeGreaterThan(-1);
    for (const c of order) {
      const at = SRC_B.indexOf(c, cursor);
      expect(at, `${c} missing or out of order`).toBeGreaterThan(cursor);
      cursor = at;
    }
  });

  it("the wrappers are layout-only — no prop, handler or condition was introduced", () => {
    // Every wrapper this slice added carries a className and, at most, a data-testid.
    for (const m of SRC_B.matchAll(/<div className="lg:(grid|col-span-2)[^"]*"([^>]*)>/g)) {
      expect(m[2].trim().replace(/data-testid="[^"]*"/, "").trim()).toBe("");
    }
  });
});

/* -------------------------------------------------------------------- 7 */

const FU = {
  configured: true as boolean, days: 7 as 7 | 30 | null,
  applied: 2, partlyApplied: 1, notYet: 0, blocked: 0, waiting: 1, overdue: 0, total: 4, answered: 3,
};
function outcome(over: Partial<ManagerOutcome> = {}): ManagerOutcome {
  return {
    participation: { joined: 4, completed: 4, followUpReachable: 4, followUpNotConnected: 0 },
    followUp: { ...FU },
    observation: { confirmed: 1, notEstablished: 1, couldntTell: 1, total: 3 },
    applicationJourney: "action_decision",
    decisionCount: 0,
    reading: "confirmed",
    decisions: [],
    ...over,
  };
}
function Body() {
  const [open, setOpen] = useState(false);
  return <TrainingOutcomeBody outcome={outcome()} t={t} openDecisions={open} setOpenDecisions={setOpen} />;
}

describe("R4-R4B · 7 · the evidence levels may share a row but never a number", () => {
  it("the two REPORTED levels sit in a grid that is one column until lg", () => {
    render(<Body />);
    const grid = screen.getByTestId("outcome-evidence-grid");
    expect(grid.className).toContain("grid-cols-1");
    expect(grid.className).toContain("lg:grid-cols-2");
  });

  it("each level keeps its own heading, its own block, and a visible rule between them", () => {
    render(<Body />);
    const after = screen.getByTestId("outcome-after");
    const observed = screen.getByTestId("outcome-observed");
    expect(after.textContent).toContain("After the training");
    expect(observed.textContent).toContain("Observed by someone else");
    // Neither block contains the other: they are siblings, not a merged panel.
    expect(after.contains(observed)).toBe(false);
    // The separator survives the reflow — a rule above on phone, a rule to the left on desktop.
    expect(observed.className).toMatch(/lg:border-l/);
  });

  it("Completed stays above and full width — it is a different KIND of fact", () => {
    render(<Body />);
    const completed = screen.getByTestId("outcome-completed");
    const grid = screen.getByTestId("outcome-evidence-grid");
    expect(grid.contains(completed)).toBe(false);
  });

  it("no combined score exists anywhere in the rendered surface", () => {
    render(<Body />);
    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(/success rate|score|overall|%/i);
    // The three levels are still three separate readable counts.
    expect(screen.getByTestId("outcome-after").textContent).toContain("Applied");
    expect(screen.getByTestId("outcome-observed").textContent).toContain("Confirmed");
  });
});

/* ------------------------------------------------------------- 8 / 9 / 10 */

describe("R4-R4B · 8/9/10 · nothing else moved", () => {
  it("8 — the outcome surface still has exactly one disclosure control, not competing CTAs", () => {
    render(
      <TrainingOutcomeBody
        outcome={outcome({ decisionCount: 2, decisions: ["a", "b"] })}
        t={t}
        openDecisions={false}
        setOpenDecisions={() => {}}
      />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("9 — EN and KO copy are untouched by this slice", () => {
    // A layout slice must not edit a single user-facing string.
    expect(t.outcomeAfterHeading).toBe("After the training");
    expect(t.outcomeObservedHeading).toBe("Observed by someone else");
    expect(EVENT_ROOMS_COPY.ko.outcomeAfterHeading).toBeTruthy();
    for (const k of Object.keys(t).filter((x) => x.startsWith("outcome"))) {
      expect(EVENT_ROOMS_COPY.ko, `ko missing ${k}`).toHaveProperty(k);
    }
  });

  it("10/12 — the canvas is presentational: no state, no fetch, no write", () => {
    const src = SRC("ManagerCanvas.tsx");
    for (const forbidden of ["useState", "useEffect", "fetch(", "supabase", ".insert", ".update", ".rpc"]) {
      expect(src).not.toContain(forbidden);
    }
  });

  it("11 — no learner room was touched by this slice", () => {
    /*
      A real scope check, not a string search. The first version of this asserted the canvas source
      did not contain "/f/" — which matched the comment explaining what the learner rooms are, so
      it was testing prose. The honest question is whether any learner client CHANGED, and git is
      the only thing that can answer it.
    */
    /*
      RE-ANCHORED TO THE SLICE'S OWN COMMIT (R4-R5B1).

      This read `git diff --name-only HEAD` — the UNCOMMITTED working tree — which gives the
      assertion two failure modes it should never have had:

        · On a clean tree it returns the empty string and passes VACUOUSLY. At the moment R4-R4B
          closed, this proved nothing at all.
        · On any later branch it returns THAT branch's work in progress, so an unrelated future
          slice legitimately touching a learner room fails a test about Manager layout. R4-R5B1
          (assignment completion truth) is the first slice to hit it.

      `1aa3d307` IS R4-R4B, the slice this file is named for. Its diff is seven files, all under
      `src/components/foundry/event-rooms/`, so the assertion below now iterates a real, non-empty
      list and genuinely proves what it claims. This is the same repair R4-R5A applied to
      `legacyPortalContainment.test.ts` T6/T6b for the identical reason.
    */
    const SLICE_COMMIT = "1aa3d30784fa395a88f003c688379c15ea4e2183";
    const all = execSync(`git show --pretty=format: --name-only ${SLICE_COMMIT}`, { encoding: "utf8" })
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    expect(all.length, "the slice commit's diff must be non-empty, or this proves nothing").toBeGreaterThan(0);
    const changed = all.filter((f) => f.startsWith("src/app/f")).join("\n");
    expect(changed, `learner rooms modified:\n${changed}`).toBe("");
  });
});

/* --------------------------------------------------------------------- G */

describe("R4-R4B · G · desktop must not cost clarity", () => {
  it("the canvas adds width only — no font, colour or spacing override", () => {
    const { container } = render(<ManagerCanvas width="wide"><p>x</p></ManagerCanvas>);
    const cls = container.querySelector("[data-manager-canvas]")!.className;
    expect(cls).not.toMatch(/\btext-(xs|sm)\b/);
    expect(cls).not.toMatch(/\bopacity-/);
    expect(cls).not.toMatch(/\bgap-/); // spacing stays the caller's decision
  });

  it("a caller's own classes survive the canvas", () => {
    const { container } = render(
      <ManagerCanvas width="measure" className="btyFadeIn flex flex-col gap-6"><p>x</p></ManagerCanvas>,
    );
    const cls = container.querySelector("[data-manager-canvas]")!.className;
    expect(cls).toContain("btyFadeIn");
    expect(cls).toContain("flex flex-col gap-6");
  });
});

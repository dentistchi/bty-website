/** @vitest-environment jsdom */
/**
 * Practice — the learner mount must give the player a page to be read on (Slice R4-R5A, Repair B).
 *
 * `ArenaPracticePlayer` is a LIGHT-surface component: its prose is `text-bty-navy`
 * (= `--bty-brand-navy` = #0B1F3A) and its choice cards are `bg-white`. `BtyDailyAppShell` paints
 * `bg-[#0B1F3A]`. Mounted bare, the scenario title, the section headings ("Your choice" / "It gets
 * harder" / "Decide"), the escalation narrative, the decision question, the completion screen and
 * the "From: <training>" line all rendered at 1.00:1 — while the white choice cards stayed
 * readable. The learner saw answers with no question.
 *
 * The Host mount (`ArenaPracticeFlow`, "Test in Arena") already wraps the SAME component in a
 * `bty-soft` surface. This file locks the learner mount to the same treatment, and to the one
 * measured difference: NO ALPHA (see the contrast test at the bottom — 40% of that token over this
 * shell leaves four of the six dimmed tokens below 3:1).
 *
 * Two things are asserted, and deliberately only two:
 *   1. STRUCTURE — every learner-facing text surface, at every phase, renders INSIDE the light
 *      container. Browser contrast is not observable in jsdom; containment is, and it is the
 *      property the repair actually establishes. Final visual confirmation is the Founder device gate.
 *   2. BEHAVIOUR UNCHANGED — phase progression, choices, the completion POST and its payload.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ArenaRoom } from "./ArenaRoom";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const PRACTICE_ID = "p-1";
const RUN_ID = "run-77";
const TRAINING = "Closing the Handover Gap";

function scenario(): ArenaScenarioDraft {
  return {
    title: "Handoff under pressure",
    opening: "A shift change happens during a busy period.",
    primary: {
      choices: [
        { id: "p1", label: "Pause and confirm the critical details" },
        { id: "p2", label: "Proceed to keep things moving" },
      ],
    },
    tradeoff: {
      escalationText: "Now a second urgent task lands while the handover is half done.",
      choices: [
        { id: "t1", label: "Escalate to the lead" },
        { id: "t2", label: "Handle it yourself" },
      ],
    },
    actionDecision: {
      prompt: "What will you do right now?",
      choices: [
        { id: "a1", label: "Record the owner and next check time", isActionCommitment: true },
        { id: "a2", label: "Wait until the rush is over", isActionCommitment: false },
      ],
    },
  };
}

const calls: Array<{ url: string; method: string; body: string | null }> = [];

function stubFetch() {
  calls.length = 0;
  const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      calls.push({ url: u, method: (init?.method ?? "GET").toUpperCase(), body: (init?.body as string) ?? null });
      if (u.endsWith("/start")) return json({ run_id: RUN_ID });
      if (u.endsWith("/complete")) return json({ ok: true });
      if (u.includes(`/api/arena/practice/${PRACTICE_ID}`)) {
        return json({
          practice: {
            id: PRACTICE_ID,
            practice_title: "Handover practice",
            source_training_title: TRAINING,
            source_module_version: 1,
            scenario: scenario(),
          },
        });
      }
      if (u.includes("/api/arena/practice")) {
        return json({
          practices: [
            { id: PRACTICE_ID, practice_title: "Handover practice", source_training_title: TRAINING, completed: false },
          ],
        });
      }
      return json({});
    }),
  );
}

/** Mount Practice and get into the player, exactly as the learner does. */
async function enterPlayer() {
  stubFetch();
  const utils = render(<ArenaRoom locale="en" lockedTag="tag" lockedBody="body" />);
  fireEvent.click(await screen.findByText("Start practice"));
  const surface = await screen.findByTestId("practice-player-surface");
  return { ...utils, surface };
}

/** The light container the player is mounted on. */
const surfaceEl = () => screen.getByTestId("practice-player-surface");

describe("G5 — the learner player is mounted on a readable light surface", () => {
  it("wraps the player in an OPAQUE bty-soft container (the Host token, without its alpha)", async () => {
    const { surface } = await enterPlayer();
    const cls = surface.getAttribute("class") ?? "";
    expect(cls).toContain("bg-bty-soft");
    // The measured failure mode: any alpha on this token drops the dimmed prose below 3:1.
    expect(cls).not.toMatch(/bg-bty-soft\/\d/);
    expect(cls).toContain("rounded-2xl");
  });

  it("the scenario title and opening context render INSIDE the light surface", async () => {
    await enterPlayer();
    const s = surfaceEl();
    expect(s.textContent).toContain("Handoff under pressure");
    expect(s.textContent).toContain("A shift change happens during a busy period.");
    // Containment, not mere presence: the text must not be a sibling on the navy shell.
    expect(s.contains(screen.getByText("Handoff under pressure"))).toBe(true);
  });

  it("the source-training line renders inside the light surface", async () => {
    await enterPlayer();
    expect(surfaceEl().textContent).toContain(TRAINING);
  });

  it("the PRIMARY heading and choices render inside the light surface", async () => {
    await enterPlayer();
    fireEvent.click(screen.getByText("Begin"));
    const s = surfaceEl();
    expect(s.textContent).toContain("Your choice");
    expect(s.contains(screen.getByText("Pause and confirm the critical details"))).toBe(true);
  });

  it("the ESCALATION narrative and its heading render inside the light surface", async () => {
    await enterPlayer();
    fireEvent.click(screen.getByText("Begin"));
    fireEvent.click(screen.getByText("Pause and confirm the critical details"));
    const s = surfaceEl();
    expect(s.textContent).toContain("It gets harder");
    expect(s.textContent).toContain("Now a second urgent task lands while the handover is half done.");
  });

  it("the DECISION question and its heading render inside the light surface", async () => {
    await enterPlayer();
    fireEvent.click(screen.getByText("Begin"));
    fireEvent.click(screen.getByText("Pause and confirm the critical details"));
    fireEvent.click(screen.getByText("Escalate to the lead"));
    const s = surfaceEl();
    expect(s.textContent).toContain("Decide");
    expect(s.textContent).toContain("What will you do right now?");
    expect(s.contains(screen.getByText("Record the owner and next check time"))).toBe(true);
  });

  it("the COMPLETION state renders inside the light surface", async () => {
    await enterPlayer();
    fireEvent.click(screen.getByText("Begin"));
    fireEvent.click(screen.getByText("Pause and confirm the critical details"));
    fireEvent.click(screen.getByText("Escalate to the lead"));
    fireEvent.click(screen.getByText("Record the owner and next check time"));
    const s = await waitFor(() => {
      const el = surfaceEl();
      expect(el.textContent).toContain("Practice complete");
      return el;
    });
    expect(s.textContent).toContain("You worked through the full decision.");
  });

  it("the shell-owned completion banners stay OUTSIDE the light surface (already white-on-navy)", async () => {
    await enterPlayer();
    fireEvent.click(screen.getByText("Begin"));
    fireEvent.click(screen.getByText("Pause and confirm the critical details"));
    fireEvent.click(screen.getByText("Escalate to the lead"));
    fireEvent.click(screen.getByText("Record the owner and next check time"));
    await waitFor(() => expect(surfaceEl().textContent).toContain("Practice complete"));
    // "Saving your completion…" / the error strip belong to ArenaRoom, not the player's page.
    const saving = screen.queryByText("Saving your completion…");
    if (saving) expect(surfaceEl().contains(saving)).toBe(false);
  });
});

describe("G6 — practice behaviour is unchanged; only the surface moved", () => {
  it("progresses opening → primary → tradeoff → action → complete exactly as before", async () => {
    await enterPlayer();
    expect(screen.getByText("Begin")).toBeTruthy();
    fireEvent.click(screen.getByText("Begin"));
    expect(screen.getByText("Your choice")).toBeTruthy();
    fireEvent.click(screen.getByText("Pause and confirm the critical details"));
    expect(screen.getByText("It gets harder")).toBeTruthy();
    fireEvent.click(screen.getByText("Escalate to the lead"));
    expect(screen.getByText("Decide")).toBeTruthy();
    fireEvent.click(screen.getByText("Record the owner and next check time"));
    await waitFor(() => expect(screen.getByText("Practice complete")).toBeTruthy());
  });

  it("completion POSTs once to the unchanged endpoint with the unchanged runId payload", async () => {
    await enterPlayer();
    fireEvent.click(screen.getByText("Begin"));
    fireEvent.click(screen.getByText("Pause and confirm the critical details"));
    fireEvent.click(screen.getByText("Escalate to the lead"));
    fireEvent.click(screen.getByText("Record the owner and next check time"));
    await waitFor(() => {
      const done = calls.filter((c) => c.url.endsWith("/complete"));
      expect(done.length).toBe(1);
      expect(done[0]!.method).toBe("POST");
      expect(JSON.parse(done[0]!.body ?? "{}")).toEqual({ runId: RUN_ID });
    });
  });

  it("start still goes snapshot → POST /start, and no canonical Arena run / XP endpoint is touched", async () => {
    await enterPlayer();
    expect(calls.some((c) => c.method === "POST" && c.url.endsWith(`/api/arena/practice/${PRACTICE_ID}/start`))).toBe(true);
    expect(calls.every((c) => !c.url.includes("/api/arena/run"))).toBe(true);
    expect(calls.every((c) => !/core_xp|weekly_xp/.test(c.url))).toBe(true);
  });

  it("the wrapper adds NO interactive element of its own (layout only)", async () => {
    const { surface } = await enterPlayer();
    expect(surface.tagName).toBe("DIV");
    expect(surface.getAttribute("onclick")).toBeNull();
    expect(surface.querySelector("nav")).toBeNull();
    expect(surface.querySelector("a[href]")).toBeNull();
  });
});

describe("the contrast the surface exists to produce", () => {
  /**
   * jsdom cannot compute rendered colour, but the two ends of the calculation are FACTS in the
   * repository: the token values in globals.css and the class the mount uses. This computes the
   * ratio from those facts, so a change to either — the token, or an alpha reintroduced on the
   * wrapper — fails here rather than on a Founder's phone.
   */
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  const token = (name: string): string => {
    const m = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
    if (!m) throw new Error(`token ${name} not found in globals.css`);
    return m[1]!;
  };
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = (c: number[]) => 0.2126 * lin(c[0]!) + 0.7152 * lin(c[1]!) + 0.0722 * lin(c[2]!);
  const ratio = (a: number[], b: number[]) => {
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
    return (l1 + 0.05) / (l2 + 0.05);
  };
  /** Compose `fg` at alpha `a` over `bg` — how Tailwind's `/NN` opacity actually resolves. */
  const over = (fg: number[], a: number, bg: number[]) => fg.map((c, i) => Math.round(a * c + (1 - a) * bg[i]!));

  const NAVY = rgb(token("--bty-brand-navy"));
  const SOFT = rgb(token("--bty-surface-soft"));
  const SHELL = NAVY; // BtyDailyAppShell root is bg-[#0B1F3A]

  it("names the defect: the player's prose on the bare shell is 1.00:1", () => {
    expect(ratio(NAVY, SHELL)).toBeCloseTo(1, 2);
  });

  it("the opaque surface carries the player's body prose above AA (4.5:1)", () => {
    expect(ratio(NAVY, SOFT)).toBeGreaterThan(4.5); // title / decision prompt / choice labels
    expect(ratio(over(NAVY, 0.9, SOFT), SOFT)).toBeGreaterThan(4.5); // escalation text
    expect(ratio(over(NAVY, 0.7, SOFT), SOFT)).toBeGreaterThan(4.5); // completion body
  });

  it("and lifts every remaining dimmed token clear of the 3:1 floor", () => {
    expect(ratio(over(NAVY, 0.6, SOFT), SOFT)).toBeGreaterThan(3); // section headings
    expect(ratio(over(NAVY, 0.5, SOFT), SOFT)).toBeGreaterThan(3); // "From: <training>"
  });

  it("WHY NO ALPHA: the Host mount's 40% leaves the dimmed tokens below the 3:1 floor", () => {
    const soft40 = over(SOFT, 0.4, SHELL);
    expect(ratio(over(NAVY, 0.6, soft40), soft40)).toBeLessThan(3); // headings ≈ 2.15:1
    expect(ratio(over(NAVY, 0.5, soft40), soft40)).toBeLessThan(3); // source line ≈ 1.88:1
    expect(ratio(over(NAVY, 0.7, soft40), soft40)).toBeLessThan(3); // completion body ≈ 2.43:1
  });
});

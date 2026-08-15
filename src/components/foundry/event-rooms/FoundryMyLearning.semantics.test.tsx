/** @vitest-environment jsdom */
/**
 * SLICE 3.2R-R1.1 — MY LEARNING SEMANTIC DUPLICATION.
 *
 * The Founder device gate on R1 reported two headings — "What I learned" and "What I achieved" —
 * showing identical content. The cause was NOT in this card: the Me-tab nav had two rows with
 * different labels and the same handler, so both opened this same screen (see
 * `meRowsDistinct.test.tsx`). What this suite fixes in place is the standard that made the report
 * legible: every heading on the card must mean something different, and no section may exist
 * because there used to be a box there.
 *
 * CASE A–I of the R1.1 matrix.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import FoundryMyLearning from "./FoundryMyLearning";

const ENTRY = "prog-1";
const UNDERSTOOD = "Confirm the owner before we leave the huddle.";
const DECIDED = "Next time I will say the owner's name out loud before we break.";

function historyItem(over: Record<string, unknown> = {}) {
  return {
    entryId: ENTRY,
    eventId: "ev-1",
    eventTitle: "Huddle ownership",
    contentType: "youtube",
    completedAt: "2026-08-01T02:00:00Z",
    sharedUnderstanding: UNDERSTOOD,
    decisionResponse: null,
    ...over,
  };
}

function stub(opts: { history?: unknown[]; evidence?: unknown[] }) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      const u = String(url);
      if (u.includes("/api/bty/foundry/evidence/mine")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ items: opts.evidence ?? [] }) } as Response);
      }
      if (u.includes("/api/bty/action-contract/reviewed-plans")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ items: [] }) } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ history: opts.history ?? [], thread: null, threadStatus: "none" }),
      } as Response);
    }),
  );
}

/**
 * Every LEARNER-AUTHORED prose paragraph on the card — the duplication detector.
 *
 * Excludes the evidence strip's own subtree: its hint ("This fills in over time…") is BTY's
 * sentence, not the learner's, and counting it would make the detector fire on a card that has
 * exactly one piece of learner writing.
 */
function proseOf(item: HTMLElement): string[] {
  const evidence = item.querySelector('[data-testid="my-learning-evidence"]');
  return Array.from(item.querySelectorAll("p"))
    .filter((p) => !evidence?.contains(p))
    .map((p) => (p.textContent ?? "").trim())
    .filter((t) => t.length > 20); // eyebrows and labels are short; learner writing is not
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
beforeEach(() => vi.restoreAllMocks());

describe("R1.1 — My Learning semantics", () => {
  it("CASE A — completion response only: ONE prose section, no duplicate, no 'What I decided'", async () => {
    stub({ history: [historyItem()], evidence: [{ entryId: ENTRY, established: ["exposed", "reflected"] }] });
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    const item = await screen.findByTestId("my-learning-item");

    expect(within(item).getByTestId("my-learning-shared").textContent).toBe(UNDERSTOOD);
    expect(screen.queryByTestId("my-learning-decision")).toBeNull();
    expect(item.textContent).not.toMatch(/What I decided/i);

    const prose = proseOf(item);
    expect(prose).toHaveLength(1);
    expect(new Set(prose).size).toBe(prose.length); // no sentence under two headings
  });

  it("CASE B — the same text can never appear twice, because each section has its own source", async () => {
    /*
      The duplication the Founder saw came from two ROUTES to one screen, not two fields. Guard the
      remaining risk anyway: if the shared answer and the decision happened to be identical text,
      that is two genuinely different acts recorded identically, and each renders under its own
      truthful heading exactly once — never one value echoed under a second heading it did not come
      from.
    */
    stub({
      history: [historyItem({ decisionResponse: UNDERSTOOD })],
      evidence: [{ entryId: ENTRY, established: ["exposed", "reflected", "decided"] }],
    });
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    const item = await screen.findByTestId("my-learning-item");
    expect(within(item).getByTestId("my-learning-shared").textContent).toBe(UNDERSTOOD);
    expect(within(item).getByTestId("my-learning-decision-text").textContent).toBe(UNDERSTOOD);
    // Two sections, two distinct headings — never the same heading twice.
    const headings = Array.from(item.querySelectorAll("span"))
      .map((s) => (s.textContent ?? "").trim())
      .filter((t) => /What I/i.test(t));
    expect(new Set(headings).size).toBe(headings.length);
  });

  it("CASE C — a genuinely distinct private reflection stays in Center, reachable by deep link", async () => {
    /*
      The private reflection is NOT rendered here on purpose (3.1B-3I): Center is its canonical home
      and this card links to the exact entry. Copying it onto this card would recreate the very
      duplication R1.1 exists to remove, one surface over.
    */
    stub({ history: [historyItem()], evidence: [{ entryId: ENTRY, established: ["exposed", "reflected"] }] });
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    const item = await screen.findByTestId("my-learning-item");
    const link = within(item).getByTestId("view-reflection-in-center");
    expect(link.getAttribute("href")).toContain(`entry=${ENTRY}`);
    expect(link.getAttribute("href")).toContain("tab=center");
  });

  it("CASE D — decision present: 'What I decided' appears AND the DECIDED chip appears", async () => {
    stub({
      history: [historyItem({ decisionResponse: DECIDED })],
      evidence: [{ entryId: ENTRY, established: ["exposed", "reflected", "decided"] }],
    });
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    const item = await screen.findByTestId("my-learning-item");
    expect(within(item).getByTestId("my-learning-decision-text").textContent).toBe(DECIDED);
    expect(item.textContent).toContain("What I decided");
    expect(within(item).getByTestId("evidence-rung-decided")).toBeTruthy();
  });

  it("CASE E — a decision PROMPT without recorded decision evidence shows neither section nor chip", async () => {
    /*
      The published journey may carry an action_decision element the learner never answered (only
      possible on a legacy row). Presence of the prompt establishes nothing: the server omits the
      rung, and with no `decisionResponse` there is nothing to render.
    */
    stub({
      history: [historyItem({ decisionResponse: null })],
      evidence: [{ entryId: ENTRY, established: ["exposed", "reflected"] }],
    });
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    const item = await screen.findByTestId("my-learning-item");
    expect(screen.queryByTestId("my-learning-decision")).toBeNull();
    expect(within(item).queryByTestId("evidence-rung-decided")).toBeNull();
  });

  it("CASE F — legacy journey without action_decision: Learned · Reflected only, nothing fabricated", async () => {
    /*
      This is the EXACT staging shape measured for R1.1: 31 completed rows, zero with
      decision_response_text, zero grounded action_decision elements anywhere. What the Founder saw
      was truthful.
    */
    stub({ history: [historyItem()], evidence: [{ entryId: ENTRY, established: ["exposed", "reflected"] }] });
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    const item = await screen.findByTestId("my-learning-item");
    const chips = within(item).getAllByTestId(/^evidence-rung-/).map((el) => el.getAttribute("data-testid"));
    expect(chips).toEqual(["evidence-rung-exposed", "evidence-rung-reflected"]);
    expect(screen.queryByTestId("my-learning-decision")).toBeNull();
    expect(item.textContent).toContain("Completed"); // completion line untouched
  });

  it("CASE I — no 'What I achieved' section exists anywhere on the card", async () => {
    stub({
      history: [historyItem({ decisionResponse: DECIDED })],
      evidence: [{ entryId: ENTRY, established: ["exposed", "reflected", "decided"] }],
    });
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    await screen.findByTestId("my-learning-item");
    expect(document.body.textContent).not.toMatch(/What I achieved/i);
    expect(document.body.textContent).not.toMatch(/내가 이룬/);
  });

  it("KO — the decision heading is localized and the section still gates on evidence", async () => {
    stub({
      history: [historyItem({ decisionResponse: DECIDED })],
      evidence: [{ entryId: ENTRY, established: ["exposed", "decided"] }],
    });
    render(<FoundryMyLearning locale="ko" onBack={() => {}} />);
    const item = await screen.findByTestId("my-learning-item");
    expect(item.textContent).toContain("내가 결정한 것");
    expect(item.textContent).not.toMatch(/내가 이룬/);
  });

  it("every heading on a fully-populated card is unique", async () => {
    stub({
      history: [historyItem({ decisionResponse: DECIDED })],
      evidence: [{ entryId: ENTRY, established: ["exposed", "reflected", "decided"] }],
    });
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    const item = await screen.findByTestId("my-learning-item");
    const eyebrows = Array.from(item.querySelectorAll("span"))
      .map((s) => (s.textContent ?? "").trim())
      .filter((t) => t.length > 3 && /^[A-Z]/.test(t) && !/^(Video|PDF|Completed)/.test(t));
    expect(new Set(eyebrows).size, `duplicate heading in ${JSON.stringify(eyebrows)}`).toBe(eyebrows.length);
  });
});

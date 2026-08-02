/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { ArenaPracticeFlow } from "./ArenaPracticeFlow";
import { ARENA_PRACTICE_COPY } from "./arenaPracticeCopy";
import { TITLE_MAX, OPENING_MAX, ESCALATION_MAX, ACTION_PROMPT_MAX, CHOICE_LABEL_MAX } from "@/domain/foundry/arena-draft/types";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";

/**
 * EVERY EDITOR FIELD SIZES TO ITS CONTENT (Slice 3.2I-R5B2-R3).
 *
 * The Founder recording showed the title's second line, and the last lines of the opening situation
 * and the escalation, cut off by the field border. Each was a `<textarea rows={n}>` with a FIXED
 * height — the title at `rows={1}`, against a 120-character domain maximum that wraps at any
 * realistic length.
 *
 * This proves the whole editor was converted, not just the three fields that happened to be long
 * in one fixture. Pixels are the Playwright spec and the device gates.
 */

const t = ARENA_PRACTICE_COPY.en;
const LINE = 24;

/** Layout stand-in: jsdom reports 0 for every measurement. */
beforeEach(() => {
  Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
    configurable: true,
    get(this: HTMLTextAreaElement) {
      return Math.max(1, Math.ceil((this.value?.length || 1) / 40)) * LINE + 24;
    },
  });
});
afterEach(() => {
  Reflect.deleteProperty(HTMLTextAreaElement.prototype, "scrollHeight");
  vi.unstubAllGlobals();
  cleanup();
});

const SOURCE = {
  event_id: "evt-1",
  event_title: "Handoff",
  event_status: "open",
  module_version: 3,
  arena_recommended: true,
  capability: "Owning a missed commitment",
  expected_behavior: "Raise the concern",
  success_evidence: null,
  audience_type: "leaders",
  audience_detail: null,
  learning_needs: ["decide"],
  hardest_when_options: ["time_limited"],
  avoidance_seeds: ["time"],
};

/** Long, realistic values — the shape of the scenario in the Founder recording. */
const TITLE = "The handoff nobody wants to own at the end of a very long shift";
const OPENING =
  "It is the end of a long shift. A colleague hands over a task that is not finished, and the person who could fix it has already left for the day. Do you raise it now, or carry it quietly and sort it out tomorrow morning?";
const ESCALATION =
  "You raise it, and the room goes quiet. Someone points out that raising it now means the whole team stays late, and that the same thing happened last month without any consequence at all.";
const PROMPT = "What will you actually do before you leave the building tonight, and who will you tell about it?";

function scenario(): ArenaScenarioDraft {
  return {
    title: TITLE,
    opening: OPENING,
    primary: { choices: [{ id: "p1", label: "Raise it now, and accept the team stays late" }, { id: "p2", label: "Carry it and resolve it first thing" }] },
    tradeoff: { escalationText: ESCALATION, choices: [{ id: "t1", label: "Hold the line" }, { id: "t2", label: "Let it go tonight" }] },
    actionDecision: {
      prompt: PROMPT,
      choices: [
        { id: "a1", label: "Tell the shift lead before leaving", isActionCommitment: true },
        { id: "a2", label: "Write it down for tomorrow", isActionCommitment: false },
      ],
    },
  };
}

const DRAFT = { id: "draft-1", scenario_draft: scenario(), generation_source: "ai" as const, revision: 3, guided_answers: { practiceSetupVersion: 1 } };

function jsonRes(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as unknown as Response;
}
function mockFetch() {
  return vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes("/arena-source/")) return jsonRes({ source: SOURCE });
    if (u.includes("/arena-drafts?")) return jsonRes({ drafts: [{ id: "draft-1" }] });
    if (u.endsWith("/publish")) return jsonRes({ practice: null });
    if (u.match(/\/arena-drafts\/[^/?]+$/)) return jsonRes({ draft: DRAFT });
    throw new Error(`unmocked fetch: ${u}`);
  });
}

const atEditor = () => waitFor(() => expect(screen.getByText(t.editTitle)).toBeTruthy());
const px = (el: HTMLElement) => parseFloat(el.style.height || "0");
const fields = () => Array.from(document.querySelectorAll("textarea")) as HTMLTextAreaElement[];

beforeEach(() => vi.stubGlobal("fetch", mockFetch()));

describe("[R3] every editor field is content-sized, on the saved value", () => {
  it("EVERY multiline field is sized without a single keystroke", async () => {
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atEditor();
    const all = fields();
    expect(all.length).toBeGreaterThanOrEqual(9); // title, opening, escalation, prompt + 6 choices
    for (const el of all) expect(px(el)).toBeGreaterThan(0);
  });

  it.each([
    ["title", () => TITLE],
    ["opening situation", () => OPENING],
    ["escalation", () => ESCALATION],
    ["decision prompt", () => PROMPT],
  ])("the %s grows past a single line rather than clipping", async (_label, get) => {
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atEditor();
    const el = screen.getByDisplayValue(get()) as HTMLTextAreaElement;
    expect(px(el)).toBeGreaterThan(LINE + 24);
    expect(el.value).toBe(get()); // complete text, nothing truncated
  });

  it("the TITLE is still a wrapping field — not forced into a clipped single-line control", async () => {
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atEditor();
    const el = screen.getByDisplayValue(TITLE);
    // `rows={1}` was the worst case in the recording: a 120-character maximum in a one-line box.
    expect(el.tagName).toBe("TEXTAREA");
    expect(TITLE_MAX).toBe(120);
  });

  it("no editor field conceals its overflow, and none offers a drag handle", async () => {
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atEditor();
    for (const el of fields()) {
      expect(el.className).not.toMatch(/overflow-hidden/);
      expect(el.style.overflowY).not.toBe("hidden");
      expect(el.className).toMatch(/\bresize-none\b/);
    }
  });

  it("choice labels size too — they carry up to the domain maximum", async () => {
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atEditor();
    const choice = screen.getByDisplayValue("Raise it now, and accept the team stays late") as HTMLTextAreaElement;
    expect(px(choice)).toBeGreaterThan(0);
    expect(CHOICE_LABEL_MAX).toBe(400);
  });

  it("editing a field re-sizes it in place", async () => {
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atEditor();
    const el = screen.getByDisplayValue(TITLE) as HTMLTextAreaElement;
    const before = px(el);
    fireEvent.change(el, { target: { value: TITLE + " " + "and then some more words again".repeat(3) } });
    await waitFor(() => expect(px(el)).toBeGreaterThan(before));
  });

  it("the domain maxima are the real budget these fields must display", () => {
    // Sizing has to hold for the largest value the server will accept, not for one fixture.
    expect([OPENING_MAX, ESCALATION_MAX, ACTION_PROMPT_MAX]).toEqual([1200, 1200, 600]);
  });
});

describe("[R3] the R2 fixes are untouched", () => {
  it("the action panel still comes after every field, in normal flow", async () => {
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atEditor();
    const region = screen.getByTestId("editor-actions");
    const last = screen.getByDisplayValue("Write it down for tomorrow");
    expect(last.compareDocumentPosition(region) & 4).toBeTruthy();
    expect(region.className).not.toMatch(/\bsticky\b|\bfixed\b|\babsolute\b/);
  });

  it("the published-state action matrix is unchanged", async () => {
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atEditor();
    // Clean and never published → Publish leads; exactly one gold primary.
    const gold = Array.from(screen.getByTestId("editor-actions").querySelectorAll("button")).filter((b) =>
      b.className.includes("bg-[#C9A66B]"),
    );
    expect(gold).toHaveLength(1);
    expect(gold[0].getAttribute("data-testid")).toBe("editor-action-publish");
  });
});

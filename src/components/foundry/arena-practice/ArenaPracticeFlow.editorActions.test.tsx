/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ArenaPracticeFlow } from "./ArenaPracticeFlow";
import { ARENA_PRACTICE_COPY } from "./arenaPracticeCopy";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";

/**
 * EDITOR ACTION REGION (Slice 3.2I-R5B2-R2).
 *
 * Founder device evidence on an iPhone: Save draft, Try a different draft, Try it as a learner,
 * Publish practice and Start a new one overlapped each other and the scenario content, labels were
 * ambiguous, and the lower part of the screen could not be read or operated.
 *
 * jsdom performs NO layout — every rectangle is 0×0 — so pixel overlap cannot be measured here and
 * is not claimed. What IS asserted is the structural property that made overlap possible and now
 * makes it impossible: the actions sit in normal document flow, in ONE region, after the content.
 * Flow boxes cannot overlap by construction. Geometry on a real 390pt viewport is device gate R2-D.
 */

const t = ARENA_PRACTICE_COPY.en;
const ROOT = process.cwd();

const SOURCE = {
  event_id: "evt-1",
  event_title: "Handoff under pressure",
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

function scenario(): ArenaScenarioDraft {
  return {
    title: "Scenario title",
    opening: "An opening situation.",
    primary: { choices: [{ id: "p1", label: "Primary one" }, { id: "p2", label: "Primary two" }] },
    tradeoff: { escalationText: "It gets harder.", choices: [{ id: "t1", label: "Trade one" }, { id: "t2", label: "Trade two" }] },
    actionDecision: {
      prompt: "Decide?",
      choices: [
        { id: "a1", label: "Act now", isActionCommitment: true },
        { id: "a2", label: "Wait", isActionCommitment: false },
      ],
    },
  };
}

const DRAFT = {
  id: "draft-1",
  scenario_draft: scenario(),
  generation_source: "ai" as const,
  revision: 3,
  guided_answers: { practiceSetupVersion: 1 },
};

function jsonRes(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as unknown as Response;
}

/** `publish` GET reports whether THIS revision is already live. */
function mockFetch(over: { live?: string | null } = {}) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? "GET";
    if (u.includes("/arena-source/")) return jsonRes({ source: SOURCE });
    if (u.includes("/arena-drafts?")) return jsonRes({ drafts: [{ id: "draft-1" }] });
    if (u.endsWith("/publish") && method === "GET") return jsonRes({ practice: over.live ? { id: over.live } : null });
    if (u.endsWith("/publish")) return jsonRes({ practice: { id: "prac-1" } });
    if (u.match(/\/arena-drafts\/[^/?]+$/) && method === "PATCH") return jsonRes({ draft: { ...DRAFT, revision: 4 } });
    if (u.match(/\/arena-drafts\/[^/?]+$/)) return jsonRes({ draft: DRAFT });
    throw new Error(`unmocked fetch: ${u}`);
  });
}

const atEditor = () => waitFor(() => expect(screen.getByText(t.editTitle)).toBeTruthy());
const region = () => screen.getByTestId("editor-actions");
const has = (id: string) => screen.queryByTestId(id) !== null;

beforeEach(() => vi.stubGlobal("fetch", mockFetch()));
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("[R2] the actions cannot overlap anything, by construction", () => {
  it("there is exactly ONE action region and it is in normal flow", async () => {
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atEditor();
    expect(screen.getAllByTestId("editor-actions")).toHaveLength(1);
    const cls = region().className;
    // The defect was `sticky bottom-2` with no background: content scrolled visibly through the
    // gaps between the buttons and nothing reserved the region's height.
    expect(cls).not.toMatch(/\bsticky\b|\bfixed\b|\babsolute\b/);
    expect(cls).toMatch(/\bbg-/); // an opaque region, not a transparent float
  });

  it("the region comes AFTER every scenario field, so nothing can sit under it", async () => {
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atEditor();
    const last = screen.getByDisplayValue("Wait"); // the final editable choice
    // DOCUMENT_POSITION_FOLLOWING === 4
    expect(last.compareDocumentPosition(region()) & 4).toBeTruthy();
  });

  it("no action is nested inside another, and each is a comfortable target", async () => {
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atEditor();
    const buttons = Array.from(region().querySelectorAll("button"));
    expect(buttons.length).toBeGreaterThan(1);
    for (const a of buttons) for (const b of buttons) if (a !== b) expect(a.contains(b)).toBe(false);
    for (const b of buttons) expect(b.className).toMatch(/min-h-\[(3rem|2\.75rem)\]/);
  });

  it("the bottom safe-area inset is reserved by the region itself", async () => {
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atEditor();
    expect(region().className).toMatch(/env\(safe-area-inset-bottom\)/);
  });

  it("at most ONE explanation line renders, so the region cannot grow by stacking hints", async () => {
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atEditor();
    fireEvent.change(screen.getByDisplayValue("Scenario title"), { target: { value: "Edited" } });
    await waitFor(() => expect(has("editor-action-hint")).toBe(true));
    expect(screen.getAllByTestId("editor-action-hint")).toHaveLength(1);
  });

  it("every scenario field remains present and editable alongside the actions", async () => {
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atEditor();
    for (const v of ["Scenario title", "An opening situation.", "Primary one", "Trade one", "Act now", "Wait"]) {
      expect(screen.getByDisplayValue(v)).toBeTruthy();
    }
  });
});

describe("[R2] each state exposes only the actions that are true for it", () => {
  it("clean and never published — Publish leads, replacement actions are secondary", async () => {
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atEditor();
    expect(has("editor-action-publish")).toBe(true);
    expect(has("editor-action-save")).toBe(true);
    expect(has("editor-action-test")).toBe(true);
    expect(has("editor-action-regenerate")).toBe(true);
    expect(has("editor-action-start-over")).toBe(true);
    // Exactly one gold primary.
    const gold = Array.from(region().querySelectorAll("button")).filter((b) => b.className.includes("bg-[#C9A66B]"));
    expect(gold).toHaveLength(1);
    expect(gold[0].getAttribute("data-testid")).toBe("editor-action-publish");
  });

  it("unsaved edits — saving leads, and the actions that would ship stale bytes are blocked", async () => {
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atEditor();
    fireEvent.change(screen.getByDisplayValue("Scenario title"), { target: { value: "Edited" } });
    await waitFor(() =>
      expect((screen.getByTestId("editor-action-save") as HTMLButtonElement).className).toMatch(/bg-\[#C9A66B\]/),
    );
    expect((screen.getByTestId("editor-action-publish") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("editor-action-test") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("editor-action-hint").textContent).toBe(t.saveBeforePublish);
  });

  it("PUBLISHED at this revision — Publish is withdrawn, not left enabled on live bytes", async () => {
    vi.stubGlobal("fetch", mockFetch({ live: "prac-1" }));
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atEditor();
    await waitFor(() => expect(has("editor-live-banner")).toBe(true));
    expect(has("editor-action-publish")).toBe(false);
    const gold = Array.from(region().querySelectorAll("button")).filter((b) => b.className.includes("bg-[#C9A66B]"));
    expect(gold).toHaveLength(1);
    expect(gold[0].getAttribute("data-testid")).toBe("editor-action-test");
  });

  it("PREVIEW — the actions that edit or replace what is being read are withdrawn", async () => {
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atEditor();
    fireEvent.click(screen.getByText(t.previewCta));
    await waitFor(() => expect(has("editor-action-save")).toBe(false));
    expect(has("editor-action-regenerate")).toBe(false);
    expect(has("editor-action-start-over")).toBe(false);
    expect(has("editor-action-test")).toBe(true);
    expect(has("editor-action-publish")).toBe(true);
    expect(screen.getAllByTestId("editor-actions")).toHaveLength(1);
  });

  it("a long or dynamic label cannot squeeze a neighbour — every action owns its own row", async () => {
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atEditor();
    // The old layout put Save and "Try a different draft" in one flex row, so the longer label
    // shrank the primary. Each primary-tier action is now full width on its own line.
    for (const id of ["editor-action-save", "editor-action-publish", "editor-action-test"]) {
      expect(screen.getByTestId(id).className).toMatch(/\bw-full\b/);
    }
  });

  it("rapid publish taps stay guarded by the existing request protection", async () => {
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atEditor();
    const btn = screen.getByTestId("editor-action-publish");
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByText(t.publishedTitle)).toBeTruthy());
  });
});

describe("[R2] nothing on the Practice surfaces leaves the four-tab shell", () => {
  const SURFACES = [
    "src/components/foundry/arena-practice/ArenaPracticeFlow.tsx",
    "src/components/foundry/arena-practice/BoundaryEditor.tsx",
    "src/components/foundry/arena-practice/BoundaryScopePanel.tsx",
    "src/components/app-shell/PracticeAuthoringEntry.tsx",
    "src/components/app-shell/ArenaRoom.tsx",
  ];

  it.each(SURFACES)("%s performs no location navigation", (rel) => {
    const src = readFileSync(join(ROOT, rel), "utf8");
    // Comments may DESCRIBE the prohibition; only real calls matter.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(\/\/|\*).*$/gm, "");
    expect(code).not.toMatch(/window\.location\s*(=|\.(href|assign|replace)\s*[=(])/);
    expect(code).not.toMatch(/location\.(href\s*=|assign\(|replace\()/);
  });

  it.each(SURFACES)("%s renders no anchor to an absolute or legacy destination", (rel) => {
    const src = readFileSync(join(ROOT, rel), "utf8");
    expect(src).not.toMatch(/<a\s[^>]*href=/);
  });

  it("the unreachable 'Return to training' copy is gone and cannot be reintroduced silently", () => {
    // R2 forensics: the ONLY artifact in the tree able to render that label was a copy key no
    // component referenced. Removing it does NOT prove the reported defect fixed — see the report.
    for (const table of Object.values(ARENA_PRACTICE_COPY)) {
      expect(Object.keys(table)).not.toContain("returnToTraining");
    }
    const src = readFileSync(join(ROOT, "src/components/foundry/arena-practice/arenaPracticeCopy.ts"), "utf8");
    expect(src).not.toMatch(/Return to training|교육으로 돌아가기/);
  });
});

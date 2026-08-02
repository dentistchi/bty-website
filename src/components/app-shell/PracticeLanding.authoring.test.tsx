/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import PracticeLanding from "./PracticeLanding";

/**
 * PRACTICE → PRACTICE SITUATIONS → BOUNDARY CONFIRMATION (Slice 3.2I-R5B2-R1).
 *
 * The 3.2K device gate failed here, not inside the boundary surface: a Host reached the Practice
 * situations screen, saw completed cards and "Practice again", and had nowhere to go. This test
 * walks the journey the Founder could not, all the way to the surface 3.2K shipped — with the real
 * ArenaRoom and the real ArenaPracticeFlow, mocking only the fetch boundary.
 */

const SOURCE = {
  event_id: "evt-1",
  event_title: "Handoff under pressure",
  event_status: "open",
  module_version: 3,
  arena_recommended: true,
  capability: "Owning a missed commitment",
  expected_behavior: "Raise the concern before the shortcut is taken",
  success_evidence: null,
  audience_type: "leaders",
  audience_detail: null,
  learning_needs: ["decide"],
  hardest_when_options: ["time_limited"],
  avoidance_seeds: ["time"],
};
/** A real shell: created by create-or-open, so it carries the lifecycle discriminator. */
const SHELL = {
  id: "shell-1",
  scenario_draft: null,
  generation_source: null,
  revision: 0,
  guided_answers: { practiceSetupVersion: 1 },
};
/** What the learner list returns: one COMPLETED practice — the exact device state. */
const COMPLETED = [
  {
    id: "prac-1",
    practice_title: "A finished situation",
    source_training_title: "Handoff under pressure",
    completed: true,
  },
];

function jsonRes(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as unknown as Response;
}

let calls: string[] = [];
function mockFetch(over: { events?: () => Response } = {}) {
  return vi.fn(async (url: string) => {
    const u = String(url);
    calls.push(u);
    if (u.includes("/api/bty/foundry/events")) return over.events ? over.events() : jsonRes({ events: [{ id: "evt-1", title: "Handoff under pressure" }] });
    if (u.includes("/arena-source/")) return jsonRes({ source: SOURCE });
    if (u.includes("/arena-drafts?")) return jsonRes({ drafts: [{ id: "shell-1" }] });
    if (u.match(/\/arena-drafts\/[^/?]+$/)) return jsonRes({ draft: SHELL });
    if (u === "/api/arena/practice") return jsonRes({ practices: COMPLETED }); // the learner list
    // Anything else is unexpected: fail loudly rather than let a stray call look answered.
    throw new Error(`unmocked fetch: ${u}`);
  });
}

const base = { locale: "en", lockedTag: "tag", lockedBody: "body" };
const openPracticeSituations = () => fireEvent.click(screen.getByTestId("practice-arena-entry"));

beforeEach(() => {
  calls = [];
  vi.stubGlobal("fetch", mockFetch());
});
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("[R1] the Host has a way in from Practice situations", () => {
  it("Create practice is present ALONGSIDE completed cards — the exact device state that failed", async () => {
    render(<PracticeLanding {...base} />);
    openPracticeSituations();
    await waitFor(() => expect(screen.getByTestId("practice-create-cta")).toBeTruthy());
    // The completed card and its "Practice again" are still there, untouched.
    await waitFor(() => expect(screen.getByText("A finished situation")).toBeTruthy());
    expect(screen.getByText("Practice again")).toBeTruthy();
  });

  it("Create practice comes BEFORE the historical list in document order", async () => {
    render(<PracticeLanding {...base} />);
    openPracticeSituations();
    await waitFor(() => expect(screen.getByTestId("practice-create-cta")).toBeTruthy());
    await waitFor(() => expect(screen.getByText("A finished situation")).toBeTruthy());
    const cta = screen.getByTestId("practice-create-cta");
    const card = screen.getByText("A finished situation");
    // Node.DOCUMENT_POSITION_FOLLOWING === 4: the card follows the CTA.
    expect(cta.compareDocumentPosition(card) & 4).toBeTruthy();
  });

  it("the entry sits in the same normal-flow region as the list — nothing to scroll past, no overlay", async () => {
    render(<PracticeLanding {...base} />);
    openPracticeSituations();
    await waitFor(() => expect(screen.getByTestId("practice-create-cta")).toBeTruthy());
    const region = screen.getByTestId("practice-arena");
    expect(within(region).getByTestId("practice-authoring-entry")).toBeTruthy();
    const cls = screen.getByTestId("practice-authoring-entry").className;
    expect(cls).not.toMatch(/fixed|absolute|sticky/);
  });

  it("a learner reaching the same surface sees the list and no authoring control", async () => {
    vi.stubGlobal("fetch", mockFetch({ events: () => jsonRes({ error: "foundry_host_required" }, false, 403) }));
    render(<PracticeLanding {...base} />);
    openPracticeSituations();
    await waitFor(() => expect(screen.getByText("A finished situation")).toBeTruthy());
    expect(screen.queryByTestId("practice-create-cta")).toBeNull();
    expect(screen.queryByTestId("practice-authoring-entry")).toBeNull();
    expect(screen.getByText("Practice again")).toBeTruthy(); // learner journey unchanged
  });
});

describe("[R1] the entry reaches the surface 3.2K shipped", () => {
  it("Create practice opens Set up practice, and the Boundary Confirmation surface is there", async () => {
    render(<PracticeLanding {...base} />);
    openPracticeSituations();
    await waitFor(() => expect(screen.getByTestId("practice-create-cta")).toBeTruthy());
    fireEvent.click(screen.getByTestId("practice-create-cta"));
    await waitFor(() => expect(screen.getByText("Set up practice")).toBeTruthy());
    // The 3.2K surface, reachable at last.
    expect(screen.getByText("What must every option respect?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirm boundary" })).toBeTruthy();
  });

  it("it opens the EXISTING draft — create-or-open, not a second creation authority", async () => {
    render(<PracticeLanding {...base} />);
    openPracticeSituations();
    await waitFor(() => expect(screen.getByTestId("practice-create-cta")).toBeTruthy());
    fireEvent.click(screen.getByTestId("practice-create-cta"));
    await waitFor(() => expect(screen.getByText("Set up practice")).toBeTruthy());
    // The existing shell was resumed by the flow's own load. No POST was issued at all, so this
    // surface cannot have created a duplicate draft.
    expect(calls.some((c) => c.includes("/arena-drafts/shell-1"))).toBe(true);
    expect(calls.filter((c) => c.endsWith("/api/bty/foundry/arena-drafts"))).toEqual([]);
  });

  it("Back from authoring returns to Practice situations with the list intact", async () => {
    render(<PracticeLanding {...base} />);
    openPracticeSituations();
    await waitFor(() => expect(screen.getByTestId("practice-create-cta")).toBeTruthy());
    fireEvent.click(screen.getByTestId("practice-create-cta"));
    await waitFor(() => expect(screen.getByText("Set up practice")).toBeTruthy());
    fireEvent.click(screen.getByText(/Back/i));
    await waitFor(() => expect(screen.getByTestId("practice-create-cta")).toBeTruthy());
    expect(screen.getByText("A finished situation")).toBeTruthy();
  });

  it("no user-visible internal terminology anywhere on the journey", async () => {
    render(<PracticeLanding {...base} />);
    openPracticeSituations();
    await waitFor(() => expect(screen.getByTestId("practice-create-cta")).toBeTruthy());
    expect(document.body.textContent).not.toMatch(/Arena|아레나/);
    fireEvent.click(screen.getByTestId("practice-create-cta"));
    await waitFor(() => expect(screen.getByText("Set up practice")).toBeTruthy());
    expect(document.body.textContent).not.toMatch(/Arena|아레나/);
  });
});

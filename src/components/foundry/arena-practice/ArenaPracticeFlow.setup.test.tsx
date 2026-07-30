/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ArenaPracticeFlow } from "./ArenaPracticeFlow";

/**
 * Render harness for the honest shell "Set up practice" surface (Slice 3.2I-R5B1A). Mocks the
 * fetch boundary with deterministic canonical responses — no real network, no Supabase, no
 * generation. Proves a canonical shell (scenario_draft = null) renders the setup surface, not
 * a generation error.
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

/** A canonical SHELL draft: exists, but no scenario yet. */
const SHELL_DRAFT = { id: "shell-1", scenario_draft: null, generation_source: null, revision: 0 };

function mockFetch(over: { draftsList?: unknown; oneDraft?: unknown } = {}) {
  return vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes("/arena-source/")) return jsonRes({ source: SOURCE });
    if (u.includes("/arena-drafts?")) return jsonRes(over.draftsList ?? { drafts: [{ id: "shell-1" }] });
    if (u.match(/\/arena-drafts\/[^/?]+$/)) return jsonRes(over.oneDraft ?? { draft: SHELL_DRAFT });
    return jsonRes({});
  });
}
function jsonRes(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as unknown as Response;
}

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch());
});
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("ArenaPracticeFlow — honest shell setup surface", () => {
  it("a canonical shell renders 'Set up practice' with the linked Training identity (EN)", async () => {
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText("Set up practice")).toBeTruthy());
    expect(screen.getByText("Handoff under pressure")).toBeTruthy(); // linked Training identity
    expect(screen.getByText("Raise the concern before the shortcut is taken")).toBeTruthy(); // expected behavior
  });

  it("does NOT show a generation-failure / retry error for a shell", async () => {
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText("Set up practice")).toBeTruthy());
    expect(screen.queryByText(/Something went wrong/i)).toBeNull();
    expect(screen.queryByText(/couldn't generate/i)).toBeNull();
    expect(screen.queryByText(/Try a different draft/i)).toBeNull();
  });

  it("renders the Korean setup copy", async () => {
    render(<ArenaPracticeFlow eventId="evt-1" locale="ko" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText("Practice 설정")).toBeTruthy());
    expect(screen.getByText("Handoff under pressure")).toBeTruthy();
  });

  it("Back invokes the origin callback (returns to Training)", async () => {
    const onBack = vi.fn();
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={onBack} />);
    await waitFor(() => expect(screen.getByText("Set up practice")).toBeTruthy());
    fireEvent.click(screen.getByText(/Back/i));
    expect(onBack).toHaveBeenCalled();
  });

  it("distinguishes a canonical-load failure from the setup state", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (String(url).includes("/arena-source/") ? jsonRes({}, false, 500) : jsonRes({}))));
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await waitFor(() => expect(screen.queryByText("Set up practice")).toBeNull());
  });
});

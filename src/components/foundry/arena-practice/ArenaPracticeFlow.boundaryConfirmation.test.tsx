/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ArenaPracticeFlow } from "./ArenaPracticeFlow";
import { ARENA_PRACTICE_COPY } from "./arenaPracticeCopy";

/**
 * SETUP → BOUNDARY → GENERATION, END TO END AT THE FETCH BOUNDARY (Slice 3.2I-R5B2).
 *
 * 3.2J measured the whole chain and stopped: a new-authority shell reached "Set up practice", the
 * screen said "Ready to create this practice situation", and there was no control on it — while
 * the server would have refused generation with `boundary_confirmation_required` anyway.
 *
 * This harness proves the chain now closes: the surface is honest about what is missing, the Host
 * can supply it, the SERVER's answer becomes what is rendered, and the forward action appears only
 * once the server would actually accept it. No network, no Supabase, no provider.
 */

const t = ARENA_PRACTICE_COPY.en;

const SOURCE = {
  event_id: "evt-1",
  event_title: "Handoff under pressure",
  event_status: "open",
  module_version: 3,
  arena_recommended: true,
  // Carries a domain term AND a mandate, so `suggestConstraints` yields exactly one candidate.
  capability: "Staff must never disclose a patient identifier before consent is confirmed.",
  expected_behavior: "Raise the concern before the shortcut is taken",
  success_evidence: null,
  audience_type: "leaders",
  audience_detail: null,
  learning_needs: ["decide"],
  hardest_when_options: ["time_limited"],
  avoidance_seeds: ["time"],
};
const SUGGESTED = "Staff must never disclose a patient identifier before consent is confirmed.";

/** A real shell: created by `createOrOpenArenaDraftShell`, so it carries the discriminator. */
const SHELL = {
  id: "shell-1",
  scenario_draft: null,
  generation_source: null,
  revision: 0,
  guided_answers: { practiceSetupVersion: 1 },
};
/** A pre-R5A.2 draft: no discriminator, so the boundary requirement never applied to it. */
const LEGACY_SHELL = { id: "legacy-1", scenario_draft: null, generation_source: null, revision: 4 };

const confirmed = (statements: string[], revision: number, scope?: unknown) => ({
  ...SHELL,
  revision,
  guided_answers: {
    practiceSetupVersion: 1,
    practiceBoundary: {
      mode: statements.length > 0 ? "judgment_with_constraints" : "judgment",
      confirmed: true,
      constraints: statements.map((s, i) => ({ id: `c${i + 1}_r`, statement: s, provenance: "manager_entered" })),
    },
    ...(scope ? { practiceBoundaryScope: scope } : {}),
  },
});

const SCENARIO = {
  title: "A generated situation",
  opening: "…",
  primary: { choices: [] },
  tradeoff: { escalationText: "", choices: [] },
  actionDecision: { prompt: "", choices: [] },
};

function jsonRes(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as unknown as Response;
}

type Call = { url: string; method: string; body: Record<string, unknown> };
let calls: Call[] = [];

/**
 * Routes by URL + method. `oneDraft` may be a queue, so a re-read after a refusal can legitimately
 * return something different from the first read.
 */
function mockFetch(over: { oneDraft?: unknown[]; boundary?: () => Response; regenerate?: () => Response } = {}) {
  const drafts = [...(over.oneDraft ?? [SHELL])];
  return vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? "GET";
    calls.push({ url: u, method, body: init?.body ? JSON.parse(String(init.body)) : {} });
    if (u.includes("/arena-source/")) return jsonRes({ source: SOURCE });
    if (u.includes("/arena-drafts?")) return jsonRes({ drafts: [{ id: drafts[0] ? (drafts[0] as { id: string }).id : "shell-1" }] });
    if (u.endsWith("/boundary")) return over.boundary ? over.boundary() : jsonRes({ draft: confirmed(["x"], 1), invalidated: false });
    if (u.endsWith("/regenerate")) return over.regenerate ? over.regenerate() : jsonRes({ draft: { ...SHELL, revision: 2, scenario_draft: SCENARIO }, warnings: [] });
    if (u.endsWith("/publish")) return jsonRes({ practice: null });
    if (u.match(/\/arena-drafts\/[^/?]+$/)) return jsonRes({ draft: drafts.length > 1 ? drafts.shift() : drafts[0] });
    return jsonRes({});
  });
}

const atSetup = () => waitFor(() => expect(screen.getByText(t.setupTitle)).toBeTruthy());
const boundaryCalls = () => calls.filter((c) => c.url.endsWith("/boundary") && c.method === "PUT");
const regenCalls = () => calls.filter((c) => c.url.endsWith("/regenerate"));

beforeEach(() => {
  calls = [];
  vi.stubGlobal("fetch", mockFetch());
});
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("[R5B2] a new-authority shell is honest about what is missing", () => {
  it("does NOT claim readiness, and offers no generation control", async () => {
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atSetup();
    expect(screen.getByText(t.setupNeedsBoundary)).toBeTruthy();
    expect(screen.queryByText(t.boundaryScopeReady)).toBeNull(); // the exact 3.2J lie
    expect(screen.queryByRole("button", { name: t.setupGenerateCta })).toBeNull();
  });

  it("shows the boundary surface with a next action, not an empty panel", async () => {
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atSetup();
    expect(screen.getByText(t.boundaryTitle)).toBeTruthy();
    expect(screen.getByRole("button", { name: t.boundaryConfirmCta })).toBeTruthy();
  });

  it("surfaces the suggestion derived from THIS training's facts", async () => {
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atSetup();
    expect(screen.getByText(t.boundarySuggestedTitle)).toBeTruthy();
    expect(screen.getByText(SUGGESTED)).toBeTruthy();
  });

  it("renders the Korean surface with no user-visible internal terminology", async () => {
    const ko = ARENA_PRACTICE_COPY.ko;
    render(<ArenaPracticeFlow eventId="evt-1" locale="ko" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText(ko.setupTitle)).toBeTruthy());
    expect(screen.getByText(ko.boundaryTitle)).toBeTruthy();
    expect(screen.getByText(ko.setupNeedsBoundary)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Arena|아레나|boundary_confirmation_required/);
  });
});

describe("[R5B2] the server is the authority on the saved boundary", () => {
  it("saves through the canonical endpoint with the CURRENT revision", async () => {
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atSetup();
    fireEvent.click(screen.getByRole("button", { name: t.boundarySuggestionAdd }));
    fireEvent.click(screen.getByRole("button", { name: t.boundaryConfirmCta }));
    await waitFor(() => expect(boundaryCalls()).toHaveLength(1));
    const call = boundaryCalls()[0];
    expect(call.url).toContain("/arena-drafts/shell-1/boundary");
    expect(call.body.expectedRevision).toBe(0); // the shell's revision, optimistic-concurrency
    const sent = call.body.boundary as { mode: string; confirmed: boolean; constraints: unknown[] };
    expect(sent.confirmed).toBe(true);
    expect(sent.mode).toBe("judgment_with_constraints");
    expect(sent.constraints).toHaveLength(1);
  });

  it("the RESPONSE becomes what is rendered, and readiness opens the forward action", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({ boundary: () => jsonRes({ draft: confirmed(["Server's canonical rule."], 1), invalidated: false }) }),
    );
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atSetup();
    fireEvent.click(screen.getByRole("button", { name: t.boundaryConfirmCta }));
    await waitFor(() => expect(screen.getByText(t.boundaryConfirmedTitle)).toBeTruthy());
    // Rendered ONCE, from the server's constraints — not echoed back from what was typed.
    expect(screen.getAllByText("Server's canonical rule.")).toHaveLength(1);
    // One confirmed rule needs no scope decision, so the status says every rule is in play.
    expect(screen.getByText(t.boundaryScopeAllActive)).toBeTruthy();
    expect(screen.getByRole("button", { name: t.setupGenerateCta })).toBeTruthy();
  });

  it("a validation refusal shows a sentence, stays unconfirmed, and keeps generation unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({ boundary: () => jsonRes({ error: "constraint_statement_too_long" }, false, 422) }),
    );
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atSetup();
    fireEvent.click(screen.getByRole("button", { name: t.boundaryConfirmCta }));
    await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
    expect(screen.getByText(t.boundaryErrorTooLong(300))).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/constraint_statement_too_long/);
    expect(screen.queryByText(t.boundaryConfirmedTitle)).toBeNull();
    expect(screen.queryByRole("button", { name: t.setupGenerateCta })).toBeNull();
    expect(screen.getByText(t.setupNeedsBoundary)).toBeTruthy();
  });

  it("a STALE revision does not overwrite: the Host's work survives and the retry is armed", async () => {
    // The refusal, then a re-read that shows what the other writer stored.
    vi.stubGlobal(
      "fetch",
      mockFetch({
        oneDraft: [SHELL, confirmed(["Someone else's rule."], 7)],
        boundary: () => jsonRes({ error: "stale_revision" }, false, 409),
      }),
    );
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atSetup();
    fireEvent.change(screen.getByLabelText(t.boundaryAddCta), { target: { value: "My unsaved rule." } });
    fireEvent.click(screen.getByRole("button", { name: t.boundaryAddCta }));
    fireEvent.click(screen.getByRole("button", { name: t.boundaryConfirmCta }));
    await waitFor(() => expect(screen.getByText(t.boundaryConflict)).toBeTruthy());
    // Not lost, not silently replaced by the other writer's version.
    expect(screen.getByText("My unsaved rule.")).toBeTruthy();
    expect(screen.getByRole("button", { name: t.boundaryConfirmCta })).toBeTruthy();
    // Exactly one write was attempted; the refusal did not become a retry loop.
    expect(boundaryCalls()).toHaveLength(1);
    // The re-read armed the next attempt with the revision the server now holds.
    await waitFor(() => {
      fireEvent.click(screen.getByRole("button", { name: t.boundaryConfirmCta }));
      expect(boundaryCalls()[1]?.body.expectedRevision).toBe(7);
    });
  });

  it("reports the server's invalidation of an earlier generated situation", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({ boundary: () => jsonRes({ draft: confirmed(["New rule."], 3), invalidated: true }) }),
    );
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atSetup();
    fireEvent.click(screen.getByRole("button", { name: t.boundaryConfirmCta }));
    await waitFor(() => expect(screen.getByText(t.boundaryInvalidatedNotice)).toBeTruthy());
  });
});

describe("[R5B2] the scope decision still governs 4+ rules", () => {
  const FOUR = ["Rule one.", "Rule two.", "Rule three.", "Rule four."];

  it("generation stays unavailable until the Host confirms a scope", async () => {
    vi.stubGlobal("fetch", mockFetch({ oneDraft: [confirmed(FOUR, 5)] }));
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atSetup();
    expect(screen.getByText(t.boundaryScopeTitle)).toBeTruthy();
    expect(screen.queryByRole("button", { name: t.setupGenerateCta })).toBeNull();
    expect(screen.getByText(t.setupPending)).toBeTruthy();
    // Nothing preselected, and the count is announced.
    expect(screen.getByText(t.boundaryScopeCount(0, 3))).toBeTruthy();
  });

  it("1-3 rules need no scope decision and go straight to the forward action", async () => {
    vi.stubGlobal("fetch", mockFetch({ oneDraft: [confirmed(["Only rule."], 5)] }));
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atSetup();
    expect(screen.getByText(t.boundaryScopeAllActive)).toBeTruthy();
    expect(screen.getByRole("button", { name: t.setupGenerateCta })).toBeTruthy();
    // No selector is offered, and the rule is stated once — not restated by a second panel.
    expect(screen.queryByText(t.boundaryScopeTitle)).toBeNull();
    expect(screen.getAllByText("Only rule.")).toHaveLength(1);
  });

  it("a confirmed boundary with NO rules shows no scope selector at all", async () => {
    vi.stubGlobal("fetch", mockFetch({ oneDraft: [confirmed([], 5)] }));
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atSetup();
    expect(screen.queryByText(t.boundaryScopeTitle)).toBeNull();
    expect(screen.queryByText(t.boundaryScopeAllActive)).toBeNull();
    expect(screen.getByRole("button", { name: t.setupGenerateCta })).toBeTruthy();
  });
});

describe("[R5B2] the forward action reuses the existing generation path", () => {
  it("one action reaches the editor, through /regenerate — no second implementation", async () => {
    vi.stubGlobal("fetch", mockFetch({ oneDraft: [confirmed(["A rule."], 5)] }));
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atSetup();
    fireEvent.click(screen.getByRole("button", { name: t.setupGenerateCta }));
    await waitFor(() => expect(screen.getByText(t.editTitle)).toBeTruthy());
    expect(regenCalls()).toHaveLength(1);
    expect(regenCalls()[0].method).toBe("POST");
    expect(regenCalls()[0].body.locale).toBe("en");
    // The boundary is read from the SERVER; a generation request never carries one.
    expect(regenCalls()[0].body).not.toHaveProperty("boundary");
  });

  it("a duplicate press does not become a second generation request", async () => {
    vi.stubGlobal("fetch", mockFetch({ oneDraft: [confirmed(["A rule."], 5)] }));
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atSetup();
    const btn = screen.getByRole("button", { name: t.setupGenerateCta });
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByText(t.editTitle)).toBeTruthy());
    expect(regenCalls()).toHaveLength(1);
  });

  it("a generation failure returns to setup with the boundary intact and no raw code", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        oneDraft: [confirmed(["A rule."], 5)],
        regenerate: () => jsonRes({ error: "boundary_confirmation_required" }, false, 400),
      }),
    );
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atSetup();
    fireEvent.click(screen.getByRole("button", { name: t.setupGenerateCta }));
    // R5A — a response carrying no product code is treated as an unnamed internal failure and
    // gets the honest line for that, rather than the old single generic retry sentence.
    await waitFor(() => expect(screen.getByText(t.genFailInternal)).toBeTruthy());
    expect(screen.getByText(t.setupTitle)).toBeTruthy();
    expect(screen.getByText("A rule.")).toBeTruthy(); // the confirmed boundary is still there
    expect(document.body.textContent).not.toMatch(/boundary_confirmation_required/);
    expect(screen.getByRole("button", { name: t.setupGenerateCta })).toBeTruthy(); // recoverable
  });
});

describe("[R5B2] LEGACY drafts keep the behaviour they had", () => {
  it("no boundary surface is imposed, and the draft stays ready as before", async () => {
    vi.stubGlobal("fetch", mockFetch({ oneDraft: [LEGACY_SHELL] }));
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atSetup();
    expect(screen.queryByText(t.boundaryTitle)).toBeNull();
    expect(screen.queryByRole("button", { name: t.boundaryConfirmCta })).toBeNull();
    expect(screen.getByText(t.boundaryScopeReady)).toBeTruthy();
    expect(screen.getByRole("button", { name: t.setupGenerateCta })).toBeTruthy();
  });
});

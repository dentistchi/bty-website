/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { ArenaPracticeFlow } from "./ArenaPracticeFlow";
import { ARENA_PRACTICE_COPY } from "./arenaPracticeCopy";

const SOURCE = {
  event_id: "evt-1",
  event_title: "Opening the Office Safely",
  event_status: "open",
  module_version: 3,
  arena_recommended: true,
  capability: "Follow the opening protocol",
  expected_behavior: "Check the safety steps",
  success_evidence: null,
  audience_type: "leaders",
  audience_detail: null,
  learning_needs: ["decide"],
  hardest_when_options: ["time_limited"],
  avoidance_seeds: ["time"],
};

const DRAFT = {
  id: "draft-1",
  scenario_draft: null,
  generation_source: null,
  revision: 9,
  generation_input_revision: 3,
  guided_answers: {
    practiceSetupVersion: 1,
    practiceBoundary: { mode: "judgment", confirmed: true, constraints: [] },
  },
};

const enGovernance = {
  generationInputRevision: 3,
  generationLocale: "en" as const,
  refusalCount: 0,
  state: "ready" as const,
  canStartGeneration: true,
  requiresExplicitConfirmation: false,
  reviewSetupRecommended: false,
};

const koGovernance = {
  generationInputRevision: 3,
  generationLocale: "ko" as const,
  refusalCount: 1,
  state: "confirm_second_attempt" as const,
  canStartGeneration: false,
  requiresExplicitConfirmation: true,
  reviewSetupRecommended: true,
};

function jsonRes(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

function fetchForLocale(calls: string[]) {
  return vi.fn(async (url: string) => {
    const u = String(url);
    calls.push(u);
    if (u.includes("/arena-source/")) return jsonRes({ source: SOURCE });
    if (u.includes("/arena-drafts?")) return jsonRes({ drafts: [{ id: DRAFT.id }] });
    if (u.endsWith("/publish")) return jsonRes({ practice: null });
    if (u === `/api/bty/foundry/arena-drafts/${DRAFT.id}?locale=ko`) return jsonRes({ draft: DRAFT, governance: koGovernance });
    if (u === `/api/bty/foundry/arena-drafts/${DRAFT.id}?locale=en`) return jsonRes({ draft: DRAFT, governance: enGovernance });
    throw new Error(`unmocked fetch: ${u}`);
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("ArenaPracticeFlow draft reopen governance locale", () => {
  it("reopens the exact Korean refusal epoch with locale=ko and renders confirmation instead of ordinary creation", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", fetchForLocale(calls));
    render(<ArenaPracticeFlow eventId="evt-1" locale="ko" onBack={() => {}} />);

    await waitFor(() => expect(screen.getByTestId("practice-governance-panel").dataset.governanceState).toBe("confirm_second_attempt"));
    expect(calls).toContain(`/api/bty/foundry/arena-drafts/${DRAFT.id}?locale=ko`);
    expect(screen.queryByRole("button", { name: ARENA_PRACTICE_COPY.ko.setupGenerateCta })).toBeNull();
    expect(screen.getByRole("button", { name: "설정 검토" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "한 번 더 시도" })).toBeTruthy();
  });

  it("requests locale=en for the independent English history", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", fetchForLocale(calls));
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);

    await waitFor(() => expect(screen.getByRole("button", { name: ARENA_PRACTICE_COPY.en.setupGenerateCta })).toBeTruthy());
    expect(calls).toContain(`/api/bty/foundry/arena-drafts/${DRAFT.id}?locale=en`);
    expect(screen.queryByTestId("practice-governance-panel")).toBeNull();
  });
});

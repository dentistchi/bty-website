/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { ModuleBuilderShell } from "./ModuleBuilderShell";

/**
 * SLICE 3.2P-R2.1 — THE REVIEW SCREEN MUST NAME WHAT IS MISSING.
 *
 * The Review screen computed the program blockers correctly and then threw them away:
 * they were passed only when the journey was NOT approvable. A v2 inherits its parent's
 * complete five-element journey, so it IS approvable — and the three kinds the Host's own
 * intent still requires were the only blockers that existed and the only ones hidden.
 *
 * This renders the real Builder against the pilot v2's exact shape. The server refuses the
 * same case independently (`guidedPublishCompleteness.test.ts`); this proves the Host is told.
 */
const jsonRes = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const el = (kind: string, content: string) => ({
  id: `el_${kind}`, kind, content,
  grounding: [{ sourceType: "host_statement", field: "problem" }],
  confirmationStatus: "grounded",
});

/** The pilot v2's inherited answers: five grounded elements, seven required kinds. */
const V2_ANSWERS = {
  problem: "During morning huddles, team members report problems but leave without naming who will act.",
  audienceType: "leaders",
  evidenceType: "confirmed",
  followUpDays: 7,
  learningNeeds: ["shared_standard", "practice"],
  materialIntent: "pdf",
  sharedQuestion: "In your own words, what is the most important standard from this training?",
  successEvidence: "The huddle note records one owner and one deadline for every agreed action.",
  arenaRecommended: true,
  completionPrompt: "What specific phrases will you use in the next huddle to confirm the owner and deadline?",
  observableBehavior: "At the next huddle, what exact words will you use to confirm the owner, action, and deadline?",
  capabilityCandidate: "Accountability",
  realityGroundedJourneyV1: {
    version: 1,
    displayTitle: "End Every Huddle With an Owner and Deadline",
    displayTitleStatus: "grounded",
    elements: [
      el("why_it_matters", "During morning huddles, problems are reported but nobody is named."),
      el("observable_standard", "At the next huddle, what exact words will you use?"),
      el("reflection", "In your own words, what is the most important standard from this training?"),
      el("evidence", "The huddle note records one owner and one deadline for every agreed action."),
      el("completion_check", "What specific phrases will you use in the next huddle?"),
    ],
  },
};

function server(answers: Record<string, unknown>) {
  return vi.fn(async (url: string) => {
    if (url.includes("/assets")) return jsonRes({ assets: [] });
    if (url.includes("/program-draft")) return jsonRes({ attempt: null });
    if (url.includes("/api/bty/foundry/modules/")) {
      return jsonRes({
        draft: {
          id: "v2", status: "draft", current_step: 8, answers,
          module_version: 2, parent_module_id: "v1",
          document_asset_ref_present: false, created_at: "t", updated_at: "t",
        },
      });
    }
    return jsonRes({});
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", server(V2_ANSWERS));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("[3.2P-R2.1] Review names the missing program sections", () => {
  it("an APPROVABLE inherited journey still shows the three kinds the Host's intent requires", async () => {
    render(<ModuleBuilderShell draftId="v2" locale="en" initialView="review" onExit={() => {}} />);

    await waitFor(() => {
      expect(screen.getAllByText(/is missing from the program/i).length).toBeGreaterThan(0);
    });
    const blockers = screen.getAllByText(/is missing from the program/i).map((n) => n.textContent ?? "");
    expect(blockers, `shown:\n${blockers.join("\n")}`).toHaveLength(3);

    // The Builder's OWN human-readable labels, not the internal enum names.
    const joined = blockers.join(" | ");
    for (const label of ["In context", "Apply it", "What happens next"]) {
      expect(joined, `missing label: ${label}`).toContain(label);
    }
    for (const raw of ["scenario", "field_application", "follow_up"]) {
      expect(joined, `internal enum leaked: ${raw}`).not.toContain(raw);
    }
  });

  it("a COMPLETE journey shows no program blockers", async () => {
    vi.stubGlobal("fetch", server({
      ...V2_ANSWERS,
      realityGroundedJourneyV1: {
        ...V2_ANSWERS.realityGroundedJourneyV1,
        elements: [
          el("why_it_matters", "During morning huddles, problems are reported but nobody is named."),
          el("observable_standard", "The huddle leader names one owner and one deadline."),
          el("scenario", "The huddle is running late and people are already standing to leave."),
          el("reflection", "In your own words, what is the most important standard from this training?"),
          el("field_application", "At the next morning huddle, name one owner and one deadline."),
          el("evidence", "The huddle note records one owner and one deadline for every agreed action."),
          el("completion_check", "What specific phrases will you use in the next huddle?"),
          el("follow_up", "In seven days you will be asked what you actually said."),
        ],
      },
    }));
    render(<ModuleBuilderShell draftId="v2" locale="en" initialView="review" onExit={() => {}} />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).toBeNull(), { timeout: 3000 }).catch(() => {});
    expect(screen.queryAllByText(/is missing from the program/i)).toHaveLength(0);
  });
});

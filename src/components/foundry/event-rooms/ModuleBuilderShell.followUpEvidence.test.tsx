/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, within } from "@testing-library/react";
import { ModuleBuilderShell } from "./ModuleBuilderShell";

/**
 * SLICE R4-R2C — NO-FOLLOW-UP EVIDENCE TRUTH, ON THE LAST SCREEN BEFORE PUBLISH.
 *
 * Measured defect: a Host could choose "No follow-up", author and freeze a real observable
 * standard (required for every program regardless of follow-up), publish — and never be told that
 * no obligation would be materialized and therefore no colleague would ever be asked to confirm
 * the behaviour. The Review screen printed "No follow-up" and stopped there.
 *
 * ALLOW IT, BUT NEVER HIDE WHAT IT MEANS. These tests prove the choice is still valid, still
 * approvable, still not an error — and now explained. The 7/30 rows must be untouched.
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

/**
 * A complete draft whose ONLY variable is the follow-up choice. It carries a grounded
 * `observable_standard` deliberately: that is precisely the case the silence was worst for — a
 * real behaviour standard, frozen and published, that nobody would ever be asked about.
 */
const ANSWERS = (followUpDays: number) => ({
  title: "Close the Loop",
  problem: "During morning huddles, team members report problems but leave without naming who will act.",
  audienceType: "leaders",
  evidenceType: "confirmed",
  followUpDays,
  learningNeeds: ["shared_standard"],
  materialIntent: "pdf",
  successEvidence: "The huddle note records one owner and one deadline for every agreed action.",
  arenaRecommended: false,
  completionPrompt: "What exact words will you use in the next huddle?",
  recurringMoment: "During morning huddles",
  observableBehavior: "The huddle leader names one owner and one deadline before the huddle ends.",
  capabilityCandidate: "Accountability",
  realityGroundedJourneyV1: {
    version: 1,
    displayTitle: "End Every Huddle With an Owner and Deadline",
    displayTitleStatus: "grounded",
    elements: [
      el("why_it_matters", "During morning huddles, problems are reported but nobody is named."),
      el("observable_standard", "The huddle leader names one owner and one deadline before the huddle ends."),
      el("completion_check", "What exact words will you use in the next huddle?"),
      /*
        A scheduled checkpoint requires two more program elements (`requiredProgramKinds`), so
        each fixture is a genuinely COMPLETE draft for its own follow-up choice. Otherwise the
        7/30 cases would carry unrelated program blockers and a reader could not tell which
        difference the test was actually about.
      */
      ...(followUpDays > 0
        ? [
            el("field_application", "At the next morning huddle, name one owner and one deadline."),
            el("follow_up", "You will be asked what you actually said."),
          ]
        : []),
    ],
  },
});

function server(answers: Record<string, unknown>) {
  return vi.fn(async (url: string) => {
    if (url.includes("/assets")) return jsonRes({ assets: [] });
    if (url.includes("/program-draft")) return jsonRes({ attempt: null });
    if (url.includes("/api/bty/foundry/modules/")) {
      return jsonRes({
        draft: {
          id: "d1", status: "draft", current_step: 9, answers,
          module_version: 1, parent_module_id: null,
          document_asset_ref_present: false, created_at: "t", updated_at: "t",
        },
      });
    }
    return jsonRes({});
  });
}

async function renderReview(followUpDays: number, locale: "en" | "ko" = "en") {
  vi.stubGlobal("fetch", server(ANSWERS(followUpDays)));
  render(<ModuleBuilderShell draftId="d1" locale={locale} initialView="review" onExit={() => {}} />);
  return await waitFor(() => screen.getByTestId("review-row-followUp"));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("[R4-R2C] the Review screen tells the truth about No follow-up", () => {
  it("followUpDays = 0 — the choice is shown AND what it means is said out loud", async () => {
    const row = await renderReview(0);

    // The choice itself is unchanged.
    expect(row.textContent).toContain("No follow-up");

    // The disclosure: both halves, because either alone is a half-truth.
    const meaning = within(row).getByTestId("review-row-meaning").textContent ?? "";
    expect(meaning).toMatch(/no follow-up will be created/i);
    expect(meaning).toMatch(/no independent observation will be requested/i);
  });

  it("followUpDays = 0 is VALID — not missing, not required, not an error", async () => {
    /*
      The Founder decision, pinned at the surface: a lower evidence ceiling is a legitimate
      product choice. If this row ever renders as a blocking section, the slice has drifted into
      forcing follow-up on every training.
    */
    const row = await renderReview(0);
    expect(row.getAttribute("data-missing")).toBeNull();
    expect(within(row).queryByTestId("required-badge")).toBeNull();
    // Precisely: the follow-up section is never named in the "needs attention" list.
    expect(screen.queryAllByTestId("review-missing-item-followUp")).toHaveLength(0);

    // It must not borrow the amber "reconsider this" channel either.
    const meaningEl = within(row).getByTestId("review-row-meaning");
    expect(meaningEl.className).not.toContain("amber");
  });

  it("followUpDays = 7 — existing behaviour, no new sentence", async () => {
    const row = await renderReview(7);
    expect(row.textContent).toContain("In 7 days");
    expect(within(row).queryByTestId("review-row-meaning")).toBeNull();
  });

  it("followUpDays = 30 — existing behaviour, no new sentence", async () => {
    const row = await renderReview(30);
    expect(row.textContent).toContain("In 30 days");
    expect(within(row).queryByTestId("review-row-meaning")).toBeNull();
  });

  it("the disclosure is localized, not English pinned into a Korean screen", async () => {
    const row = await renderReview(0, "ko");
    const meaning = within(row).getByTestId("review-row-meaning").textContent ?? "";
    expect(meaning).toContain("후속 확인");
    expect(meaning).toContain("제3자 관찰");
  });

  it("an UNANSWERED follow-up gets no meaning — and the existing missing behaviour is untouched", async () => {
    /*
      SLICE R4-R2C-R1, gates I and J. An ordinary draft that has not reached the question yet must
      not be told what "No follow-up" means: nobody chose it. The row falls through to exactly the
      behaviour it had before either slice — empty value, Required badge, named in the
      needs-attention list — which is what makes this a fall-through and not a new state.
    */
    const row = await renderReview(undefined as unknown as number);
    expect(within(row).queryByTestId("review-row-meaning")).toBeNull();

    expect(row.getAttribute("data-missing")).toBe("true");
    expect(within(row).getByTestId("required-badge")).toBeTruthy();
    expect(screen.getAllByTestId("review-missing-item-followUp").length).toBeGreaterThan(0);
    expect(row.textContent).toContain("Not added yet");
  });

  it("a CORRUPT persisted value gets no meaning — an unreadable value is not a decision", async () => {
    /*
      The R2C-R1 regression itself. `validateDraftPatch` refuses to persist a 5, but the draft READ
      path re-validates nothing, so a value written out-of-band arrives here intact. Before the
      repair it would have been reported to the Host as their own deliberate choice to skip
      follow-up. It is now indistinguishable from unanswered, which is the truth about it.
    */
    const row = await renderReview(5);
    expect(within(row).queryByTestId("review-row-meaning")).toBeNull();
    expect(row.getAttribute("data-missing")).toBe("true");
    expect(row.textContent).not.toContain("No follow-up");
  });

  it("says nothing about the OTHER rows — the disclosure is scoped to the follow-up choice", async () => {
    /*
      A training with no follow-up still teaches, still freezes its standard and still records a
      completion. Only the follow-up/observation claim is withdrawn, so exactly one row carries a
      meaning line.
    */
    await renderReview(0);
    expect(screen.getAllByTestId("review-row-meaning")).toHaveLength(1);
  });
});

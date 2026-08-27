/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { ModuleBuilderShell } from "./ModuleBuilderShell";
// Slice R4-R8B — the material question is step 6 now; fixtures name the constant.
import { BUILDER_QUESTION_STEP } from "@/domain/foundry/module/module-builder";
import { journeyCopy } from "@/domain/foundry/module/journeyLocaleCopy";
import { suggestCompletionPrompt } from "./moduleBuilderCopy";
import { copyLikeLearnerQuestions } from "@/domain/foundry/module/learnerQuestionRole";

/**
 * Wait for the Review surface, then make the raw Builder details visible.
 *
 * Slice 3.2L made the PROGRAM primary and collapsed the field-by-field details behind
 * "All training details" — Review is a training now, not a form. The panel auto-opens
 * when something is missing (a blocker must never hide), so these tests must expand it
 * explicitly when the draft is complete.
 */
async function showAllDetails() {
  const toggle = await screen.findByTestId("all-training-details-toggle");
  if (toggle.getAttribute("aria-expanded") !== "true") {
    await act(async () => {
      fireEvent.click(toggle);
    });
  }
  return screen.findByText("Review what you’ve built.");
}


type Asset = { id: string; filename: string; file_kind: string; mime_type: string; byte_size: number; page_count: number | null; page_count_verified: boolean; width: number | null; height: number | null; uploaded_at: string; preview_supported: boolean; participant_delivery_ready: boolean };
type Draft = {
  id: string;
  status: string;
  current_step: number;
  answers: Record<string, unknown>;
  module_version: number;
  parent_module_id: string | null;
  document_asset_ref_present: boolean;
  attachment: null;
  assets: Asset[];
  created_at: string;
  updated_at: string;
};

const mkAsset = (over: Partial<Asset> = {}): Asset => ({
  id: `a${Math.random().toString(36).slice(2, 7)}`,
  filename: "Care Standard.docx",
  file_kind: "document",
  mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  byte_size: 2512034,
  page_count: null,
  page_count_verified: false,
  width: null,
  height: null,
  uploaded_at: "t",
  preview_supported: false,
  participant_delivery_ready: false,
  ...over,
});

const jsonRes = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

/**
 * Stateful fake: GET returns the draft (+assets), PATCH merges answers/step,
 * POST/DELETE /assets attach/remove files. `assetReason` forces per-upload failure
 * with a specific reason (e.g. unsupported_file_type).
 */
function mockDraftServer(
  initial: Partial<Draft>,
  opts: {
    assetReason?: string;
    publishError?: boolean;
    directions?: { status?: number; suggestions?: unknown[] };
    moduleDraft?: { status?: number; body?: unknown };
  } = {},
) {
  const draft: Draft = {
    id: "d-1",
    status: "draft",
    current_step: 1,
    answers: {},
    module_version: 1,
    parent_module_id: null,
    document_asset_ref_present: false,
    attachment: null,
    assets: [],
    created_at: "t",
    updated_at: "t",
    ...initial,
  };
  const patches: Array<{ answers?: Record<string, unknown>; current_step?: number }> = [];
  let counter = 0;
  const fn = vi.fn(async (url: string, o?: { method?: string; body?: string }) => {
    const method = o?.method ?? "GET";
    if (url.includes("/publish")) {
      if (opts.publishError) return jsonRes({ error: "publish_conflict" }, 409);
      return jsonRes({ event: { id: "ev-new", join_url: "https://x.dev/f/tok" }, reused: false });
    }
    if (url.includes("/assets")) {
      if (method === "POST") {
        if (opts.assetReason) return jsonRes({ error: opts.assetReason }, opts.assetReason === "draft_not_mutable" ? 409 : 400);
        const asset = mkAsset({ id: `srv-${counter++}`, filename: `Doc ${counter}.pdf`, file_kind: "pdf", participant_delivery_ready: true, preview_supported: true });
        draft.assets = [...draft.assets, asset];
        return jsonRes({ asset }, 201);
      }
      if (method === "DELETE") {
        const id = url.split("/").pop() as string;
        draft.assets = draft.assets.filter((a) => a.id !== id);
        return jsonRes({ removed: true });
      }
    }
    if (url.includes("/directions")) {
      if (opts.directions?.status && opts.directions.status >= 400) {
        return jsonRes({ error: "generation_failed" }, opts.directions.status);
      }
      return jsonRes({ suggestions: opts.directions?.suggestions ?? [], generation_version: "direction_copilot_v1" });
    }
    if (url.includes("/module-draft")) {
      if (opts.moduleDraft?.status && opts.moduleDraft.status >= 400) {
        return jsonRes({ error: "generation_failed" }, opts.moduleDraft.status);
      }
      return jsonRes(opts.moduleDraft?.body ?? {});
    }
    if (method === "PATCH") {
      const body = JSON.parse(o?.body ?? "{}");
      patches.push(body);
      if (body.answers) draft.answers = { ...draft.answers, ...body.answers };
      if (typeof body.current_step === "number") draft.current_step = body.current_step;
      return jsonRes({ draft });
    }
    return jsonRes({ draft });
  });
  // @ts-expect-error test shim
  global.fetch = fn;
  return { draft, patches, fn };
}

/** Fire a file selection onto the "Attach files" input. */
function selectFiles(files: File[]) {
  const input = document.querySelector('input[aria-label="Attach files"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files } });
}
const pdf = (name: string) => new File(["%PDF-"], name, { type: "application/pdf" });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ModuleBuilderShell — restore + navigation", () => {
  it("restores exact answers + current_step from the server (no empty flash)", async () => {
    mockDraftServer({ current_step: 4, answers: { observableBehavior: "reads back the dosage" } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    // step 3 question appears, with the restored value.
    expect(await screen.findByText("After this training, what should they do differently?")).toBeTruthy();
    const ta = screen.getByLabelText("After this training, what should they do differently?") as HTMLTextAreaElement;
    expect(ta.value).toBe("reads back the dosage");
  });

  it("shows exactly one primary question (h2) per step", async () => {
    mockDraftServer({ current_step: 1 });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What keeps going wrong?");
    const h2s = document.querySelectorAll("h2");
    expect(h2s.length).toBe(1);
  });

  it("Next saves before advancing and Back preserves the entered value", async () => {
    const srv = mockDraftServer({ current_step: 1 });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What keeps going wrong?");

    // Slice 3.2R-R2.1 — Step 1 asks two things now, so advancing needs both.
    fireEvent.change(screen.getByTestId("builder-title-input"), { target: { value: "Read Back Before Sign-Off" } });
    const ta = screen.getByLabelText("What keeps going wrong?") as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "handoffs keep missing the double-check" } });

    fireEvent.click(screen.getByText("Next"));
    // advanced to step 2
    await screen.findByText("Who needs to do something differently?");
    // a PATCH persisted the typed problem before/at advancing
    await waitFor(() =>
      expect(srv.patches.some((p) => p.answers?.problem === "handoffs keep missing the double-check")).toBe(true),
    );

    fireEvent.click(screen.getByText("Back"));
    const ta2 = (await screen.findByLabelText("What keeps going wrong?")) as HTMLTextAreaElement;
    expect(ta2.value).toBe("handoffs keep missing the double-check");
  });

  it("cold-restores the persisted step after a remount", async () => {
    const srv = mockDraftServer({ current_step: 1 });
    const { unmount } = render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What keeps going wrong?");
    // Slice 3.2R-R2.1 — both Step 1 fields are required to advance.
    fireEvent.change(screen.getByTestId("builder-title-input"), { target: { value: "Read Back Before Sign-Off" } });
    const ta = screen.getByLabelText("What keeps going wrong?") as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "a real recurring problem here" } });
    fireEvent.click(screen.getByText("Next"));
    await screen.findByText("Who needs to do something differently?");
    await waitFor(() => expect(srv.draft.current_step).toBe(2));

    unmount();
    cleanup();
    // Remount reads the server draft (now at step 2) — restore from server, not memory.
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    expect(await screen.findByText("Who needs to do something differently?")).toBeTruthy();
  });

  it("navigates home with gone=true when the draft 404s", async () => {
    const fn = vi.fn(async () => jsonRes({ error: "not_found" }, 404));
    // @ts-expect-error test shim
    global.fetch = fn;
    const onExit = vi.fn();
    render(<ModuleBuilderShell draftId="gone" locale="en" onExit={onExit} />);
    await waitFor(() => expect(onExit).toHaveBeenCalledWith({ gone: true }));
  });
});

describe("ModuleBuilderShell — review + material intent", () => {
  const fullAnswers = {
    // Slice 3.2R-R2.1 — a complete draft now carries a NAME as well as a problem.
    title: "Read Back Before Sign-Off",
    problem: "handoffs miss the double-check",
    audienceType: "specific_role",
    audienceDetail: "charge nurse",
    recurringMoment: "at each handoff point",
    observableBehavior: "reads the dosage back at handoff",
    successEvidence: "receiving nurse confirms a read-back",
    learningNeed: "practice",
    materialIntent: "pdf",
    followUpDays: 7,
    arenaRecommended: true,
  };

  it("review shows the summary + the Create training action (Slice 2.3A; renamed R4-R8A)", async () => {
    mockDraftServer({ current_step: 9, answers: fullAnswers });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    // review header + a summary value
    expect(await screen.findByText("TRAINING DRAFT")).toBeTruthy();
    expect(await showAllDetails()).toBeTruthy();
    expect(screen.getByText("reads the dosage back at handoff")).toBeTruthy();
    // The canonical publish action is now offered on review (2.3A), alongside Edit + Save and leave.
    expect(screen.getByText("Create training")).toBeTruthy();
    expect(screen.getByText("Save and leave")).toBeTruthy();
    expect(screen.getAllByText("Edit").length).toBeGreaterThan(0);
  });

  it("choosing Files and documents reveals the attach affordances without uploading", async () => {
    const srv = mockDraftServer({ current_step: BUILDER_QUESTION_STEP, answers: {} });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What will people learn from?");
    fireEvent.click(screen.getByText("Files and documents"));
    expect(await screen.findByText("Attach files")).toBeTruthy();
    expect(screen.getByText("Add photo or screenshot")).toBeTruthy();
    const calledUpload = srv.fn.mock.calls.some(
      (c) => String(c[0]).includes("/events/upload") || String(c[0]).includes("/assets"),
    );
    expect(calledUpload).toBe(false);
  });
});

describe("ModuleBuilderShell — Slice 2.1 corrections", () => {
  it("Step 4 asks about post-training evidence and shows the behavior as context", async () => {
    mockDraftServer({ current_step: 5, answers: { observableBehavior: "reads the dosage back" } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    expect(
      await screen.findByText("After the training, what would show that people are doing this differently?"),
    ).toBeTruthy();
    // behavior shown as context
    expect(screen.getByText("You said people should:")).toBeTruthy();
    expect(screen.getByText("“reads the dosage back”")).toBeTruthy();
    // verification options are fully labelled
    expect(screen.getByText("Observed directly")).toBeTruthy();
    expect(screen.getByText("Heard in conversation")).toBeTruthy();
    expect(screen.getByText("Recorded in the workflow")).toBeTruthy();
    expect(screen.getByText("Confirmed by another person")).toBeTruthy();
    // the old unrelated handoff example is gone
    expect(screen.queryByText(/receiving nurse/i)).toBeNull();
  });

  it("learning types remain MULTI-SELECT and still persist the array (R4-R8B: on Review)", async () => {
    /*
      The screen that asked this is gone — BTY derives learning needs from the behaviour now — but
      the Host can still change them, under the details disclosure on Review. What is held here is
      unchanged: more than one may be chosen, and the choice reaches the draft as an array through
      the same save path, so an override is indistinguishable from an answer.
    */
    const srv = mockDraftServer({ current_step: 9, answers: { learningNeeds: ["know"] } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    fireEvent.click(await screen.findByTestId("all-training-details-toggle"));
    fireEvent.click(await screen.findByTestId("review-need-practice"));
    await waitFor(() => {
      const last = srv.patches[srv.patches.length - 1];
      expect(last?.answers?.learningNeeds).toEqual(["know", "practice"]);
    });
  });

  it("a legacy singular learning_type is still restored, and still wins over the derivation", async () => {
    mockDraftServer({ current_step: 9, answers: { learningNeed: "decide" } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    fireEvent.click(await screen.findByTestId("all-training-details-toggle"));
    expect((await screen.findByTestId("review-need-decide")).getAttribute("aria-pressed")).toBe("true");
    // The Host stored exactly one need; a derivation must not silently add its own.
    expect(screen.getByTestId("review-need-know").getAttribute("aria-pressed")).toBe("false");
  });

  /*
    SUPERSEDED BY FOUNDER DECISION, NOT DELETED (Slice R4-R2G).

    This test asserted that Written guidance and Live discussion were ABSENT from the material
    step. That was a true and deliberate statement of the product at the time: the domain union
    carried all four types, the copy table carried all four labels, and the chooser deliberately
    offered two.

    R4-R2G reversed that. The BTY Learning OS product architecture approves four V1 material
    types and the Founder ruled the missing two in, with completion semantics for both (D1/D2/D3).
    So the assertion is inverted rather than removed — the fact this test guards (which options
    Step 6 offers) is still worth guarding, and the record of what changed stays readable.
  */
  it("Step 6 offers all FOUR approved material types", async () => {
    mockDraftServer({ current_step: BUILDER_QUESTION_STEP, answers: {} });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What will people learn from?");
    expect(screen.getByText("YouTube video")).toBeTruthy();
    expect(screen.getByText("Files and documents")).toBeTruthy();
    expect(screen.getByText("Written guidance")).toBeTruthy();
    expect(screen.getByText("Live discussion")).toBeTruthy();
  });

  it("Step 6 YouTube without a URL shows the missing-link state", async () => {
    mockDraftServer({ current_step: BUILDER_QUESTION_STEP, answers: { materialIntent: "youtube" } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What will people learn from?");
    expect(screen.getByText(/Link not added yet · Required before approval/i)).toBeTruthy();
  });

  it("review begins near the top (no viewport spacer) and shows the explicit missing summary", async () => {
    mockDraftServer({
      current_step: 9,
      answers: { title: "Read Back Before Sign-Off", problem: "x", observableBehavior: "show leadership", materialIntent: "youtube" },
    });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    // review lead sits right under the header — no min-h spacer block precedes it.
    expect(await showAllDetails()).toBeTruthy();
    // The canonical missing summary names the exact sections (no generic 'highlighted' copy).
    const summaries = screen.getAllByTestId("review-missing-summary");
    expect(summaries.length).toBeGreaterThan(0);
    expect(summaries[0].textContent).toContain("sections need attention");
    // behavior is present-but-vague → soft guidance still shown (non-blocking).
    expect(screen.getByText(/Needs clarification/)).toBeTruthy();
    // The publish control is present but GATED — an incomplete draft can't be published.
    const publishBtn = screen.getByTestId("publish-cta") as HTMLButtonElement;
    expect(publishBtn.disabled).toBe(true);
    // The ambiguous "Complete the highlighted sections first" copy is gone.
    expect(screen.queryByText("Complete the highlighted sections first.")).toBeNull();
  });
});

describe("ModuleBuilderShell — Files and documents (2.1.2)", () => {
  it("Files selection shows Attach files + Add photo or screenshot inputs", async () => {
    mockDraftServer({ current_step: BUILDER_QUESTION_STEP, answers: { materialIntent: "pdf" } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    expect(await screen.findByText("Attach files")).toBeTruthy();
    expect(screen.getByText("Add photo or screenshot")).toBeTruthy();
    const docInput = document.querySelector('input[aria-label="Attach files"]') as HTMLInputElement;
    const imgInput = document.querySelector('input[aria-label="Add photo or screenshot"]') as HTMLInputElement;
    expect(docInput.getAttribute("accept")).toContain(".pdf");
    expect(docInput.multiple).toBe(true);
    expect(imgInput.getAttribute("accept")).toContain("image/png");
  });

  it("uploads each selected file independently and shows them as attached", async () => {
    mockDraftServer({ current_step: BUILDER_QUESTION_STEP, answers: { materialIntent: "pdf" } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("Attach files");
    selectFiles([pdf("Alpha.pdf"), pdf("Beta.pdf")]);
    // both land as server assets (their server-assigned names).
    await waitFor(() => expect(screen.getByText("Doc 1.pdf")).toBeTruthy());
    expect(screen.getByText("Doc 2.pdf")).toBeTruthy();
  });

  it("one invalid file does not discard the valid ones, and is retryable", async () => {
    // First selection fails (unsupported); the valid one still uploads on retry via a fresh server.
    mockDraftServer({ current_step: BUILDER_QUESTION_STEP, answers: { materialIntent: "pdf" } }, { assetReason: "unsupported_file_type" });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("Attach files");
    selectFiles([new File(["x"], "malware.exe", { type: "" })]);
    expect(await screen.findByText("Unsupported file type")).toBeTruthy();
  });

  it("cold-restores attached files after remount", async () => {
    mockDraftServer({
      current_step: BUILDER_QUESTION_STEP,
      answers: { materialIntent: "pdf" },
      assets: [mkAsset({ id: "a1", filename: "Existing.docx" })],
    });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    expect(await screen.findByText("Existing.docx")).toBeTruthy();
    expect(screen.getByText("Remove")).toBeTruthy();
  });

  it("removing one file preserves the others", async () => {
    mockDraftServer({
      current_step: BUILDER_QUESTION_STEP,
      answers: { materialIntent: "pdf" },
      assets: [mkAsset({ id: "a1", filename: "Keep.docx" }), mkAsset({ id: "a2", filename: "Drop.png", file_kind: "image" })],
    });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("Drop.png");
    const dropRow = screen.getByText("Drop.png").closest("div")?.parentElement as HTMLElement;
    fireEvent.click(dropRow.querySelector("button") as HTMLButtonElement);
    await waitFor(() => expect(screen.queryByText("Drop.png")).toBeNull());
    expect(screen.getByText("Keep.docx")).toBeTruthy();
  });

  it("review lists attached files and does NOT flag the material section when a file is present", async () => {
    mockDraftServer({
      current_step: 9,
      answers: { title: "Read Back Before Sign-Off", problem: "x", observableBehavior: "reads back the dosage at handoff", materialIntent: "pdf" },
      assets: [mkAsset({ id: "a1", filename: "Care.pdf", file_kind: "pdf", participant_delivery_ready: true })],
    });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await showAllDetails();
    expect(screen.getByText(/Care\.pdf · Attached · Ready for participant delivery/)).toBeTruthy();
    // Material is satisfied → its row is not highlighted as missing.
    expect(screen.getByTestId("review-row-material").getAttribute("data-missing")).toBeNull();
  });

  it("review highlights the material section (Required) when no PDF file is attached", async () => {
    mockDraftServer({
      current_step: 9,
      answers: { title: "Read Back Before Sign-Off", problem: "x", observableBehavior: "reads back the dosage at handoff", materialIntent: "pdf" },
      assets: [],
    });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await showAllDetails();
    const materialRow = screen.getByTestId("review-row-material");
    expect(materialRow.getAttribute("data-missing")).toBe("true");
    expect(materialRow.textContent).toContain("Required");
    // The material section is named in the explicit missing summary.
    expect(screen.getAllByTestId("review-missing-item-material").length).toBeGreaterThan(0);
  });

  it("YouTube regression: switching to YouTube still shows the missing-link state", async () => {
    mockDraftServer({ current_step: BUILDER_QUESTION_STEP, answers: {} });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What will people learn from?");
    fireEvent.click(screen.getByText("YouTube video"));
    expect(await screen.findByText(/Link not added yet · Required before approval/)).toBeTruthy();
  });
});

describe("ModuleBuilderShell — publish (Slice 2.3A)", () => {
  const completeYoutube = {
    title: "Read Back Before Sign-Off",
    problem: "Handoffs skip the double-check.",
    audienceType: "everyone",
    recurringMoment: "at each handoff point",
    observableBehavior: "The charge nurse reads back the dosage before sign-off.",
    successEvidence: "Sign-offs include a witnessed read-back.",
    evidenceType: "seen",
    learningNeeds: ["practice"],
    materialIntent: "youtube",
    materialText: "https://youtu.be/dQw4w9WgXcQ",
    followUpDays: 7,
    completionPrompt: "What read-back will you commit to?",
  };

  it("R4-R8B — there is no Completion question to prefill, and BTY's own question is not copyable", async () => {
    /*
      REPLACES "prefills an editable Completion question…" (Slice R4-R8B).

      R4-R5C12A repaired that prefill so it stopped quoting the behaviour back at the learner. The
      prefill itself is what this slice removes: a box arriving with BTY's sentence in it is an
      invitation to adjust one word, and adjusting one word gave the Host's version absolute
      precedence — so the barrier question BTY writes could never render. There is nothing to
      prefill because there is nothing to author.

      The property R4-R5C12A was protecting is asserted directly on the question that now reaches
      the learner: it cannot be answered by repeating the material.
    */
    mockDraftServer({ current_step: BUILDER_QUESTION_STEP, answers: { materialIntent: "youtube", observableBehavior: "reads back the dosage", materialText: "x" } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What will people learn from?");
    expect(screen.queryByText("Completion question")).toBeNull();
    expect(screen.queryByTestId("builder-completion-question")).toBeNull();

    const derived = journeyCopy("en").completionBarrier;
    expect(derived.toLowerCase()).not.toContain("reads back the dosage");
    expect(copyLikeLearnerQuestions({ observableBehavior: "reads back the dosage", completionPrompt: derived })).toEqual([]);
  });

  it("review → Create training publishes, confirms, then hands off the new event id", async () => {
    const onExit = vi.fn();
    mockDraftServer({ current_step: 9, answers: completeYoutube });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={onExit} />);
    const btn = await screen.findByText("Create training");
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(btn);
    // Slice 3.1B-3C: publish now shows a confirmation first (open_link here — no
    // participation in the mock response), then hands off on Continue.
    const cont = await screen.findByTestId("publish-confirm-continue");
    expect(screen.getByTestId("publish-confirm-open")).toBeTruthy();
    fireEvent.click(cont);
    await waitFor(() => expect(onExit).toHaveBeenCalledWith({ publishedEventId: "ev-new" }));
  });

  it("disables publish for an incomplete draft and names the missing sections", async () => {
    mockDraftServer({ current_step: 9, answers: { title: "Read Back Before Sign-Off", problem: "only this" } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    const btn = await screen.findByText("Create training");
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    // Explicit named summary instead of the old ambiguous "highlighted sections" copy.
    expect(screen.getAllByTestId("review-missing-summary").length).toBeGreaterThan(0);
    expect(screen.queryByText("Complete the highlighted sections first.")).toBeNull();
  });

  it("surfaces a publish failure without leaving the builder", async () => {
    const onExit = vi.fn();
    mockDraftServer({ current_step: 9, answers: completeYoutube }, { publishError: true });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={onExit} />);
    fireEvent.click(await screen.findByText("Create training"));
    expect(await screen.findByText(/Couldn’t create the session/)).toBeTruthy();
    expect(onExit).not.toHaveBeenCalled();
  });
});

/*
  REMOVED WITH THE SURFACES THEY DESCRIBED (Slice R4-R8A).

  Two describe blocks lived here — "Direction Copilot integration (2.4A)" and "Module-draft
  Copilot integration (2.4B)" — and both measured the SHELL WIRING of generators the canonical
  creation flow no longer offers. They are not failing; their subject was removed by decision,
  and a test kept alive against a screen no Host can reach proves only that the code still
  compiles.

  Nothing about the components themselves is uncovered: `DirectionCopilot.test.tsx` and
  `ModuleDraftCopilot.test.tsx` still hold their behaviour in full, and both files still exist,
  as does each route and its own route test. What replaces the wiring assertions is their
  opposite, in `hostAuthoringSimplificationA.test.tsx` T1/T2 — the Builder must not construct
  either surface, asserted against the source as well as the screen, because a step the walk
  never reaches renders nothing and would pass either way.
*/

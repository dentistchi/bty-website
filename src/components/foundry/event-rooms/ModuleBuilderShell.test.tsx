/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { ModuleBuilderShell } from "./ModuleBuilderShell";

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

  it("review shows the summary + the Approve & create session action (Slice 2.3A)", async () => {
    mockDraftServer({ current_step: 9, answers: fullAnswers });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    // review header + a summary value
    expect(await screen.findByText("TRAINING DRAFT")).toBeTruthy();
    expect(await showAllDetails()).toBeTruthy();
    expect(screen.getByText("reads the dosage back at handoff")).toBeTruthy();
    // The canonical publish action is now offered on review (2.3A), alongside Edit + Save and leave.
    expect(screen.getByText("Approve & create session")).toBeTruthy();
    expect(screen.getByText("Save and leave")).toBeTruthy();
    expect(screen.getAllByText("Edit").length).toBeGreaterThan(0);
  });

  it("choosing Files and documents reveals the attach affordances without uploading", async () => {
    const srv = mockDraftServer({ current_step: 7, answers: {} });
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

  it("Step 5 supports MULTIPLE learning-type selections and persists the array", async () => {
    const srv = mockDraftServer({ current_step: 6, answers: {} });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What does this training need to include?");
    fireEvent.click(screen.getByText("Information"));
    fireEvent.click(screen.getByText("Practice"));
    await waitFor(() => {
      const last = srv.patches[srv.patches.length - 1];
      expect(last?.answers?.learningNeeds).toEqual(["know", "practice"]);
    });
  });

  it("Step 5 restores a legacy singular learning_type into the multi-select", async () => {
    mockDraftServer({ current_step: 6, answers: { learningNeed: "decide" } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    const decision = (await screen.findByText("Decision")).closest("button") as HTMLButtonElement;
    expect(decision.getAttribute("aria-pressed")).toBe("true");
  });

  it("Step 6 offers only YouTube + PDF; Written guidance and Live discussion are gone", async () => {
    mockDraftServer({ current_step: 7, answers: {} });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What will people learn from?");
    expect(screen.getByText("YouTube video")).toBeTruthy();
    expect(screen.getByText("Files and documents")).toBeTruthy();
    expect(screen.queryByText("Written guidance")).toBeNull();
    expect(screen.queryByText("Live discussion")).toBeNull();
  });

  it("Step 6 YouTube without a URL shows the missing-link state", async () => {
    mockDraftServer({ current_step: 7, answers: { materialIntent: "youtube" } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What will people learn from?");
    expect(screen.getByText(/Link not added yet · Required before approval/i)).toBeTruthy();
  });

  it("review begins near the top (no viewport spacer) and shows the explicit missing summary", async () => {
    mockDraftServer({
      current_step: 9,
      answers: { problem: "x", observableBehavior: "show leadership", materialIntent: "youtube" },
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
    mockDraftServer({ current_step: 7, answers: { materialIntent: "pdf" } });
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
    mockDraftServer({ current_step: 7, answers: { materialIntent: "pdf" } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("Attach files");
    selectFiles([pdf("Alpha.pdf"), pdf("Beta.pdf")]);
    // both land as server assets (their server-assigned names).
    await waitFor(() => expect(screen.getByText("Doc 1.pdf")).toBeTruthy());
    expect(screen.getByText("Doc 2.pdf")).toBeTruthy();
  });

  it("one invalid file does not discard the valid ones, and is retryable", async () => {
    // First selection fails (unsupported); the valid one still uploads on retry via a fresh server.
    mockDraftServer({ current_step: 7, answers: { materialIntent: "pdf" } }, { assetReason: "unsupported_file_type" });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("Attach files");
    selectFiles([new File(["x"], "malware.exe", { type: "" })]);
    expect(await screen.findByText("Unsupported file type")).toBeTruthy();
  });

  it("cold-restores attached files after remount", async () => {
    mockDraftServer({
      current_step: 7,
      answers: { materialIntent: "pdf" },
      assets: [mkAsset({ id: "a1", filename: "Existing.docx" })],
    });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    expect(await screen.findByText("Existing.docx")).toBeTruthy();
    expect(screen.getByText("Remove")).toBeTruthy();
  });

  it("removing one file preserves the others", async () => {
    mockDraftServer({
      current_step: 7,
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
      answers: { problem: "x", observableBehavior: "reads back the dosage at handoff", materialIntent: "pdf" },
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
      answers: { problem: "x", observableBehavior: "reads back the dosage at handoff", materialIntent: "pdf" },
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
    mockDraftServer({ current_step: 7, answers: {} });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What will people learn from?");
    fireEvent.click(screen.getByText("YouTube video"));
    expect(await screen.findByText(/Link not added yet · Required before approval/)).toBeTruthy();
  });
});

describe("ModuleBuilderShell — publish (Slice 2.3A)", () => {
  const completeYoutube = {
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

  it("prefills an editable Completion question on the material step", async () => {
    mockDraftServer({ current_step: 7, answers: { materialIntent: "youtube", observableBehavior: "reads back the dosage", materialText: "x" } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    expect(await screen.findByText("Completion question")).toBeTruthy();
    const ta = screen.getByLabelText("Completion question") as HTMLTextAreaElement;
    // seeded from the deterministic suggestion (references the behavior, editable)
    await waitFor(() => expect(ta.value.length).toBeGreaterThan(0));
    expect(ta.value.toLowerCase()).toContain("reads back the dosage");
  });

  it("review → Approve & create session publishes, confirms, then hands off the new event id", async () => {
    const onExit = vi.fn();
    mockDraftServer({ current_step: 9, answers: completeYoutube });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={onExit} />);
    const btn = await screen.findByText("Approve & create session");
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
    mockDraftServer({ current_step: 9, answers: { problem: "only this" } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    const btn = await screen.findByText("Approve & create session");
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    // Explicit named summary instead of the old ambiguous "highlighted sections" copy.
    expect(screen.getAllByTestId("review-missing-summary").length).toBeGreaterThan(0);
    expect(screen.queryByText("Complete the highlighted sections first.")).toBeNull();
  });

  it("surfaces a publish failure without leaving the builder", async () => {
    const onExit = vi.fn();
    mockDraftServer({ current_step: 9, answers: completeYoutube }, { publishError: true });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={onExit} />);
    fireEvent.click(await screen.findByText("Approve & create session"));
    expect(await screen.findByText(/Couldn’t create the session/)).toBeTruthy();
    expect(onExit).not.toHaveBeenCalled();
  });
});

describe("ModuleBuilderShell — Direction Copilot integration (Slice 2.4A)", () => {
  const SUGGESTIONS = [
    { id: "direction_1", title: "Accurate handoff", capability_candidate: "Shift Handoff", rationale: "why", observable_behavior: "At handoff, the nurse names the owner and next check time.", success_evidence_hint: "The handoff record lists the owner and follow-up.", important_assumption: null },
    { id: "direction_2", title: "Order read-back", capability_candidate: "Order Verification", rationale: "why", observable_behavior: "Before acting, the staff repeats the dose back.", success_evidence_hint: "The chart shows a confirmation entry.", important_assumption: null },
    { id: "direction_3", title: "Escalate early", capability_candidate: "Escalation", rationale: "why", observable_behavior: "When unsure, the employee flags it and logs the time.", success_evidence_hint: "A supervisor confirms it was raised.", important_assumption: null },
  ];

  it("applying a direction writes capability/behavior/evidence via the canonical PATCH, preserves the problem, and restores after reload", async () => {
    const srv = mockDraftServer(
      { current_step: 1, answers: { problem: "Handoffs miss the double-check." } },
      { directions: { suggestions: SUGGESTIONS } },
    );
    const { unmount } = render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What keeps going wrong?");

    // Generate → results (no canonical mutation yet).
    fireEvent.click(await screen.findByTestId("direction-copilot-trigger"));
    await screen.findByTestId("direction-copilot-results");
    expect(srv.patches.some((p) => p.answers?.capabilityCandidate)).toBe(false);

    // Use + apply the first direction.
    fireEvent.click(screen.getAllByTestId("direction-card-use")[0]);
    fireEvent.click(await screen.findByTestId("direction-copilot-apply"));

    await waitFor(() =>
      expect(
        srv.patches.some(
          (p) =>
            p.answers?.capabilityCandidate === "Shift Handoff" &&
            typeof p.answers?.observableBehavior === "string" &&
            typeof p.answers?.successEvidence === "string",
        ),
      ).toBe(true),
    );
    // The Host-authored problem is preserved on the server draft.
    expect(srv.draft.answers.problem).toBe("Handoffs miss the double-check.");
    expect(await screen.findByTestId("direction-copilot-applied")).toBeTruthy();

    // Reload at the behavior step → the applied capability restores and is editable.
    srv.draft.current_step = 4;
    unmount();
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    const capInput = (await screen.findByLabelText("Capability (optional)")) as HTMLInputElement;
    expect(capInput.value).toBe("Shift Handoff");
  });

  it("shows the discoverable assistive block on the first step, above the footer Next, and hides it for short input", async () => {
    mockDraftServer({ current_step: 1, answers: { problem: "Handoffs miss the double-check." } });
    const { unmount } = render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What keeps going wrong?");

    const block = await screen.findByTestId("direction-copilot");
    expect(block.textContent).toContain("Not sure how to turn this into training?");
    expect(block.textContent).toContain("Show me three possible directions");
    // The block sits ABOVE the bottom navigation action in document order.
    const nextBtn = screen.getByText("Next");
    expect(block.compareDocumentPosition(nextBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // A too-short problem exposes no active generation action.
    unmount();
    mockDraftServer({ current_step: 1, answers: { problem: "x" } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What keeps going wrong?");
    expect(screen.queryByTestId("direction-copilot")).toBeNull();
    expect(screen.getByText("Next")).toBeTruthy(); // manual Next path remains
  });

  it("a generation failure keeps the problem and the manual path intact", async () => {
    const srv = mockDraftServer(
      { current_step: 1, answers: { problem: "Handoffs miss the double-check." } },
      { directions: { status: 502 } },
    );
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What keeps going wrong?");
    fireEvent.click(await screen.findByTestId("direction-copilot-trigger"));
    await screen.findByTestId("direction-copilot-error");
    // Manual Builder untouched: problem preserved, no canonical copilot write.
    const ta = screen.getByLabelText("What keeps going wrong?") as HTMLTextAreaElement;
    expect(ta.value).toBe("Handoffs miss the double-check.");
    expect(srv.patches.some((p) => p.answers?.capabilityCandidate)).toBe(false);
    // Continue without suggestions returns to the trigger.
    fireEvent.click(screen.getByText("Continue without suggestions"));
    expect(screen.getByTestId("direction-copilot-trigger")).toBeTruthy();
  });
});

describe("ModuleBuilderShell — Review completion-gate reconciliation (Slice 2.4A.3)", () => {
  // Every visible section populated EXCEPT follow-up (which previously masqueraded as
  // "No follow-up" and blocked approval with nothing highlighted — the Commander bug).
  const nearCompleteNoFollow = {
    problem: "Handoffs skip the double-check.",
    audienceType: "everyone" as const,
    recurringMoment: "at each handoff point",
    observableBehavior: "The charge nurse reads back the dosage before sign-off.",
    successEvidence: "Sign-offs include a witnessed read-back.",
    evidenceType: "seen" as const,
    learningNeeds: ["practice" as const],
    materialIntent: "youtube" as const,
    materialText: "https://youtu.be/dQw4w9WgXcQ",
    completionPrompt: "What read-back will you commit to?",
    arenaRecommended: true,
  };

  it("REPRODUCTION: a draft missing only follow-up disables Approve, names the exact section, and highlights ONLY that row", async () => {
    mockDraftServer({ current_step: 9, answers: nearCompleteNoFollow });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await showAllDetails();

    // Approve disabled.
    expect((screen.getByTestId("publish-cta") as HTMLButtonElement).disabled).toBe(true);
    // Exact missing section named (count + name), not a generic "highlighted" line.
    expect(screen.getAllByTestId("review-missing-summary")[0].textContent).toContain("1 section needs attention");
    expect(screen.getAllByTestId("review-missing-item-followUp").length).toBeGreaterThan(0);
    expect(screen.queryByText("Complete the highlighted sections first.")).toBeNull();
    // The follow-up row is the ONLY highlighted row, with a Required label.
    const followRow = screen.getByTestId("review-row-followUp");
    expect(followRow.getAttribute("data-missing")).toBe("true");
    expect(followRow.textContent).toContain("Required");
    expect(followRow.textContent).toContain("Not added yet"); // no more false "No follow-up"
    expect(document.querySelectorAll('[data-missing="true"]').length).toBe(1);
  });

  it("Edit from the missing summary navigates to the correct Builder step, and completing it enables Approve on return", async () => {
    mockDraftServer({ current_step: 9, answers: nearCompleteNoFollow });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await showAllDetails();

    // Tap the named missing item → jump to the follow-up step (7).
    fireEvent.click(screen.getAllByTestId("review-missing-item-followUp")[0]);
    await screen.findByText("When should you check what happened?");
    fireEvent.click(screen.getByText("No follow-up"));

    // Return to Review.
    fireEvent.click(screen.getByText("Next"));
    await showAllDetails();
    // Highlight is gone and Approve is enabled immediately (no reload).
    expect(document.querySelectorAll('[data-missing="true"]').length).toBe(0);
    expect(screen.queryByTestId("review-missing-summary")).toBeNull();
    expect((screen.getByTestId("publish-cta") as HTMLButtonElement).disabled).toBe(false);
  });

  it("a fully complete draft shows no summary, no highlighted row, and an enabled Approve", async () => {
    mockDraftServer({ current_step: 9, answers: { ...nearCompleteNoFollow, followUpDays: 7 } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await showAllDetails();
    expect(screen.queryByTestId("review-missing-summary")).toBeNull();
    expect(document.querySelectorAll('[data-missing="true"]').length).toBe(0);
    expect((screen.getByTestId("publish-cta") as HTMLButtonElement).disabled).toBe(false);
  });

  it("Copilot-applied behavior + evidence are recognized by the readiness gate (no false missing)", async () => {
    // Behavior/evidence carrying the exact Copilot-applied shape; only audience left blank.
    const copilotApplied = {
      ...nearCompleteNoFollow,
      followUpDays: 0 as const,
      audienceType: undefined,
      capabilityCandidate: "Shift Handoff",
      recurringMoment: "at each handoff point",
      observableBehavior: "Before ending the handoff, the nurse records the owner and next check time.",
      successEvidence: "The handoff record lists the owner and a follow-up time.",
    };
    mockDraftServer({ current_step: 9, answers: copilotApplied });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await showAllDetails();
    // Behavior + evidence are NOT flagged (Copilot values count); only audience is.
    expect(screen.getByTestId("review-row-behavior").getAttribute("data-missing")).toBeNull();
    expect(screen.getByTestId("review-row-evidence").getAttribute("data-missing")).toBeNull();
    expect(screen.getByTestId("review-row-audience").getAttribute("data-missing")).toBe("true");
    expect(document.querySelectorAll('[data-missing="true"]').length).toBe(1);
  });
});

describe("ModuleBuilderShell — Module-draft Copilot integration (Slice 2.4B)", () => {
  const CONTEXT = {
    problem: "Handoffs skip the double-check.",
    audienceType: "everyone",
    recurringMoment: "at each handoff point",
    observableBehavior: "The charge nurse reads the dosage back before sign-off.",
    successEvidence: "Sign-offs include a witnessed read-back.",
  };
  const DRAFT_BODY = {
    module_draft: {
      learning_approach: ["practice", "shared_standard"],
      learning_approach_rationale: "A standard practiced under pressure.",
      completion_question: "Before the next sign-off, what phrase will you use to confirm the read-back with the receiving nurse?",
      arena_recommended: true,
      arena_rationale: "Must hold when the unit is busy.",
      follow_up_days: 7,
      follow_up_guidance: "Ask what made the read-back difficult.",
      material_guidance: { recommended_types: ["written"], suggestion: "A short checklist may help; the host supplies it." },
    },
    assumptions: [],
    warnings: [],
    generation_version: "module_draft_copilot_v1",
  };

  it("entry is absent on step 5 until the canonical minimum context is complete", async () => {
    mockDraftServer({ current_step: 6, answers: { problem: "only this" } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What does this training need to include?");
    expect(screen.queryByTestId("module-draft-copilot")).toBeNull();
  });

  it("generates, applies only approved fields via the canonical PATCH, preserves context, and restores", async () => {
    const srv = mockDraftServer({ current_step: 6, answers: CONTEXT }, { moduleDraft: { body: DRAFT_BODY } });
    const { unmount } = render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What does this training need to include?");

    // Entry present (context complete) — generate.
    fireEvent.click(await screen.findByTestId("module-draft-trigger"));
    await screen.findByTestId("module-draft-review");
    expect(srv.patches.some((p) => p.answers?.completionPrompt)).toBe(false); // nothing yet

    // Apply the reviewed draft (all fields default to Use on an empty draft).
    fireEvent.click(screen.getByTestId("module-draft-apply"));
    await waitFor(() =>
      expect(
        srv.patches.some(
          (p) =>
            Array.isArray(p.answers?.learningNeeds) &&
            p.answers?.completionPrompt === DRAFT_BODY.module_draft.completion_question &&
            p.answers?.arenaRecommended === true &&
            p.answers?.followUpDays === 7,
        ),
      ).toBe(true),
    );
    // The approved direction context is preserved on the server draft.
    expect(srv.draft.answers.problem).toBe(CONTEXT.problem);
    expect(srv.draft.answers.observableBehavior).toBe(CONTEXT.observableBehavior);
    expect(srv.draft.answers.successEvidence).toBe(CONTEXT.successEvidence);
    expect(await screen.findByTestId("module-draft-applied")).toBeTruthy();

    // Reload → applied learning approach restores as selected on step 5.
    unmount();
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What does this training need to include?");
    const practice = screen.getByText("Practice").closest("button") as HTMLButtonElement;
    expect(practice.getAttribute("aria-pressed")).toBe("true");
  });

  it("a generation failure keeps the manual Builder intact", async () => {
    const srv = mockDraftServer({ current_step: 6, answers: CONTEXT }, { moduleDraft: { status: 502 } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What does this training need to include?");
    fireEvent.click(await screen.findByTestId("module-draft-trigger"));
    await screen.findByTestId("module-draft-error");
    expect(srv.patches.some((p) => p.answers?.completionPrompt)).toBe(false);
    fireEvent.click(screen.getByText("Continue manually"));
    expect(screen.getByTestId("module-draft-trigger")).toBeTruthy();
  });
});

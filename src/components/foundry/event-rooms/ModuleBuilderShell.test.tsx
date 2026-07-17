/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ModuleBuilderShell } from "./ModuleBuilderShell";

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
  opts: { assetReason?: string; publishError?: boolean; directions?: { status?: number; suggestions?: unknown[] } } = {},
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
    mockDraftServer({ current_step: 3, answers: { observableBehavior: "reads back the dosage" } });
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
    observableBehavior: "reads the dosage back at handoff",
    successEvidence: "receiving nurse confirms a read-back",
    learningNeed: "practice",
    materialIntent: "pdf",
    followUpDays: 7,
    arenaRecommended: true,
  };

  it("review shows the summary + the Approve & create session action (Slice 2.3A)", async () => {
    mockDraftServer({ current_step: 8, answers: fullAnswers });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    // review header + a summary value
    expect(await screen.findByText("TRAINING DRAFT")).toBeTruthy();
    expect(screen.getByText("Review what you’ve built.")).toBeTruthy();
    expect(screen.getByText("reads the dosage back at handoff")).toBeTruthy();
    // The canonical publish action is now offered on review (2.3A), alongside Edit + Save and leave.
    expect(screen.getByText("Approve & create session")).toBeTruthy();
    expect(screen.getByText("Save and leave")).toBeTruthy();
    expect(screen.getAllByText("Edit").length).toBeGreaterThan(0);
  });

  it("choosing Files and documents reveals the attach affordances without uploading", async () => {
    const srv = mockDraftServer({ current_step: 6, answers: {} });
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
    mockDraftServer({ current_step: 4, answers: { observableBehavior: "reads the dosage back" } });
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
    const srv = mockDraftServer({ current_step: 5, answers: {} });
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
    mockDraftServer({ current_step: 5, answers: { learningNeed: "decide" } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    const decision = (await screen.findByText("Decision")).closest("button") as HTMLButtonElement;
    expect(decision.getAttribute("aria-pressed")).toBe("true");
  });

  it("Step 6 offers only YouTube + PDF; Written guidance and Live discussion are gone", async () => {
    mockDraftServer({ current_step: 6, answers: {} });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What will people learn from?");
    expect(screen.getByText("YouTube video")).toBeTruthy();
    expect(screen.getByText("Files and documents")).toBeTruthy();
    expect(screen.queryByText("Written guidance")).toBeNull();
    expect(screen.queryByText("Live discussion")).toBeNull();
  });

  it("Step 6 YouTube without a URL shows the missing-link state", async () => {
    mockDraftServer({ current_step: 6, answers: { materialIntent: "youtube" } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What will people learn from?");
    expect(screen.getByText(/Link not added yet · Required before approval/i)).toBeTruthy();
  });

  it("review begins near the top (no viewport spacer) and shows needs-attention", async () => {
    mockDraftServer({
      current_step: 8,
      answers: { problem: "x", observableBehavior: "show leadership", materialIntent: "youtube" },
    });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    // review lead sits right under the header — no min-h spacer block precedes it.
    expect(await screen.findByText("Review what you’ve built.")).toBeTruthy();
    // vague behavior + missing YouTube link => 2 needs-attention.
    expect(screen.getByText("Needs attention — 2")).toBeTruthy();
    expect(screen.getByText(/Needs clarification/)).toBeTruthy();
    // The publish control is present but GATED — an incomplete draft can't be published.
    const publishBtn = screen.getByText("Approve & create session") as HTMLButtonElement;
    expect(publishBtn.disabled).toBe(true);
    expect(screen.getByText("Complete the highlighted sections first.")).toBeTruthy();
  });
});

describe("ModuleBuilderShell — Files and documents (2.1.2)", () => {
  it("Files selection shows Attach files + Add photo or screenshot inputs", async () => {
    mockDraftServer({ current_step: 6, answers: { materialIntent: "pdf" } });
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
    mockDraftServer({ current_step: 6, answers: { materialIntent: "pdf" } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("Attach files");
    selectFiles([pdf("Alpha.pdf"), pdf("Beta.pdf")]);
    // both land as server assets (their server-assigned names).
    await waitFor(() => expect(screen.getByText("Doc 1.pdf")).toBeTruthy());
    expect(screen.getByText("Doc 2.pdf")).toBeTruthy();
  });

  it("one invalid file does not discard the valid ones, and is retryable", async () => {
    // First selection fails (unsupported); the valid one still uploads on retry via a fresh server.
    mockDraftServer({ current_step: 6, answers: { materialIntent: "pdf" } }, { assetReason: "unsupported_file_type" });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("Attach files");
    selectFiles([new File(["x"], "malware.exe", { type: "" })]);
    expect(await screen.findByText("Unsupported file type")).toBeTruthy();
  });

  it("cold-restores attached files after remount", async () => {
    mockDraftServer({
      current_step: 6,
      answers: { materialIntent: "pdf" },
      assets: [mkAsset({ id: "a1", filename: "Existing.docx" })],
    });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    expect(await screen.findByText("Existing.docx")).toBeTruthy();
    expect(screen.getByText("Remove")).toBeTruthy();
  });

  it("removing one file preserves the others", async () => {
    mockDraftServer({
      current_step: 6,
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

  it("review lists attached files (and honest requirement when none)", async () => {
    mockDraftServer({
      current_step: 8,
      answers: { problem: "x", observableBehavior: "reads back the dosage at handoff", materialIntent: "pdf" },
      assets: [mkAsset({ id: "a1", filename: "Care.pdf", file_kind: "pdf", participant_delivery_ready: true })],
    });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("Review what you’ve built.");
    expect(screen.getByText(/Care\.pdf · Attached · Ready for participant delivery/)).toBeTruthy();
    expect(screen.queryByText(/Needs attention/)).toBeNull();
  });

  it("review shows the requirement when no files are attached", async () => {
    mockDraftServer({
      current_step: 8,
      answers: { problem: "x", observableBehavior: "reads back the dosage at handoff", materialIntent: "pdf" },
      assets: [],
    });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("Review what you’ve built.");
    expect(screen.getByText(/No files attached yet/)).toBeTruthy();
    expect(screen.getByText("Needs attention — 1")).toBeTruthy();
  });

  it("YouTube regression: switching to YouTube still shows the missing-link state", async () => {
    mockDraftServer({ current_step: 6, answers: {} });
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
    mockDraftServer({ current_step: 6, answers: { materialIntent: "youtube", observableBehavior: "reads back the dosage", materialText: "x" } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    expect(await screen.findByText("Completion question")).toBeTruthy();
    const ta = screen.getByLabelText("Completion question") as HTMLTextAreaElement;
    // seeded from the deterministic suggestion (references the behavior, editable)
    await waitFor(() => expect(ta.value.length).toBeGreaterThan(0));
    expect(ta.value.toLowerCase()).toContain("reads back the dosage");
  });

  it("review → Approve & create session publishes and hands off the new event id", async () => {
    const onExit = vi.fn();
    mockDraftServer({ current_step: 8, answers: completeYoutube });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={onExit} />);
    const btn = await screen.findByText("Approve & create session");
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(btn);
    await waitFor(() => expect(onExit).toHaveBeenCalledWith({ publishedEventId: "ev-new" }));
  });

  it("disables publish for an incomplete draft (not ready)", async () => {
    mockDraftServer({ current_step: 8, answers: { problem: "only this" } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    const btn = await screen.findByText("Approve & create session");
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Complete the highlighted sections first.")).toBeTruthy();
  });

  it("surfaces a publish failure without leaving the builder", async () => {
    const onExit = vi.fn();
    mockDraftServer({ current_step: 8, answers: completeYoutube }, { publishError: true });
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
    srv.draft.current_step = 3;
    unmount();
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    const capInput = (await screen.findByLabelText("Capability (optional)")) as HTMLInputElement;
    expect(capInput.value).toBe("Shift Handoff");
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

/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ModuleBuilderShell } from "./ModuleBuilderShell";

type Attachment = { present: true; filename: string | null; byte_size: number; page_count: number; page_count_verified: boolean; uploaded_at: string };
type Draft = {
  id: string;
  status: string;
  current_step: number;
  answers: Record<string, unknown>;
  module_version: number;
  parent_module_id: string | null;
  document_asset_ref_present: boolean;
  attachment: Attachment | null;
  created_at: string;
  updated_at: string;
};

const jsonRes = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

/**
 * Stateful fake: GET returns the draft, PATCH merges answers/step, POST/DELETE
 * /document attach/remove the PDF. `docFail` forces the upload/remove to fail.
 */
function mockDraftServer(initial: Partial<Draft>, opts: { docFail?: boolean } = {}) {
  const draft: Draft = {
    id: "d-1",
    status: "draft",
    current_step: 1,
    answers: {},
    module_version: 1,
    parent_module_id: null,
    document_asset_ref_present: false,
    attachment: null,
    created_at: "t",
    updated_at: "t",
    ...initial,
  };
  const patches: Array<{ answers?: Record<string, unknown>; current_step?: number }> = [];
  const fn = vi.fn(async (url: string, o?: { method?: string; body?: string }) => {
    const method = o?.method ?? "GET";
    if (url.includes("/document")) {
      if (opts.docFail) return jsonRes({ error: method === "DELETE" ? "remove_failed" : "attach_failed" }, 502);
      if (method === "POST") {
        const att: Attachment = { present: true, filename: "Care Standard.pdf", byte_size: 2512034, page_count: 18, page_count_verified: true, uploaded_at: "t" };
        draft.attachment = att;
        draft.document_asset_ref_present = true;
        return jsonRes({ attachment: att, draft });
      }
      if (method === "DELETE") {
        draft.attachment = null;
        draft.document_asset_ref_present = false;
        return jsonRes({ draft });
      }
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

  it("review shows the summary and has NO approve/publish/create-session control", async () => {
    mockDraftServer({ current_step: 8, answers: fullAnswers });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    // review header + a summary value
    expect(await screen.findByText("TRAINING DRAFT")).toBeTruthy();
    expect(screen.getByText("Review what you’ve built.")).toBeTruthy();
    expect(screen.getByText("reads the dosage back at handoff")).toBeTruthy();
    // The forbidden actions must not exist.
    expect(screen.queryByText(/approve/i)).toBeNull();
    expect(screen.queryByText(/publish/i)).toBeNull();
    expect(screen.queryByText(/create session/i)).toBeNull();
    expect(screen.queryByText(/generate qr/i)).toBeNull();
    // Only Edit + Save and leave are offered.
    expect(screen.getByText("Save and leave")).toBeTruthy();
    expect(screen.getAllByText("Edit").length).toBeGreaterThan(0);
  });

  it("choosing PDF shows the Attach UI and never calls the legacy upload endpoint", async () => {
    const srv = mockDraftServer({ current_step: 6, answers: {} });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What will people learn from?");
    fireEvent.click(screen.getByText("PDF document"));
    // selecting PDF reveals the attach affordance — it does NOT upload on selection.
    expect(await screen.findByText("Attach PDF")).toBeTruthy();
    const calledUpload = srv.fn.mock.calls.some(
      (c) => String(c[0]).includes("/events/upload") || String(c[0]).includes("/document"),
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
    expect(screen.getByText("PDF document")).toBeTruthy();
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
    // still no approve/publish/session/QR controls.
    expect(screen.queryByText(/approve|publish|create session|generate qr/i)).toBeNull();
  });
});

describe("ModuleBuilderShell — PDF attachment (2.1.1)", () => {
  it("PDF selection shows Attach PDF backed by a PDF-only file input", async () => {
    mockDraftServer({ current_step: 6, answers: { materialIntent: "pdf" } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    expect(await screen.findByText("Attach a PDF your team will read.")).toBeTruthy();
    expect(screen.getByText("Attach PDF")).toBeTruthy();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.getAttribute("accept")).toBe("application/pdf");
  });

  it("uploading a valid PDF shows filename, page count, size, and Replace/Remove", async () => {
    mockDraftServer({ current_step: 6, answers: { materialIntent: "pdf" } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("Attach PDF");
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["%PDF-"], "Care Standard.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText("Care Standard.pdf")).toBeTruthy();
    expect(screen.getByText(/18 pages/)).toBeTruthy();
    expect(screen.getByText(/2\.4 MB/)).toBeTruthy();
    expect(screen.getByText("Replace PDF")).toBeTruthy();
    expect(screen.getByText("Remove")).toBeTruthy();
  });

  it("upload failure stays retryable", async () => {
    mockDraftServer({ current_step: 6, answers: { materialIntent: "pdf" } }, { docFail: true });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("Attach PDF");
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["%PDF-"], "x.pdf", { type: "application/pdf" })] } });
    expect(await screen.findByText(/Couldn’t upload the PDF/)).toBeTruthy();
    // still retryable (Attach PDF still present)
    expect(screen.getByText("Attach PDF")).toBeTruthy();
  });

  it("cold restore shows the attached PDF", async () => {
    mockDraftServer({
      current_step: 6,
      answers: { materialIntent: "pdf" },
      attachment: { present: true, filename: "Existing.pdf", byte_size: 1024, page_count: 3, page_count_verified: true, uploaded_at: "t" },
      document_asset_ref_present: true,
    });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    expect(await screen.findByText("Existing.pdf")).toBeTruthy();
    expect(screen.getByText("Remove")).toBeTruthy();
  });

  it("Remove clears the attachment state", async () => {
    mockDraftServer({
      current_step: 6,
      answers: { materialIntent: "pdf" },
      attachment: { present: true, filename: "Existing.pdf", byte_size: 1024, page_count: 3, page_count_verified: true, uploaded_at: "t" },
      document_asset_ref_present: true,
    });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("Existing.pdf");
    fireEvent.click(screen.getByText("Remove"));
    await waitFor(() => expect(screen.queryByText("Existing.pdf")).toBeNull());
    expect(screen.getByText("Attach PDF")).toBeTruthy();
  });

  it("review shows Ready when attached (needs-attention drops)", async () => {
    mockDraftServer({
      current_step: 8,
      answers: { problem: "x", observableBehavior: "reads back the dosage at handoff", materialIntent: "pdf" },
      attachment: { present: true, filename: "Care.pdf", byte_size: 2048, page_count: 12, page_count_verified: true, uploaded_at: "t" },
      document_asset_ref_present: true,
    });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("Review what you’ve built.");
    expect(screen.getByText(/12 pages · .* · Ready/)).toBeTruthy();
    // behavior is concrete + PDF ready => nothing needs attention.
    expect(screen.queryByText(/Needs attention/)).toBeNull();
  });

  it("YouTube regression: switching to YouTube still shows the missing-link state", async () => {
    mockDraftServer({ current_step: 6, answers: {} });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What will people learn from?");
    fireEvent.click(screen.getByText("YouTube video"));
    expect(await screen.findByText(/Link not added yet · Required before approval/)).toBeTruthy();
  });
});

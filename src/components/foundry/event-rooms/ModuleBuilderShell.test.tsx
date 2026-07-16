/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ModuleBuilderShell } from "./ModuleBuilderShell";

type Draft = {
  id: string;
  status: string;
  current_step: number;
  answers: Record<string, unknown>;
  module_version: number;
  parent_module_id: string | null;
  document_asset_ref_present: boolean;
  created_at: string;
  updated_at: string;
};

const jsonRes = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

/** Stateful fake: GET returns the draft, PATCH merges answers/step and echoes it. */
function mockDraftServer(initial: Partial<Draft>) {
  const draft: Draft = {
    id: "d-1",
    status: "draft",
    current_step: 1,
    answers: {},
    module_version: 1,
    parent_module_id: null,
    document_asset_ref_present: false,
    created_at: "t",
    updated_at: "t",
    ...initial,
  };
  const patches: Array<{ answers?: Record<string, unknown>; current_step?: number }> = [];
  const fn = vi.fn(async (_url: string, opts?: { method?: string; body?: string }) => {
    const method = opts?.method ?? "GET";
    if (method === "PATCH") {
      const body = JSON.parse(opts?.body ?? "{}");
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
    expect(await screen.findByText("DRAFT SAVED")).toBeTruthy();
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

  it("choosing PDF shows the deferred copy and never calls the upload endpoint", async () => {
    const srv = mockDraftServer({ current_step: 6, answers: { materialIntent: undefined } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What will people learn from?");
    fireEvent.click(screen.getByText("PDF document"));
    expect(await screen.findByText(/add the document before creating the session/i)).toBeTruthy();
    // no upload / staging-ticket call ever happened
    const calledUpload = srv.fn.mock.calls.some((c) => String(c[0]).includes("/events/upload"));
    expect(calledUpload).toBe(false);
    // no file input rendered
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});

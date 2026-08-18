/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { ModuleBuilderShell } from "./ModuleBuilderShell";

/**
 * R4-R2G — the Builder half of learning-material completeness.
 *
 * F1–F4, F6–F9, F13 and F14: the two new types can be chosen, their text persists, survives a
 * reload, and reaches Review distinguishably; switching type leaks no stale field; and Save /
 * Back / Next still behave.
 *
 * The YouTube and PDF proofs (F11, F12) live in `ModuleBuilderShell.test.tsx`, which already
 * owns them and passes unchanged — that is the regression evidence, and duplicating it here
 * would only create a second place for it to drift.
 */

const jsonRes = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

type Draft = {
  id: string;
  status: string;
  current_step: number;
  answers: Record<string, unknown>;
  module_version: number;
  parent_module_id: string | null;
  document_asset_ref_present: boolean;
  attachment: null;
  assets: unknown[];
  created_at: string;
  updated_at: string;
};

/** Stateful fake draft server — GET returns the row, PATCH merges into it. */
function mockDraftServer(initial: Partial<Draft>) {
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
  const fn = vi.fn(async (url: string, o?: { method?: string; body?: string }) => {
    const method = o?.method ?? "GET";
    if (url.includes("/publish")) return jsonRes({ event: { id: "ev-new", join_url: "https://x.dev/f/tok" }, reused: false });
    if (url.includes("/assets") || url.includes("/directions") || url.includes("/module-draft")) return jsonRes({});
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

async function showAllDetails() {
  const toggle = await screen.findByTestId("all-training-details-toggle");
  if (toggle.getAttribute("aria-expanded") !== "true") {
    await act(async () => {
      fireEvent.click(toggle);
    });
  }
}

const COMPLETE = {
  title: "Ask Before You Assume",
  problem: "People act on half a handover.",
  audienceType: "everyone",
  recurringMoment: "at each handoff point",
  observableBehavior: "The nurse asks one clarifying question before acting.",
  successEvidence: "Handovers include a clarifying question.",
  evidenceType: "heard",
  learningNeeds: ["know"],
  followUpDays: 7,
  completionPrompt: "What will you ask next time?",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("R4-R2G · F1/F6 — the two new types can be selected", () => {
  it("choosing Written guidance marks it selected and opens its text field", async () => {
    mockDraftServer({ current_step: 7, answers: {} });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What will people learn from?");

    const option = screen.getByText("Written guidance").closest("button")!;
    expect(option.getAttribute("aria-pressed")).toBe("false");
    await act(async () => {
      fireEvent.click(option);
    });
    expect(option.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("builder-guidance-material")).toBeTruthy();
    expect(screen.getByLabelText("Written guidance")).toBeTruthy();
  });

  it("choosing Live discussion marks it selected and opens its own field", async () => {
    mockDraftServer({ current_step: 7, answers: {} });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What will people learn from?");

    const option = screen.getByText("Live discussion").closest("button")!;
    await act(async () => {
      fireEvent.click(option);
    });
    expect(option.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByLabelText("Live discussion")).toBeTruthy();
  });

  it("only ONE material choice is active at a time", async () => {
    mockDraftServer({ current_step: 7, answers: { materialIntent: "youtube", materialText: "https://youtu.be/x" } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What will people learn from?");

    await act(async () => {
      fireEvent.click(screen.getByText("Written guidance").closest("button")!);
    });
    const pressed = Array.from(document.querySelectorAll('button[aria-pressed="true"]'));
    expect(pressed).toHaveLength(1);
    expect(pressed[0].textContent).toBe("Written guidance");
  });

  it("a Host choosing Live discussion is told what BTY cannot see — before they build on it", async () => {
    mockDraftServer({ current_step: 7, answers: { materialIntent: "live_discussion", materialText: "Where did we skip it?" } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What will people learn from?");

    const honesty = screen.getByTestId("builder-live-discussion-honesty");
    expect(honesty.textContent).toContain("can’t see the discussion");
    expect(honesty.textContent).toContain("said they took part");
  });

  it("no enum name reaches the Host on this screen", async () => {
    mockDraftServer({ current_step: 7, answers: { materialIntent: "live_discussion", materialText: "topic" } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What will people learn from?");
    const body = document.body.textContent ?? "";
    for (const raw of ["live_discussion", "written_guidance", "materialIntent", "materialText"]) {
      expect(body).not.toContain(raw);
    }
  });
});

describe("R4-R2G · F2/F7 — the text persists", () => {
  for (const [label, intent] of [
    ["Written guidance", "written"],
    ["Live discussion", "live_discussion"],
  ] as const) {
    it(`${label} text is saved to the draft`, async () => {
      const srv = mockDraftServer({ current_step: 7, answers: { materialIntent: intent } });
      render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
      await screen.findByText("What will people learn from?");

      const field = screen.getByLabelText(label) as HTMLTextAreaElement;
      await act(async () => {
        fireEvent.change(field, { target: { value: "Ask one question before you act." } });
      });
      await waitFor(() => expect(srv.draft.answers.materialText).toBe("Ask one question before you act."));
      expect(srv.draft.answers.materialIntent).toBe(intent);
    });
  }

  it("an empty guidance says so, and says it is required before approval", async () => {
    mockDraftServer({ current_step: 7, answers: { materialIntent: "written" } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What will people learn from?");
    expect(screen.getByText(/Guidance not written yet · Required before approval/i)).toBeTruthy();
  });
});

describe("R4-R2G · F3/F8 — the text survives reload / re-entry", () => {
  for (const [label, intent, text] of [
    ["Written guidance", "written", "Ask one question before you act."],
    ["Live discussion", "live_discussion", "Where did we act on half a handover?"],
  ] as const) {
    it(`${label} is restored from the server on a cold mount`, async () => {
      mockDraftServer({ current_step: 7, answers: { materialIntent: intent, materialText: text } });
      render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
      await screen.findByText("What will people learn from?");

      const field = (await screen.findByLabelText(label)) as HTMLTextAreaElement;
      expect(field.value).toBe(text);
      expect(screen.getByText(label).closest("button")!.getAttribute("aria-pressed")).toBe("true");
    });
  }
});

describe("R4-R2G · F4/F9 — Review distinguishes the four types at a glance", () => {
  for (const [intent, rowValue, text] of [
    ["written", "Written guidance", "Ask one question before you act."],
    ["live_discussion", "Live discussion", "Where did we act on half a handover?"],
  ] as const) {
    it(`Review names "${rowValue}" and shows which one it is`, async () => {
      mockDraftServer({ current_step: 9, answers: { ...COMPLETE, materialIntent: intent, materialText: text } });
      render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
      await showAllDetails();

      const materials = await screen.findByText("LEARNING MATERIALS");
      const row = materials.closest("div")!.parentElement!;
      expect(row.textContent).toContain(rowValue);
      // The Host's own first line rides along, so Review shows WHICH guidance.
      expect(row.textContent).toContain(text);
    });
  }

  it("an EMPTY guidance reads as missing and blocks Approve — never as finished", async () => {
    mockDraftServer({ current_step: 9, answers: { ...COMPLETE, materialIntent: "written", materialText: "" } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await showAllDetails();

    const publishBtn = (await screen.findByTestId("publish-cta")) as HTMLButtonElement;
    expect(publishBtn.disabled).toBe(true);
    // And the reason names the RIGHT thing — not "choose what people will learn from".
    expect(screen.getByText("Write the guidance your team will read.")).toBeTruthy();
  });

  it("a live discussion missing its topic gets its OWN sentence", async () => {
    mockDraftServer({ current_step: 9, answers: { ...COMPLETE, materialIntent: "live_discussion", materialText: "  " } });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await showAllDetails();
    expect(await screen.findByText("Add what the team should discuss.")).toBeTruthy();
  });

  it("a COMPLETE guidance draft is approvable", async () => {
    mockDraftServer({
      current_step: 9,
      answers: { ...COMPLETE, materialIntent: "written", materialText: "Ask one question before you act." },
    });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await showAllDetails();
    const publishBtn = (await screen.findByTestId("publish-cta")) as HTMLButtonElement;
    expect(publishBtn.disabled).toBe(false);
  });
});

describe("R4-R2G · F13 — switching type leaks no stale incompatible field", () => {
  it("a YouTube URL does not survive into the guidance a team will read", async () => {
    const srv = mockDraftServer({
      current_step: 7,
      answers: { materialIntent: "youtube", materialText: "https://youtu.be/dQw4w9WgXcQ" },
    });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What will people learn from?");

    await act(async () => {
      fireEvent.click(screen.getByText("Written guidance").closest("button")!);
    });

    await waitFor(() => expect(srv.draft.answers.materialIntent).toBe("written"));
    expect(srv.draft.answers.materialText).toBe("");
    const field = screen.getByLabelText("Written guidance") as HTMLTextAreaElement;
    expect(field.value).toBe("");
  });

  it("guidance text does not survive into a YouTube link field", async () => {
    const srv = mockDraftServer({
      current_step: 7,
      answers: { materialIntent: "written", materialText: "Ask one question before you act." },
    });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What will people learn from?");

    await act(async () => {
      fireEvent.click(screen.getByText("YouTube video").closest("button")!);
    });

    await waitFor(() => expect(srv.draft.answers.materialIntent).toBe("youtube"));
    expect(srv.draft.answers.materialText).toBe("");
  });

  it("re-tapping the ALREADY SELECTED type does not wipe the Host's work", async () => {
    const srv = mockDraftServer({
      current_step: 7,
      answers: { materialIntent: "written", materialText: "Ask one question before you act." },
    });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What will people learn from?");

    await act(async () => {
      fireEvent.click(screen.getByText("Written guidance").closest("button")!);
    });
    expect(srv.draft.answers.materialText).toBe("Ask one question before you act.");
  });
});

describe("R4-R2G · F14 — Save / Back / Next still behave", () => {
  it("Next advances from the material step and the guidance is already saved", async () => {
    const srv = mockDraftServer({
      current_step: 7,
      answers: { ...COMPLETE, materialIntent: "written", materialText: "Ask one question before you act." },
    });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("What will people learn from?");

    await act(async () => {
      fireEvent.click(screen.getByText("Next"));
    });
    await waitFor(() => expect(srv.draft.current_step).toBe(8));
    expect(srv.draft.answers.materialText).toBe("Ask one question before you act.");
  });

  it("Back returns to the material step with the guidance intact", async () => {
    const srv = mockDraftServer({
      current_step: 8,
      answers: { ...COMPLETE, materialIntent: "live_discussion", materialText: "Where did we act on half a handover?" },
    });
    render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);
    await screen.findByText("In 7 days");

    await act(async () => {
      fireEvent.click(screen.getByText("Back"));
    });
    const field = (await screen.findByLabelText("Live discussion")) as HTMLTextAreaElement;
    expect(field.value).toBe("Where did we act on half a handover?");
  });
});

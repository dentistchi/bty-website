/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { ModuleBuilderShell } from "./ModuleBuilderShell";
import { programContext, programContextFingerprint } from "@/domain/foundry/module/program-authorship";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

/**
 * SLICE 3.2L-R11.4K — a successful generation is unfinished user work.
 *
 * These mount the REAL Builder, unmount it the way ordinary navigation does — the shell is
 * keyed by draft id and re-lists from the server on tab re-entry, so an unmount is
 * guaranteed, not incidental — and mount it again. R11.4E-R1 is the standing lesson: a test
 * that never unmounts cannot see a defect whose whole nature is unmounting.
 */
const DRAFT = "093b0361-7cc8-4688-9f93-396d60582501";
const OTHER = "35773b57-219b-43fb-829e-80f0656ccb66";

const ANSWERS = {
  problem: "Our handoffs are inconsistent.",
  audienceType: "everyone",
  observableBehavior: "Create a shared handoff standard.",
  successEvidence: "Handoff record",
  evidenceType: "seen",
  learningNeeds: ["know", "decide", "practice"],
  materialIntent: "youtube",
  materialText: "https://youtu.be/x",
  completionPrompt: "What specific elements will you include in your handoff record?",
  arenaRecommended: true,
  followUpDays: 7,
} as unknown as BuilderAnswers;

const TITLE = "Handing over without gaps";
const PROGRAM = {
  displayTitle: TITLE,
  elements: [
    { kind: "why_it_matters", content: "When a handover misses a step, the next person starts without knowing what changed.", rationale: "" },
    { kind: "observable_standard", content: "The outgoing person states each open item aloud.", rationale: "" },
    { kind: "scenario", content: "The shift ran late and two people are already waiting.", rationale: "" },
    { kind: "action_decision", content: "I will decide which open items I always state aloud.", rationale: "" },
    { kind: "field_application", content: "At your next handover, you state the open items before leaving.", rationale: "" },
    { kind: "completion_check", content: "What will you say aloud at your next handover?", rationale: "" },
    { kind: "follow_up", content: "In seven days you will be asked what you actually said.", rationale: "" },
  ],
  assumptions: [],
  warnings: [],
};

const FINGERPRINT = programContextFingerprint(programContext(ANSWERS)!);

let generateCalls = 0;
let patchCalls = 0;

function stubFetch(answers: BuilderAnswers = ANSWERS, program: unknown = PROGRAM) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: { method?: string }) => {
      const u = String(url);
      if (u.includes("/program-draft")) {
        generateCalls += 1;
        return {
          ok: true,
          json: async () => ({
            program,
            evidence_ceiling: "Nothing here can show that behaviour changed.",
            attempt_id: "496302b6-26ec-4ea0-bad8-fb981ca2c596",
            context_fingerprint: FINGERPRINT,
          }),
        } as unknown as Response;
      }
      if ((init?.method ?? "GET") !== "GET") patchCalls += 1;
      const id = u.includes(OTHER) ? OTHER : DRAFT;
      return {
        ok: true,
        json: async () => ({ draft: { id, status: "draft", currentStep: 7, answers, assets: [] }, adoption: { ok: true } }),
      } as unknown as Response;
    }),
  );
}

function mount(draftId = DRAFT) {
  return render(<ModuleBuilderShell draftId={draftId} locale="en" initialView="review" onExit={() => {}} />);
}

async function generateOnce() {
  fireEvent.click(await screen.findByTestId("program-generate", {}, { timeout: 8000 }));
  fireEvent.click(await screen.findByTestId("program-target-confirm-action", {}, { timeout: 8000 }));
  await screen.findByTestId("program-review", {}, { timeout: 8000 });
}

/** The review surface is the proposal: it exists only when one is being shown. */
const proposalOnScreen = () => screen.queryByTestId("program-review") !== null;
const shownTitle = () => (screen.queryByTestId("program-title-input") as HTMLInputElement | null)?.value ?? null;
const shownSection = (kind: string) =>
  (screen.queryByTestId(`program-edit-${kind}`) as HTMLTextAreaElement | HTMLInputElement | null)?.value ??
  screen.queryByTestId(`program-section-${kind}`)?.textContent ??
  null;

beforeEach(() => {
  generateCalls = 0;
  patchCalls = 0;
  window.sessionStorage.clear();
  stubFetch();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("[3.2L-R11.4K] continuity through the real Builder", () => {
  it("G1 — a successful generation shows the proposal", async () => {
    mount();
    await generateOnce();
    expect(proposalOnScreen()).toBe(true);
    expect(shownTitle()).toBe(TITLE);
    for (const e of PROGRAM.elements) expect(shownSection(e.kind), e.kind).toContain(e.content.slice(0, 25));
    expect(generateCalls).toBe(1);
  }, 30000);

  it("G2/G4 — unmount (Learn home, or a reload) then reopen: the exact proposal is back", async () => {
    mount();
    await generateOnce();
    cleanup();                       // exactly what leaving the screen does
    stubFetch();
    mount();
    await waitFor(() => expect(proposalOnScreen()).toBe(true), { timeout: 8000 });
    // …and it is the SAME proposal, section for section.
    expect(shownTitle()).toBe(TITLE);
    for (const e of PROGRAM.elements) expect(shownSection(e.kind), e.kind).toContain(e.content.slice(0, 25));
  }, 30000);

  it("G3 — opening another draft does not leak it, and returning restores it", async () => {
    mount();
    await generateOnce();
    cleanup();
    stubFetch();
    mount(OTHER);
    await screen.findByTestId("program-generate", {}, { timeout: 8000 });
    expect(proposalOnScreen(), "another draft must never show this program").toBe(false);
    cleanup();
    stubFetch();
    mount();
    await waitFor(() => expect(proposalOnScreen()).toBe(true), { timeout: 8000 });
  }, 30000);

  it("G5/G6 — resuming spends nothing: no provider call, no attempt, no write", async () => {
    mount();
    await generateOnce();
    expect(generateCalls).toBe(1);
    cleanup();
    stubFetch();
    // Counted from the moment the Builder is re-entered, so the resume's own spend is what
    // is being measured — not the generation that legitimately happened before it.
    generateCalls = 0;
    const patchesBefore = patchCalls;
    mount();
    await waitFor(() => expect(proposalOnScreen()).toBe(true), { timeout: 8000 });
    expect(generateCalls, "resume must never reach the provider").toBe(0);
    expect(patchCalls, "resume must not write the draft").toBe(patchesBefore);
  }, 30000);

  it("G8 — a changed draft context makes the proposal ineligible rather than stale", async () => {
    mount();
    await generateOnce();
    cleanup();
    const moved = { ...ANSWERS, problem: "Our handoffs are inconsistent, and shifts overlap." } as BuilderAnswers;
    stubFetch(moved);
    mount();
    await screen.findByTestId("program-generate", {}, { timeout: 8000 });
    expect(proposalOnScreen()).toBe(false);
  }, 30000);

  it("G9 — a newer successful generation supersedes the cached one", async () => {
    mount();
    await generateOnce();
    cleanup();
    const NEWER = { ...PROGRAM, displayTitle: "The last five minutes" };
    stubFetch(ANSWERS, NEWER);
    mount();
    await waitFor(() => expect(proposalOnScreen()).toBe(true), { timeout: 8000 });
    // Discard the resumed one, generate again — the newer program replaces it everywhere.
    fireEvent.click(await screen.findByTestId("program-discard", {}, { timeout: 8000 }));
    await generateOnceNewer();
    cleanup();
    stubFetch(ANSWERS, NEWER);
    mount();
    await waitFor(() => expect(proposalOnScreen()).toBe(true), { timeout: 8000 });
    expect(shownTitle()).toBe("The last five minutes");
  }, 30000);

  it("G11 — Discard ends the continuity", async () => {
    mount();
    await generateOnce();
    fireEvent.click(await screen.findByTestId("program-discard", {}, { timeout: 8000 }));
    cleanup();
    stubFetch();
    mount();
    await screen.findByTestId("program-generate", {}, { timeout: 8000 });
    expect(proposalOnScreen()).toBe(false);
  }, 30000);

  it("G12 — the cache is keyed by draft, and a draft this session cannot open is never read", async () => {
    mount();
    await generateOnce();
    // A different Host's session cannot even mount this draft: the draft GET is
    // owner-scoped, so the id never reaches the Builder. The nearest reachable proof is
    // that no other draft id resolves to this entry.
    expect(window.sessionStorage.getItem(`bty_program_proposal_v1:${OTHER}`)).toBeNull();
    expect(window.sessionStorage.getItem(`bty_program_proposal_v1:${DRAFT}`)).not.toBeNull();
  }, 30000);
});

async function generateOnceNewer() {
  fireEvent.click(await screen.findByTestId("program-generate", {}, { timeout: 8000 }));
  fireEvent.click(await screen.findByTestId("program-target-confirm-action", {}, { timeout: 8000 }));
  await waitFor(() => expect(shownTitle()).toBe("The last five minutes"), { timeout: 8000 });
}

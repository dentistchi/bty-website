/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { useCallback, useState } from "react";
import { ProgramAuthorship, type ProgramApplyOutcome, type ProgramGenerateOutcome } from "./ProgramAuthorship";
import type { RealityGroundedJourneyV1 } from "@/domain/foundry/module/journey";
import { programContext, programContextFingerprint } from "@/domain/foundry/module/program-authorship";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

/**
 * SLICE 3.2L-R11.4K — a successful generation is unfinished user work.
 *
 * These mount the REAL Builder, unmount it the way ordinary navigation does — the shell is
 * keyed by draft id and re-lists from the server on tab re-entry, so an unmount is
 * guaranteed, not incidental — and mount it again. R11.4E-R1 is the standing lesson: a test
 * that never unmounts cannot see a defect whose whole nature is unmounting.
 *
 * RETARGETED, NOT WEAKENED (Slice R4-R8A). The canonical Review generates by itself and adopts
 * on the same pass, so the shell can no longer be driven to the generated-but-unadopted state
 * this suite is about — there is no entry button and no confirmation to press. The state itself
 * still exists (it is the window between generation and adoption, and it is where a failed apply
 * leaves the Host), so the suite mounts `ProgramAuthorship` through a wrapper that performs the
 * SAME three requests the shell performs, over the SAME fetch stub. Every counter — provider
 * calls, draft writes, resume checks — keeps counting the same things.
 *
 * The two claims that belong to the automatic path — a cached proposal is reused rather than
 * regenerated, and an already-adopted training buys nothing on reload — are held in
 * `hostAuthoringSimplificationA.test.tsx`.
 */
const DRAFT = "093b0361-7cc8-4688-9f93-396d60582501";
const OTHER = "35773b57-219b-43fb-829e-80f0656ccb66";

const ANSWERS = {
  problem: "Our handoffs are inconsistent.",
  audienceType: "everyone",
  recurringMoment: "at each handoff point",
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
let resumeEligible = true;

function stubFetch(answers: BuilderAnswers = ANSWERS, program: unknown = PROGRAM) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: { method?: string }) => {
      const u = String(url);
      if (u.includes("/program-draft?attempt=")) {
        // Server-owned resume eligibility (R11.4K-R1). Read-only; never returns prose.
        return { ok: true, json: async () => ({ eligible: resumeEligible }) } as unknown as Response;
      }
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

/**
 * The Review host, reduced to exactly what this suite measures: the three requests the shell
 * makes on behalf of `ProgramAuthorship`, written the way the shell writes them so the stub
 * above answers them unchanged.
 */
function ReviewHost({ draftId, answers }: { draftId: string; answers: BuilderAnswers }) {
  const [journey, setJourney] = useState<RealityGroundedJourneyV1 | undefined>(undefined);
  const fingerprint = programContextFingerprint(programContext(answers)!);

  const onGenerate = useCallback(async (): Promise<ProgramGenerateOutcome> => {
    const res = await fetch(`/api/bty/foundry/modules/${draftId}/program-draft`, {
      method: "POST",
      body: JSON.stringify({ locale: "en", submission_intent_id: crypto.randomUUID(), context_fingerprint: fingerprint }),
    });
    const data = (await res.json()) as { program?: unknown; evidence_ceiling?: string; attempt_id?: string; context_fingerprint?: string };
    if (!data.program) return { ok: false, code: "invalid_output" };
    return {
      ok: true,
      proposal: data.program as never,
      evidenceCeiling: data.evidence_ceiling ?? "",
      attemptId: data.attempt_id ?? null,
      contextFingerprint: data.context_fingerprint ?? "",
    };
  }, [draftId, fingerprint]);

  const onCheckResume = useCallback(
    async (attemptId: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/bty/foundry/modules/${draftId}/program-draft?attempt=${attemptId}`);
        if (!res.ok) return false;
        const data = (await res.json()) as { eligible?: unknown };
        return data.eligible === true;
      } catch {
        // Fails CLOSED, exactly as the shell does — a network fault is not "still fine".
        return false;
      }
    },
    [draftId],
  );

  const onApply = useCallback(
    async (next: RealityGroundedJourneyV1): Promise<ProgramApplyOutcome> => {
      await fetch(`/api/bty/foundry/modules/${draftId}`, { method: "PATCH" });
      setJourney(next);
      return { status: "adopted" };
    },
    [draftId],
  );

  return (
    <ProgramAuthorship
      draftId={draftId}
      locale="en"
      answers={answers}
      journey={journey}
      ready
      onGenerate={onGenerate}
      onCheckResume={onCheckResume}
      onApply={onApply}
      currentContextFingerprint={fingerprint}
    />
  );
}

function mount(draftId = DRAFT, answers: BuilderAnswers = ANSWERS) {
  return render(<ReviewHost draftId={draftId} answers={answers} />);
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
  resumeEligible = true;
  window.localStorage.clear();
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
    mount(DRAFT, moved);
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

  it("R1/A–E — the server refuses eligibility → the proposal is not offered, and the cache is cleared", async () => {
    mount();
    await generateOnce();
    cleanup();
    // Applied elsewhere, superseded, no longer owned, no longer digest-bearing: the client
    // never has to tell these apart. It asks, and a refusal means the same thing each time.
    resumeEligible = false;
    stubFetch();
    mount();
    await screen.findByTestId("program-generate", {}, { timeout: 8000 });
    expect(proposalOnScreen()).toBe(false);
    expect(window.localStorage.getItem(`bty_program_proposal_v2:${DRAFT}`), "a refused cache is not left to be re-offered").toBeNull();
  }, 30000);

  it("R1 — a network or auth failure fails CLOSED, not open", async () => {
    mount();
    await generateOnce();
    cleanup();
    vi.stubGlobal("fetch", vi.fn(async (url: unknown) => {
      const u = String(url);
      if (u.includes("/program-draft?attempt=")) throw new Error("offline");
      return { ok: true, json: async () => ({ draft: { id: DRAFT, status: "draft", currentStep: 7, answers: ANSWERS, assets: [] } }) } as unknown as Response;
    }));
    mount();
    await screen.findByTestId("program-generate", {}, { timeout: 8000 });
    expect(proposalOnScreen()).toBe(false);
  }, 30000);

  it("G10 — a successful Apply ends the continuity: nothing is restored afterwards", async () => {
    mount();
    await generateOnce();
    expect(window.localStorage.getItem(`bty_program_proposal_v2:${DRAFT}`)).not.toBeNull();
    fireEvent.click(await screen.findByTestId("program-apply", {}, { timeout: 8000 }));
    await waitFor(
      () => expect(window.localStorage.getItem(`bty_program_proposal_v2:${DRAFT}`)).toBeNull(),
      { timeout: 8000 },
    );
    cleanup();
    stubFetch();
    mount();
    await screen.findByTestId("program-generate", {}, { timeout: 8000 });
    expect(proposalOnScreen(), "an adopted program must never come back as an offer").toBe(false);
  }, 30000);

  it("G12 — the cache is keyed by draft, and a draft this session cannot open is never read", async () => {
    mount();
    await generateOnce();
    // A different Host's session cannot even mount this draft: the draft GET is
    // owner-scoped, so the id never reaches the Builder. The nearest reachable proof is
    // that no other draft id resolves to this entry.
    expect(window.localStorage.getItem(`bty_program_proposal_v2:${OTHER}`)).toBeNull();
    expect(window.localStorage.getItem(`bty_program_proposal_v2:${DRAFT}`)).not.toBeNull();
  }, 30000);
});

async function generateOnceNewer() {
  fireEvent.click(await screen.findByTestId("program-generate", {}, { timeout: 8000 }));
  fireEvent.click(await screen.findByTestId("program-target-confirm-action", {}, { timeout: 8000 }));
  await waitFor(() => expect(shownTitle()).toBe("The last five minutes"), { timeout: 8000 });
}

/**
 * SLICE 3.2L-R11.4K-R2 — the cross-tab matrix.
 *
 * A second tab is a second top-level browsing context with its own component tree and its
 * own empty `sessionStorage`. jsdom gives one `window` per FILE, so a tab is modelled the
 * only way it honestly can be here: a fresh mount that shares the browser's persistent
 * store and nothing else. The browser semantics themselves were measured separately, in
 * WebKit against the deployed origin — sessionStorage `null` in a new tab, localStorage
 * shared — which is why this now passes and could not have before.
 */
describe("[3.2L-R11.4K-R2] a second tab", () => {
  /** What tab B starts with: no component state, no sessionStorage, the shared store only. */
  function newTab() {
    cleanup();
    window.sessionStorage.clear();
    stubFetch();
  }

  it("G2/G3/G4 — tab B restores the exact proposal, spending nothing", async () => {
    mount();
    await generateOnce();
    const title = shownTitle();

    newTab();
    generateCalls = 0;
    const patchesBefore = patchCalls;
    mount();
    await waitFor(() => expect(proposalOnScreen()).toBe(true), { timeout: 8000 });
    expect(shownTitle()).toBe(title);
    for (const e of PROGRAM.elements) expect(shownSection(e.kind), e.kind).toContain(e.content.slice(0, 25));
    expect(generateCalls, "a second tab must never reach the provider").toBe(0);
    expect(patchCalls, "and must not write the draft").toBe(patchesBefore);
  }, 30000);

  it("G5 — tab B asks the server about the SAME attempt", async () => {
    mount();
    await generateOnce();
    newTab();
    const asked: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: unknown) => {
      const u = String(url);
      if (u.includes("/program-draft?attempt=")) {
        asked.push(new URL(u, "http://localhost").searchParams.get("attempt") ?? "");
        return { ok: true, json: async () => ({ eligible: true }) } as unknown as Response;
      }
      return { ok: true, json: async () => ({ draft: { id: DRAFT, status: "draft", currentStep: 7, answers: ANSWERS, assets: [] } }) } as unknown as Response;
    }));
    mount();
    await waitFor(() => expect(proposalOnScreen()).toBe(true), { timeout: 8000 });
    expect(asked).toEqual(["496302b6-26ec-4ea0-bad8-fb981ca2c596"]);
  }, 30000);

  it("G6/G7 — tab B survives its own reload, and outliving tab A changes nothing", async () => {
    mount();
    await generateOnce();
    newTab();                        // tab B
    mount();
    await waitFor(() => expect(proposalOnScreen()).toBe(true), { timeout: 8000 });
    newTab();                        // tab B reloads; tab A is long gone
    mount();
    await waitFor(() => expect(proposalOnScreen()).toBe(true), { timeout: 8000 });
  }, 30000);

  it("G12/G13 — Apply and Discard remove it for every tab, not just the one that acted", async () => {
    mount();
    await generateOnce();
    fireEvent.click(await screen.findByTestId("program-apply", {}, { timeout: 8000 }));
    await waitFor(
      () => expect(window.localStorage.getItem(`bty_program_proposal_v2:${DRAFT}`)).toBeNull(),
      { timeout: 8000 },
    );
    newTab();
    mount();
    await screen.findByTestId("program-generate", {}, { timeout: 8000 });
    expect(proposalOnScreen(), "an adopted program must not reappear in another tab").toBe(false);
  }, 30000);
});

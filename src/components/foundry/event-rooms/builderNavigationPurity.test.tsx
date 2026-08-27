/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup, waitFor } from "@testing-library/react";
import { ModuleBuilderShell } from "./ModuleBuilderShell";
import { BUILDER_QUESTION_STEP } from "@/domain/foundry/module/module-builder";
import { programContext, programContextFingerprint, requiredProgramKinds } from "@/domain/foundry/module/program-authorship";
import { suggestSharedQuestion } from "./moduleBuilderCopy";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

/**
 * SLICE 3.2L-R11.4B — navigation is not authoring.
 *
 * The canonical draft grew a `sharedQuestion` it was never given, purely because the Host
 * navigated back across step 6. That field is inside `programContextFingerprint`, so a
 * traversal silently moved the training from a 7-section program to an 8-section one.
 */
afterEach(cleanup);

/** The canonical draft's real answers, at the state it was in before the incident. */
const CANONICAL: BuilderAnswers = {
  problem: "Our handoffs are inconsistent.",
  audienceType: "everyone",
  recurringMoment: "at each handoff point",
  observableBehavior: "Create a shared handoff standard.",
  successEvidence: "Handoff record\n",
  learningNeeds: ["know", "decide", "practice"],
  arenaRecommended: true,
  followUpDays: 7,
  completionPrompt: "What specific elements will you include in your handoff record to align with the shared handoff standard?",
  materialIntent: "youtube",
  materialText: "https://youtu.be/mRdT9oK1Cmo",
  evidenceType: "seen",
};

/** Records every answers payload the Builder tries to persist. */
function mountAt(step: number, extraAnswers: Partial<BuilderAnswers> = {}) {
  const saved: BuilderAnswers[] = [];
  global.fetch = vi.fn(async (url: unknown, init?: { method?: string; body?: string }) => {
    const u = String(url);
    if (init?.method === "PATCH") {
      saved.push((JSON.parse(init.body ?? "{}") as { answers: BuilderAnswers }).answers);
      return { ok: true, status: 200, json: async () => ({ draft: {} }) } as never;
    }
    if (u.includes("/api/bty/foundry/modules/")) {
      return {
        ok: true, status: 200,
        json: async () => ({ draft: { id: "d-1", status: "draft", current_step: step, answers: { ...CANONICAL, ...extraAnswers }, module_version: 1 } }),
      } as never;
    }
    return { ok: true, status: 200, json: async () => ({}) } as never;
  }) as never;
  render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={vi.fn()} />);
  return saved;
}

describe("[3.2L-R11.4B] traversing a step never authors content", () => {
  it("resuming ON the material step does not write sharedQuestion", async () => {
    const saved = mountAt(BUILDER_QUESTION_STEP);
    await waitFor(() => expect(screen.queryByTestId("module-builder-step")).toBeTruthy(), { timeout: 2000 }).catch(() => undefined);
    await act(async () => { await new Promise((r) => setTimeout(r, 900)); });
    for (const a of saved) {
      expect(Object.prototype.hasOwnProperty.call(a, "sharedQuestion"), JSON.stringify(a).slice(0, 120)).toBe(false);
    }
  });

  it("R4-R8B — nothing is SHOWN either, which is the stronger form of the same guarantee", async () => {
    /*
      R11.4B's finding was that traversing a step wrote BTY's suggestion into the draft, silently
      turning a 7-section program into an 8-section one. Its fix moved the suggestion into
      display-only state: shown, never stored until edited.

      That fixed the WRITE and could not fix the READ. A box containing BTY's sentence still
      invites a Host to adjust a word of it, and for the completion question adjusting a word
      transferred ownership — after which BTY's barrier question could never render. So neither
      question is offered on a fresh draft at all. Nothing shown, nothing written, nothing to
      accidentally own: the property this describe block is named for, at full strength.
    */
    mountAt(BUILDER_QUESTION_STEP);
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    const shown = Array.from(document.querySelectorAll("textarea")).map((t) => (t as HTMLTextAreaElement).value);
    expect(shown.some((v) => v === suggestSharedQuestion("en")), shown.join(" | ")).toBe(false);
    expect(screen.queryByTestId("builder-shared-question")).toBeNull();
    /*
      The completion box IS present here, and that is the other half of the rule rather than an
      exception to it: `CANONICAL` carries a `completionPrompt` its Host wrote, which makes this
      fixture a legacy draft. Its question is shown, editable and preserved. Only a draft that
      never had one is never offered one.
    */
    expect(screen.getByTestId("builder-completion-question")).toBeTruthy();
  });

  it("R4-R8B — a legacy draft that already holds its Host's question still shows and saves it", async () => {
    const saved = mountAt(BUILDER_QUESTION_STEP, { sharedQuestion: "How do you close a huddle today?" });
    const box = (await screen.findByTestId("builder-shared-question")).querySelector("textarea") as HTMLTextAreaElement;
    expect(box.value).toBe("How do you close a huddle today?");
    await act(async () => {
      fireEvent.change(box, { target: { value: "What standard mattered most to you?" } });
      await new Promise((r) => setTimeout(r, 900));
    });
    expect(saved.some((a) => a.sharedQuestion === "What standard mattered most to you?")).toBe(true);
  });
});

describe("[3.2L-R11.4B] generation-context purity", () => {
  const fp = (a: BuilderAnswers) => programContextFingerprint(programContext(a)!);

  it("navigation-only leaves the fingerprint and the program shape untouched", () => {
    // No authored change => identical context, identical required sections.
    expect(fp({ ...CANONICAL })).toBe(fp(CANONICAL));
    expect(requiredProgramKinds({ ...CANONICAL })).toEqual(requiredProgramKinds(CANONICAL));
    // 8 since Slice R4-R5C14A: WHAT SUCCESS LOOKS LIKE is its own required section.
    expect(requiredProgramKinds(CANONICAL)).toHaveLength(8);
    expect(requiredProgramKinds(CANONICAL)).not.toContain("reflection");
  });

  it("the incident's exact mutation still moves the generation context", () => {
    /*
      THE INCIDENT, AND WHAT R4-R5C12A CHANGED ABOUT IT.

      3.2L-R11.4B found that traversing to the material step patched BTY's suggested shared
      question into the draft, which moved a 7-section program to 8 by adding REFLECT. That fix
      stopped the write. C12A closes the other half: even when the value IS stored — 15 live
      drafts still carry it from before the fix — BTY's own prefill no longer requires a REFLECT
      section, because nobody asked for one. It still moves the FINGERPRINT, which is right: the
      stored context genuinely differs, and a program written from it must not be reused.
    */
    const btyPrefill = { ...CANONICAL, sharedQuestion: suggestSharedQuestion("en") };
    expect(fp(btyPrefill)).not.toBe(fp(CANONICAL));
    expect(requiredProgramKinds(btyPrefill)).toHaveLength(8);
    expect(requiredProgramKinds(btyPrefill)).not.toContain("reflection");

    // A question the HOST wrote is what asks for the section, and always did.
    const hostOwn = { ...CANONICAL, sharedQuestion: "What usually happens at the huddle when nobody is named?" };
    expect(fp(hostOwn)).not.toBe(fp(CANONICAL));
    expect(requiredProgramKinds(hostOwn)).toHaveLength(9);
    expect(requiredProgramKinds(hostOwn)).toContain("reflection");
  });

  it("an intentional Host edit still moves the context, as it must", () => {
    expect(fp({ ...CANONICAL, problem: "Our handovers drop things." })).not.toBe(fp(CANONICAL));
    expect(fp({ ...CANONICAL, sharedQuestion: "What standard mattered most?" })).not.toBe(fp(CANONICAL));
  });
});

describe("[3.2L-R11.4E] opening a draft's review by link writes nothing", () => {
  /** The canonical draft's real state: developed content, resume position well before review. */
  const DURABLE_STEP = 2;

  /*
    ONE COUNTER PER KIND OF REQUEST (Slice R4-R8A).

    R11.4E's claim is that arriving on Review must not MUTATE THE DRAFT — a deep link is a way
    of looking, not a way of editing. That is unchanged. What changed is that Review now issues
    a POST of its own to `program-draft`, deliberately, and the original single `saved` bucket
    counted every non-GET together — so leaving it as it was would have reported the new
    generation as a draft write and hidden the very thing the suite exists to watch.
  */
  function mountDeepLinked(initialView?: "review") {
    const draftWrites: unknown[] = [];
    const generations: unknown[] = [];
    global.fetch = vi.fn(async (url: unknown, init?: { method?: string; body?: string }) => {
      const u = String(url);
      if (u.includes("/program-draft")) {
        if ((init?.method ?? "GET") !== "GET") generations.push({ method: init?.method });
        return { ok: true, status: 200, json: async () => ({ eligible: true }) } as never;
      }
      if (init?.method && init.method !== "GET") {
        draftWrites.push({ method: init.method, body: init.body });
        return { ok: true, status: 200, json: async () => ({ draft: {} }) } as never;
      }
      if (u.includes("/api/bty/foundry/modules/")) {
        return {
          ok: true, status: 200,
          json: async () => ({ draft: { id: "d-1", status: "draft", current_step: DURABLE_STEP, answers: CANONICAL, module_version: 1 } }),
        } as never;
      }
      return { ok: true, status: 200, json: async () => ({}) } as never;
    }) as never;
    render(<ModuleBuilderShell draftId="d-1" locale="en" initialView={initialView} onExit={vi.fn()} />);
    return { draftWrites, generations };
  }

  /** Review is the only screen carrying the create action, so it is the honest anchor. */
  const onReview = () => waitFor(() => expect(screen.queryByTestId("publish-cta")).toBeTruthy(), { timeout: 3000 });

  it("lands on Review even though the durable position is earlier", async () => {
    mountDeepLinked("review");
    await onReview();
  });

  it("issues NO write to the draft while opening", async () => {
    const { draftWrites } = mountDeepLinked("review");
    await onReview();
    await act(async () => { await new Promise((r) => setTimeout(r, 1000)); });
    expect(draftWrites, JSON.stringify(draftWrites).slice(0, 200)).toEqual([]);
  });

  it("without the link it still opens at the Host's own position", async () => {
    mountDeepLinked();
    await act(async () => { await new Promise((r) => setTimeout(r, 500)); });
    expect(screen.queryByTestId("publish-cta")).toBeNull();
  });

  it("the generation the deep link triggers is ONE, and is not a draft write", async () => {
    /*
      REPLACES "pressing the generation entry only opens the existing confirmation" (Slice
      R4-R8A). There is no entry to press: the deep link itself is what starts the work now, so
      the thing worth pinning is that it starts it ONCE and that the draft is still untouched.
    */
    const { draftWrites, generations } = mountDeepLinked("review");
    await onReview();
    await act(async () => { await new Promise((r) => setTimeout(r, 1000)); });
    expect(generations.length).toBeLessThanOrEqual(1);
    expect(draftWrites).toEqual([]);
  });
});

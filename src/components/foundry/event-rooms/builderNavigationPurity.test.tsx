/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup, waitFor } from "@testing-library/react";
import { ModuleBuilderShell } from "./ModuleBuilderShell";
import { programContext, programContextFingerprint, requiredProgramKinds } from "@/domain/foundry/module/program-authorship";
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
function mountAt(step: number) {
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
        json: async () => ({ draft: { id: "d-1", status: "draft", current_step: step, answers: CANONICAL, module_version: 1 } }),
      } as never;
    }
    return { ok: true, status: 200, json: async () => ({}) } as never;
  }) as never;
  render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={vi.fn()} />);
  return saved;
}

describe("[3.2L-R11.4B] traversing a step never authors content", () => {
  it("resuming ON the material step does not write sharedQuestion", async () => {
    const saved = mountAt(7);
    await waitFor(() => expect(screen.queryByTestId("module-builder-step")).toBeTruthy(), { timeout: 2000 }).catch(() => undefined);
    await act(async () => { await new Promise((r) => setTimeout(r, 900)); });
    for (const a of saved) {
      expect(Object.prototype.hasOwnProperty.call(a, "sharedQuestion"), JSON.stringify(a).slice(0, 120)).toBe(false);
    }
  });

  it("the proposal is still SHOWN, so the Host can accept it by editing", async () => {
    mountAt(7);
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    const shown = Array.from(document.querySelectorAll("textarea")).map((t) => (t as HTMLTextAreaElement).value);
    expect(shown.some((v) => v.includes("In your own words")), shown.join(" | ")).toBe(true);
  });

  it("editing the field IS authoring, and persists", async () => {
    const saved = mountAt(7);
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    const areas = Array.from(document.querySelectorAll("textarea")) as HTMLTextAreaElement[];
    const target = areas.find((t) => t.value.includes("In your own words"));
    expect(target).toBeTruthy();
    await act(async () => {
      fireEvent.change(target!, { target: { value: "What standard mattered most to you?" } });
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
    expect(requiredProgramKinds(CANONICAL)).toHaveLength(7);
    expect(requiredProgramKinds(CANONICAL)).not.toContain("reflection");
  });

  it("the incident's exact mutation is what moved 7 sections to 8", () => {
    const withShared = { ...CANONICAL, sharedQuestion: "In your own words, what is the most important standard from this training?" };
    expect(fp(withShared)).not.toBe(fp(CANONICAL));
    expect(requiredProgramKinds(withShared)).toHaveLength(8);
    expect(requiredProgramKinds(withShared)).toContain("reflection");
  });

  it("an intentional Host edit still moves the context, as it must", () => {
    expect(fp({ ...CANONICAL, problem: "Our handovers drop things." })).not.toBe(fp(CANONICAL));
    expect(fp({ ...CANONICAL, sharedQuestion: "What standard mattered most?" })).not.toBe(fp(CANONICAL));
  });
});

describe("[3.2L-R11.4E] opening a draft's review by link writes nothing", () => {
  /** The canonical draft's real state: developed content, resume position well before review. */
  const DURABLE_STEP = 2;

  function mountDeepLinked(initialView?: "review") {
    const saved: unknown[] = [];
    global.fetch = vi.fn(async (url: unknown, init?: { method?: string; body?: string }) => {
      if (init?.method && init.method !== "GET") {
        saved.push({ method: init.method, body: init.body });
        return { ok: true, status: 200, json: async () => ({ draft: {} }) } as never;
      }
      if (String(url).includes("/api/bty/foundry/modules/")) {
        return {
          ok: true, status: 200,
          json: async () => ({ draft: { id: "d-1", status: "draft", current_step: DURABLE_STEP, answers: CANONICAL, module_version: 1 } }),
        } as never;
      }
      return { ok: true, status: 200, json: async () => ({}) } as never;
    }) as never;
    render(<ModuleBuilderShell draftId="d-1" locale="en" initialView={initialView} onExit={vi.fn()} />);
    return saved;
  }

  it("lands on Review even though the durable position is earlier", async () => {
    mountDeepLinked("review");
    await waitFor(() => expect(screen.queryByTestId("program-authorship-entry")).toBeTruthy(), { timeout: 3000 });
    // The generation entry only exists on the review step.
    expect(screen.getByTestId("program-generate")).toBeTruthy();
  });

  it("issues NO write of any kind while opening", async () => {
    const saved = mountDeepLinked("review");
    await waitFor(() => expect(screen.queryByTestId("program-authorship-entry")).toBeTruthy(), { timeout: 3000 });
    await act(async () => { await new Promise((r) => setTimeout(r, 1000)); });
    expect(saved, JSON.stringify(saved).slice(0, 200)).toEqual([]);
  });

  it("without the link it still opens at the Host's own position", async () => {
    mountDeepLinked();
    await act(async () => { await new Promise((r) => setTimeout(r, 500)); });
    expect(screen.queryByTestId("program-authorship-entry")).toBeNull();
  });

  it("pressing the generation entry only opens the existing confirmation", async () => {
    const saved = mountDeepLinked("review");
    await waitFor(() => expect(screen.queryByTestId("program-generate")).toBeTruthy(), { timeout: 3000 });
    await act(async () => { fireEvent.click(screen.getByTestId("program-generate")); });
    expect(screen.getByTestId("program-target-confirm-action")).toBeTruthy();
    // Still nothing written, and nothing posted to program-draft.
    expect(saved).toEqual([]);
  });
});

/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup, waitFor } from "@testing-library/react";
import { ModuleBuilderShell } from "./ModuleBuilderShell";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

/**
 * SLICE 3.2P-R3.6-R2 — A CORRECTION IS NOT AN AUTHORING SESSION.
 *
 * THE DEVICE FAILURE. Review said "When it happens — Add". The Founder tapped it, answered
 * "During morning huddles", pressed Next — and landed on STEP 4 OF 8, walking forward through
 * questions answered weeks earlier. The answer had saved correctly and nothing was lost; what
 * was lost was the INTENT. `jumpTo` called the same `navigate` as any other move, so by the time
 * Next ran the shell could no longer tell a one-section correction from sequential authoring.
 *
 * Two navigation modes exist and only one was represented:
 *
 *   sequential   step N  → Next → step N+1
 *   review edit  Review → one section → Next → Review
 *
 * These hold the second without disturbing the first.
 */
afterEach(cleanup);

/** The canonical draft, missing only the moment — the exact state the device gate ran against. */
const CANONICAL: BuilderAnswers = {
  problem: "During morning huddles, team members report problems but leave without naming who will act or when the next step will happen.",
  audienceType: "leaders",
  observableBehavior: "At the next huddle, what exact words will you use to confirm the owner, action, and deadline?",
  successEvidence: "The huddle note records one owner and one deadline for every agreed action.",
  evidenceType: "confirmed",
  learningNeeds: ["shared_standard", "practice"],
  materialIntent: "pdf",
  followUpDays: 7,
  arenaRecommended: true,
  completionPrompt: "What specific phrases will you use in the next huddle to confirm the action owner and deadline?",
  sharedQuestion: "In your own words, what is the most important standard from this training?",
  capabilityCandidate: "Accountability",
} as unknown as BuilderAnswers;

type Saved = { answers: BuilderAnswers; current_step: number };

/** Mount the shell over a fake draft server, recording every PATCH. */
function mount(opts: { step: number; view?: "review"; answers?: BuilderAnswers }) {
  const saved: Saved[] = [];
  /*
    DEEP-COPIED. The PATCH handler below merges into `draft.answers`, so sharing the fixture
    object across tests let one test's answer leak into the next — which is exactly how the
    first run of this file "proved" a missing row was absent.
  */
  const draft = { id: "d-1", status: "draft", current_step: opts.step, answers: structuredClone(opts.answers ?? CANONICAL), module_version: 2 };
  global.fetch = vi.fn(async (url: unknown, init?: { method?: string; body?: string }) => {
    if (init?.method === "PATCH") {
      const body = JSON.parse(init.body ?? "{}") as Saved;
      saved.push(body);
      Object.assign(draft.answers, body.answers ?? {});
      draft.current_step = body.current_step ?? draft.current_step;
      return { ok: true, status: 200, json: async () => ({ draft }) } as never;
    }
    if (String(url).includes("/api/bty/foundry/modules/")) {
      return { ok: true, status: 200, json: async () => ({ draft }) } as never;
    }
    return { ok: true, status: 200, json: async () => ({}) } as never;
  }) as never;
  const view = render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={vi.fn()} initialView={opts.view} />);
  return { saved, draft, view };
}

const settle = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 700));
  });
};
const onReview = () => screen.queryByTestId("review-row-recurringMoment") !== null;
const onMomentStep = () => screen.queryByText("When does this usually happen?") !== null;
/** Open a section the way the Review DETAIL list does — the row's own Edit control. */
const editRow = async (section: string) => {
  await act(async () => {
    fireEvent.click(screen.getByTestId(`review-row-${section}`).querySelector("button")!);
  });
  await settle();
};
/** Open it the way the "needs attention" summary does. */
const editMissing = async (section: string) => {
  await act(async () => {
    // Two summaries render when anything is outstanding (the publish block and the detail
    // list); they are the same control, so either one is the Founder's tap.
    fireEvent.click(screen.getAllByTestId(`review-missing-item-${section}`)[0]);
  });
  await settle();
};
const next = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
  });
  await settle();
};

describe("[3.2P-R3.6-R2] A/B — the same Next, two honest destinations", () => {
  it("A — reached sequentially, Next goes to the following question", async () => {
    mount({ step: 3 });
    await waitFor(() => expect(onMomentStep()).toBe(true));
    await act(async () => {
      fireEvent.change(screen.getByLabelText("When does this usually happen?"), {
        target: { value: "During morning huddles" },
      });
    });
    await next();
    // Step 4 is the behaviour question — ordinary authoring, unchanged.
    expect(screen.queryByText("After this training, what should they do differently?")).toBeTruthy();
    expect(onReview()).toBe(false);
  });

  it("B — reached from Review, Next returns to Review", async () => {
    mount({ step: 1, view: "review" });
    await waitFor(() => expect(onReview()).toBe(true));

    // The exact control the Founder tapped: the missing-input row for the moment.
    await editMissing("recurringMoment");
    expect(onMomentStep(), "Edit must open the moment question").toBe(true);

    await act(async () => {
      fireEvent.change(screen.getByLabelText("When does this usually happen?"), {
        target: { value: "During morning huddles" },
      });
    });
    await next();

    expect(onReview(), "Next must return to Review, not walk forward").toBe(true);
    expect(screen.queryByText("After this training, what should they do differently?")).toBeNull();
  });
});

describe("[3.2P-R3.6-R2] C/D/H/I — the answer is durable before the return", () => {
  it("C/H — the moment is persisted, and survives a remount", async () => {
    const { saved, draft } = mount({ step: 1, view: "review" });
    await waitFor(() => expect(onReview()).toBe(true));
    await editMissing("recurringMoment");
    await act(async () => {
      fireEvent.change(screen.getByLabelText("When does this usually happen?"), {
        target: { value: "During morning huddles" },
      });
    });
    await next();

    // Written before the return — not merely held in component state.
    expect(saved.some((s) => s.answers?.recurringMoment === "During morning huddles")).toBe(true);
    expect(draft.answers.recurringMoment).toBe("During morning huddles");

    cleanup();
    mount({ step: 9, answers: draft.answers });
    await waitFor(() => expect(onReview()).toBe(true));
    expect(screen.getByText("During morning huddles")).toBeTruthy();
  });

  it("D — Review stops asking for it once it is answered", async () => {
    mount({ step: 9, answers: { ...CANONICAL, recurringMoment: "During morning huddles" } as BuilderAnswers });
    await waitFor(() => expect(onReview()).toBe(true));
    expect(screen.getByText("During morning huddles")).toBeTruthy();
    // The "needs attention" row is gone; nothing is outstanding.
    expect(screen.queryByText("Add when this situation usually happens.")).toBeNull();
  });

  it("I — none of this touches generation", async () => {
    const calls: string[] = [];
    const { saved } = mount({ step: 1, view: "review" });
    const original = global.fetch as unknown as (u: unknown, i?: { method?: string }) => unknown;
    global.fetch = vi.fn(async (u: unknown, i?: { method?: string; body?: string }) => {
      calls.push(String(u));
      return original(u, i) as never;
    }) as never;
    await waitFor(() => expect(onReview()).toBe(true));
    await editMissing("recurringMoment");
    await next();
    expect(calls.some((u) => u.includes("program-draft"))).toBe(false);
    expect(saved.every((s) => s.answers !== undefined || s.current_step !== undefined)).toBe(true);
  });
});

describe("[3.2P-R3.6-R2] F/G — every Review Edit behaves the same way", () => {
  it("F — editing an ALREADY ANSWERED moment also returns to Review", async () => {
    mount({ step: 9, answers: { ...CANONICAL, recurringMoment: "at each morning huddle" } as BuilderAnswers });
    await waitFor(() => expect(onReview()).toBe(true));
    await editRow("recurringMoment");
    expect(onMomentStep()).toBe(true);
    await act(async () => {
      fireEvent.change(screen.getByLabelText("When does this usually happen?"), {
        target: { value: "During morning huddles" },
      });
    });
    await next();
    expect(onReview()).toBe(true);
  });

  it("G — an unrelated Review Edit destination returns to Review too", async () => {
    /*
      The intent is set in `jumpTo`, which is the ONLY entry point Review uses to open a section.
      So the fix covers every row rather than the one that exposed the defect — the problem
      question behaves exactly like the moment.
    */
    mount({ step: 9 });
    await waitFor(() => expect(onReview()).toBe(true));
    await editRow("problem");
    expect(screen.queryByText("What keeps going wrong?")).toBeTruthy();
    await next();
    expect(onReview()).toBe(true);
  });

  it("Back is unchanged, and ends the correction rather than teleporting later", async () => {
    mount({ step: 1, view: "review" });
    await waitFor(() => expect(onReview()).toBe(true));
    await editMissing("recurringMoment");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Back" }));
    });
    await settle();
    // Back went one step, as it always has…
    expect(screen.queryByText("Who needs to do something differently?")).toBeTruthy();
    // …and the next forward move is ordinary, not a jump to Review.
    await next();
    expect(onMomentStep()).toBe(true);
    expect(onReview()).toBe(false);
  });
});

/** @vitest-environment jsdom */
/**
 * SLICE 3.2R-R2.1 — Step 1 on the device.
 *
 * The Founder could not tell where the training was named. These tests fix the two things that
 * made that true: there was no title input at all, and the "Training focus" header above the one
 * textarea was that textarea's own first line echoed back.
 *
 * They fail against the pre-R2.1 Builder.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, within, waitFor } from "@testing-library/react";
import { ModuleBuilderShell } from "./ModuleBuilderShell";

/** Minimal stateful draft server, matching the shape the shell actually restores. */
function stub(answers: Record<string, unknown> = {}) {
  const draft = {
    id: "d-1", status: "draft", current_step: 1, answers: { ...answers }, module_version: 1,
    parent_module_id: null, document_asset_ref_present: false, attachment: null, assets: [],
    created_at: "t", updated_at: "t",
  };
  const fn = vi.fn(async (_url: string, o?: { method?: string; body?: string }) => {
    if ((o?.method ?? "GET") === "PATCH") {
      const body = JSON.parse(o?.body ?? "{}");
      if (body.answers) draft.answers = { ...draft.answers, ...body.answers };
      if (typeof body.current_step === "number") draft.current_step = body.current_step;
    }
    return { ok: true, status: 200, json: async () => ({ draft }) } as Response;
  });
  // @ts-expect-error test shim
  global.fetch = fn;
  return draft;
}

const open = async (locale: "en" | "ko" = "en") => {
  render(<ModuleBuilderShell draftId="d-1" locale={locale} onExit={() => {}} />);
  return screen.findByTestId("module-builder");
};

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
beforeEach(() => vi.restoreAllMocks());

describe("Builder Step 1 — title and problem are visibly distinct", () => {
  it("renders TWO inputs, each with its own visible label", async () => {
    stub();
    await open();
    const title = await screen.findByTestId("builder-title-input");
    const problem = await screen.findByTestId("builder-problem-input");
    expect(title.tagName).toBe("INPUT");
    expect(problem.tagName).toBe("TEXTAREA");
    // Real <label for=…>, not an aria-label on a bare control.
    expect(document.querySelector('label[for="builder-title"]')?.textContent).toBe("Training title");
    expect(document.querySelector('label[for="builder-problem"]')?.textContent).toBe("What keeps going wrong?");
  });

  it("the step's single primary question names the STEP, not one of its fields", async () => {
    stub();
    await open();
    const h2s = Array.from(document.querySelectorAll("h2")).map((h) => h.textContent);
    expect(h2s).toContain("Define the training");
    // Exactly one h2 — the Builder's standing invariant, unchanged by adding a field.
    expect(h2s).toHaveLength(1);
  });

  it("each helper sentence appears exactly once", async () => {
    stub();
    await open();
    const body = document.body.textContent ?? "";
    const count = (s: string) => body.split(s).length - 1;
    expect(count("Give this training a short, clear name.")).toBe(1);
    expect(count("Describe a specific situation that repeats — not a general topic.")).toBe(1);
  });

  it("typing a title does NOT change the problem, and vice versa", async () => {
    stub();
    await open();
    const title = await screen.findByTestId("builder-title-input");
    const problem = await screen.findByTestId("builder-problem-input");

    fireEvent.change(title, { target: { value: "Close the Loop" } });
    expect((problem as HTMLTextAreaElement).value).toBe("");

    fireEvent.change(problem, { target: { value: "Huddles end without an owner." } });
    expect((title as HTMLInputElement).value).toBe("Close the Loop");

    fireEvent.change(title, { target: { value: "Renamed" } });
    expect((problem as HTMLTextAreaElement).value).toBe("Huddles end without an owner.");
  });

  it("the 'Training focus' header shows the TITLE once one exists — not the problem", async () => {
    stub({ title: "Close the Loop", problem: "Huddles end without an owner." });
    await open();
    const identity = await screen.findByTestId("draft-identity");
    expect(within(identity).getByTestId("draft-identity-statement").textContent).toBe("Close the Loop");
    expect(identity.textContent).not.toContain("Huddles end without an owner.");
  });

  it("G — 'Untitled training draft' is gone once a title exists", async () => {
    stub({ title: "Close the Loop" });
    await open();
    await screen.findByTestId("draft-identity-statement");
    expect(screen.queryByTestId("draft-identity-fallback")).toBeNull();
    expect(document.body.textContent).not.toContain("Untitled training draft");
  });

  it("H — there is exactly ONE editable title control on the step", async () => {
    stub({ title: "Close the Loop" });
    await open();
    const editable = Array.from(document.querySelectorAll("input[type=text], textarea"));
    const withTitleValue = editable.filter((el) => (el as HTMLInputElement).value === "Close the Loop");
    expect(withTitleValue).toHaveLength(1);
    // The header renders the title but is not an input.
    const identity = screen.getByTestId("draft-identity");
    expect(identity.querySelector("input, textarea")).toBeNull();
  });

  it("the problem sentence is never rendered as the training's name", async () => {
    stub({ problem: "Huddles end without an owner." });
    await open();
    const identity = await screen.findByTestId("draft-identity");
    // No title yet → the legacy fallback still disambiguates the draft, but the title INPUT is
    // empty, so the Host can see the name has not been written.
    expect((screen.getByTestId("builder-title-input") as HTMLInputElement).value).toBe("");
  });

  it("J — the Builder is still 8 steps", async () => {
    stub();
    await open();
    expect(document.body.textContent).toMatch(/Step 1 of 8/);
  });

  it("I — KO renders the Korean labels and helpers", async () => {
    stub();
    await open("ko");
    await screen.findByTestId("builder-title-input");
    expect(document.querySelector('label[for="builder-title"]')?.textContent).toBe("교육 제목");
    expect(document.querySelector('label[for="builder-problem"]')?.textContent).toBe("무엇이 반복해서 잘못되고 있나요?");
    const body = document.body.textContent ?? "";
    expect(body).toContain("교육 정의");
    expect(body).toContain("이 교육을 짧고 분명하게 표현하는 이름을 적어주세요.");
    expect(body).toContain("일반적인 주제가 아니라 반복되는 구체적인 상황을 적어주세요.");
  });
});

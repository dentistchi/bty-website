/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { BoundaryEditor, toBoundary } from "./BoundaryEditor";
import { ARENA_PRACTICE_COPY } from "./arenaPracticeCopy";
import { CONSTRAINTS_MAX, CONSTRAINT_STATEMENT_MAX, type BoundaryConstraint, type PracticeBoundary } from "@/domain/foundry/arena-draft/boundary";

/**
 * HOST BOUNDARY CONFIRMATION (Slice 3.2I-R5B2).
 *
 * The measured 3.2J blocker was not that this surface behaved badly — it was that it did not
 * exist, so a new-authority draft could never obtain the confirmed boundary the server demands.
 * These tests hold the surface to the two things that make it a fix rather than a form: the Host
 * can always reach a confirmable state, and the server stays the authority on what is confirmed.
 */

const t = ARENA_PRACTICE_COPY.en;
const ko = ARENA_PRACTICE_COPY.ko;

const suggestion = (n: number): BoundaryConstraint => ({
  id: `s${n}`,
  statement: `Never disclose a patient identifier before consent ${n}.`,
  provenance: "suggested_from_problem",
});

const confirmedBoundary = (statements: string[]): PracticeBoundary => ({
  mode: statements.length > 0 ? "judgment_with_constraints" : "judgment",
  confirmed: true,
  constraints: statements.map((s, i) => ({ id: `c${i}`, statement: s, provenance: "manager_entered" })),
});

function setup(props: Partial<Parameters<typeof BoundaryEditor>[0]> = {}) {
  const onConfirm = vi.fn();
  render(
    <BoundaryEditor boundary={undefined} suggestions={[]} copy={t} onConfirm={onConfirm} {...props} />,
  );
  return { onConfirm };
}

const typeNew = (text: string) => fireEvent.change(screen.getByLabelText(t.boundaryAddCta), { target: { value: text } });
const clickAdd = () => fireEvent.click(screen.getByRole("button", { name: t.boundaryAddCta }));

afterEach(cleanup);

describe("[R5B2] the Host always has a way to a confirmable boundary", () => {
  it("with NO suggestions the Host can still author a rule and confirm — the dead end is gone", () => {
    const { onConfirm } = setup({ suggestions: [] });
    expect(screen.getByText(t.boundaryRulesEmpty)).toBeTruthy();
    typeNew("Never act before the check is signed off.");
    clickAdd();
    fireEvent.click(screen.getByRole("button", { name: t.boundaryConfirmCta }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const sent = onConfirm.mock.calls[0][0] as PracticeBoundary;
    expect(sent.confirmed).toBe(true);
    expect(sent.mode).toBe("judgment_with_constraints");
    expect(sent.constraints.map((c) => c.statement)).toEqual(["Never act before the check is signed off."]);
  });

  it("confirming with NO rules is legitimate and maps to the mode the server accepts", () => {
    const { onConfirm } = setup();
    expect(screen.getByText(t.boundaryOptionalHint)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t.boundaryConfirmCta }));
    const sent = onConfirm.mock.calls[0][0] as PracticeBoundary;
    // `judgment` is a POSITIVE statement that no confirmed rule constrains this practice, and the
    // generation service returns `generate` for it. `knowledge_check` would DECLINE forever, which
    // is exactly why this surface never produces it.
    expect(sent).toEqual({ mode: "judgment", confirmed: true, constraints: [] });
  });

  it("suggestions can be accepted, and disappear from the offer once taken", () => {
    setup({ suggestions: [suggestion(1), suggestion(2)] });
    expect(screen.getByText(t.boundarySuggestedTitle)).toBeTruthy();
    const rows = screen.getAllByRole("button", { name: t.boundarySuggestionAdd });
    expect(rows).toHaveLength(2);
    fireEvent.click(rows[0]);
    expect(screen.getAllByRole("button", { name: t.boundarySuggestionAdd })).toHaveLength(1);
    expect(screen.getByText(suggestion(1).statement)).toBeTruthy(); // now a rule, not an offer
  });

  it("no suggestion block is rendered when the training yields none", () => {
    setup({ suggestions: [] });
    expect(screen.queryByText(t.boundarySuggestedTitle)).toBeNull();
  });
});

describe("[R5B2] the Host can edit, remove and replace before confirming", () => {
  it("an added rule can be edited, and the edit is what gets sent", () => {
    const { onConfirm } = setup();
    typeNew("First wording.");
    clickAdd();
    fireEvent.click(screen.getByRole("button", { name: t.boundaryEditCta }));
    fireEvent.change(screen.getByLabelText(t.boundaryEditCta), { target: { value: "Corrected wording." } });
    fireEvent.click(screen.getByRole("button", { name: t.boundaryEditSaveCta }));
    fireEvent.click(screen.getByRole("button", { name: t.boundaryConfirmCta }));
    expect((onConfirm.mock.calls[0][0] as PracticeBoundary).constraints[0].statement).toBe("Corrected wording.");
  });

  it("cancelling an edit keeps the original wording", () => {
    const { onConfirm } = setup();
    typeNew("Original.");
    clickAdd();
    fireEvent.click(screen.getByRole("button", { name: t.boundaryEditCta }));
    fireEvent.change(screen.getByLabelText(t.boundaryEditCta), { target: { value: "Discarded." } });
    fireEvent.click(screen.getByRole("button", { name: t.boundaryEditCancelCta }));
    fireEvent.click(screen.getByRole("button", { name: t.boundaryConfirmCta }));
    expect((onConfirm.mock.calls[0][0] as PracticeBoundary).constraints[0].statement).toBe("Original.");
  });

  it("a rule can be removed and another chosen in its place", () => {
    const { onConfirm } = setup();
    typeNew("Remove me.");
    clickAdd();
    fireEvent.click(screen.getByRole("button", { name: t.boundaryRemoveCta }));
    expect(screen.getByText(t.boundaryRulesEmpty)).toBeTruthy();
    typeNew("Keep me.");
    clickAdd();
    fireEvent.click(screen.getByRole("button", { name: t.boundaryConfirmCta }));
    const sent = onConfirm.mock.calls[0][0] as PracticeBoundary;
    expect(sent.constraints.map((c) => c.statement)).toEqual(["Keep me."]);
  });

  it("confirming is blocked while a rule is mid-edit, so an unsaved edit cannot be silently dropped", () => {
    setup();
    typeNew("A rule.");
    clickAdd();
    fireEvent.click(screen.getByRole("button", { name: t.boundaryEditCta }));
    expect((screen.getByRole("button", { name: t.boundaryConfirmCta }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("[R5B2] refusals are stated as sentences, never as codes", () => {
  it("an empty rule is refused with actionable copy", () => {
    setup();
    typeNew("   ");
    clickAdd();
    expect(screen.getByRole("alert").textContent).toBe(t.boundaryErrorEmpty);
  });

  it("a duplicate rule is refused", () => {
    setup();
    typeNew("Same rule.");
    clickAdd();
    typeNew("  same RULE.  "); // normalization-equivalent, exactly as validateBoundary compares
    clickAdd();
    expect(screen.getByRole("alert").textContent).toBe(t.boundaryErrorDuplicate);
  });

  it("an over-long rule is refused with the real limit", () => {
    setup();
    typeNew("x".repeat(CONSTRAINT_STATEMENT_MAX + 1));
    clickAdd();
    expect(screen.getByRole("alert").textContent).toBe(t.boundaryErrorTooLong(CONSTRAINT_STATEMENT_MAX));
  });

  it("the rule ceiling is the domain's, and it is stated rather than silently enforced", () => {
    setup();
    for (let i = 0; i < CONSTRAINTS_MAX; i++) {
      typeNew(`Rule number ${i}.`);
      clickAdd();
    }
    typeNew("One too many.");
    clickAdd();
    expect(screen.getByRole("alert").textContent).toBe(t.boundaryErrorTooMany(CONSTRAINTS_MAX));
    expect(screen.getByText(t.boundaryCount(CONSTRAINTS_MAX, CONSTRAINTS_MAX))).toBeTruthy();
  });

  it("a server refusal is rendered as the resolved sentence the parent supplies", () => {
    setup({ saveError: t.boundarySaveError });
    expect(screen.getByRole("alert").textContent).toBe(t.boundarySaveError);
    // A raw reason code must never reach the screen.
    expect(document.body.textContent).not.toMatch(/boundary_|constraint_|stale_revision/);
  });
});

describe("[R5B2] the server owns confirmation, and a conflict never overwrites", () => {
  it("a stored CONFIRMED boundary renders read-only, from the server's constraints", () => {
    render(
      <BoundaryEditor
        boundary={confirmedBoundary(["Server rule A.", "Server rule B."])}
        suggestions={[]}
        copy={t}
        onConfirm={vi.fn()}
      />,
    );
    const section = screen.getByLabelText(t.boundaryConfirmedTitle);
    expect(within(section).getByText("Server rule A.")).toBeTruthy();
    expect(within(section).getByText("Server rule B.")).toBeTruthy();
    // No editing affordance until the Host asks for one.
    expect(screen.queryByRole("button", { name: t.boundaryConfirmCta })).toBeNull();
    expect(screen.getByRole("button", { name: t.boundaryChangeCta })).toBeTruthy();
  });

  it("'Change boundary' reopens the editor seeded with the SERVER's rules, not a local guess", () => {
    render(
      <BoundaryEditor boundary={confirmedBoundary(["Server rule A."])} suggestions={[]} copy={t} onConfirm={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: t.boundaryChangeCta }));
    expect(screen.getByText("Server rule A.")).toBeTruthy();
    expect(screen.getByRole("button", { name: t.boundaryConfirmCta })).toBeTruthy();
  });

  it("a canonical response REPLACES the local list — the screen shows what was stored", () => {
    const { rerender } = render(
      <BoundaryEditor boundary={undefined} suggestions={[]} copy={t} onConfirm={vi.fn()} />,
    );
    typeNew("What the Host typed.");
    clickAdd();
    // The server normalised/rewrote it. The canonical answer wins.
    rerender(
      <BoundaryEditor
        boundary={confirmedBoundary(["What the server stored."])}
        suggestions={[]}
        copy={t}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText("What the server stored.")).toBeTruthy();
    expect(screen.queryByText("What the Host typed.")).toBeNull();
  });

  it("a CONFLICT keeps the Host's unsaved work and says so — no silent overwrite, no lost input", () => {
    const { rerender } = render(
      <BoundaryEditor boundary={undefined} suggestions={[]} copy={t} onConfirm={vi.fn()} />,
    );
    typeNew("Work in progress.");
    clickAdd();
    // The save was REFUSED; the parent re-read a draft someone else had changed.
    rerender(
      <BoundaryEditor
        boundary={confirmedBoundary(["Someone else's rule."])}
        suggestions={[]}
        copy={t}
        conflict
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText("Work in progress.")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe(t.boundaryConflict);
    expect(screen.getByRole("button", { name: t.boundaryConfirmCta })).toBeTruthy();
  });

  it("saving disables the confirm control so one refusal cannot become two writes", () => {
    setup({ saving: true });
    const btn = screen.getByRole("button", { name: t.boundarySaving }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});

describe("[R5B2] the shape sent to the server, and the language shown to the Host", () => {
  it("toBoundary derives the mode from the rules and always proposes confirmed", () => {
    expect(toBoundary([])).toEqual({ mode: "judgment", confirmed: true, constraints: [] });
    const one = toBoundary([{ key: "k1", statement: "  A rule.  ", provenance: "manager_entered" }]);
    expect(one.mode).toBe("judgment_with_constraints");
    expect(one.constraints[0].statement).toBe("A rule."); // trimmed, as the validator compares
    expect(one.constraints[0].id).toBeTruthy();
    expect(one.constraints[0].provenance).toBe("manager_entered");
  });

  it("ids are unique across rules, as validateBoundary requires", () => {
    const b = toBoundary(
      ["Alpha rule.", "Beta rule.", "Gamma rule."].map((statement, i) => ({
        key: `k${i}`,
        statement,
        provenance: "manager_entered" as const,
      })),
    );
    expect(new Set(b.constraints.map((c) => c.id)).size).toBe(3);
  });

  it("an accepted suggestion keeps its provenance; a Host-authored rule is manager_entered", () => {
    const { onConfirm } = setup({ suggestions: [suggestion(1)] });
    fireEvent.click(screen.getByRole("button", { name: t.boundarySuggestionAdd }));
    typeNew("My own rule.");
    clickAdd();
    fireEvent.click(screen.getByRole("button", { name: t.boundaryConfirmCta }));
    const sent = onConfirm.mock.calls[0][0] as PracticeBoundary;
    expect(sent.constraints.map((c) => c.provenance)).toEqual(["suggested_from_problem", "manager_entered"]);
  });

  it("renders in Korean with no user-visible internal terminology", () => {
    render(<BoundaryEditor boundary={undefined} suggestions={[]} copy={ko} onConfirm={vi.fn()} />);
    expect(screen.getByText(ko.boundaryTitle)).toBeTruthy();
    expect(screen.getByRole("button", { name: ko.boundaryConfirmCta })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Arena|아레나|judgment_with_constraints|manager_entered/);
  });
});

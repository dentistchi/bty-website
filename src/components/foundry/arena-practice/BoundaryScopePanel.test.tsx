/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoundaryScopePanel } from "./BoundaryScopePanel";
import { ARENA_PRACTICE_COPY } from "./arenaPracticeCopy";
import { resolvePracticeReadiness } from "@/domain/foundry/arena-draft/practiceReadiness";
import { buildBoundaryScope } from "@/domain/foundry/arena-draft/boundaryScope";
import type { BoundaryConstraint, PracticeBoundary } from "@/domain/foundry/arena-draft/boundary";

/**
 * HOST ACTIVE-BOUNDARY SELECTOR (Slice 3.2I-R5B1A.1-R2.23D).
 *
 * R2.23C made generation block at four or more confirmed boundaries and left the Host a static
 * "not ready yet" panel — no boundaries, no selector, no way forward. These cases pin the surface
 * that clears it, and pin the things it must never do: preselect, rank, reorder, hide, summarise,
 * silently replace a choice, or show an internal id.
 */

afterEach(cleanup);

const EN = ARENA_PRACTICE_COPY.en;
const KO = ARENA_PRACTICE_COPY.ko;

const STATEMENTS = [
  "Two identifiers must be verified before treatment",
  "Private employee information cannot be disclosed",
  "A safety incident must be reported within the shift",
  "Overtime must be approved before it is worked",
  "Client data never leaves the managed environment",
];
const rule = (i: number): BoundaryConstraint => ({ id: `c${i + 1}_rule`, statement: STATEMENTS[i], provenance: "manager_entered" });
const rules = (n: number) => Array.from({ length: n }, (_, i) => rule(i));
const boundary = (n: number): PracticeBoundary => ({ mode: "judgment_with_constraints", confirmed: true, constraints: rules(n) });

const panel = (n: number, scope?: Parameters<typeof resolvePracticeReadiness>[1], copy = EN, onConfirm = vi.fn()) => {
  const readiness = resolvePracticeReadiness(boundary(n), scope);
  render(<BoundaryScopePanel readiness={readiness} copy={copy} onConfirm={onConfirm} />);
  return { readiness, onConfirm };
};
const rowFor = (statement: string) => screen.getByRole("checkbox", { name: statement });

// ---------------------------------------------------------------------------
// 1-5. ZERO TO THREE
// ---------------------------------------------------------------------------

describe("1-5. zero to three available", () => {
  it("1. zero confirmed boundaries renders no selector at all", () => {
    const readiness = resolvePracticeReadiness({ mode: "judgment", confirmed: true, constraints: [] });
    const { container } = render(<BoundaryScopePanel readiness={readiness} copy={EN} onConfirm={vi.fn()} />);
    expect(container.innerHTML).toBe("");
    expect(readiness.canGenerate).toBe(true);
  });

  it.each([1, 2, 3])("2/3/4. %i available are shown and ALL active, with no decision asked", (n) => {
    panel(n);
    expect(screen.getByText(EN.boundaryScopeAllActive)).toBeTruthy();
    for (const s of STATEMENTS.slice(0, n)) expect(screen.getByText(s)).toBeTruthy();
    // Nothing to choose: no controls, no confirm CTA.
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: EN.boundaryScopeConfirm })).toBeNull();
  });

  it("5. statements render byte-faithfully — never summarised, reworded or truncated", () => {
    panel(3);
    for (const s of STATEMENTS.slice(0, 3)) expect(screen.getByText(s, { exact: true })).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 6-15. FOUR PLUS
// ---------------------------------------------------------------------------

describe("6-15. four or more available", () => {
  it("6. every available boundary is rendered — none is hidden behind a limit", () => {
    panel(5);
    expect(screen.getAllByRole("checkbox")).toHaveLength(5);
    for (const s of STATEMENTS) expect(screen.getByText(s)).toBeTruthy();
  });

  it("7. NOTHING is preselected on first entry", () => {
    panel(5);
    for (const c of screen.getAllByRole("checkbox")) expect(c.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText(EN.boundaryScopeCount(0, 3))).toBeTruthy();
  });

  it("7b. the order is the Manager's order — no ranking is implied", () => {
    panel(5);
    const names = screen.getAllByRole("checkbox").map((c) => c.textContent);
    expect(names).toEqual(STATEMENTS);
  });

  it("8/9/13. selecting one and then three updates the count accurately", async () => {
    const u = userEvent.setup();
    panel(5);
    await u.click(rowFor(STATEMENTS[0]));
    expect(screen.getByText(EN.boundaryScopeCount(1, 3))).toBeTruthy();
    await u.click(rowFor(STATEMENTS[2]));
    await u.click(rowFor(STATEMENTS[4]));
    expect(screen.getByText(EN.boundaryScopeCount(3, 3))).toBeTruthy();
    expect(rowFor(STATEMENTS[0]).getAttribute("aria-checked")).toBe("true");
  });

  it("10. a FOURTH selection is PREVENTED — an earlier choice is never silently replaced", async () => {
    const u = userEvent.setup();
    panel(5);
    for (const i of [0, 1, 2]) await u.click(rowFor(STATEMENTS[i]));
    await u.click(rowFor(STATEMENTS[3]));
    expect(rowFor(STATEMENTS[3]).getAttribute("aria-checked")).toBe("false");
    // …and the three already chosen are untouched.
    for (const i of [0, 1, 2]) expect(rowFor(STATEMENTS[i]).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText(EN.boundaryScopeCount(3, 3))).toBeTruthy();
    expect(screen.getByText(EN.boundaryScopeMaxReached)).toBeTruthy();
  });

  it("11. deselecting frees a slot, and another can then be chosen", async () => {
    const u = userEvent.setup();
    panel(5);
    for (const i of [0, 1, 2]) await u.click(rowFor(STATEMENTS[i]));
    await u.click(rowFor(STATEMENTS[1])); // deselect
    expect(screen.getByText(EN.boundaryScopeCount(2, 3))).toBeTruthy();
    await u.click(rowFor(STATEMENTS[3]));
    expect(rowFor(STATEMENTS[3]).getAttribute("aria-checked")).toBe("true");
  });

  it("12. zero selected cannot confirm", async () => {
    const u = userEvent.setup();
    panel(5);
    expect((screen.getByRole("button", { name: EN.boundaryScopeConfirm }) as HTMLButtonElement).disabled).toBe(true);
    await u.click(rowFor(STATEMENTS[0]));
    expect((screen.getByRole("button", { name: EN.boundaryScopeConfirm }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("14/15. unselected boundaries stay visible, and the copy says why", async () => {
    const u = userEvent.setup();
    panel(5);
    await u.click(rowFor(STATEMENTS[0]));
    for (const s of STATEMENTS) expect(screen.getByText(s)).toBeTruthy();
    expect(screen.getByText(EN.boundaryScopeAnother)).toBeTruthy();
  });

  it("no internal id is ever rendered", () => {
    const { container } = render(
      <BoundaryScopePanel readiness={resolvePracticeReadiness(boundary(5))} copy={EN} onConfirm={vi.fn()} />,
    );
    expect(container.textContent).not.toMatch(/c\d+_rule/);
  });

  it("no infrastructure language reaches the Host", () => {
    const { container } = render(
      <BoundaryScopePanel readiness={resolvePracticeReadiness(boundary(5))} copy={EN} onConfirm={vi.fn()} />,
    );
    expect(container.textContent).not.toMatch(/token|model|context window|budget|schema|Arena/i);
  });
});

// ---------------------------------------------------------------------------
// 16-22. CONFIRMATION AND REOPEN
// ---------------------------------------------------------------------------

describe("16-22. confirmation, reopen and change", () => {
  it("16. the EXACT chosen ids are submitted, in selection order", async () => {
    const u = userEvent.setup();
    const onConfirm = vi.fn();
    panel(5, undefined, EN, onConfirm);
    await u.click(rowFor(STATEMENTS[3]));
    await u.click(rowFor(STATEMENTS[0]));
    await u.click(screen.getByRole("button", { name: EN.boundaryScopeConfirm }));
    expect(onConfirm).toHaveBeenCalledWith(["c4_rule", "c1_rule"]);
  });

  it("18. reopening a confirmed scope restores the exact selection, read-only", () => {
    const scope = buildBoundaryScope(rules(5), ["c2_rule", "c5_rule"]);
    if (!scope.ok) throw new Error("fixture");
    panel(5, scope.value);
    expect(screen.getByText(EN.boundaryScopeConfirmed)).toBeTruthy();
    expect(screen.getByText(STATEMENTS[1])).toBeTruthy();
    expect(screen.getByText(STATEMENTS[4])).toBeTruthy();
    // No selection controls until the Host asks to change it.
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("14b/18b. the unchosen boundaries remain VISIBLE in the confirmed state", () => {
    const scope = buildBoundaryScope(rules(5), ["c2_rule"]);
    if (!scope.ok) throw new Error("fixture");
    panel(5, scope.value);
    for (const s of STATEMENTS) expect(screen.getByText(s, { exact: false })).toBeTruthy();
  });

  it("19. Change selection reopens the selector with the stored choice intact", async () => {
    const u = userEvent.setup();
    const scope = buildBoundaryScope(rules(5), ["c2_rule", "c5_rule"]);
    if (!scope.ok) throw new Error("fixture");
    panel(5, scope.value);
    await u.click(screen.getByRole("button", { name: EN.boundaryScopeChange }));
    expect(rowFor(STATEMENTS[1]).getAttribute("aria-checked")).toBe("true");
    expect(rowFor(STATEMENTS[4]).getAttribute("aria-checked")).toBe("true");
    expect(rowFor(STATEMENTS[0]).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText(EN.boundaryScopeCount(2, 3))).toBeTruthy();
  });

  it("20. readiness flips ONLY on confirmation", () => {
    const unconfirmed = buildBoundaryScope(rules(5), ["c1_rule"]);
    if (!unconfirmed.ok) throw new Error("fixture");
    expect(resolvePracticeReadiness(boundary(5), { ...unconfirmed.value, confirmed: false }).canGenerate).toBe(false);
    expect(resolvePracticeReadiness(boundary(5), unconfirmed.value).canGenerate).toBe(true);
  });

  it("21/22. only the ACTIVE boundaries are active, and the full available set is preserved", () => {
    const scope = buildBoundaryScope(rules(5), ["c1_rule", "c3_rule"]);
    if (!scope.ok) throw new Error("fixture");
    const r = resolvePracticeReadiness(boundary(5), scope.value);
    expect(r.active.map((c) => c.id)).toEqual(["c1_rule", "c3_rule"]);
    expect(r.available).toHaveLength(5);
    expect(r.available.map((c) => c.statement)).toEqual(STATEMENTS);
  });
});

// ---------------------------------------------------------------------------
// 23-32. STALE STATE AND RECOVERY
// ---------------------------------------------------------------------------

describe("23-32. stale state and error recovery", () => {
  const confirmedFor = (n: number, ids: string[]) => {
    const b = buildBoundaryScope(rules(n), ids);
    if (!b.ok) throw new Error("fixture");
    return b.value;
  };

  it("23/24/25. adding, removing or REWORDING a boundary invalidates the confirmation", () => {
    const scope = confirmedFor(5, ["c1_rule", "c2_rule"]);
    const added: PracticeBoundary = { ...boundary(5), constraints: [...rules(5), { id: "c6_rule", statement: "A new rule", provenance: "manager_entered" }] };
    expect(resolvePracticeReadiness(added, scope).state).toBe("active_boundary_set_changed");
    const removed: PracticeBoundary = { ...boundary(5), constraints: rules(4) };
    expect(resolvePracticeReadiness(removed, scope).canGenerate).toBe(false);
    const reworded: PracticeBoundary = { ...boundary(5), constraints: rules(5).map((c) => (c.id === "c3_rule" ? { ...c, statement: "Reworded rule" } : c)) };
    expect(resolvePracticeReadiness(reworded, scope).state).toBe("active_boundary_set_changed");
  });

  it("27/28. a changed set shows the CURRENT complete list and carries no stale subset forward", () => {
    const scope = confirmedFor(5, ["c1_rule", "c2_rule"]);
    const reworded: PracticeBoundary = { ...boundary(5), constraints: rules(5).map((c) => (c.id === "c3_rule" ? { ...c, statement: "Reworded rule" } : c)) };
    const r = resolvePracticeReadiness(reworded, scope);
    expect(r.active).toEqual([]); // nothing carried forward
    render(<BoundaryScopePanel readiness={r} copy={EN} onConfirm={vi.fn()} />);
    expect(screen.getByText(EN.boundaryScopeChangedNotice)).toBeTruthy();
    expect(screen.getAllByRole("checkbox")).toHaveLength(5);
    for (const c of screen.getAllByRole("checkbox")) expect(c.getAttribute("aria-checked")).toBe("false");
  });

  it("29/31. every fail-closed state maps to an actionable selector, never a dead end", () => {
    const cases: Array<[string, ReturnType<typeof resolvePracticeReadiness>]> = [
      ["boundary_scope_required", resolvePracticeReadiness(boundary(5))],
      ["boundary_scope_unconfirmed", resolvePracticeReadiness(boundary(5), { ...confirmedFor(5, ["c1_rule"]), confirmed: false })],
      ["active_boundary_set_changed", resolvePracticeReadiness({ ...boundary(5), constraints: rules(4) }, confirmedFor(5, ["c1_rule"]))],
    ];
    for (const [expected, readiness] of cases) {
      expect(readiness.state, expected).toBe(expected);
      const { unmount } = render(<BoundaryScopePanel readiness={readiness} copy={EN} onConfirm={vi.fn()} />);
      // Actionable: the selector is present with a confirm route out.
      expect(screen.getAllByRole("checkbox").length, expected).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: EN.boundaryScopeConfirm }), expected).toBeTruthy();
      unmount();
    }
  });

  it("30. no technical code, status number or raw state name is rendered", () => {
    for (const readiness of [resolvePracticeReadiness(boundary(5)), resolvePracticeReadiness({ ...boundary(5), constraints: rules(4) }, confirmedFor(5, ["c1_rule"]))]) {
      const { container, unmount } = render(<BoundaryScopePanel readiness={readiness} copy={EN} onConfirm={vi.fn()} />);
      expect(container.textContent).not.toMatch(/boundary_scope|active_boundary_set_changed|too_many|unknown_active|4\d\d|5\d\d/);
      unmount();
    }
  });

  it("a save failure is reported honestly and the selection survives it", async () => {
    const u = userEvent.setup();
    const readiness = resolvePracticeReadiness(boundary(5));
    render(<BoundaryScopePanel readiness={readiness} copy={EN} onConfirm={vi.fn()} saveError />);
    await u.click(rowFor(STATEMENTS[0]));
    expect(screen.getByRole("alert")?.textContent).toContain(EN.boundaryScopeSaveError);
    expect(rowFor(STATEMENTS[0]).getAttribute("aria-checked")).toBe("true");
  });

  it("confirming is disabled while a save is in flight", () => {
    const built = buildBoundaryScope(rules(5), ["c1_rule"]);
    if (!built.ok) throw new Error("fixture");
    const readiness = resolvePracticeReadiness(boundary(5), { ...built.value, confirmed: false });
    render(<BoundaryScopePanel readiness={readiness} copy={EN} onConfirm={vi.fn()} saving />);
    expect((screen.getByRole("button", { name: EN.boundaryScopeSaving }) as HTMLButtonElement).disabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 33-37. ACCESSIBILITY
// ---------------------------------------------------------------------------

describe("33-37. accessibility", () => {
  it("33. every boundary is keyboard-operable", async () => {
    const u = userEvent.setup();
    panel(5);
    await u.tab();
    // Tab order reaches the first boundary row; space toggles it.
    const first = rowFor(STATEMENTS[0]);
    first.focus();
    await u.keyboard(" ");
    expect(first.getAttribute("aria-checked")).toBe("true");
    await u.keyboard(" ");
    expect(first.getAttribute("aria-checked")).toBe("false");
  });

  it("34. the accessible name IS the Manager's statement", () => {
    panel(5);
    for (const s of STATEMENTS) expect(screen.getByRole("checkbox", { name: s })).toBeTruthy();
  });

  it("35. selected state is programmatic, not only visual", async () => {
    const u = userEvent.setup();
    panel(5);
    await u.click(rowFor(STATEMENTS[1]));
    expect(rowFor(STATEMENTS[1]).getAttribute("aria-checked")).toBe("true");
  });

  it("36. the count and the max-reached notice are announced", async () => {
    const u = userEvent.setup();
    const { container } = render(<BoundaryScopePanel readiness={resolvePracticeReadiness(boundary(5))} copy={EN} onConfirm={vi.fn()} />);
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toContain(EN.boundaryScopeCount(0, 3));
    for (const i of [0, 1, 2]) await u.click(rowFor(STATEMENTS[i]));
    expect(screen.getAllByRole("status").some((n) => n.textContent === EN.boundaryScopeMaxReached)).toBe(true);
  });

  it("37. an unselectable row explains itself rather than disappearing", async () => {
    const u = userEvent.setup();
    panel(5);
    for (const i of [0, 1, 2]) await u.click(rowFor(STATEMENTS[i]));
    const fourth = rowFor(STATEMENTS[3]);
    expect((fourth as HTMLButtonElement).disabled).toBe(false); // still reachable and readable
    expect(fourth.getAttribute("aria-describedby")).toBe("practice-boundaries-max");
  });

  it("the section is labelled for assistive technology", () => {
    const { container } = render(<BoundaryScopePanel readiness={resolvePracticeReadiness(boundary(5))} copy={EN} onConfirm={vi.fn()} />);
    const section = container.querySelector("section");
    expect(section?.getAttribute("aria-labelledby")).toBe("practice-boundaries-heading");
    expect(within(section as HTMLElement).getByRole("heading")?.textContent).toContain(EN.boundaryScopeTitle);
  });
});

// ---------------------------------------------------------------------------
// Korean
// ---------------------------------------------------------------------------

describe("Korean copy carries the same meaning", () => {
  it("renders the KO selector with the same structure and the same count semantics", async () => {
    const u = userEvent.setup();
    panel(5, undefined, KO);
    expect(screen.getByRole("heading", { name: KO.boundaryScopeTitle })).toBeTruthy();
    expect(screen.getByText(KO.boundaryScopeCount(0, 3))).toBeTruthy();
    await u.click(rowFor(STATEMENTS[0]));
    expect(screen.getByText(KO.boundaryScopeCount(1, 3))).toBeTruthy();
    expect(screen.getByText(KO.boundaryScopeAnother)).toBeTruthy();
  });

  it("KO uses Practice terminology and no infrastructure language", () => {
    const { container } = render(<BoundaryScopePanel readiness={resolvePracticeReadiness(boundary(5))} copy={KO} onConfirm={vi.fn()} />);
    expect(container.textContent).not.toMatch(/아레나|토큰|모델/);
    expect(container.textContent).toContain("연습");
  });
});

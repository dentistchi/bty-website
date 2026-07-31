import { describe, it, expect } from "vitest";
import {
  GENERATED_ACTION_CHOICES,
  GENERATED_PRIMARY_CHOICES,
  GENERATED_TRADEOFF_CHOICES,
  GEN_CHOICE_LABEL_MAX,
  GEN_OPENING_MAX,
  PRIMARY_CHOICES_MAX,
  PRIMARY_CHOICES_MIN,
  TRADEOFF_CHOICES_MAX,
  ACTION_CHOICES_MAX,
  type ArenaScenarioDraft,
} from "./types";
import { PROVIDER_SCENARIO_JSON_SCHEMA, canonicalizeProviderScenario, validateProviderScenario } from "./providerDto";
import { constructionFor, toProviderDto } from "./providerDto.fixture";
import { parseArenaScenarioDraft } from "./validate";
import { enumerateChoices } from "./choiceConstruction";

/**
 * GENERATED-PRACTICE CARDINALITY (Slice 3.2I-R5B1A.1-R2.23A).
 *
 * "Three-part" in this product means the three DECISION STAGES — Primary, Tradeoff, Action
 * Decision — not three or four buttons at a stage. The full loop is unchanged. Newly generated
 * Practice offers EXACTLY two options at each stage, because every option has to be defensible,
 * causally distinct, costly and independently reviewable, and two that clear that bar beat four
 * that do not.
 *
 * The restriction is GENERATION-ONLY. Legacy Arena scenarios, existing static content and
 * already-persisted snapshots keep the canonical 2-4 range and are not rewritten or migrated.
 */

const choice = (label: string, i: number) => ({ label, constraintAssessments: [], construction: constructionFor(label, i) });
const act = (label: string, commit: boolean, i: number) => ({ ...choice(label, i), isActionCommitment: commit });

const branch = (n: number) => ({
  resultingWorldState: `World after primary ${n}.`,
  escalationText: `A new pressure follows primary ${n} within the hour.`,
  tradeoffChoices: [choice(`Branch ${n} tradeoff one`, 0), choice(`Branch ${n} tradeoff two`, 1)],
  actionDecision: { prompt: "Commit to what?", choices: [act(`Branch ${n} commit`, true, 0), act(`Branch ${n} alternate`, false, 1)] },
});

const dto = () =>
  toProviderDto({
    title: "Raising a risk under a deadline",
    opening: "A teammate flags a safety gap hours before the client deadline; both promises cannot hold.",
    primary: { choices: [{ id: "p1", label: "Stop the line now" }, { id: "p2", label: "Verify the gap yourself first" }] },
    tradeoff: { escalationText: "A second reviewer reports the same gap.", choices: [{ id: "ft1", label: "Ask for more time" }, { id: "ft2", label: "Narrow the scope" }] },
    actionDecision: { prompt: "What now?", choices: [{ id: "fa1", label: "Call the client now", isActionCommitment: true }, { id: "fa2", label: "Verify once more first", isActionCommitment: false }] },
    branches: {
      p1: { escalationText: "The client escalates.", tradeoffChoices: [{ id: "p1-t1", label: "Brief the director" }, { id: "p1-t2", label: "Send the summary" }], actionDecision: { prompt: "Commit?", choices: [{ id: "p1-a1", label: "Give a dated plan", isActionCommitment: true }, { id: "p1-a2", label: "Ask for a day", isActionCommitment: false }] } },
      p2: { escalationText: "The buffer is consumed.", tradeoffChoices: [{ id: "p2-t1", label: "Ship the verified part" }, { id: "p2-t2", label: "Ask for overtime" }], actionDecision: { prompt: "Commit?", choices: [{ id: "p2-a1", label: "Say which part slips", isActionCommitment: true }, { id: "p2-a2", label: "Wait for the result", isActionCommitment: false }] } },
    },
  });

// ---------------------------------------------------------------------------
// 1-9. GENERATED CARDINALITY
// ---------------------------------------------------------------------------

describe("1-4. the strict schema requires exactly two at every generated decision", () => {
  const p = PROVIDER_SCENARIO_JSON_SCHEMA.properties;

  it("1/2. exactly two primary choices and exactly two branches", () => {
    expect([p.primaryChoices.minItems, p.primaryChoices.maxItems]).toEqual([2, 2]);
    expect([p.branches.minItems, p.branches.maxItems]).toEqual([2, 2]);
  });

  it("3/4. exactly two tradeoff and two action choices in every branch, and in the flat projection", () => {
    const b = p.branches.items.properties;
    expect([b.tradeoffChoices.minItems, b.tradeoffChoices.maxItems]).toEqual([2, 2]);
    expect([b.actionDecision.properties.choices.minItems, b.actionDecision.properties.choices.maxItems]).toEqual([2, 2]);
    expect([p.flatTradeoffChoices.minItems, p.flatTradeoffChoices.maxItems]).toEqual([2, 2]);
    expect([p.flatActionDecision.properties.choices.minItems, p.flatActionDecision.properties.choices.maxItems]).toEqual([2, 2]);
  });

  it("the constants say exactly two, and a valid two-choice DTO is ACCEPTED", () => {
    expect([GENERATED_PRIMARY_CHOICES, GENERATED_TRADEOFF_CHOICES, GENERATED_ACTION_CHOICES]).toEqual([2, 2, 2]);
    expect(validateProviderScenario(dto()).ok).toBe(true);
  });
});

describe("5-7. anything other than two is rejected", () => {
  it("5. one primary choice is rejected", () => {
    const d = dto();
    d.primaryChoices = [d.primaryChoices[0]];
    d.branches = [d.branches[0]];
    const r = validateProviderScenario(d);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors.some((e) => e.startsWith("dto_choice_count:primary"))).toBe(true);
  });

  it("6. three generated primaries are rejected", () => {
    const d = dto();
    d.primaryChoices = [...d.primaryChoices, choice("A third strategy", 2)];
    d.branches = [...d.branches, branch(3)];
    const r = validateProviderScenario(d);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors.some((e) => e.startsWith("dto_choice_count:primary"))).toBe(true);
  });

  it("7. four generated primaries are rejected", () => {
    const d = dto();
    d.primaryChoices = [...d.primaryChoices, choice("A third strategy", 2), choice("A fourth strategy", 3)];
    d.branches = [...d.branches, branch(3), branch(4)];
    expect(validateProviderScenario(d).ok).toBe(false);
  });

  it("5b. three tradeoff or three action choices are rejected at every phase", () => {
    const flat = dto();
    flat.flatTradeoffChoices = [...flat.flatTradeoffChoices, choice("A third tradeoff", 2)];
    expect(validateProviderScenario(flat).ok).toBe(false);

    const branchTradeoff = dto();
    branchTradeoff.branches[0].tradeoffChoices = [...branchTradeoff.branches[0].tradeoffChoices, choice("A third tradeoff", 2)];
    expect(validateProviderScenario(branchTradeoff).ok).toBe(false);

    const branchAction = dto();
    branchAction.branches[1].actionDecision.choices = [...branchAction.branches[1].actionDecision.choices, act("A third action", false, 2)];
    expect(validateProviderScenario(branchAction).ok).toBe(false);
  });
});

describe("8/9. adapter and coverage under exactly two", () => {
  it("8. the adapter assigns the same deterministic ids for two choices", () => {
    const { draft } = canonicalizeProviderScenario((validateProviderScenario(dto()) as { value: ReturnType<typeof dto> }).value);
    expect(draft.primary.choices.map((c) => c.id)).toEqual(["p1", "p2"]);
    expect(Object.keys(draft.branches!)).toEqual(["p1", "p2"]);
    expect(draft.branches!.p1.tradeoffChoices.map((c) => c.id)).toEqual(["p1-t1", "p1-t2"]);
    expect(draft.branches!.p2.tradeoffChoices.map((c) => c.id)).toEqual(["p2-t1", "p2-t2"]);
    expect(draft.branches!.p1.actionDecision.choices.map((c) => c.id)).toEqual(["p1-a1", "p1-a2"]);
    expect(draft.branches!.p2.actionDecision.choices.map((c) => c.id)).toEqual(["p2-a1", "p2-a2"]);
  });

  it("9. the reviewer must cover exactly 14 visible choices in the generated shape", () => {
    const { draft } = canonicalizeProviderScenario((validateProviderScenario(dto()) as { value: ReturnType<typeof dto> }).value);
    // 2 primary + 2 flat tradeoff + 2 flat action + 2 branches x (2 + 2)
    expect(enumerateChoices(draft)).toHaveLength(14);
  });

  it("the canonical persisted draft still parses unchanged", () => {
    const { draft } = canonicalizeProviderScenario((validateProviderScenario(dto()) as { value: ReturnType<typeof dto> }).value);
    expect(parseArenaScenarioDraft(draft).ok).toBe(true);
    expect(Object.keys(draft).sort()).toEqual(["actionDecision", "branches", "opening", "primary", "title", "tradeoff"]);
  });
});

// ---------------------------------------------------------------------------
// 10-15. BACKWARD COMPATIBILITY — the restriction is GENERATION-ONLY
// ---------------------------------------------------------------------------

const legacy = (n: number): ArenaScenarioDraft => {
  const ids = Array.from({ length: n }, (_, i) => `legacy_p${i + 1}`);
  return {
    title: `A legacy ${n}-choice scenario`,
    opening: "A supplier misses a delivery window and three teams are already waiting on the parts today.",
    primary: { choices: ids.map((id, i) => ({ id, label: `Legacy strategy ${i + 1}` })) },
    tradeoff: {
      escalationText: "The account manager escalates within the hour.",
      choices: [{ id: "lt1", label: "Legacy tradeoff one" }, { id: "lt2", label: "Legacy tradeoff two" }, { id: "lt3", label: "Legacy tradeoff three" }].slice(0, Math.min(3, n + 1)),
    },
    actionDecision: {
      prompt: "What do you commit to?",
      choices: [{ id: "la1", label: "Legacy commit", isActionCommitment: true }, { id: "la2", label: "Legacy alternate", isActionCommitment: false }, { id: "la3", label: "Legacy third", isActionCommitment: false }].slice(0, Math.min(3, n + 1)),
    },
    branches: Object.fromEntries(
      ids.map((id, i) => [
        id,
        {
          escalationText: `Legacy branch ${i + 1} escalation with its own new pressure.`,
          tradeoffChoices: [{ id: `${id}_t1`, label: `Legacy branch ${i + 1} tradeoff one` }, { id: `${id}_t2`, label: `Legacy branch ${i + 1} tradeoff two` }],
          actionDecision: { prompt: "Commit?", choices: [{ id: `${id}_a1`, label: `Legacy branch ${i + 1} commit`, isActionCommitment: true }, { id: `${id}_a2`, label: `Legacy branch ${i + 1} alternate`, isActionCommitment: false }] },
        },
      ]),
    ),
  };
};

describe("10-15. legacy and persisted content is untouched", () => {
  it("13. the CANONICAL validator still accepts 2-4, unchanged", () => {
    expect([PRIMARY_CHOICES_MIN, PRIMARY_CHOICES_MAX]).toEqual([2, 4]);
    expect(TRADEOFF_CHOICES_MAX).toBe(3);
    expect(ACTION_CHOICES_MAX).toBe(3);
  });

  it("10/11/12. existing 2-, 3- and 4-primary snapshots all still parse and play", () => {
    for (const n of [2, 3, 4]) {
      const r = parseArenaScenarioDraft(legacy(n));
      expect(r.ok, `legacy ${n}-primary snapshot no longer parses`).toBe(true);
      if (r.ok) expect(r.value.primary.choices).toHaveLength(n);
    }
  });

  it("11b. a legacy FLAT scenario with no branches still parses", () => {
    const flat = { ...legacy(3) };
    delete (flat as { branches?: unknown }).branches;
    expect(parseArenaScenarioDraft(flat).ok).toBe(true);
  });

  it("14. selected_path ids from legacy content are untouched — the generator never re-identifies them", () => {
    const r = parseArenaScenarioDraft(legacy(4));
    expect(r.ok && r.value.primary.choices.map((c) => c.id)).toEqual(["legacy_p1", "legacy_p2", "legacy_p3", "legacy_p4"]);
    // The generated id scheme is applied only at generation ingestion, never to stored content.
    expect(r.ok && Object.keys(r.value.branches!)).toEqual(["legacy_p1", "legacy_p2", "legacy_p3", "legacy_p4"]);
  });

  it("15. no migration is implied — legacy text limits are the canonical ones, not the generated ones", () => {
    // A legacy label longer than the concise GENERATED bound still parses; only generation is bound.
    const long = legacy(3);
    long.primary.choices[0].label = "L".repeat(GEN_CHOICE_LABEL_MAX + 40);
    expect(parseArenaScenarioDraft(long).ok).toBe(true);
    long.opening = `${long.opening} ${"x".repeat(GEN_OPENING_MAX)}`;
    expect(parseArenaScenarioDraft(long).ok).toBe(true);
  });

  it("the generated bounds are STRICTER than the canonical ones — they never widen anything", () => {
    expect(GEN_CHOICE_LABEL_MAX).toBeLessThan(400);
    expect(GEN_OPENING_MAX).toBeLessThan(1200);
    expect(GENERATED_PRIMARY_CHOICES).toBeGreaterThanOrEqual(PRIMARY_CHOICES_MIN);
    expect(GENERATED_PRIMARY_CHOICES).toBeLessThanOrEqual(PRIMARY_CHOICES_MAX);
  });
});

// ---------------------------------------------------------------------------
// 24. CONCISE BOUNDS — over-limit output FAILS, it is never truncated
// ---------------------------------------------------------------------------

describe("24. an over-limit field is rejected by validation, never trimmed", () => {
  it("an over-long choice label fails", () => {
    const d = dto();
    d.primaryChoices[0].label = "x".repeat(GEN_CHOICE_LABEL_MAX + 1);
    const r = validateProviderScenario(d);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors).toContain("dto_label_too_long");
  });

  it("an over-long opening, title, escalation or prompt fails", () => {
    for (const [mutate, code] of [
      [(d: ReturnType<typeof dto>) => (d.opening = "x".repeat(GEN_OPENING_MAX + 1)), "dto_opening_too_long"],
      [(d: ReturnType<typeof dto>) => (d.title = "x".repeat(200)), "dto_title_too_long"],
      [(d: ReturnType<typeof dto>) => (d.flatEscalationText = "x".repeat(900)), "dto_escalation_too_long"],
      [(d: ReturnType<typeof dto>) => (d.flatActionDecision.prompt = "x".repeat(400)), "dto_action_prompt_too_long"],
    ] as Array<[(d: ReturnType<typeof dto>) => void, string]>) {
      const d = dto();
      mutate(d);
      const r = validateProviderScenario(d);
      expect(r.ok, code).toBe(false);
      expect(!r.ok && r.errors, code).toContain(code);
    }
  });

  it("the schema itself declares the bounds, so a compliant provider never sends over-limit text", () => {
    const p = PROVIDER_SCENARIO_JSON_SCHEMA.properties;
    expect(p.title.maxLength).toBeGreaterThan(0);
    expect(p.opening.maxLength).toBe(GEN_OPENING_MAX);
    expect(p.primaryChoices.items.properties.label.maxLength).toBe(GEN_CHOICE_LABEL_MAX);
    expect(p.primaryChoices.items.properties.construction.properties.competentIntent.maxLength).toBeGreaterThan(0);
  });
});

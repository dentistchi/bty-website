import { describe, it, expect } from "vitest";
import {
  validateDirectionSuggestions,
  problemStatementsCompatible,
  DIRECTION_GENERATION_VERSION,
  DIRECTION_LIMITS,
  type DirectionSuggestion,
} from "./direction-copilot";

/**
 * Direction Copilot validator — fail-closed. Proves shape, length, unsafe-markup,
 * distinctness, observability, and evidence-honesty gates, plus normalization and
 * the unknown-field policy. These are a deterministic MINIMUM floor, not a claim of
 * semantic perfection (see the module header).
 */

type RawItem = Record<string, unknown>;

function validItems(): RawItem[] {
  return [
    {
      title: "Accurate shift handoff",
      capability_candidate: "Shift Handoff",
      rationale: "Focuses on how information moves between roles at the end of a shift.",
      observable_behavior:
        "At shift handoff, the nurse names the unresolved issue, the owner, and the next check time before leaving.",
      success_evidence_hint:
        "The handoff record lists the unresolved issue, an assigned owner, and a follow-up time.",
      important_assumption: "This assumes a shared handoff record exists.",
    },
    {
      title: "Read-back on medication orders",
      capability_candidate: "Order Verification",
      rationale: "Targets the moment a spoken order could be misheard.",
      observable_behavior:
        "Before acting on a verbal order, the staff member repeats the dose back and writes it on the chart.",
      success_evidence_hint: "The chart shows a written confirmation entry for the verbal order.",
      important_assumption: null,
    },
    {
      title: "Escalation when unsure",
      capability_candidate: "Escalation Judgment",
      rationale: "Addresses whether people raise concerns in time.",
      observable_behavior:
        "When unsure about a change, the employee flags it to the supervisor and records the time it was raised.",
      success_evidence_hint: "A supervisor confirms the concern was raised and the time is logged.",
      important_assumption: "This may require a policy change in addition to training.",
    },
  ];
}

const wrap = (items: RawItem[]) => ({ suggestions: items });

function expectReject(raw: unknown, code: string) {
  const r = validateDirectionSuggestions(raw);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.code).toBe(code);
}

describe("validateDirectionSuggestions — shape", () => {
  it("accepts exactly three valid directions with server-assigned ids", () => {
    const r = validateDirectionSuggestions(wrap(validItems()));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.suggestions.map((s) => s.id)).toEqual(["direction_1", "direction_2", "direction_3"]);
    expect(r.suggestions[1].important_assumption).toBeNull();
    expect(r.suggestions[0].important_assumption).toBe("This assumes a shared handoff record exists.");
  });

  it("accepts a bare array (no wrapper object)", () => {
    expect(validateDirectionSuggestions(validItems()).ok).toBe(true);
  });

  it("rejects 0, 1, 2, and 4 suggestions as wrong_count", () => {
    for (const n of [0, 1, 2, 4]) {
      const items = n <= 3 ? validItems().slice(0, n) : [...validItems(), validItems()[0]];
      expectReject(wrap(items), "wrong_count");
    }
  });

  it("rejects a non-object / non-array top level", () => {
    expectReject(null, "not_object");
    expectReject("nope", "not_object");
  });

  it("rejects a non-array suggestions field", () => {
    expectReject({ suggestions: "x" }, "not_array");
  });

  it("rejects a non-object item", () => {
    const items = validItems();
    // @ts-expect-error intentional bad shape
    items[1] = "not an object";
    expectReject(wrap(items), "item_not_object");
  });

  it("rejects a missing required field", () => {
    const items = validItems();
    delete items[0].capability_candidate;
    expectReject(wrap(items), "missing_field");
  });

  it("rejects a non-string required field", () => {
    const items = validItems();
    items[0].title = 42;
    expectReject(wrap(items), "field_not_string");
  });

  it("rejects an empty (whitespace-only) required field", () => {
    const items = validItems();
    items[0].title = "   \n  ";
    expectReject(wrap(items), "empty_field");
  });
});

describe("validateDirectionSuggestions — length + markup", () => {
  it("rejects an overlong field", () => {
    const items = validItems();
    items[0].rationale = "x".repeat(DIRECTION_LIMITS.rationale + 1);
    expectReject(wrap(items), "too_long");
  });

  it("rejects HTML tags", () => {
    const items = validItems();
    items[0].title = "Handoff <img src=x onerror=1>";
    expectReject(wrap(items), "unsafe_markup");
  });

  it("rejects markdown code fences", () => {
    const items = validItems();
    items[0].rationale = "```json\n{}\n```";
    expectReject(wrap(items), "unsafe_markup");
  });

  it("rejects data: URLs and script-like content", () => {
    const items = validItems();
    items[0].rationale = "See data:text/html;base64,PHNjcmlwdD4=";
    expectReject(wrap(items), "unsafe_markup");
  });

  it("rejects a field that is itself serialized JSON", () => {
    const items = validItems();
    items[0].capability_candidate = '{"nested":"json"}';
    expectReject(wrap(items), "unsafe_markup");
  });
});

describe("validateDirectionSuggestions — distinctness", () => {
  it("rejects duplicate capabilities", () => {
    const items = validItems();
    items[1].capability_candidate = "Shift Handoff";
    expectReject(wrap(items), "duplicate_capability");
  });

  it("rejects titles that differ only by generic modifiers", () => {
    const items = validItems();
    items[0].title = "Shift handoff";
    items[1].title = "Better shift handoff approach";
    expectReject(wrap(items), "duplicate_title");
  });

  it("rejects duplicate observable behaviors", () => {
    const items = validItems();
    items[1].observable_behavior = items[0].observable_behavior;
    expectReject(wrap(items), "duplicate_behavior");
  });

  it("rejects a behavior that is merely a shorter version of another", () => {
    const items = validItems();
    items[1].observable_behavior = "The nurse names the unresolved issue and the owner.";
    items[0].observable_behavior =
      "At shift handoff the nurse names the unresolved issue and the owner before leaving the floor.";
    expectReject(wrap(items), "duplicate_behavior");
  });
});

describe("validateDirectionSuggestions — observability + honesty", () => {
  it("rejects a vague, non-observable behavior", () => {
    for (const vague of [
      "Improve communication between the day and night teams.",
      "Be more accountable for outcomes.",
      "Understand the importance of handoffs.",
    ]) {
      const items = validItems();
      items[0].observable_behavior = vague;
      expectReject(wrap(items), "vague_behavior");
    }
  });

  it("accepts honest, observable behavior (the valid set)", () => {
    expect(validateDirectionSuggestions(wrap(validItems())).ok).toBe(true);
  });

  it("rejects evidence that overclaims permanent change / competence", () => {
    for (const overclaim of [
      "The employee is now competent and behavior has permanently changed.",
      "Trust was restored across the team.",
      "The patient fully understood everything.",
    ]) {
      const items = validItems();
      items[0].success_evidence_hint = overclaim;
      expectReject(wrap(items), "overclaiming_evidence");
    }
  });
});

describe("validateDirectionSuggestions — normalization + unknown fields", () => {
  it("normalizes surrounding + internal whitespace", () => {
    const items = validItems();
    items[0].title = "  Accurate   shift\n\nhandoff  ";
    const r = validateDirectionSuggestions(wrap(items));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.suggestions[0].title).toBe("Accurate shift handoff");
  });

  it("drops unknown fields and ignores a client-supplied id", () => {
    const items = validItems();
    items[0].id = "client-forged";
    items[0].confidence = 0.99;
    items[0].internal_policy = "secret";
    const r = validateDirectionSuggestions(wrap(items));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.suggestions[0].id).toBe("direction_1");
    expect(Object.keys(r.suggestions[0]).sort()).toEqual(
      (
        [
          "capability_candidate",
          "id",
          "important_assumption",
          "observable_behavior",
          "rationale",
          "success_evidence_hint",
          "title",
        ] satisfies (keyof DirectionSuggestion)[]
      ).sort(),
    );
  });

  it("accepts an absent important_assumption as null", () => {
    const items = validItems();
    delete items[0].important_assumption;
    const r = validateDirectionSuggestions(wrap(items));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.suggestions[0].important_assumption).toBeNull();
  });
});

describe("problemStatementsCompatible", () => {
  it("tolerates trivial whitespace/case differences", () => {
    expect(problemStatementsCompatible("Handoffs  miss the check", "handoffs miss the check")).toBe(true);
  });
  it("rejects a real edit as incompatible (stale guard)", () => {
    expect(problemStatementsCompatible("Handoffs miss the check", "Orders are misheard")).toBe(false);
  });
});

it("exposes a stable generation version", () => {
  expect(DIRECTION_GENERATION_VERSION).toBe("direction_copilot_v1");
});

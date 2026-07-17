import { describe, it, expect } from "vitest";
import {
  detectSensitiveInfo,
  parseArenaScenarioDraft,
  parseGuidedAnswers,
  validateArenaScenarioDraft,
} from "./validate";
import type { ArenaScenarioDraft } from "./types";

function validDraft(over: Partial<ArenaScenarioDraft> = {}): ArenaScenarioDraft {
  return {
    title: "Speak up when a shortcut is proposed",
    opening: "A teammate proposes skipping a check to hit the deadline. What do you do?",
    primary: {
      choices: [
        { id: "primary_1", label: "Raise the risk directly, now" },
        { id: "primary_2", label: "Ask a clarifying question first" },
        { id: "primary_3", label: "Say nothing and go along" },
      ],
    },
    tradeoff: {
      escalationText: "Your manager backs the shortcut and time is nearly up.",
      choices: [
        { id: "tradeoff_1", label: "Hold your position on the check" },
        { id: "tradeoff_2", label: "Defer to your manager to keep the peace" },
      ],
    },
    actionDecision: {
      prompt: "What will you actually do?",
      choices: [
        { id: "action_1", label: "Send the written objection now", isActionCommitment: true },
        { id: "action_2", label: "Wait and watch how it plays out", isActionCommitment: false },
      ],
    },
    ...over,
  };
}

describe("validateArenaScenarioDraft — three-phase structure", () => {
  it("accepts a well-formed three-phase draft", () => {
    const r = validateArenaScenarioDraft(validDraft());
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("rejects a non-object", () => {
    expect(validateArenaScenarioDraft(null).errors).toContain("draft_invalid");
  });

  it("rejects a missing PRIMARY phase", () => {
    const d = validDraft();
    delete (d as { primary?: unknown }).primary;
    expect(validateArenaScenarioDraft(d).errors).toContain("primary_missing");
  });

  it("rejects a missing TRADEOFF phase", () => {
    const d = validDraft();
    delete (d as { tradeoff?: unknown }).tradeoff;
    const r = validateArenaScenarioDraft(d);
    expect(r.errors).toContain("tradeoff_missing");
  });

  it("rejects a missing ACTION DECISION phase", () => {
    const d = validDraft();
    delete (d as { actionDecision?: unknown }).actionDecision;
    expect(validateArenaScenarioDraft(d).errors).toContain("action_missing");
  });

  it("rejects a missing escalation text", () => {
    const d = validDraft({ tradeoff: { escalationText: "  ", choices: validDraft().tradeoff.choices } });
    expect(validateArenaScenarioDraft(d).errors).toContain("missing_escalation");
  });

  it("rejects when NO action choice is an action commitment", () => {
    const d = validDraft();
    d.actionDecision.choices = d.actionDecision.choices.map((c) => ({ ...c, isActionCommitment: false }));
    expect(validateArenaScenarioDraft(d).errors).toContain("no_action_commitment");
  });

  it("rejects a non-boolean commitment flag", () => {
    const d = validDraft();
    (d.actionDecision.choices[0] as { isActionCommitment: unknown }).isActionCommitment = "yes";
    expect(validateArenaScenarioDraft(d).errors).toContain("action_choice_missing_commitment_flag");
  });

  it("rejects duplicate choice ids (across phases)", () => {
    const d = validDraft();
    d.tradeoff.choices[0].id = "primary_1"; // collide with a primary id
    expect(validateArenaScenarioDraft(d).errors).toContain("duplicate_choice_id");
  });

  it("rejects an empty choice label", () => {
    const d = validDraft();
    d.primary.choices[0].label = "   ";
    expect(validateArenaScenarioDraft(d).errors).toContain("primary_choice_empty_label");
  });

  it("rejects a choice with a missing id", () => {
    const d = validDraft();
    (d.primary.choices[1] as { id?: string }).id = "";
    expect(validateArenaScenarioDraft(d).errors).toContain("primary_choice_missing_id");
  });

  it("enforces PRIMARY cardinality (2-4)", () => {
    const one = validDraft();
    one.primary.choices = [one.primary.choices[0]];
    expect(validateArenaScenarioDraft(one).errors).toContain("primary_choice_count");

    const five = validDraft();
    five.primary.choices = [
      { id: "p1", label: "a" },
      { id: "p2", label: "b" },
      { id: "p3", label: "c" },
      { id: "p4", label: "d" },
      { id: "p5", label: "e" },
    ];
    expect(validateArenaScenarioDraft(five).errors).toContain("primary_choice_count");
  });

  it("enforces TRADEOFF and ACTION cardinality (2-3)", () => {
    const t = validDraft();
    t.tradeoff.choices = [t.tradeoff.choices[0]];
    expect(validateArenaScenarioDraft(t).errors).toContain("tradeoff_choice_count");

    const a = validDraft();
    a.actionDecision.choices = [a.actionDecision.choices[0]];
    expect(validateArenaScenarioDraft(a).errors).toContain("action_choice_count");
  });
});

describe("parseArenaScenarioDraft — untrusted coercion", () => {
  it("normalizes a valid raw value (trims strings, projects choice fields)", () => {
    const raw = validDraft({ title: "  Trim me  " });
    (raw.primary.choices[0] as { extra?: string }).extra = "dropped";
    const r = parseArenaScenarioDraft(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.title).toBe("Trim me");
      expect(r.value.primary.choices[0]).toEqual({ id: "primary_1", label: "Raise the risk directly, now" });
    }
  });

  it("returns errors for an invalid raw value", () => {
    const r = parseArenaScenarioDraft({ title: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThan(0);
  });

  it("surfaces sensitive-info warnings but still parses", () => {
    const d = validDraft({ opening: "Patient chart 123456 emailed to a.b@x.com about the shortcut." });
    const r = parseArenaScenarioDraft(d);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("detectSensitiveInfo", () => {
  it("flags email, phone, RRN, and MRN patterns", () => {
    expect(detectSensitiveInfo("reach me at jane@example.com")).toContain("sensitive_email");
    expect(detectSensitiveInfo("call 010-1234-5678")).toContain("sensitive_phone");
    expect(detectSensitiveInfo("주민 900101-1234567")).toContain("sensitive_rrn");
    expect(detectSensitiveInfo("patient id 4831900")).toContain("sensitive_mrn");
  });

  it("returns nothing for clean text", () => {
    expect(detectSensitiveInfo("A teammate proposes a shortcut.")).toEqual([]);
  });
});

describe("parseGuidedAnswers", () => {
  it("accepts a fixed option + free-text pressure", () => {
    const r = parseGuidedAnswers({
      hardestWhen: { choice: "time_limited" },
      avoidancePressure: { text: "no time" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.hardestWhen.choice).toBe("time_limited");
  });

  it("requires custom text when the option is 'other'", () => {
    const r = parseGuidedAnswers({
      hardestWhen: { choice: "other" },
      avoidancePressure: { text: "x" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("hardest_when_custom_required");
  });

  it("keeps custom text for 'other'", () => {
    const r = parseGuidedAnswers({
      hardestWhen: { choice: "other", customText: "at shift handover" },
      avoidancePressure: { text: "handover is rushed" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.hardestWhen.customText).toBe("at shift handover");
  });

  it("rejects an invalid option and a missing pressure", () => {
    expect(parseGuidedAnswers({ hardestWhen: { choice: "nope" }, avoidancePressure: { text: "y" } }).ok).toBe(false);
    expect(parseGuidedAnswers({ hardestWhen: { choice: "time_limited" }, avoidancePressure: { text: "" } }).ok).toBe(
      false,
    );
  });
});

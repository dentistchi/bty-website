import { describe, it, expect } from "vitest";
import {
  builderApprovalErrors,
  isBuilderApprovable,
  deriveEventMaterial,
  buildModuleSnapshot,
  completionPromptOrNull,
  reviewMissingSections,
  ALL_BLOCKING_CODES,
  SNAPSHOT_ANSWER_KEYS,
} from "./module-publish";
import type { BuilderAnswers } from "./module-builder";

function completeYoutube(): BuilderAnswers {
  return {
    // Slice 3.2R-R2.1 — a COMPLETE draft now has a name as well as a problem. The two are
    // deliberately different sentences here, so any test that confuses them fails.
    title: "Read Back Before Sign-Off",
    problem: "Handoffs skip the double-check.",
    audienceType: "everyone",
    recurringMoment: "at each handoff point",
    observableBehavior: "The charge nurse reads back the dosage before sign-off.",
    successEvidence: "Sign-offs include a witnessed read-back.",
    evidenceType: "seen",
    learningNeeds: ["practice"],
    materialIntent: "youtube",
    materialText: "https://youtu.be/dQw4w9WgXcQ",
    followUpDays: 7,
    completionPrompt: "What read-back will you commit to?",
  };
}

describe("builderApprovalErrors", () => {
  it("a complete YouTube draft is approvable", () => {
    expect(builderApprovalErrors(completeYoutube())).toEqual([]);
    expect(isBuilderApprovable(completeYoutube())).toBe(true);
  });

  it("an empty draft reports the first-step blocker(s)", () => {
    const errs = builderApprovalErrors({});
    expect(errs.length).toBeGreaterThan(0);
    // Slice 3.2R-R2.1 — step 1 reports its first unmet field; the problem blocker follows once
    // the training has a name.
    expect(errs).toContain("title_required");
    expect(builderApprovalErrors({ title: "A name" })).toContain("problem_required");
  });

  it("a YouTube material with no URL is blocked", () => {
    const a = { ...completeYoutube(), materialText: "" };
    expect(builderApprovalErrors(a)).toContain("material_youtube_url_required");
    expect(isBuilderApprovable(a)).toBe(false);
  });

  it("a PDF material is NOT url-blocked (asset presence is a service check)", () => {
    const a: BuilderAnswers = { ...completeYoutube(), materialIntent: "pdf", materialText: undefined };
    expect(builderApprovalErrors(a)).not.toContain("material_youtube_url_required");
    expect(builderApprovalErrors(a)).toEqual([]);
  });

  it("requires audience detail for a specific-role audience", () => {
    const a: BuilderAnswers = { ...completeYoutube(), audienceType: "specific_role", audienceDetail: "" };
    expect(builderApprovalErrors(a)).toContain("audience_detail_required");
  });
});

describe("reviewMissingSections — canonical Review readiness (Slice 2.4A.3)", () => {
  const sections = (a: BuilderAnswers, extra: string[] = []) => reviewMissingSections(a, extra).map((m) => m.section);

  it("a complete draft has zero missing sections (isComplete)", () => {
    const m = reviewMissingSections(completeYoutube());
    expect(m).toEqual([]);
  });

  it("maps each required field, missing individually, to its exact section + step", () => {
    const cases: Array<[Partial<BuilderAnswers>, string, number]> = [
      [{ problem: "   " }, "problem", 1],
      [{ audienceType: undefined }, "audience", 2],
      // Slice 3.2P-R3.6-R1 — the Host's recurring moment, and the one-step shift it caused.
      [{ recurringMoment: "  " }, "recurringMoment", 3],
      [{ observableBehavior: "  " }, "behavior", 4],
      [{ successEvidence: "\n\t" }, "evidence", 5],
      [{ learningNeeds: [] }, "learning", 6],
      [{ materialIntent: undefined, materialText: undefined }, "material", 7],
      [{ materialText: "" }, "material", 7], // youtube intent but blank URL
      [{ followUpDays: undefined }, "followUp", 8],
    ];
    for (const [override, section, step] of cases) {
      const m = reviewMissingSections({ ...completeYoutube(), ...override });
      expect(m).toContainEqual({ section, step });
    }
  });

  it("treats whitespace-only required values as empty (missing)", () => {
    expect(sections({ ...completeYoutube(), successEvidence: "   " })).toContain("evidence");
  });

  it("returns a deterministic list ordered by step for multiple missing fields", () => {
    // pdf intent set (so material is satisfied at the answers level); everything else empty.
    const m = reviewMissingSections({ materialIntent: "pdf" });
    expect(m.map((x) => x.step)).toEqual([...m.map((x) => x.step)].sort((a, b) => a - b));
    // Slice 3.2P-R3.6-R1 — "When it happens" sits between the audience and the behaviour.
    // Slice 3.2R-R2.1 — "title" leads, as its own Review row, ahead of the problem it is not.
    expect(m.map((x) => x.section)).toEqual(["title", "problem", "audience", "recurringMoment", "behavior", "evidence", "learning", "followUp"]);
  });

  it("does NOT block on an empty (optional) capability candidate", () => {
    const a = { ...completeYoutube(), capabilityCandidate: undefined };
    expect(reviewMissingSections(a)).toEqual([]);
  });

  it("counts Copilot-applied behavior + evidence exactly like manual entry", () => {
    const a: BuilderAnswers = {
      ...completeYoutube(),
      recurringMoment: "at each handoff point",
      observableBehavior: "Before ending the handoff, the nurse records the owner and next check time.",
      successEvidence: "The handoff record lists the owner and a follow-up time.",
    };
    expect(reviewMissingSections(a)).toEqual([]);
  });

  it("folds the service-only PDF-asset gate into the material section", () => {
    const a: BuilderAnswers = { ...completeYoutube(), materialIntent: "pdf", materialText: undefined };
    expect(sections(a)).not.toContain("material"); // answers alone are fine
    expect(sections(a, ["material_pdf_required"])).toEqual(["material"]); // no asset → material missing once
  });

  it("de-duplicates a section reached by multiple codes", () => {
    // material intent missing AND a pdf-required extra → still one 'material' entry
    const a: BuilderAnswers = { ...completeYoutube(), materialIntent: undefined, materialText: undefined };
    const m = sections(a, ["material_pdf_required"]);
    expect(m.filter((s) => s === "material")).toHaveLength(1);
  });

  it("INVARIANT: every blocking code the gate can emit maps to a visible section", () => {
    for (const code of ALL_BLOCKING_CODES) {
      expect(reviewMissingSections({}, [code]).length).toBeGreaterThan(0);
    }
    // and builderApprovalErrors can only emit codes covered by the map
    const emitted = new Set(builderApprovalErrors({}));
    for (const code of emitted) expect(ALL_BLOCKING_CODES).toContain(code);
  });
});

describe("deriveEventMaterial", () => {
  it("youtube → url", () => {
    expect(deriveEventMaterial(completeYoutube())).toEqual({ kind: "youtube", url: "https://youtu.be/dQw4w9WgXcQ" });
  });
  it("pdf → pdf marker", () => {
    expect(deriveEventMaterial({ materialIntent: "pdf" })).toEqual({ kind: "pdf" });
  });
  it("youtube with blank url → unsupported", () => {
    expect(deriveEventMaterial({ materialIntent: "youtube", materialText: "  " })).toEqual({
      kind: "unsupported",
      reason: "material_youtube_url_required",
    });
  });
  it("no material intent → unsupported", () => {
    expect(deriveEventMaterial({})).toEqual({ kind: "unsupported", reason: "material_intent_unsupported" });
  });
});

describe("buildModuleSnapshot", () => {
  it("freezes ONLY whitelisted design fields, dropping runtime/identity keys", () => {
    const answers = {
      ...completeYoutube(),
      // runtime / identity / private keys that must never be snapshotted:
      id: "draft-xyz",
      owner_user_id: "owner-1",
      status: "approved",
      approved_at: "t",
      document_asset_ref: "SECRET_PATH",
      unknownKey: "junk",
    } as unknown as BuilderAnswers;
    const snap = buildModuleSnapshot(answers);
    const json = JSON.stringify(snap);
    expect(json).not.toContain("SECRET_PATH");
    expect(json).not.toContain("owner_user_id");
    expect(json).not.toContain("draft-xyz");
    expect(json).not.toContain("unknownKey");
    // whitelisted design fields ARE present
    expect(snap.problem).toBe("Handoffs skip the double-check.");
    expect(snap.materialIntent).toBe("youtube");
    expect(snap.completionPrompt).toBe("What read-back will you commit to?");
  });

  it("omits undefined keys (partial answers)", () => {
    const snap = buildModuleSnapshot({ problem: "x" });
    expect(Object.keys(snap)).toEqual(["problem"]);
  });

  it("whitelist excludes every non-design key", () => {
    const forbidden = ["id", "owner_user_id", "status", "approved_at", "published_at", "module_version", "parent_module_id", "document_asset_ref"];
    for (const k of forbidden) expect(SNAPSHOT_ANSWER_KEYS).not.toContain(k);
  });
});

describe("completionPromptOrNull", () => {
  it("returns the trimmed host value", () => {
    expect(completionPromptOrNull({ completionPrompt: "  ask this  " })).toBe("ask this");
  });
  it("returns null when blank (service supplies the default)", () => {
    expect(completionPromptOrNull({ completionPrompt: "   " })).toBeNull();
    expect(completionPromptOrNull({})).toBeNull();
  });
});

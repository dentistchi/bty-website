import { describe, it, expect } from "vitest";
import {
  builderApprovalErrors,
  isBuilderApprovable,
  deriveEventMaterial,
  buildModuleSnapshot,
  completionPromptOrNull,
  SNAPSHOT_ANSWER_KEYS,
} from "./module-publish";
import type { BuilderAnswers } from "./module-builder";

function completeYoutube(): BuilderAnswers {
  return {
    problem: "Handoffs skip the double-check.",
    audienceType: "everyone",
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
    expect(errs).toContain("problem_required");
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

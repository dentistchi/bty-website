import { describe, it, expect } from "vitest";
import {
  deriveEventMaterial,
  builderApprovalErrors,
  reviewMissingSections,
  buildPublishedGuidance,
  readPublishedGuidance,
  buildModuleSnapshot,
  ALL_BLOCKING_CODES,
  PUBLISHED_GUIDANCE_KEY,
} from "./module-publish";
import { MATERIAL_INTENTS, type BuilderAnswers } from "./module-builder";
import {
  readContentType,
  isFoundryContentType,
  isGuidanceContentType,
  FOUNDRY_CONTENT_TYPES,
  CONTENT_TYPE_EVIDENCE_COLUMN,
  MATERIAL_INTENT_CONTENT_TYPE,
} from "../events/content-type";
import { projectManagerRosterStatus, projectPublicTrainingStage } from "../events/foundry-training";

/**
 * R4-R2G — LEARNING MATERIAL COMPLETENESS, domain proofs.
 *
 * Two things are being protected here, and they are different:
 *
 *   1. That written guidance and live discussion are FIRST-CLASS — derivable, approvable,
 *      reviewable, freezable, readable.
 *
 *   2. That an UNKNOWN type can never again be silently rendered as a known one. That is the
 *      failure the pre-slice measurement found in nine places, and the reason the Founder
 *      ordered the fail-closed work BEFORE the new types were allowed near production.
 */

const COMPLETE: BuilderAnswers = {
  title: "Read Back Before Sign-Off",
  problem: "Handoffs skip the double-check.",
  audienceType: "everyone",
  recurringMoment: "at each handoff point",
  observableBehavior: "The charge nurse reads back the dosage before sign-off.",
  successEvidence: "Sign-offs include a witnessed read-back.",
  evidenceType: "seen",
  learningNeeds: ["practice"],
  followUpDays: 7,
  completionPrompt: "What read-back will you commit to?",
};

describe("R4-R2G · the content-type authority fails closed", () => {
  it("knows exactly the four approved types", () => {
    expect([...FOUNDRY_CONTENT_TYPES]).toEqual(["youtube", "document", "written_guidance", "live_discussion"]);
    for (const t of FOUNDRY_CONTENT_TYPES) expect(isFoundryContentType(t)).toBe(true);
  });

  it("an UNRECOGNISED value reads as null — never as youtube", () => {
    // The exact shape of the old normalizers: anything not "document" became "youtube".
    expect(readContentType("some_future_type")).toBeNull();
    expect(readContentType("YOUTUBE")).toBeNull();
    expect(readContentType(42)).toBeNull();
    expect(readContentType({})).toBeNull();
  });

  it("an ABSENT field is the column default, which is a different fact from an unknown value", () => {
    // `content_type` is `not null default 'youtube'`; a SELECT that omits it yields undefined.
    expect(readContentType(undefined)).toBe("youtube");
    expect(readContentType(null)).toBe("youtube");
    expect(readContentType("")).toBe("youtube");
  });

  it("every content type has its own evidence column — no type borrows another's stamp", () => {
    const columns = Object.values(CONTENT_TYPE_EVIDENCE_COLUMN);
    expect(new Set(columns).size).toBe(columns.length);
    expect(CONTENT_TYPE_EVIDENCE_COLUMN.written_guidance).toBe("written_guidance_read_at");
    expect(CONTENT_TYPE_EVIDENCE_COLUMN.live_discussion).toBe("discussion_self_reported_at");
  });

  it("only the two guidance types are guidance types", () => {
    expect(isGuidanceContentType("written_guidance")).toBe(true);
    expect(isGuidanceContentType("live_discussion")).toBe(true);
    expect(isGuidanceContentType("youtube")).toBe(false);
    expect(isGuidanceContentType("document")).toBe(false);
  });

  it("an unknown room never reports the learner as watching, and never opens the video stage", () => {
    const progress = { video_started_at: "t", video_completed_at: null, completed_at: null, xp_awarded_at: null };
    expect(projectManagerRosterStatus("joined", progress, null)).toBe("joined");
    expect(
      projectPublicTrainingStage({
        participantStatus: "joined",
        eventStatus: "open",
        progress,
        hasParticipant: true,
        contentType: null,
      }),
    ).toBe("inactive");
  });

  it("each known type gets its OWN pre-completion stage", () => {
    const stage = (contentType: "youtube" | "document" | "written_guidance" | "live_discussion") =>
      projectPublicTrainingStage({
        participantStatus: "joined",
        eventStatus: "open",
        progress: { video_started_at: null, video_completed_at: null, completed_at: null, xp_awarded_at: null },
        hasParticipant: true,
        contentType,
      });
    expect(stage("youtube")).toBe("watch");
    expect(stage("document")).toBe("read");
    expect(stage("written_guidance")).toBe("declare");
    expect(stage("live_discussion")).toBe("declare");
  });
});

describe("R4-R2G · every material intent publishes to exactly one content type", () => {
  it("the intent → content type map covers the whole union", () => {
    for (const intent of MATERIAL_INTENTS) {
      expect(MATERIAL_INTENT_CONTENT_TYPE[intent]).toBeDefined();
      expect(isFoundryContentType(MATERIAL_INTENT_CONTENT_TYPE[intent])).toBe(true);
    }
    expect(new Set(Object.values(MATERIAL_INTENT_CONTENT_TYPE)).size).toBe(MATERIAL_INTENTS.length);
  });
});

describe("R4-R2G · deriveEventMaterial handles all four (F11, F12, F6, F1)", () => {
  it("F11 — YouTube still derives its URL", () => {
    expect(deriveEventMaterial({ ...COMPLETE, materialIntent: "youtube", materialText: "https://youtu.be/x" })).toEqual({
      kind: "youtube",
      url: "https://youtu.be/x",
    });
  });

  it("F12 — PDF still derives unchanged", () => {
    expect(deriveEventMaterial({ ...COMPLETE, materialIntent: "pdf" })).toEqual({ kind: "pdf" });
  });

  it("F1/F6 — written guidance and live discussion derive as guidance, carrying their own content type", () => {
    expect(deriveEventMaterial({ ...COMPLETE, materialIntent: "written", materialText: "  Ask before you assume.  " })).toEqual({
      kind: "guidance",
      contentType: "written_guidance",
      text: "Ask before you assume.",
    });
    expect(deriveEventMaterial({ ...COMPLETE, materialIntent: "live_discussion", materialText: "Where did we skip the check?" })).toEqual({
      kind: "guidance",
      contentType: "live_discussion",
      text: "Where did we skip the check?",
    });
  });

  it("an EMPTY guidance refuses with its own reason — never the YouTube one", () => {
    expect(deriveEventMaterial({ ...COMPLETE, materialIntent: "written", materialText: "   " })).toEqual({
      kind: "unsupported",
      reason: "material_written_guidance_required",
    });
    expect(deriveEventMaterial({ ...COMPLETE, materialIntent: "live_discussion" })).toEqual({
      kind: "unsupported",
      reason: "material_live_discussion_required",
    });
  });

  it("no intent at all is still unsupported", () => {
    expect(deriveEventMaterial(COMPLETE)).toEqual({ kind: "unsupported", reason: "material_intent_unsupported" });
  });
});

describe("R4-R2G · the Review gate can no longer say 'ready' while publish refuses", () => {
  /*
    THE PRE-SLICE DEFECT, PINNED. With a third intent selected, `builderApprovalErrors` emitted
    nothing, so Review reported the draft approvable — and `deriveEventMaterial` then refused it
    with a code that mapped to no Review section and no publish sentence. This is that exact
    scenario, and it now blocks visibly instead.
  */
  it("an empty written guidance blocks approval AND highlights the material section", () => {
    const a: BuilderAnswers = { ...COMPLETE, materialIntent: "written", materialText: "" };
    expect(builderApprovalErrors(a)).toContain("material_written_guidance_required");
    expect(reviewMissingSections(a)).toContainEqual({ section: "material", step: 7 });
  });

  it("an empty live discussion blocks approval AND highlights the material section", () => {
    const a: BuilderAnswers = { ...COMPLETE, materialIntent: "live_discussion" };
    expect(builderApprovalErrors(a)).toContain("material_live_discussion_required");
    expect(reviewMissingSections(a)).toContainEqual({ section: "material", step: 7 });
  });

  it("a filled guidance is approvable and nothing is missing", () => {
    for (const intent of ["written", "live_discussion"] as const) {
      const a: BuilderAnswers = { ...COMPLETE, materialIntent: intent, materialText: "Say the number back." };
      expect(builderApprovalErrors(a)).toEqual([]);
      expect(reviewMissingSections(a)).toEqual([]);
    }
  });

  it("EVERY blocking code the gates can emit maps to a Review section — the totality invariant", () => {
    for (const code of ALL_BLOCKING_CODES) {
      expect(reviewMissingSections({}, [code]).length + reviewMissingSections(COMPLETE, [code]).length).toBeGreaterThan(0);
    }
    expect(ALL_BLOCKING_CODES).toContain("material_written_guidance_required");
    expect(ALL_BLOCKING_CODES).toContain("material_live_discussion_required");
  });
});

describe("R4-R2G · the frozen guidance contract (F5, F10, F15)", () => {
  it("freezes the resolved content, trimmed, with an optional shared question", () => {
    expect(
      buildPublishedGuidance({
        contentType: "written_guidance",
        materialText: "  Ask before you assume.  ",
        completionPrompt: "  What will you ask?  ",
        sharedQuestion: "   ",
      }),
    ).toEqual({
      version: 1,
      contentType: "written_guidance",
      materialText: "Ask before you assume.",
      completionPrompt: "What will you ask?",
      sharedQuestion: null,
    });
  });

  it("refuses to freeze content that would leave the learner with an empty room", () => {
    expect(
      buildPublishedGuidance({ contentType: "written_guidance", materialText: "", completionPrompt: "p", sharedQuestion: null }),
    ).toBeNull();
    expect(
      buildPublishedGuidance({ contentType: "live_discussion", materialText: "topic", completionPrompt: "  ", sharedQuestion: null }),
    ).toBeNull();
  });

  it("reads back what it froze, from the snapshot shape the publish actually writes", () => {
    const frozen = buildPublishedGuidance({
      contentType: "live_discussion",
      materialText: "Where did we skip the check?",
      completionPrompt: "What will you raise?",
      sharedQuestion: "What did your team agree?",
    })!;
    const snapshot = { ...buildModuleSnapshot(COMPLETE), [PUBLISHED_GUIDANCE_KEY]: frozen };
    expect(readPublishedGuidance(snapshot)).toEqual(frozen);
  });

  it("FAILS CLOSED on a snapshot it cannot trust — never a half-rendered training", () => {
    expect(readPublishedGuidance(null)).toBeNull();
    expect(readPublishedGuidance({})).toBeNull();
    expect(readPublishedGuidance({ [PUBLISHED_GUIDANCE_KEY]: { version: 2, contentType: "written_guidance", materialText: "a", completionPrompt: "b" } })).toBeNull();
    expect(readPublishedGuidance({ [PUBLISHED_GUIDANCE_KEY]: { version: 1, contentType: "youtube", materialText: "a", completionPrompt: "b" } })).toBeNull();
    expect(readPublishedGuidance({ [PUBLISHED_GUIDANCE_KEY]: { version: 1, contentType: "written_guidance", materialText: "", completionPrompt: "b" } })).toBeNull();
  });

  it("a YouTube or PDF snapshot is byte-identical to what it was before this slice", () => {
    const yt = buildModuleSnapshot({ ...COMPLETE, materialIntent: "youtube", materialText: "https://youtu.be/x" });
    expect(PUBLISHED_GUIDANCE_KEY in (yt as Record<string, unknown>)).toBe(false);
  });
});

describe("R4-R2G · F13 — switching material type leaks no stale incompatible field", () => {
  /*
    The DOMAIN half of F13 (the Builder half is proven in the component suite): whatever text
    survives a switch, the derivation for the NEW type is computed from that text alone and can
    never reach back for another type's value. A URL left in `materialText` would publish as the
    guidance a team reads, so the Builder clears it — and this pins that nothing downstream
    re-derives the old meaning.
  */
  it("derivation reads only the current intent's own text", () => {
    const switched: BuilderAnswers = { ...COMPLETE, materialIntent: "written", materialText: "" };
    expect(deriveEventMaterial(switched)).toEqual({ kind: "unsupported", reason: "material_written_guidance_required" });

    const pdfAfterYoutube: BuilderAnswers = { ...COMPLETE, materialIntent: "pdf", materialText: "https://youtu.be/x" };
    // PDF's derivation never consults materialText, so a leftover URL cannot become its material.
    expect(deriveEventMaterial(pdfAfterYoutube)).toEqual({ kind: "pdf" });
  });
});

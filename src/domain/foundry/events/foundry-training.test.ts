import { describe, it, expect } from "vitest";
import {
  validateCompletionPrompt,
  validateResponse,
  projectManagerRosterStatus,
  projectPublicTrainingStage,
  canSubmitResponse,
  FOUNDRY_COMPLETION_PROMPT_MAX,
  FOUNDRY_RESPONSE_MAX,
  type TrainingProgressMarkers,
} from "./foundry-training";

const M = (o: Partial<TrainingProgressMarkers>): TrainingProgressMarkers => ({
  video_started_at: null,
  video_completed_at: null,
  completed_at: null,
  xp_awarded_at: null,
  ...o,
});

describe("validateCompletionPrompt", () => {
  it("accepts and trims", () => {
    expect(validateCompletionPrompt("  What will you do?  ")).toEqual({ ok: true, value: "What will you do?" });
  });
  it("rejects empty", () => {
    expect(validateCompletionPrompt("")).toEqual({ ok: false, reason: "prompt_required" });
    expect(validateCompletionPrompt("   ")).toEqual({ ok: false, reason: "prompt_required" });
  });
  it("enforces max 300", () => {
    expect(validateCompletionPrompt("a".repeat(FOUNDRY_COMPLETION_PROMPT_MAX + 1))).toEqual({
      ok: false,
      reason: "prompt_too_long",
    });
  });
});

describe("validateResponse", () => {
  it("accepts and keeps newlines", () => {
    const r = validateResponse("Line one\nLine two");
    expect(r).toEqual({ ok: true, value: "Line one\nLine two" });
  });
  it("rejects empty / whitespace", () => {
    expect(validateResponse("   ")).toEqual({ ok: false, reason: "response_required" });
  });
  it("enforces max 1000", () => {
    expect(validateResponse("x".repeat(FOUNDRY_RESPONSE_MAX + 1))).toEqual({
      ok: false,
      reason: "response_too_long",
    });
  });
  it("strips non-newline control chars", () => {
    const withControl = "Ok" + String.fromCharCode(0x00) + "!";
    expect(validateResponse(withControl)).toEqual({ ok: true, value: "Ok!" });
  });
});

describe("projectManagerRosterStatus", () => {
  it("removed wins", () => {
    expect(projectManagerRosterStatus("removed", M({ completed_at: "t" }))).toBe("removed");
  });
  it("complete > response_pending > watching > joined", () => {
    expect(projectManagerRosterStatus("joined", M({ completed_at: "t", video_completed_at: "t" }))).toBe("complete");
    expect(projectManagerRosterStatus("joined", M({ video_completed_at: "t" }))).toBe("response_pending");
    expect(projectManagerRosterStatus("joined", M({ video_started_at: "t" }))).toBe("watching");
    expect(projectManagerRosterStatus("joined", null)).toBe("joined");
  });
});

describe("projectPublicTrainingStage", () => {
  const base = { eventStatus: "open" as const, hasParticipant: true, participantStatus: "joined" as const };

  it("pre_join when no participant + open", () => {
    expect(
      projectPublicTrainingStage({ ...base, hasParticipant: false, participantStatus: null, progress: null }),
    ).toBe("pre_join");
  });
  it("closed when no participant + closed", () => {
    expect(
      projectPublicTrainingStage({
        eventStatus: "closed",
        hasParticipant: false,
        participantStatus: null,
        progress: null,
      }),
    ).toBe("closed");
  });
  it("watch → response as the video completes", () => {
    expect(projectPublicTrainingStage({ ...base, progress: null })).toBe("watch");
    expect(projectPublicTrainingStage({ ...base, progress: M({ video_completed_at: "t" }) })).toBe("response");
  });
  it("completed_claimable vs completed_awarded", () => {
    expect(projectPublicTrainingStage({ ...base, progress: M({ completed_at: "t" }) })).toBe("completed_claimable");
    expect(
      projectPublicTrainingStage({ ...base, progress: M({ completed_at: "t", xp_awarded_at: "t" }) }),
    ).toBe("completed_awarded");
  });
  it("completed result survives event close", () => {
    expect(
      projectPublicTrainingStage({
        ...base,
        eventStatus: "closed",
        progress: M({ completed_at: "t", xp_awarded_at: "t" }),
      }),
    ).toBe("completed_awarded");
  });
  it("closed_incomplete when joined, not complete, event closed", () => {
    expect(
      projectPublicTrainingStage({ ...base, eventStatus: "closed", progress: M({ video_completed_at: "t" }) }),
    ).toBe("closed_incomplete");
  });
  it("removed wins", () => {
    expect(
      projectPublicTrainingStage({ ...base, participantStatus: "removed", progress: M({ completed_at: "t" }) }),
    ).toBe("removed");
  });
});

describe("canSubmitResponse", () => {
  it("only after video complete and before completion", () => {
    expect(canSubmitResponse(null)).toBe(false);
    expect(canSubmitResponse(M({}))).toBe(false);
    expect(canSubmitResponse(M({ video_completed_at: "t" }))).toBe(true);
    expect(canSubmitResponse(M({ video_completed_at: "t", completed_at: "t" }))).toBe(false);
  });
});

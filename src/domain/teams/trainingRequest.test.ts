/**
 * The rules that decide when a Teams deep-link occurrence opens a training.
 * Slice Teams iOS Deep-Link Resume.
 */
import { describe, it, expect } from "vitest";
import { readTrainingRequest, shouldOpenTrainingRequest, type TrainingRequest } from "./trainingRequest";

const TOKEN = "btyfr1.eyJ0eXBlIjoiZm91bmRyeV9yb29tIn0.c2lnbmF0dXJlLXZhbHVl";
const TOKEN_B = "btyfr1.eyJiIjoxfQ.c2Vjb25kLXNpZ25hdHVyZQ";
const req = (joinToken: string, requestKey: string): TrainingRequest => ({ target: { joinToken }, requestKey });

describe("an observation becomes a request only for the one approved grammar", () => {
  it("parses a valid target and stamps it with its occurrence", () => {
    expect(readTrainingRequest(`foundry-training:${TOKEN}`, "bootstrap", 0)).toEqual({
      target: { joinToken: TOKEN },
      requestKey: "bootstrap:0",
    });
    expect(readTrainingRequest(`foundry-training:${TOKEN}`, "refresh", 7)).toEqual({
      target: { joinToken: TOKEN },
      requestKey: "refresh:7",
    });
  });

  it("the SAME target observed twice yields two DISTINCT occurrences", () => {
    const first = readTrainingRequest(`foundry-training:${TOKEN}`, "refresh", 1)!;
    const second = readTrainingRequest(`foundry-training:${TOKEN}`, "refresh", 2)!;
    expect(first.target).toEqual(second.target);
    expect(first.requestKey).not.toBe(second.requestKey);
  });

  it("anything outside the grammar is no request at all", () => {
    for (const bad of [
      undefined, null, "", "   ", "/en/app", "conversations", "btyHome",
      "foundry-training:", "foundry-training:../../admin", "foundry-training:not-a-token",
      "https://evil.example/f/btyfr1.a.b", { subEntityId: `foundry-training:${TOKEN}` }, 42,
    ]) {
      expect(readTrainingRequest(bad, "refresh", 1), String(bad)).toBeNull();
    }
  });
});

describe("when an occurrence opens the room", () => {
  it("a fresh request with nothing open opens it", () => {
    expect(shouldOpenTrainingRequest({ request: req(TOKEN, "refresh:1"), handledKey: null, openJoinToken: null })).toBe(true);
  });

  it("an occurrence already handled is inert — re-renders cost nothing", () => {
    expect(
      shouldOpenTrainingRequest({ request: req(TOKEN, "refresh:1"), handledKey: "refresh:1", openJoinToken: null }),
    ).toBe(false);
  });

  it("★ the training ALREADY OPEN is not reopened — a mid-quiz refocus must not remount it", () => {
    expect(
      shouldOpenTrainingRequest({ request: req(TOKEN, "refresh:2"), handledKey: "refresh:1", openJoinToken: TOKEN }),
    ).toBe(false);
  });

  it("★ the SAME training AFTER it was closed does reopen — tapping the invitation again works", () => {
    expect(
      shouldOpenTrainingRequest({ request: req(TOKEN, "refresh:2"), handledKey: "refresh:1", openJoinToken: null }),
    ).toBe(true);
  });

  it("a DIFFERENT training replaces the open one", () => {
    expect(
      shouldOpenTrainingRequest({ request: req(TOKEN_B, "refresh:2"), handledKey: "refresh:1", openJoinToken: TOKEN }),
    ).toBe(true);
  });

  it("no request never opens anything", () => {
    expect(shouldOpenTrainingRequest({ request: null, handledKey: null, openJoinToken: null })).toBe(false);
    expect(shouldOpenTrainingRequest({ request: null, handledKey: "refresh:1", openJoinToken: TOKEN })).toBe(false);
  });

  it("de-duplication is by OCCURRENCE, never by target — the whole point of the key", () => {
    // Same target, new occurrence, nothing open → opens. A target-only rule would refuse this.
    const opens = shouldOpenTrainingRequest({ request: req(TOKEN, "refresh:9"), handledKey: "bootstrap:0", openJoinToken: null });
    expect(opens).toBe(true);
  });
});

/**
 * The rules that decide when a Teams deep-link occurrence opens a training.
 * Slice Teams iOS Deep-Link Resume.
 */
import { describe, it, expect } from "vitest";
import { readTrainingRequest, shouldOpenTrainingRequest, type TrainingRequest } from "./trainingRequest";

const TOKEN = "btyfr1.eyJ0eXBlIjoiZm91bmRyeV9yb29tIn0.c2lnbmF0dXJlLXZhbHVl";
const TOKEN_B = "btyfr1.eyJiIjoxfQ.c2Vjb25kLXNpZ25hdHVyZQ";
const req = (joinToken: string, requestKey: string): TrainingRequest =>
  ({ target: { joinToken }, requestKey, transport: "context" });

describe("an observation becomes a request only for the one approved grammar", () => {
  it("parses a valid target and stamps it with its occurrence", () => {
    expect(readTrainingRequest({ subPageId: `foundry-training:${TOKEN}` }, "bootstrap", 0)).toEqual({
      target: { joinToken: TOKEN },
      requestKey: "bootstrap:0",
      transport: "context",
    });
    expect(readTrainingRequest({ subPageId: `foundry-training:${TOKEN}` }, "refresh", 7)).toEqual({
      target: { joinToken: TOKEN },
      requestKey: "refresh:7",
      transport: "context",
    });
  });

  it("the SAME target observed twice yields two DISTINCT occurrences", () => {
    const first = readTrainingRequest({ subPageId: `foundry-training:${TOKEN}` }, "refresh", 1)!;
    const second = readTrainingRequest({ subPageId: `foundry-training:${TOKEN}` }, "refresh", 2)!;
    expect(first.target).toEqual(second.target);
    expect(first.requestKey).not.toBe(second.requestKey);
  });

  it("anything outside the grammar is no request at all", () => {
    for (const bad of [
      undefined, null, "", "   ", "/en/app", "conversations", "btyHome",
      "foundry-training:", "foundry-training:../../admin", "foundry-training:not-a-token",
      "https://evil.example/f/btyfr1.a.b", { subEntityId: `foundry-training:${TOKEN}` }, 42,
    ]) {
      expect(readTrainingRequest({ subPageId: bad }, "refresh", 1), String(bad)).toBeNull();
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

/*
  THE SECOND TRANSPORT (Slice Teams iOS webUrl Fallback). Teams iOS delivered no `subPageId` at
  all, so the same signed target now also rides `/teams?training=`. One grammar, one gate, two ways
  in — and a deterministic precedence so a client that supplies both cannot vary the outcome.
*/
describe("context and query are two transports for one capability", () => {
  const TARGET = `foundry-training:${TOKEN}`;
  const TARGET_B = `foundry-training:${TOKEN_B}`;

  it("reads the query when the context has nothing — the measured iOS case", () => {
    expect(readTrainingRequest({ search: `?training=${encodeURIComponent(TARGET)}` }, "bootstrap", 0)).toEqual({
      target: { joinToken: TOKEN },
      requestKey: "bootstrap:0",
      transport: "query",
    });
    expect(
      readTrainingRequest({ subPageId: undefined, search: `?training=${encodeURIComponent(TARGET)}` }, "refresh", 3),
    ).toMatchObject({ target: { joinToken: TOKEN }, transport: "query" });
  });

  it("CONTEXT WINS when both are present", () => {
    const req = readTrainingRequest(
      { subPageId: TARGET, search: `?training=${encodeURIComponent(TARGET_B)}` },
      "bootstrap",
      0,
    );
    expect(req).toMatchObject({ target: { joinToken: TOKEN }, transport: "context" });
  });

  it("falls through to the query when the CONTEXT value is malformed", () => {
    const req = readTrainingRequest(
      { subPageId: "conversations", search: `?training=${encodeURIComponent(TARGET)}` },
      "refresh",
      1,
    );
    expect(req).toMatchObject({ target: { joinToken: TOKEN }, transport: "query" });
  });

  it("both malformed is no request at all", () => {
    expect(readTrainingRequest({ subPageId: "/en/app", search: "?training=/en/app" }, "refresh", 1)).toBeNull();
    expect(readTrainingRequest({}, "refresh", 1)).toBeNull();
    expect(readTrainingRequest({ subPageId: null, search: null }, "refresh", 1)).toBeNull();
  });

  it("the query transport still yields the same occurrence semantics", () => {
    const first = readTrainingRequest({ search: `?training=${encodeURIComponent(TARGET)}` }, "refresh", 1)!;
    const second = readTrainingRequest({ search: `?training=${encodeURIComponent(TARGET)}` }, "refresh", 2)!;
    expect(first.requestKey).not.toBe(second.requestKey);
    expect(shouldOpenTrainingRequest({ request: second, handledKey: first.requestKey, openJoinToken: null })).toBe(true);
    // ...and the already-open guard applies regardless of which transport delivered it.
    expect(shouldOpenTrainingRequest({ request: second, handledKey: first.requestKey, openJoinToken: TOKEN })).toBe(false);
  });
});

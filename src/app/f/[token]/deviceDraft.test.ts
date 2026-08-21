/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  readDraft, writeDraft, clearDraft, draftKey, isEmpty,
  DRAFT_TTL_MS, DRAFT_VERSION, type DraftFields,
} from "./useDeviceDraft";
import { participantDraftNamespace } from "@/lib/bty/foundry/events/participant-draft-namespace";

/**
 * R4-R5C4A — the storage primitive and the isolation it is responsible for.
 *
 * The hook tests live alongside; this file pins the parts that must hold no matter which room
 * family is calling: what a namespace guarantees, and what a draft refuses to become.
 */

const F = (over: Partial<DraftFields> = {}): DraftFields => ({
  response: "what I will say to Minjun",
  sharedResponse: "",
  decisionResponse: "",
  reflectResponse: "",
  ...over,
});

const EV_A = "11111111-1111-4111-8111-111111111111";
const EV_B = "22222222-2222-4222-8222-222222222222";
const P_A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const P_B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";

const NS_A = participantDraftNamespace(EV_A, P_A);

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("the opaque namespace (Step 0)", () => {
  it("is stable for the same participant, across any number of derivations", () => {
    expect(participantDraftNamespace(EV_A, P_A)).toBe(NS_A);
    expect(participantDraftNamespace(EV_A, P_A)).toBe(NS_A);
  });

  it("T3 — a DIFFERENT participant on the SAME event gets a different namespace", () => {
    expect(participantDraftNamespace(EV_A, P_B)).not.toBe(NS_A);
  });

  it("T6 — the SAME participant id under a different event cannot collide", () => {
    expect(participantDraftNamespace(EV_B, P_A)).not.toBe(NS_A);
  });

  it("reveals neither the participant id nor the event id", () => {
    expect(NS_A).not.toContain(P_A);
    expect(NS_A).not.toContain(EV_A);
    expect(NS_A).not.toContain(P_A.slice(0, 8));
    // Opaque, fixed-width, URL/keysafe.
    expect(NS_A).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });
});

describe("read/write contract", () => {
  it("T1/T2 — a written draft is readable back, verbatim", () => {
    expect(writeDraft(NS_A, F({ sharedResponse: "we agreed on the handoff" }))).toBe(true);
    const got = readDraft(NS_A);
    expect(got?.response).toBe("what I will say to Minjun");
    expect(got?.sharedResponse).toBe("we agreed on the handoff");
  });

  it("T3/T4/T6 — a draft is unreachable from any other namespace, by construction", () => {
    writeDraft(NS_A, F());
    expect(readDraft(participantDraftNamespace(EV_A, P_B))).toBeNull(); // other participant
    expect(readDraft(participantDraftNamespace(EV_B, P_A))).toBeNull(); // other event
  });

  it("T7 — a draft older than the participant cookie's 30 days is ignored AND removed", () => {
    const now = Date.now();
    writeDraft(NS_A, F(), now - DRAFT_TTL_MS - 1);
    expect(readDraft(NS_A, now)).toBeNull();
    expect(window.localStorage.getItem(draftKey(NS_A))).toBeNull();
  });

  it("T7b — a draft one millisecond INSIDE the window still restores", () => {
    const now = Date.now();
    writeDraft(NS_A, F(), now - DRAFT_TTL_MS + 1);
    expect(readDraft(NS_A, now)?.response).toBe("what I will say to Minjun");
  });

  it("T8 — a version mismatch is discarded, not shown as the learner's words", () => {
    window.localStorage.setItem(
      draftKey(NS_A),
      JSON.stringify({ version: DRAFT_VERSION + 1, savedAt: Date.now(), response: "from the future" }),
    );
    expect(readDraft(NS_A)).toBeNull();
    expect(window.localStorage.getItem(draftKey(NS_A))).toBeNull();
  });

  it("T8b — malformed JSON never throws and never survives", () => {
    window.localStorage.setItem(draftKey(NS_A), "{not json");
    expect(() => readDraft(NS_A)).not.toThrow();
    expect(readDraft(NS_A)).toBeNull();
  });

  it("T8c — a well-formed entry with a non-string field degrades to empty, not to garbage", () => {
    window.localStorage.setItem(
      draftKey(NS_A),
      JSON.stringify({ version: DRAFT_VERSION, savedAt: Date.now(), response: 42, sharedResponse: "kept" }),
    );
    const got = readDraft(NS_A);
    expect(got?.response).toBe("");
    expect(got?.sharedResponse).toBe("kept");
  });

  it("T11 — clearing every field REMOVES the entry rather than storing an empty husk", () => {
    writeDraft(NS_A, F());
    expect(window.localStorage.getItem(draftKey(NS_A))).not.toBeNull();
    expect(writeDraft(NS_A, { response: "", sharedResponse: "", decisionResponse: "", reflectResponse: "" })).toBe(false);
    expect(window.localStorage.getItem(draftKey(NS_A))).toBeNull();
    expect(readDraft(NS_A)).toBeNull();
  });

  it("T11b — deleting SOME text is persisted as the new truth", () => {
    writeDraft(NS_A, F({ sharedResponse: "first thought" }));
    writeDraft(NS_A, F({ sharedResponse: "" }));
    expect(readDraft(NS_A)?.sharedResponse).toBe("");
  });

  it("an all-empty stored entry never restores", () => {
    window.localStorage.setItem(
      draftKey(NS_A),
      JSON.stringify({ version: DRAFT_VERSION, savedAt: Date.now(), response: "", sharedResponse: "", decisionResponse: "", reflectResponse: "" }),
    );
    expect(readDraft(NS_A)).toBeNull();
    expect(isEmpty({ response: "", sharedResponse: "", decisionResponse: "", reflectResponse: "" })).toBe(true);
  });

  it("clearDraft removes it", () => {
    writeDraft(NS_A, F());
    clearDraft(NS_A);
    expect(readDraft(NS_A)).toBeNull();
  });
});

describe("T9 — storage that refuses must never break a training", () => {
  it("setItem throwing (private mode / quota) reports NOT SAVED and does not throw", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(() => writeDraft(NS_A, F())).not.toThrow();
    expect(writeDraft(NS_A, F())).toBe(false); // <- the saved signal can never be shown
  });

  it("getItem throwing yields no draft rather than an error", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    expect(() => readDraft(NS_A)).not.toThrow();
    expect(readDraft(NS_A)).toBeNull();
  });

  it("removeItem throwing during cleanup is swallowed", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    expect(() => clearDraft(NS_A)).not.toThrow();
  });
});

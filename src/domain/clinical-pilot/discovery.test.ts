import { describe, expect, it } from "vitest";
import { applyDiscoveryAction, discoveryTurns, initialAssessment, latestAssessment, startDiscoveryPilot, type DiscoveryReply } from "./discovery";
import { applyPilotAction, PILOT_SCHEMA, releasedReference, type PilotCase, type PilotReference } from "./pilot";

const c: PilotCase = { caseId: "fixture", number: 1, version: "source-1", title: "Patient encounter 001", scenario: "A tooth bothers me.", findings: [], question: "Meet your patient.", available: true };
const ref: PilotReference = { author: "Dr. Chi", referenceId: "fixture@1", sourceSections: [], version: "1", original: "Recorded original", paraphrase: "Recorded perspective", reviewStatus: "author-paraphrase-awaiting-review", limitations: [], evidenceNotes: [], label: "Recorded author perspective · clinical validation pending" };
const start = () => startDiscoveryPilot("attempt", c, "hash", "start", "2026-10-23T10:00:00Z", false, "pack-1");
const reply: DiscoveryReply = { channel: "patient", text: "Brief cold sensitivity.", factIds: ["cold"], availableFactIds: ["cold"], unavailableFactIds: [], resolution: "answered", routing: { method: "authored-rules", version: "1" } };
describe("question-led clinical evidence capture", () => {
  it("retains the protected storage envelope and identifies a different interaction mode", () => {
    const t = start();
    expect(t.schemaVersion).toBe(PILOT_SCHEMA);
    expect(t.discovery).toMatchObject({ interactionVersion: "clinical-discovery/v1", packVersion: "pack-1" });
    expect(t.caseSnapshot.findings).toEqual([]);
    expect(t.events[0].payload.mode).toBe("discovery");
    expect(releasedReference(t)).toBeNull();
  });
  it("preserves literal questions and the exact evidence available before each decision", () => {
    const before = applyDiscoveryAction(start(), { operation: "decision", text: "  Cause uncertain.  " }, "d1", "2026-10-23T10:00:05Z", ref);
    expect(before.events.at(-1)!.payload.informationAvailable).toEqual([]);
    const asked = applyDiscoveryAction(before, { operation: "message", text: "  Does cold bother you?  ", channel: "patient" }, "q1", "2026-10-23T10:00:10Z", ref, reply);
    expect(discoveryTurns(asked)[0].question).toBe("  Does cold bother you?  ");
    expect(asked.events.at(-1)!.payload.informationBefore).toEqual([]);
    const after = applyDiscoveryAction(asked, { operation: "decision", text: "Consider cold response." }, "d2", "2026-10-23T10:00:20Z", ref);
    expect(after.events.at(-1)!.payload.informationAvailable).toEqual(["cold"]);
    expect(after.events.slice(0, before.events.length)).toEqual(before.events);
    expect(after.phase).toBe("draft");
    expect(latestAssessment(after)).toBe("Consider cold response.");
    expect(releasedReference(after)).toBeNull();
  });
  it("logs unavailable requests without turning them into obtained negative findings", () => {
    const unavailable: DiscoveryReply = { ...reply, channel: "exam", text: "No result available.", factIds: ["probing"], availableFactIds: [], unavailableFactIds: ["probing"], resolution: "unavailable" };
    const asked = applyDiscoveryAction(start(), { operation: "message", text: "Probe around this tooth", channel: "exam" }, "q1", "2026-10-23T10:00:10Z", ref, unavailable);
    const final = applyDiscoveryAction(asked, { operation: "conclude", text: "Need further assessment." }, "finish", "2026-10-23T10:00:20Z", ref);
    expect(final.events.find(e => e.type === "assessment_submitted")!.payload).toMatchObject({ informationAvailable: [], turnCount: 1 });
    expect(discoveryTurns(final)[0].reply.unavailableFactIds).toEqual(["probing"]);
  });
  it("lets the doctor decide when to stop, freezes that decision, and keeps reactions separate", () => {
    const t = applyDiscoveryAction(start(), { operation: "conclude", text: "I need an examination before deciding." }, "finish", "2026-10-23T10:00:20Z", ref);
    expect(initialAssessment(t)).toBe("I need an examination before deciding.");
    expect(t.events.map(e => e.type)).toEqual(["case_presented", "assessment_submitted", "reference_released"]);
    expect(t.events[1].payload.turnCount).toBe(0);
    expect(() => applyDiscoveryAction(t, { operation: "message", text: "New question", channel: "patient" }, "later", "later", ref, reply)).toThrow("IMMUTABLE");
    expect(applyDiscoveryAction(t, { operation: "conclude", text: "Replace it" }, "finish", "later", ref)).toBe(t);
    const done = applyPilotAction(t, { operation: "react", reaction: { helpful: "partly", comment: "Different priorities", revisedPlan: "Further examination" } }, "react", "2026-10-23T10:00:30Z", ref);
    expect(done.phase).toBe("completed");
    expect(done.events.slice(0, t.events.length)).toEqual(t.events);
    expect(initialAssessment(done)).toBe(initialAssessment(t));
  });
  it("still permits a final assessment when the turn limit has been reached", () => {
    let t = start();
    for (let i = 0; i < 299; i++) t = applyDiscoveryAction(t, { operation: "message", text: "Ask again", channel: "patient" }, `q-${i}`, "2026-10-23T10:00:10Z", ref, reply);
    expect(() => applyDiscoveryAction(t, { operation: "message", text: "Another question", channel: "patient" }, "extra", "2026-10-23T10:00:20Z", ref, reply)).toThrow("ENCOUNTER_LIMIT");
    expect(applyDiscoveryAction(t, { operation: "conclude", text: "I have enough information to document a plan." }, "finish", "2026-10-23T10:00:30Z", ref).phase).toBe("submitted");
  });
});

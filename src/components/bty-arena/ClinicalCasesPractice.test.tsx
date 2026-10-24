/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ClinicalCasesPractice } from "./ClinicalCasesPractice";
import {
  applyPilotAction, blankAnswers, publicCase, referenceFor, startPilot,
  type AuthorCase, type PilotCase, type PilotTrace,
} from "@/domain/clinical-pilot/pilot";
import { applyDiscoveryAction, discoveryTurns, initialAssessment, startDiscoveryPilot, type DiscoveryReply } from "@/domain/clinical-pilot/discovery";
import catalog from "@/domain/clinical-pilot/catalog.json";

// The API fixture owns private facts. The component receives only a neutral card,
// opening concern and the answers actually issued in response to its requests.
const source = catalog[0] as AuthorCase;
const opening = "One of my lower back teeth hurts sometimes.";
const foodAnswer = "It is a sharp pain when I eat hard food.";
const restorationAnswer = "A large MOD restoration is present on the mandibular molar.";
const c: PilotCase = { caseId: source.caseId, number: source.number, version: source.version,
  title: "Patient encounter 001", scenario: opening, findings: [], question: "Meet the patient and decide what to ask or examine.", available: true };
type Row = { owner: string; trace: PilotTrace };
let rows: Row[];
let user: string;
let failMessage: boolean;
let loseMessageAcknowledgement: boolean;
let conflictMessage: boolean;
let rejectMessage: boolean;
const calls: Record<string, any>[] = [];
const current = () => rows.find(row => row.owner === user)!.trace;
const field = () => screen.getByLabelText("Your question or examination request") as HTMLTextAreaElement;
function reply(body: Record<string, any>): DiscoveryReply {
  const known = body.channel === "patient" && /hard|hurt|chew/i.test(body.text)
    ? { text: foodAnswer, factIds: ["symptom-trigger"] }
    : body.channel === "exam" && /restoration|visual/i.test(body.text)
      ? { text: restorationAnswer, factIds: ["restoration"] }
      : null;
  return { channel: body.channel, text: known?.text ?? "That information is not available in this encounter.",
    factIds: known?.factIds ?? [], availableFactIds: known?.factIds ?? [], unavailableFactIds: [],
    resolution: known ? "answered" : "unavailable", routing: { method: "authored-rules", version: "fixture-v1" } };
}
beforeEach(() => {
  rows = []; user = "owner"; calls.length = 0; failMessage = false; loseMessageAcknowledgement = false;
  conflictMessage = false; rejectMessage = false; localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (!init?.body) return Response.json(String(url).includes("caseId=")
      ? { ok: true, traces: rows.filter(row => row.owner === user).map(row => ({ raw_trace: row.trace })) }
      : { ok: true, cases: [c], userId: user, isAdmin: false });
    const body = JSON.parse(init.body as string); calls.push(body);
    if (body.operation === "message" && failMessage) return Response.json({ ok: false, error: "UNAVAILABLE" }, { status: 503 });
    if (body.operation === "message" && conflictMessage) return Response.json({ ok: false, error: "CONFLICT" }, { status: 409 });
    if (body.operation === "message" && rejectMessage) return Response.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
    const at = new Date(Date.UTC(2026, 9, 23, 10, 0, calls.length)).toISOString();
    if (body.operation === "start") {
      const prior = rows.some(row => row.owner === user && row.trace.phase !== "draft");
      const t = startDiscoveryPilot(body.traceId, c, "fixture-hash", body.requestId, at, prior, "fixture-pack-v1");
      rows.unshift({ owner: user, trace: t });
    } else {
      const row = rows.find(row => row.owner === user && row.trace.traceId === body.traceId)!;
      try {
        row.trace = body.operation === "react"
          ? applyPilotAction(row.trace, body, body.requestId, at, referenceFor(source))
          : applyDiscoveryAction(row.trace, body, body.requestId, at, referenceFor(source), body.operation === "message" ? reply(body) : undefined);
      } catch (e) { return Response.json({ ok: false, error: (e as Error).message }, { status: 400 }); }
    }
    if (body.operation === "message" && loseMessageAcknowledgement) {
      loseMessageAcknowledgement = false;
      return Response.json({ ok: false, error: "UNAVAILABLE" }, { status: 503 });
    }
    return Response.json({ ok: true, trace: rows.find(row => row.owner === user && row.trace.traceId === body.traceId)!.trace });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function openCard() {
  render(<ClinicalCasesPractice />);
  fireEvent.click(await screen.findByRole("button", { name: /Case 001/ }));
  await screen.findByRole("button", { name: "Begin encounter" });
}
async function begin() {
  await openCard();
  fireEvent.click(screen.getByRole("button", { name: "Begin encounter" }));
  await screen.findByLabelText("Your question or examination request");
}
async function ask(text: string, channel: "patient" | "exam" = "patient") {
  fireEvent.click(screen.getByRole("button", { name: channel === "patient" ? "Ask patient" : "Examine or test" }));
  fireEvent.change(field(), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: channel === "patient" ? "Send question" : "Request examination" }));
  await waitFor(() => expect(field().value).toBe(""));
}
async function conclude(text = "Suspected structural problem; examine the remaining tooth and discuss options before treatment.") {
  fireEvent.click(screen.getByRole("button", { name: "Finish assessment" }));
  fireEvent.change(screen.getByLabelText(/Your assessment and plan/), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Submit assessment & compare" }));
  await screen.findByRole("heading", { name: "Dr. Chi’s recorded approach" });
}

describe("question-led clinical discovery", () => {
  it("reveals only requested information, records working reasoning, then releases comparison after the final assessment", async () => {
    await begin();
    expect(screen.getByText(opening)).toBeTruthy();
    expect(screen.queryByText(foodAnswer)).toBeNull();
    expect(screen.queryByText(restorationAnswer)).toBeNull();
    expect(screen.queryByLabelText(/^Evaluation/)).toBeNull();
    expect(screen.queryByLabelText(/^Working diagnosis/)).toBeNull();
    expect(screen.queryByRole("heading", { name: "Dr. Chi’s recorded approach" })).toBeNull();

    await ask("What makes the tooth hurt?");
    expect(screen.getByText(foodAnswer)).toBeTruthy();
    expect(screen.queryByText(restorationAnswer)).toBeNull();
    await ask("Inspect the restoration", "exam");
    expect(screen.getByText(restorationAnswer)).toBeTruthy();
    expect(discoveryTurns(current()).map(turn => [turn.channel, turn.question])).toEqual([
      ["patient", "What makes the tooth hurt?"], ["exam", "Inspect the restoration"],
    ]);
    expect(calls.filter(call => call.operation === "message").map(call => call.expectedEventCount)).toEqual([1, 2]);

    fireEvent.change(field(), { target: { value: "Does it hurt at night?" } });
    fireEvent.click(screen.getByRole("button", { name: "Record working assessment" }));
    fireEvent.change(screen.getByLabelText(/Your assessment and plan/), { target: { value: "Structural cause is possible; I need more information." } });
    fireEvent.click(screen.getByRole("button", { name: "Save working assessment" }));
    await waitFor(() => expect(field().value).toBe("Does it hurt at night?"));
    expect(current().events.some(e => e.type === "working_assessment")).toBe(true);
    expect(screen.queryByRole("heading", { name: "Dr. Chi’s recorded approach" })).toBeNull();

    await conclude();
    expect(calls.find(call => call.operation === "decision")!.expectedEventCount).toBe(3);
    expect(calls.find(call => call.operation === "conclude")!.expectedEventCount).toBe(4);
    expect(screen.getByText("Your initial assessment and plan")).toBeTruthy();
    expect(current().events.find(e => e.type === "assessment_submitted")!.payload.informationAvailable).toEqual(["symptom-trigger", "restoration"]);
    const frozen = initialAssessment(current());
    fireEvent.change(screen.getByLabelText("Was this comparison helpful?"), { target: { value: "partly" } });
    fireEvent.change(screen.getByLabelText(/What stood out/), { target: { value: "The initial bite question is a different priority." } });
    fireEvent.change(screen.getByLabelText(/Would you change your plan/), { target: { value: "I would also ask how the bite feels." } });
    fireEvent.click(screen.getByRole("button", { name: "Save reaction & finish" }));
    await screen.findByText("Encounter completed. Your conversation, initial assessment, and reaction are saved separately.");
    expect(initialAssessment(current())).toBe(frozen);
    expect(current().events.at(-1)!.payload.reaction).toMatchObject({ helpful: "partly", revisedPlan: "I would also ask how the bite feels." });
    const firstTrace = current();
    fireEvent.click(screen.getByRole("button", { name: "Start new attempt" }));
    await waitFor(() => expect(current().traceId).not.toBe(firstTrace.traceId));
    expect(field().value).toBe("");
    expect(discoveryTurns(current())).toHaveLength(0);
    expect(screen.queryByText(foodAnswer)).toBeNull();
    expect(screen.queryByRole("heading", { name: "Dr. Chi’s recorded approach" })).toBeNull();
  });

  it("does not disclose a response before persistence is confirmed and retries the exact message", async () => {
    await begin(); failMessage = true;
    fireEvent.change(field(), { target: { value: "What makes the tooth hurt?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send question" }));
    await screen.findByRole("alert");
    expect(screen.queryByText(foodAnswer)).toBeNull();
    expect(field().value).toBe("What makes the tooth hurt?");
    const failed = calls.at(-1)!; failMessage = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry same request" }));
    await screen.findByText(foodAnswer);
    expect(calls.at(-1)).toEqual(failed);
    expect(discoveryTurns(current())).toHaveLength(1);
  });

  it("preserves an unavailable question without turning missing information into a negative finding", async () => {
    await begin();
    await ask("Do you grind your teeth at night?");
    expect(screen.getByText("That information is not available in this encounter.")).toBeTruthy();
    expect(discoveryTurns(current())[0]).toMatchObject({ question: "Do you grind your teeth at night?", reply: { resolution: "unavailable", availableFactIds: [] } });
    expect(screen.queryByText(restorationAnswer)).toBeNull();
    expect(screen.queryByRole("heading", { name: "Dr. Chi’s recorded approach" })).toBeNull();
  });

  it("recovers an unacknowledged request across remount and reuses its request ID", async () => {
    await begin(); failMessage = true;
    fireEvent.change(field(), { target: { value: "What makes the tooth hurt?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send question" }));
    await screen.findByRole("alert");
    const failed = calls.at(-1)!;
    cleanup();
    render(<ClinicalCasesPractice />);
    fireEvent.click(await screen.findByRole("button", { name: /Case 001/ }));
    await screen.findByRole("button", { name: "Retry same request" });
    expect(field().value).toBe(failed.text);
    failMessage = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry same request" }));
    await screen.findByText(foodAnswer);
    expect(calls.at(-1)).toEqual(failed);
    expect(discoveryTurns(current())).toHaveLength(1);
  });

  it("reconciles a lost acknowledgement from the server trace without sending the question twice", async () => {
    await begin(); loseMessageAcknowledgement = true;
    fireEvent.change(field(), { target: { value: "What makes the tooth hurt?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send question" }));
    await screen.findByRole("alert");
    expect(discoveryTurns(current())).toHaveLength(1);
    expect(screen.queryByText(foodAnswer)).toBeNull();
    const writes = calls.length;
    cleanup(); render(<ClinicalCasesPractice />);
    fireEvent.click(await screen.findByRole("button", { name: /Case 001/ }));
    await screen.findByText(foodAnswer);
    expect(field().value).toBe("");
    expect(screen.queryByRole("button", { name: "Retry same request" })).toBeNull();
    expect(calls).toHaveLength(writes);
  });

  it("retains unsent text after validation rejection and after an explicit conflict reload", async () => {
    await begin(); rejectMessage = true;
    const originalTraceId = current().traceId;
    fireEvent.change(field(), { target: { value: "What makes the tooth hurt?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send question" }));
    await screen.findByRole("alert");
    expect(field().disabled).toBe(false);
    expect(field().value).toBe("What makes the tooth hurt?");
    rejectMessage = false; conflictMessage = true;
    fireEvent.click(screen.getByRole("button", { name: "Send question" }));
    await screen.findByRole("button", { name: "Reload attempt" });
    conflictMessage = false;
    // A different tab acknowledged its own save and replaced the shared cache.
    for (const key of Object.keys(localStorage)) if (key.endsWith(":" + current().traceId)) {
      const cached = JSON.parse(localStorage.getItem(key)!);
      localStorage.setItem(key, JSON.stringify({ ...cached, question: "" }));
    }
    rows.unshift({ owner: user, trace: startDiscoveryPilot(crypto.randomUUID(), c, "another-hash", crypto.randomUUID(),
      "2026-10-23T10:20:00Z", false, "fixture-pack-v1") });
    fireEvent.click(screen.getByRole("button", { name: "Reload attempt" }));
    // Fieldset-disabled controls do not inherit their parent's disabled property.
    await waitFor(() => expect((screen.getByRole("button", { name: "Send question" }) as HTMLButtonElement).disabled).toBe(false));
    expect(field().value).toBe("What makes the tooth hurt?");
    fireEvent.click(screen.getByRole("button", { name: "Send question" }));
    await screen.findByText(foodAnswer);
    expect(calls.at(-1)!.traceId).toBe(originalTraceId);
  });

  it("recovers unsent drafts for the same owner and attempt, without leaking them to another owner", async () => {
    await begin();
    fireEvent.change(field(), { target: { value: "Does it hurt at night?" } });
    cleanup(); render(<ClinicalCasesPractice />);
    fireEvent.click(await screen.findByRole("button", { name: /Case 001/ }));
    await waitFor(() => expect(field().value).toBe("Does it hurt at night?"));
    cleanup(); user = "other-owner";
    await begin();
    expect(field().value).toBe("");
  });

  it("allows the clinician to finish without a prescribed checklist and recovers the later reaction separately", async () => {
    await begin();
    await conclude("Insufficient information to diagnose; I would arrange a further assessment before treatment.");
    expect(discoveryTurns(current())).toHaveLength(0);
    fireEvent.change(screen.getByLabelText(/What stood out/), { target: { value: "Still considering the priorities." } });
    cleanup(); render(<ClinicalCasesPractice />);
    fireEvent.click(await screen.findByRole("button", { name: /Case 001/ }));
    await waitFor(() => expect((screen.getByLabelText(/What stood out/) as HTMLTextAreaElement).value).toBe("Still considering the priorities."));
    expect(initialAssessment(current())).toContain("Insufficient information");
  });

  it("keeps a completed historical written attempt separate from a new discovery encounter", async () => {
    const answers = { ...blankAnswers(), evaluation: "Historical written evaluation", diagnosis: "Uncertain", plan: "Assess further", rationale: "Information was limited" };
    let old = startPilot("written-trace", publicCase(source), "old-hash", "old-start", "2026-10-22T10:00:00Z", false);
    old = applyPilotAction(old, { operation: "submit", answers }, "old-submit", "2026-10-22T10:01:00Z", referenceFor(source));
    old = applyPilotAction(old, { operation: "react", reaction: { helpful: "partly", comment: "Legacy", revisedPlan: "" } }, "old-react", "2026-10-22T10:02:00Z", referenceFor(source));
    rows.push({ owner: user, trace: old });
    await openCard();
    expect(screen.queryByText("Historical written evaluation")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "View previous written attempt" }));
    await screen.findByText("Historical written evaluation");
    expect(screen.queryByLabelText("Your question or examination request")).toBeNull();
    expect(rows[0].trace).toEqual(old);
  });
});

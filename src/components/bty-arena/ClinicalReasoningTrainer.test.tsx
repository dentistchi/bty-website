// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClinicalReasoningTrainer } from "./ClinicalReasoningTrainer";
import { completeEncounter, recordDecision, startEncounter, submit } from "@/domain/clinical-encounter/session";
import type { EncounterTraceV2 } from "@/domain/clinical-encounter/encounter";

const decision = { differential: "Pulp injury", diagnosis: "Incisor crown fracture", treatment: "Protect exposed dentin", followup: "Review in two weeks", confidence: "Moderate", rationale: "Based on trauma history and cold response" };
type Write = { operation: string; trace: EncounterTraceV2 };
let writes: Write[];
let rows: { status: string; raw_trace: EncounterTraceV2 }[];
let failComplete: boolean;
let failSave: boolean;
let failLoad: boolean;
let lostAcknowledgement: boolean;
let conflictingCompletion: boolean;
beforeEach(() => {
  writes = []; rows = []; failComplete = false; failSave = false; failLoad = false; lostAcknowledgement = false; conflictingCompletion = false;
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method !== "POST") return Response.json({ ok: !failLoad, traces: rows }, { status: failLoad ? 503 : 200 });
    const body = JSON.parse(init.body as string) as Write;
    writes.push(body);
    if (body.operation === "complete" && lostAcknowledgement) {
      rows = [{ status: "completed", raw_trace: body.trace }];
      if (conflictingCompletion) rows[0].raw_trace = { ...body.trace, events: body.trace.events.map(e => e.type === "diagnosis_submitted" ? { ...e, response: "Another tab's diagnosis" } : e) };
      throw new Error("Response lost after commit");
    }
    if (body.operation === "complete" ? failComplete : failSave) return Response.json({ ok: false }, { status: 500 });
    return Response.json({ ok: true, status: body.operation === "complete" ? "completed" : "active" });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function ready() { await waitFor(() => expect((screen.getByLabelText("Clinical encounter message") as HTMLInputElement).disabled).toBe(false)); }
function send(message: string) { fireEvent.change(screen.getByLabelText("Clinical encounter message"), { target: { value: message } }); fireEvent.click(screen.getByRole("button", { name: "Send" })); }
function fillDecision() {
  fireEvent.click(screen.getByText("Make decision / Finish case"));
  for (const [label, value] of [["Differential (optional)", decision.differential], ["Diagnosis", decision.diagnosis], ["Treatment", decision.treatment], ["Follow-up", decision.followup], ["Confidence", decision.confidence], ["Rationale", decision.rationale]]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
}

describe("ClinicalReasoningTrainer V2", () => {
  it("saves the conversational encounter and completes structured reasoning before showing review", async () => {
    render(<ClinicalReasoningTrainer />);
    expect(screen.getByText("I fell earlier today and broke my two front teeth.")).toBeTruthy();
    await ready();
    send("When did this happen?");
    expect(screen.getByText(/It happened about two hours ago/)).toBeTruthy();
    send("cold test #8");
    expect(screen.getByText(/#8 responds/)).toBeTruthy();
    fillDecision();
    // A typed but unsent question must not be substituted for the decision.
    fireEvent.change(screen.getByLabelText("Clinical encounter message"), { target: { value: "unsent message" } });
    fireEvent.click(screen.getByRole("button", { name: "Record decision" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete case" }));
    expect(await screen.findByRole("heading", { name: "Your reasoning review" })).toBeTruthy();
    const completed = writes.find(w => w.operation === "complete")!;
    expect(writes.filter(w => w.operation === "save").length).toBeGreaterThanOrEqual(3);
    expect(Object.keys(completed).sort()).toEqual(["operation", "trace"]);
    expect(completed.trace.events.slice(0, 2).map(e => e.type)).toEqual(["encounter_started", "chief_complaint_presented"]);
    for (const type of ["differential_updated", "diagnosis_submitted", "treatment_submitted", "followup_submitted", "confidence_submitted", "rationale_submitted", "encounter_completed"]) {
      expect(completed.trace.events.filter(e => e.type === type)).toHaveLength(1);
    }
    expect(completed.trace.events.find(e => e.type === "diagnosis_submitted")?.response).toBe(decision.diagnosis);
    expect(completed.trace.events.some(e => e.doctorMessage === "unsent message")).toBe(false);
    expect(completed.trace.events.map(e => e.sequence)).toEqual(completed.trace.events.map((_, i) => i + 1));
    expect(screen.getByLabelText("Encounter timeline")).toBeTruthy();
    expect(screen.getByText(/Important domains missed:/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Complete case" })).toBeNull();
  });

  it("preserves a failed completion and retries the same raw trace without showing false success", async () => {
    failComplete = true;
    render(<ClinicalReasoningTrainer />); await ready();
    send("When did this happen?"); fillDecision();
    fireEvent.click(screen.getByRole("button", { name: "Complete case" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("Completion failed"));
    expect(screen.queryByRole("heading", { name: "Your reasoning review" })).toBeNull();
    expect(screen.getByText(/It happened about two hours ago/)).toBeTruthy();
    expect((screen.getByLabelText("Diagnosis") as HTMLTextAreaElement).value).toBe(decision.diagnosis);
    const first = writes.find(w => w.operation === "complete")!.trace;
    failComplete = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry completion" }));
    await screen.findByRole("heading", { name: "Your reasoning review" });
    expect(writes.filter(w => w.operation === "complete").map(w => w.trace)).toEqual([first, first]);
  });

  it("resumes the active case conversation and recorded decision from the authenticated endpoint", async () => {
    const trace = recordDecision(submit(startEncounter("resumed"), "When did this happen?"), decision);
    rows = [{ status: "active", raw_trace: trace }];
    render(<ClinicalReasoningTrainer />); await ready();
    expect(screen.getByText(/It happened about two hours ago/)).toBeTruthy();
    expect((screen.getByLabelText("Diagnosis") as HTMLTextAreaElement).value).toBe(decision.diagnosis);
    expect(writes).toEqual([]);
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain("status=active");
    fireEvent.click(screen.getByText("Make decision / Finish case"));
    fireEvent.click(screen.getByRole("button", { name: "Complete case" }));
    await screen.findByRole("heading", { name: "Your reasoning review" });
    expect(writes[0].trace.traceId).toBe("resumed");
  });

  it("does not resume completed or other-case traces as editable", async () => {
    rows = [
      { status: "completed", raw_trace: completeEncounter(startEncounter("completed"), decision) },
      { status: "active", raw_trace: { ...startEncounter("other-case"), caseId: "other" } },
    ];
    render(<ClinicalReasoningTrainer />); await ready();
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(["completed", "other-case"]).not.toContain(writes[0].trace.traceId);
    expect((screen.getByLabelText("Diagnosis") as HTMLTextAreaElement).value).toBe("");
  });

  it("keeps a fresh encounter usable when retrieval fails, and preserves failed active saves", async () => {
    failLoad = true; failSave = true;
    render(<ClinicalReasoningTrainer />); await ready();
    send("When did this happen?");
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Save failed"));
    expect(screen.getByText(/It happened about two hours ago/)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Not saved to server");
    failSave = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Saved to server"));
    expect(writes[1].trace).toEqual(writes[0].trace);
  });

  it("confirms a lost completion acknowledgement through a server read", async () => {
    lostAcknowledgement = true;
    render(<ClinicalReasoningTrainer />); await ready(); fillDecision();
    fireEvent.click(screen.getByRole("button", { name: "Complete case" }));
    await screen.findByRole("heading", { name: "Your reasoning review" });
    expect(screen.getByRole("status").textContent).toBe("Completed and saved");
  });

  it("preserves local reasoning when another tab completed a different trace snapshot", async () => {
    lostAcknowledgement = true; conflictingCompletion = true;
    render(<ClinicalReasoningTrainer />); await ready(); fillDecision();
    fireEvent.click(screen.getByRole("button", { name: "Complete case" }));
    await screen.findByRole("alert");
    expect(screen.queryByRole("heading", { name: "Your reasoning review" })).toBeNull();
    expect((screen.getByLabelText("Diagnosis") as HTMLTextAreaElement).value).toBe(decision.diagnosis);
  });
});

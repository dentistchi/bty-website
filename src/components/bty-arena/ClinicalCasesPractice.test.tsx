/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ClinicalCasesPractice } from "./ClinicalCasesPractice";
import { applyPilotAction, publicCase, referenceFor, startPilot, type AuthorCase, type PilotTrace } from "@/domain/clinical-pilot/pilot";
import catalog from "@/domain/clinical-pilot/catalog.json";

const c = catalog[22] as AuthorCase;
let trace: PilotTrace | null;
let failSubmit: boolean;
const calls: Record<string, any>[] = [];
beforeEach(() => {
  trace = null; failSubmit = false; calls.length = 0; localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (!init?.body) return Response.json(url.includes("caseId=") ? { ok: true, traces: trace ? [{ raw_trace: trace }] : [] }
      : { ok: true, cases: [publicCase(c)], userId: "owner", isAdmin: false });
    const body = JSON.parse(init.body as string); calls.push(body);
    if (body.operation === "start") trace = startPilot(body.traceId, publicCase(c), "hash", body.requestId, "2026-10-23T10:00:00Z", false);
    else if (body.operation === "submit" && failSubmit) return Response.json({ ok: false, error: "UNAVAILABLE" }, { status: 503 });
    else {
      try { trace = applyPilotAction(trace!, body, body.requestId, "2026-10-23T10:01:00Z", referenceFor(c)); }
      catch (e) { return Response.json({ ok: false, error: (e as Error).message }, { status: 400 }); }
    }
    return Response.json({ ok: true, trace });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function openCase() {
  render(<ClinicalCasesPractice />);
  fireEvent.click(await screen.findByRole("button", { name: /Case 023/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Start case" }));
  await screen.findByText("Saved to server");
}
function fill(evaluation = "Inspect proximal contact") {
  for (const [label, value] of [["Evaluation", evaluation], ["Working diagnosis", "Open contact"], ["Treatment plan", "Assess #29"], ["Reasoning", "Preserve a functioning crown"]]) fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`)), { target: { value } });
}
describe("clinical author pilot", () => {
  it("captures first reasoning before comparison, then collects an explicit reaction", async () => {
    await openCase();
    expect(screen.queryByText("Dr. Chi’s recorded approach")).toBeNull();
    expect(screen.queryByRole("button", { name: "Review responses" })).toBeNull();
    fill(); fireEvent.click(screen.getByRole("button", { name: "Submit & compare" }));
    await screen.findByText("Dr. Chi’s recorded approach");
    expect(screen.getByText("Your initial response")).toBeTruthy();
    expect(screen.getByText("English paraphrase · awaiting author review")).toBeTruthy();
    expect(screen.getByLabelText("Was this comparison helpful?").getAttribute("required")).not.toBeNull();
    fireEvent.change(screen.getByLabelText("Was this comparison helpful?"), { target: { value: "no" } });
    fireEvent.change(screen.getByLabelText(/What stood out/), { target: { value: "I would check occlusion too" } });
    fireEvent.click(screen.getByRole("button", { name: "Save reaction & finish" }));
    await screen.findByText("Case completed. Your initial response and reaction are saved separately.");
    expect(trace!.events.find(e => e.type === "reasoning_submitted")!.payload.answers).toMatchObject({ evaluation: "Inspect proximal contact" });
    expect(trace!.events.at(-1)!.payload.reaction).toMatchObject({ helpful: "no", comment: "I would check occlusion too" });
    fireEvent.click(screen.getByRole("button", { name: "Start new attempt" }));
    await screen.findByRole("button", { name: "Submit & compare" });
    fill(); fireEvent.click(screen.getByRole("button", { name: "Submit & compare" }));
    await screen.findByText("Dr. Chi’s recorded approach");
    expect((screen.getByLabelText("Was this comparison helpful?") as HTMLSelectElement).value).toBe("");
    expect((screen.getByLabelText(/What stood out/) as HTMLTextAreaElement).value).toBe("");
  });
  it("retains input and retries the same operation after a failed save, without early feedback", async () => {
    await openCase(); fill(); failSubmit = true;
    fireEvent.click(screen.getByRole("button", { name: "Submit & compare" }));
    await screen.findByRole("alert");
    expect(screen.queryByText("Dr. Chi’s recorded approach")).toBeNull();
    expect((screen.getByLabelText(/^Evaluation/) as HTMLTextAreaElement).value).toBe("Inspect proximal contact");
    const failedId = calls.at(-1)!.requestId; failSubmit = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
    await screen.findByText("Dr. Chi’s recorded approach");
    expect(calls.at(-1)!.requestId).toBe(failedId);
    expect(trace!.events.filter(e => e.type === "reasoning_submitted")).toHaveLength(1);
  });
  it("allows correction after a terminal validation error rather than locking the form", async () => {
    await openCase(); fill("   ");
    fireEvent.submit(screen.getByRole("button", { name: "Submit & compare" }).closest("form")!);
    await screen.findByText("Enter an evaluation, working diagnosis, treatment plan, and reasoning before submitting.");
    expect((screen.getByLabelText(/^Evaluation/) as HTMLTextAreaElement).disabled).toBe(false);
    fireEvent.change(screen.getByLabelText(/^Evaluation/), { target: { value: "Check contact" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit & compare" }));
    await screen.findByText("Dr. Chi’s recorded approach");
  });
  it("recovers an unsaved reaction after remount using the owner and attempt scoped browser draft", async () => {
    await openCase(); fill(); fireEvent.click(screen.getByRole("button", { name: "Submit & compare" }));
    await screen.findByText("Dr. Chi’s recorded approach");
    fireEvent.change(screen.getByLabelText(/What stood out/), { target: { value: "Still thinking" } });
    cleanup(); render(<ClinicalCasesPractice />);
    fireEvent.click(await screen.findByRole("button", { name: /Case 023/ }));
    await waitFor(() => expect((screen.getByLabelText(/What stood out/) as HTMLTextAreaElement).value).toBe("Still thinking"));
  });
});

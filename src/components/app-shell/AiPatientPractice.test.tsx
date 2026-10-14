/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * AI Patient Practice — the learner's screen. The server is a test double here; what is proven is
 * that the screen gates on the notice, carries the sealed session faithfully, falls back to typing
 * when the microphone is refused, and shows feedback without any score.
 */

let voiceMode: "browser_recorder" | "teams_native" | "none" = "none";
const startRecorder = vi.fn();
vi.mock("@/lib/bty/arena/aiPatient/voiceCapture", async () => {
  const actual = await vi.importActual<typeof import("@/lib/bty/arena/aiPatient/voiceCapture")>("@/lib/bty/arena/aiPatient/voiceCapture");
  class FakeRecorder {
    recording = false;
    async start() {
      startRecorder();
      throw new actual.CaptureError("permission_denied");
    }
    async stop() {
      return new Blob();
    }
    cancel() {}
  }
  return {
    ...actual,
    detectVoiceMode: async () => voiceMode,
    BrowserTurnRecorder: FakeRecorder,
    // Issue #64: Teams iPhone — the recording was saved, then the handoff to BTY failed.
    recordWithTeams: vi.fn(async () => {
      throw new actual.CaptureError("handoff_failed", { stage: "get_media_callback", sdkErrorCode: 4000, attachmentCount: 1, format: "base64", mimeType: "audio/mp4", hasContent: true, hasPreview: false });
    }),
  };
});

import { AiPatientPractice } from "./AiPatientPractice";
import { buildCoachingView, HELPED_TEXT, SAFETY_COACHING } from "@/domain/arena/aiPatient/coachingView";
import type { ShownFeedback } from "@/domain/arena/aiPatient/feedback";

/** A reconciled review as the route returns it; its coaching view comes from the REAL builder. */
const REVIEW: ShownFeedback = {
  hiddenConcern: { key: "financial_limit", label: "a real money limit" },
  concernSurfaced: { status: "yes", quote: "What feels hardest?" },
  observations: [{ key: "open_question", label: "Asked an open question before explaining more", status: "seen", quotes: ["What feels hardest?"], note: "You asked first." }],
  concerns: [{ kind: "insurance_guarantee", quote: "it's covered", explanation: "Not confirmed.", quoteVerified: false, source: "coach" }],
  nextStep: "Ask before explaining.",
  suggestMentorReview: true,
  safetyScreen: "ran",
};

const OPENING = "I'm not in pain, and my insurance doesn't cover much. I think I need to think about it.";
const view = (turns: Array<{ role: string; text: string }>, state: string) => ({
  state,
  turns,
  expiresAt: Date.now() + 300_000,
  serverNow: Date.now(),
  turnsLeft: 14 - turns.filter((t) => t.role === "tc").length,
  limits: { sessionSeconds: 300, maxLearnerTurns: 14, maxLearnerChars: 600, maxAudioSeconds: 45 },
});

const calls: Array<{ url: string; body: unknown }> = [];
beforeEach(() => {
  voiceMode = "none";
  calls.length = 0;
  startRecorder.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : init?.body;
      calls.push({ url, body });
      if (url.endsWith("/start")) return Response.json({ ...view([{ role: "patient", text: OPENING }], "aps1.s0"), patientName: "Dana", briefing: "Dana has just seen Dr. Patel.", voiceAvailable: false });
      if (url.endsWith("/turn"))
        return Response.json({
          ...view([{ role: "patient", text: OPENING }, { role: "tc", text: "What feels hardest?" }, { role: "patient", text: "Honestly, money is tight." }], "aps1.s1"),
          patientText: "Honestly, money is tight.",
          learnerText: "What feels hardest?",
        });
      if (url.endsWith("/feedback"))
        return Response.json({
          feedback: { ...REVIEW, coaching: buildCoachingView(REVIEW) },
        });
      return new Response("{}", { status: 404 });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function startConversation() {
  render(<AiPatientPractice onBack={() => undefined} />);
  const startBtn = screen.getByTestId("ai-patient-start") as HTMLButtonElement;
  expect(startBtn.disabled).toBe(true); // the notice must be acknowledged first
  fireEvent.click(screen.getByTestId("ai-patient-ack"));
  expect(startBtn.disabled).toBe(false);
  await act(async () => fireEvent.click(startBtn));
  await screen.findByTestId("ai-patient-talking");
}

describe("AiPatientPractice", () => {
  it("shows the fictional-patient and privacy notice before anything starts", () => {
    render(<AiPatientPractice onBack={() => undefined} />);
    const notice = screen.getByTestId("ai-patient-notice").textContent ?? "";
    expect(notice).toMatch(/Fictional patient/);
    expect(notice).toMatch(/Never use a real patient/);
    expect(notice).toMatch(/does not keep the recording or the conversation/);
    expect(notice).toMatch(/isn.t a score/);
    expect(calls).toHaveLength(0);
  });

  it("opens on the patient's line and sends the learner's typed turn with the sealed session", async () => {
    await startConversation();
    expect(calls[0]).toEqual({ url: "/api/arena/ai-patient/start", body: { acknowledged: true } });
    expect(screen.getAllByTestId("turn-patient")[0]!.textContent).toContain(OPENING);
    fireEvent.change(screen.getByTestId("ai-patient-input"), { target: { value: "What feels hardest?" } });
    await act(async () => fireEvent.click(screen.getByTestId("ai-patient-send")));
    await waitFor(() => expect(screen.getAllByTestId("turn-patient")).toHaveLength(2));
    expect(calls[1]).toEqual({ url: "/api/arena/ai-patient/turn", body: { state: "aps1.s0", text: "What feels hardest?" } });
    expect(screen.getAllByTestId("turn-tc")[0]!.textContent).toBe("What feels hardest?");
  });

  it("when the microphone is refused, says how to allow it and keeps typing available", async () => {
    voiceMode = "browser_recorder";
    render(<AiPatientPractice onBack={() => undefined} />);
    fireEvent.click(screen.getByTestId("ai-patient-ack"));
    // Voice needs the server's speech support too; the double reports it available for this case.
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async () =>
      Response.json({ ...view([{ role: "patient", text: OPENING }], "aps1.s0"), patientName: "Dana", briefing: "", voiceAvailable: true }),
    );
    await act(async () => fireEvent.click(screen.getByTestId("ai-patient-start")));
    await screen.findByTestId("ai-patient-talking");
    await act(async () => fireEvent.click(screen.getByTestId("ai-patient-mic")));
    expect(startRecorder).toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/App permissions/);
    expect(screen.queryByTestId("ai-patient-mic")).toBeNull();
    expect((screen.getByTestId("ai-patient-input") as HTMLTextAreaElement).disabled).toBe(false);
  });

  it("ends into coaching: reveals the concern, flags what to review with a mentor, and shows no score", async () => {
    await startConversation();
    fireEvent.change(screen.getByTestId("ai-patient-input"), { target: { value: "What feels hardest?" } });
    await act(async () => fireEvent.click(screen.getByTestId("ai-patient-send")));
    await waitFor(() => expect(screen.getAllByTestId("turn-patient")).toHaveLength(2));
    await act(async () => fireEvent.click(screen.getByTestId("ai-patient-end")));
    const body = await screen.findByTestId("ai-patient-feedback-body");
    expect(calls.at(-1)).toEqual({ url: "/api/arena/ai-patient/feedback", body: { state: "aps1.s1" } });
    expect(body.textContent).toMatch(/It was a real money limit/);
    // Issue #69: three coaching sections, not a seven-row report card.
    const helped = screen.getByTestId("coach-helped").textContent ?? "";
    expect(helped).toContain(HELPED_TEXT.open_question);
    expect(helped).toContain("You said: \u201cWhat feels hardest?\u201d");
    const oneThing = screen.getByTestId("coach-one-thing").textContent ?? "";
    expect(oneThing).toContain(SAFETY_COACHING.insurance_guarantee.title);
    expect(oneThing).toContain(SAFETY_COACHING.insurance_guarantee.whyItMatters);
    expect(oneThing).toContain(`Try saying: \u201c${SAFETY_COACHING.insurance_guarantee.tryInstead}\u201d`);
    expect(oneThing).toMatch(/we couldn't match this to your exact words/);
    expect(oneThing).toMatch(/BTY hasn't shared this with anyone/);
    expect(screen.getByTestId("coach-try-next").textContent).toContain("Ask before explaining.");
    // The default view carries no report-card statuses; the full review is one tap away, closed.
    for (const id of ["coach-helped", "coach-one-thing", "coach-try-next"]) {
      expect(screen.getByTestId(id).textContent).not.toMatch(/\b(Seen|Partly|Not seen|Unclear)\b/);
    }
    const details = screen.getByTestId("coach-details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details.textContent).toContain("Asked an open question before explaining more");
    // "isn't a score" is the disclaimer itself; any other mention of a score, points, pass/fail or a
    // percentage would be a grade.
    expect(body.textContent).not.toMatch(/(?<!(?:not|isn't) a )\bscore\b|\bpoints?\b|\bpassed\b|\bfailed\b|\d+\s?%/i);
    expect(body.textContent).toMatch(/It isn't a score or a clinical or professional certification/);
    expect(screen.getByTestId("ai-patient-again")).toBeTruthy();
  });
});

describe("AiPatientPractice — Teams iPhone Save handoff (Issue #64)", () => {
  it("says the recording was made but not handed over — never that the microphone didn't start — shows the stage code, and keeps typing open", async () => {
    voiceMode = "teams_native";
    render(<AiPatientPractice onBack={() => undefined} />);
    fireEvent.click(screen.getByTestId("ai-patient-ack"));
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async () =>
      Response.json({ ...view([{ role: "patient", text: OPENING }], "aps1.s0"), patientName: "Dana", briefing: "", voiceAvailable: true }),
    );
    await act(async () => fireEvent.click(screen.getByTestId("ai-patient-start")));
    await screen.findByTestId("ai-patient-talking");
    expect(screen.getByTestId("ai-patient-mic").textContent).toBe("Record what you say");
    await act(async () => fireEvent.click(screen.getByTestId("ai-patient-mic")));
    const alert = screen.getByTestId("ai-patient-talking").querySelector('[role="alert"]')!;
    expect(alert.textContent).toMatch(/Your recording was made, but Teams couldn't pass it to BTY/);
    expect(alert.textContent).not.toMatch(/microphone didn't start/);
    expect(screen.getByTestId("ai-patient-capture-diag").textContent).toBe("AIP-VOICE get_media_callback code=4000 n=1 fmt=base64 mime=audio/mp4 content=y preview=n");
    // A handoff failure is retryable: the record button stays, and typing works.
    expect(screen.getByTestId("ai-patient-mic")).toBeTruthy();
    expect((screen.getByTestId("ai-patient-input") as HTMLTextAreaElement).disabled).toBe(false);
  });
});

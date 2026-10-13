import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

/**
 * AI PATIENT — the four routes, end to end, with the model and the auth gate replaced.
 * The provider double is SCRIPTED for tests only; production replies come from the real model.
 */

const mockCreate = vi.fn();
vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => true,
  getLlmClient: () => ({ chat: { completions: { create: mockCreate } } }),
}));

const adminFrom = vi.fn();
let gateUser: string | null = "user-a";
vi.mock("@/lib/bty/foundry/arena/arenaPracticeGate", () => ({
  requireConsentedArenaAccess: async () =>
    gateUser
      ? { ok: true, access: { userId: gateUser, admin: { from: adminFrom }, isApprovedMember: true } }
      : { ok: false, response: NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }) },
}));

/** The real KV limiter is replaced by a counter the tests can read and fill. */
const budgetCalls: Array<{ endpoint: string; identifier: string }> = [];
let budgetRefuse: string | null = null;
vi.mock("@/lib/rate-limit", () => ({
  rateLimitKV: async (o: { endpoint: string; identifier: string }) => {
    budgetCalls.push({ endpoint: o.endpoint, identifier: o.identifier });
    return budgetRefuse && o.endpoint.startsWith(budgetRefuse) ? { allowed: false, retryAfterSeconds: 42 } : { allowed: true };
  },
}));

import { POST as start } from "./start/route";
import { POST as turn } from "./turn/route";
import { POST as speech } from "./speech/route";
import { POST as feedback } from "./feedback/route";
import { GET as access } from "./access/route";
import { CASE_ACCEPTANCE_01 } from "@/domain/arena/aiPatient/caseAcceptance01";
import { AI_PATIENT_LIMITS } from "@/domain/arena/aiPatient/sessionRules";
import { FEEDBACK_BEHAVIORS } from "@/domain/arena/aiPatient/feedback";

const json = (body: unknown) => new Request("http://x/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const reply = (content: string) => ({ choices: [{ message: { content, refusal: null }, finish_reason: "stop" }] });
const providerFetch = vi.fn();

beforeEach(() => {
  gateUser = "user-a";
  mockCreate.mockReset();
  adminFrom.mockReset();
  providerFetch.mockReset();
  budgetCalls.length = 0;
  budgetRefuse = null;
  vi.stubEnv("AI_PATIENT_ALLOWED_USER_IDS", "user-a");
  vi.stubEnv("AI_PATIENT_SESSION_SECRET", "route-test-secret");
  vi.stubEnv("OPENAI_API_KEY", "sk-test-not-real");
  vi.stubEnv("AI_PATIENT_OPENAI_API_KEY", "sk-dedicated-ai-patient-test");
  vi.stubGlobal("fetch", providerFetch);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function begin() {
  const res = await start(json({ acknowledged: true }));
  expect(res.status).toBe(200);
  return (await res.json()) as { state: string; turns: Array<{ role: string; text: string }>; turnsLeft: number; voiceAvailable: boolean; expiresAt: number };
}

describe("[AI patient] start", () => {
  it("fails closed when dedicated key is missing even if the global OpenAI key exists", async () => {
    vi.stubEnv("AI_PATIENT_OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "sk-global-bty-must-not-be-used");
    expect((await access()).status).toBe(200);
    expect(await (await access()).json()).toEqual({ enabled: false });
    const result = await start(json({ acknowledged: true }));
    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({ error: "llm_unavailable" });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("401 without a signed-in, consented learner", async () => {
    gateUser = null;
    expect((await start(json({ acknowledged: true }))).status).toBe(401);
  });

  it("requires the learner to acknowledge the fictional-patient notice", async () => {
    const res = await start(json({}));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "acknowledgement_required" });
  });

  it("opens on the authored line, sealed, with the limits — and calls no model yet", async () => {
    const s = await begin();
    expect(s.turns).toEqual([{ role: "patient", text: CASE_ACCEPTANCE_01.openingLine }]);
    expect(s.state.startsWith("aps1.")).toBe(true);
    expect(s.turnsLeft).toBe(AI_PATIENT_LIMITS.maxLearnerTurns);
    expect(s.voiceAvailable).toBe(true);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(JSON.stringify(s)).not.toMatch(/financial_limit|clinical_need_doubt/);
  });
});

describe("[AI patient] a real multi-turn conversation", () => {
  it("each patient answer comes from the model, which sees the whole conversation so far", async () => {
    mockCreate.mockResolvedValueOnce(reply("Honestly, it's a lot of money right now.")).mockResolvedValueOnce(reply("I'd have to check what my plan covers."));
    let s = await begin();
    let r = await turn(json({ state: s.state, text: "That makes sense. What feels hardest about it?" }));
    expect(r.status).toBe(200);
    let body = await r.json();
    expect(body.patientText).toBe("Honestly, it's a lot of money right now.");
    s = body;
    r = await turn(json({ state: s.state, text: "Would it help to look at the estimate together?" }));
    body = await r.json();
    expect(body.turns.map((t: { role: string }) => t.role)).toEqual(["patient", "tc", "patient", "tc", "patient"]);
    expect(body.turnsLeft).toBe(AI_PATIENT_LIMITS.maxLearnerTurns - 2);
    const secondCall = mockCreate.mock.calls[1]![0] as { messages: Array<{ role: string; content: string }>; model: string; max_tokens: number };
    expect(secondCall.messages.map((m) => m.role)).toEqual(["system", "assistant", "user", "assistant", "user"]);
    expect(secondCall.messages[3]!.content).toBe("Honestly, it's a lot of money right now.");
    expect(secondCall.max_tokens).toBe(AI_PATIENT_LIMITS.patientMaxTokens);
  });

  it("a reply that steps out of role is regenerated once with a reminder", async () => {
    mockCreate.mockResolvedValueOnce(reply("As an AI, I think you asked a great question.")).mockResolvedValueOnce(reply("I guess I'm just worried about the cost."));
    const s = await begin();
    const body = await (await turn(json({ state: s.state, text: "What's on your mind?" }))).json();
    expect(body.patientText).toBe("I guess I'm just worried about the cost.");
    const retryMessages = (mockCreate.mock.calls[1]![0] as { messages: Array<{ content: string }> }).messages;
    expect(retryMessages.at(-1)!.content).toMatch(/answer only as Dana/);
  });

  it("a second out-of-role reply is refused and never shown; the session is unchanged so the learner can resend", async () => {
    mockCreate.mockResolvedValue(reply("Great job! As your coach, you should have asked earlier."));
    const s = await begin();
    const res = await turn(json({ state: s.state, text: "What's on your mind?" }));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "patient_left_role" });
  });

  it("refuses a tampered session and another user's session", async () => {
    vi.stubEnv("AI_PATIENT_ALLOWED_USER_IDS", "user-a, user-b");
    const s = await begin();
    expect((await turn(json({ state: s.state.slice(0, -4) + "AAAA", text: "hi" }))).status).toBe(400);
    gateUser = "user-b";
    const res = await turn(json({ state: s.state, text: "hi" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "session_invalid" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("refuses a turn after time is up — before any model or transcription is paid for", async () => {
    const s = await begin();
    vi.useFakeTimers({ now: s.expiresAt + 1000, toFake: ["Date"] });
    const res = await turn(json({ state: s.state, text: "Are you still there?" }));
    expect(res.status).toBe(410);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("refuses an over-long typed turn rather than cutting it", async () => {
    const s = await begin();
    const res = await turn(json({ state: s.state, text: "x".repeat(AI_PATIENT_LIMITS.maxLearnerChars + 1) }));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "too_long" });
  });

  it("never touches a database table for the conversation", async () => {
    mockCreate.mockResolvedValue(reply("I need to think."));
    const s = await begin();
    await turn(json({ state: s.state, text: "Okay." }));
    expect(adminFrom).not.toHaveBeenCalled();
  });
});

describe("[AI patient] voice turns", () => {
  const voiceReq = (state: string, clip: Blob) => {
    const form = new FormData();
    form.append("state", state);
    form.append("audio", clip, "turn");
    return new Request("http://x/api", { method: "POST", body: form });
  };

  it("a recorded clip is transcribed by the server and answered like a typed turn", async () => {
    providerFetch.mockResolvedValueOnce(Response.json({ text: "What part of this feels hardest for you?" }));
    mockCreate.mockResolvedValueOnce(reply("I'm just not sure I really need it."));
    const s = await begin();
    const res = await turn(voiceReq(s.state, new Blob([new Uint8Array(4000)], { type: "audio/webm" })));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.learnerText).toBe("What part of this feels hardest for you?");
    expect(body.patientText).toBe("I'm just not sure I really need it.");
    const [url, init] = providerFetch.mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect((init as RequestInit).body).toBeInstanceOf(FormData);
  });

  it("an oversized clip is refused before transcription", async () => {
    const s = await begin();
    const res = await turn(voiceReq(s.state, new Blob([new Uint8Array(AI_PATIENT_LIMITS.maxAudioBytes + 1)], { type: "audio/webm" })));
    expect(res.status).toBe(413);
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("silence is reported as nothing heard, and no patient reply is generated", async () => {
    providerFetch.mockResolvedValueOnce(Response.json({ text: "   " }));
    const s = await begin();
    const res = await turn(voiceReq(s.state, new Blob([new Uint8Array(4000)], { type: "audio/mp4" })));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "nothing_heard" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("a transcription outage is a recoverable failure, not a silent empty turn", async () => {
    providerFetch.mockResolvedValueOnce(new Response("down", { status: 503 }));
    const s = await begin();
    const res = await turn(voiceReq(s.state, new Blob([new Uint8Array(4000)], { type: "audio/webm" })));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "transcription_failed" });
  });
});

describe("[AI patient] the patient's voice", () => {
  it("speaks only a patient line already in the sealed transcript", async () => {
    mockCreate.mockResolvedValueOnce(reply("It just seems like a lot."));
    const s = await begin();
    const after = await (await turn(json({ state: s.state, text: "Tell me more?" }))).json();
    providerFetch.mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "audio/mpeg" } }));
    const ok = await speech(json({ state: after.state, index: 2 }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("Content-Type")).toBe("audio/mpeg");
    const sent = JSON.parse(String((providerFetch.mock.calls[0]![1] as RequestInit).body)) as { input: string; model: string };
    expect(sent.input).toBe("It just seems like a lot.");
    // The learner's own line (index 1) is not something BTY will voice.
    expect((await speech(json({ state: after.state, index: 1 }))).status).toBe(400);
    expect((await speech(json({ state: after.state, index: 99 }))).status).toBe(400);
  });
});

describe("[AI patient] coaching feedback", () => {
  const modelFeedback = {
    observations: FEEDBACK_BEHAVIORS.map((b) =>
      b.key === "open_question"
        ? { key: b.key, status: "seen", quotes: ["What feels hardest about it?"], note: "You opened with a question." }
        : b.key === "no_pressure"
          ? { key: b.key, status: "seen", quotes: ["I never pushed you"], note: "Claimed without evidence." }
          : { key: b.key, status: "not_seen", quotes: [], note: "" },
    ),
    concerns: [{ kind: "insurance_guarantee", quote: "your insurance will cover it all", explanation: "Coverage was not confirmed." }],
    concernSurfaced: { status: "yes", quote: "What feels hardest about it?" },
    nextStep: "Ask what makes it hard before you explain the estimate.",
  };

  it("is evidence-checked against the transcript and asks the model for strict JSON", async () => {
    mockCreate
      .mockResolvedValueOnce(reply("Money's tight."))
      .mockResolvedValueOnce(reply("Really? All of it?"))
      .mockResolvedValueOnce(reply(JSON.stringify(modelFeedback)))
      .mockResolvedValueOnce(reply(JSON.stringify({ findings: [] })));
    let s = await begin();
    s = await (await turn(json({ state: s.state, text: "What feels hardest about it?" }))).json();
    s = await (await turn(json({ state: s.state, text: "Don't worry, your insurance will cover it all." }))).json();
    const res = await feedback(json({ state: s.state }));
    expect(res.status).toBe(200);
    const { feedback: f } = await res.json();
    expect(f.observations.find((o: { key: string }) => o.key === "open_question").status).toBe("seen");
    // Claimed, but the learner never said it: not credited.
    expect(f.observations.find((o: { key: string }) => o.key === "no_pressure").status).toBe("unclear");
    expect(f.concerns).toEqual([{ kind: "insurance_guarantee", quote: "your insurance will cover it all", explanation: "Coverage was not confirmed.", quoteVerified: true, source: "coach" }]);
    expect(f.safetyScreen).toBe("ran");
    expect(f.suggestMentorReview).toBe(true);
    expect(["a real money limit", "doubt about whether the crown is needed"]).toContain(f.hiddenConcern.label);
    const call = mockCreate.mock.calls[2]![0] as { response_format: { type: string; json_schema: { strict: boolean } } };
    expect(call.response_format.type).toBe("json_schema");
    expect(call.response_format.json_schema.strict).toBe(true);
    expect(JSON.stringify(f)).not.toMatch(/\bscore\b|\bgrade\b|\bpercent/i);
  });

  it("has nothing to review before the learner has said anything", async () => {
    const s = await begin();
    const res = await feedback(json({ state: s.state }));
    expect(res.status).toBe(422);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("the safety screen flags a line the coach missed; that line is never credited, and its area is not credited", async () => {
    const undermining = "Honestly the crack is tiny, Dr. Patel is just being cautious; you could wait a couple of years.";
    const coachMissedIt = {
      ...modelFeedback,
      observations: FEEDBACK_BEHAVIORS.map((b) =>
        b.key === "referred_clinical" || b.key === "found_concern"
          ? { key: b.key, status: "seen", quotes: [undermining], note: "Credited by mistake." }
          : { key: b.key, status: "not_seen", quotes: [], note: "" },
      ),
      concerns: [],
      concernSurfaced: { status: "yes", quote: undermining },
    };
    mockCreate
      .mockResolvedValueOnce(reply("Oh. So I could wait?"))
      .mockResolvedValueOnce(reply(JSON.stringify(coachMissedIt)))
      .mockResolvedValueOnce(reply(JSON.stringify({ findings: [{ line: 1, kind: "clinical_misrepresentation", explanation: "You second-guessed the dentist." }, { line: 0, kind: "other", explanation: "Not a TC line." }] })));
    let s = await begin();
    s = await (await turn(json({ state: s.state, text: undermining }))).json();
    const { feedback: f } = await (await feedback(json({ state: s.state }))).json();
    expect(f.concerns).toEqual([{ kind: "clinical_misrepresentation", quote: undermining, explanation: "You second-guessed the dentist.", quoteVerified: true, source: "screen" }]);
    const obs = (k: string) => f.observations.find((o: { key: string }) => o.key === k);
    expect(obs("referred_clinical").status).toBe("not_seen"); // blocked by the concern's area
    expect(obs("found_concern").status).toBe("unclear"); // its only evidence was the flagged line
    expect(f.concernSurfaced.status).toBe("unclear");
    expect(f.suggestMentorReview).toBe(true);
    const screenCall = mockCreate.mock.calls[2]![0] as { model: string; messages: Array<{ content: string }> };
    expect(screenCall.messages[1]!.content).toContain(`LINE 1: ${undermining}`);
    expect(screenCall.messages[0]!.content).toMatch(/insurance company has NOT confirmed coverage/);
  });

  it("when the safety screen fails, feedback still arrives and says the check did not run", async () => {
    mockCreate
      .mockResolvedValueOnce(reply("Okay."))
      .mockResolvedValueOnce(reply(JSON.stringify(modelFeedback)))
      .mockRejectedValueOnce(new Error("timeout"));
    let s = await begin();
    s = await (await turn(json({ state: s.state, text: "What feels hardest about it?" }))).json();
    const res = await feedback(json({ state: s.state }));
    expect(res.status).toBe(200);
    expect((await res.json()).feedback.safetyScreen).toBe("unavailable");
  });

  it("an unreadable model answer is reported, never replaced with made-up feedback", async () => {
    mockCreate.mockResolvedValueOnce(reply("Fine.")).mockResolvedValueOnce(reply("not json at all")).mockResolvedValueOnce(reply(JSON.stringify({ findings: [] })));
    let s = await begin();
    s = await (await turn(json({ state: s.state, text: "What's on your mind?" }))).json();
    const res = await feedback(json({ state: s.state }));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "feedback_unreadable" });
  });
});

describe("[AI patient] Founder-only pilot access", () => {
  it("is closed by default: with no allowlist configured, nobody can start", async () => {
    vi.stubEnv("AI_PATIENT_ALLOWED_USER_IDS", "");
    const res = await start(json({ acknowledged: true }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "ai_patient_not_enabled" });
  });

  it("refuses a signed-in user who is not on the allowlist on EVERY route, before any paid call", async () => {
    const s = await begin(); // user-a is allowed
    gateUser = "user-b";
    for (const res of [
      await start(json({ acknowledged: true })),
      await turn(json({ state: s.state, text: "hello" })),
      await speech(json({ state: s.state, index: 0 })),
      await feedback(json({ state: s.state })),
    ]) {
      expect(res.status).toBe(403);
    }
    expect(mockCreate).not.toHaveBeenCalled();
    expect(providerFetch).not.toHaveBeenCalled();
    expect(budgetCalls.filter((b) => b.identifier === "user-b")).toEqual([]); // refused before budgeting
  });

  it("tells the Practice screen whether to show the door — and only that", async () => {
    expect(await (await access()).json()).toEqual({ enabled: true });
    gateUser = "user-b";
    expect(await (await access()).json()).toEqual({ enabled: false });
    gateUser = null;
    expect((await access()).status).toBe(401);
    expect(budgetCalls).toEqual([]);
  });
});

describe("[AI patient] replay and cost are bounded per user", () => {
  it("every paid action spends the user's own budget, in short and daily windows", async () => {
    mockCreate.mockResolvedValue(reply("Okay."));
    const s = await begin();
    await turn(json({ state: s.state, text: "Hi" }));
    expect(budgetCalls.map((b) => b.endpoint)).toEqual(["ai-patient:start:3600", "ai-patient:start:86400", "ai-patient:turn:600", "ai-patient:turn:86400"]);
    expect(new Set(budgetCalls.map((b) => b.identifier))).toEqual(new Set(["user-a"]));
  });

  it("replaying the same sealed state is counted every time, and refused once the budget is spent", async () => {
    mockCreate.mockResolvedValue(reply("Okay."));
    const s = await begin();
    for (let i = 0; i < 3; i++) expect((await turn(json({ state: s.state, text: "Same old state" }))).status).toBe(200);
    expect(budgetCalls.filter((b) => b.endpoint === "ai-patient:turn:600")).toHaveLength(3);
    budgetRefuse = "ai-patient:turn";
    const res = await turn(json({ state: s.state, text: "Same old state" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    expect(mockCreate).toHaveBeenCalledTimes(3); // the refused replay cost nothing
  });

  it("an exhausted budget refuses speech and feedback before any provider call", async () => {
    const s = await begin();
    budgetRefuse = "ai-patient:speech";
    expect((await speech(json({ state: s.state, index: 0 }))).status).toBe(429);
    budgetRefuse = "ai-patient:feedback";
    expect((await feedback(json({ state: s.state }))).status).toBe(429);
    expect(providerFetch).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

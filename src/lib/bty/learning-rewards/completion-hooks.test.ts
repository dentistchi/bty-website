import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({ userId: "canonical-user" as string | null, consent: true, db: {} as object, canonicalOk: true, order: [] as string[], reward: undefined as unknown }));
const sync = vi.hoisted(() => vi.fn());
const save = vi.hoisted(() => vi.fn());
vi.mock("@/lib/bty/learning-rewards/service.server", () => ({ syncLearningRewardsIfEnabled: sync }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => state.db }));
vi.mock("@/lib/bty/arena/supabaseServer", () => ({ getSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.userId ? { id: state.userId } : null } }) } }) }));
vi.mock("@/lib/authz", () => ({ requireUser: async () => state.userId ? { ok: true, user: { id: state.userId } } : { ok: false, status: 401 }, requirePlatformAdmin: vi.fn(), isActivePlatformAdmin: vi.fn() }));
vi.mock("@/lib/legal/activeConsent", () => ({ isConsentCurrent: async () => state.consent, consentRequiredResponse: () => new Response(JSON.stringify({ ok: false, error: "consent_required" }), { status: 403 }) }));
vi.mock("@/lib/bty/foundry/events/foundryTrainingService", () => ({ completeTraining: save }));
vi.mock("@/lib/bty/foundry/events/foundryDocumentService", () => ({ completeDocumentTraining: save }));
vi.mock("@/lib/bty/foundry/events/foundryGuidanceService", () => ({ completeGuidanceTraining: save, resolveGuidanceType: async () => "written_guidance" }));
vi.mock("@/lib/bty/foundry/events/foundryFollowupService", () => ({ submitFollowupOutcome: save }));
vi.mock("@/lib/bty/clinical-pilot/service.server", () => ({ authorCases: [], createPilot: save, mutatePilot: save, publicDiscoveryCase: vi.fn(), readOwnPilot: vi.fn(), reviewPilots: vi.fn() }));
vi.mock("@/lib/bty/clinical-pilot/model-check.server", () => ({ checkDiscoveryModel: vi.fn() }));
vi.mock("@/lib/bty/clinical-pilot/founder-preview.server", () => ({ isClinicalFounder: vi.fn() }));
vi.mock("@/lib/bty/foundry/events/publicRoute", () => ({ jsonNoStore: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Cache-Control": "no-store" } }), readParticipantSession: () => "participant-session", PUBLIC_REASON_STATUS: { event_closed: 400 } }));

import { POST as video } from "@/app/api/bty/foundry/public/[token]/progress/complete/route";
import { POST as document } from "@/app/api/bty/foundry/public/[token]/doc/complete/route";
import { POST as guidance } from "@/app/api/bty/foundry/public/[token]/guidance/complete/route";
import { POST as followup } from "@/app/api/bty/foundry/followups/[followupId]/respond/route";
import { POST as clinical } from "@/app/api/bty/clinical-pilot/route";
const request = (body = {}) => new NextRequest("https://bty.test/complete", { method: "POST", body: JSON.stringify(body) });
const context = { params: Promise.resolve({ token: "safe-token" }) };
const identity = { traceId: "11111111-1111-4111-8111-111111111111", requestId: "22222222-2222-4222-8222-222222222222" };
const receipt = { status: "synced", xpAwarded: 10, awards: [{ xp: 10, disposition: "awarded" }], newAchievements: [] };

beforeEach(() => {
  state.userId = "canonical-user"; state.consent = true; state.canonicalOk = true; state.order = []; state.reward = undefined;
  vi.stubEnv("CLINICAL_AUTHOR_PILOT_ENABLED", "1");
  save.mockReset(); sync.mockReset();
  save.mockImplementation(async () => { state.order.push("canonical-save"); return state.canonicalOk ? { ok: true, snapshot: { stage: "completed_awarded" }, result: "responded", status: "RESPONDED", outcome: "BLOCKED", canCheckInAgain: true, phase: "completed" } : { ok: false, reason: "event_closed", result: "not_found" }; });
  sync.mockImplementation(async () => { state.order.push("reward-sync"); return state.reward; });
});
afterEach(() => vi.unstubAllEnvs());

describe("Learning Rewards completion hooks · committed evidence first", () => {
  it.each([["video", video], ["document", document], ["guidance", guidance]] as const)("%s completion reconciles only after the signed-in canonical save, and returns the receipt", async (_label, handler) => {
    state.reward = receipt;
    const response = await handler(request({ response_text: "Own wording", userId: "attacker", xp: 999 }), context);
    expect(response.status).toBe(200);
    expect((await response.json()).learningRewards).toEqual(receipt);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(state.order).toEqual(["canonical-save", "reward-sync"]);
    expect(sync).toHaveBeenCalledWith(state.db, "canonical-user");
  });

  it.each([["video", video], ["document", document], ["guidance", guidance]] as const)("%s completion preserves the existing response when rewards are disabled", async (_label, handler) => {
    const body = await (await handler(request(), context)).json();
    expect(body.ok).toBe(true);
    expect(body.learningRewards).toBeUndefined();
    expect(body.stage).toBe("completed_awarded");
  });

  it.each([["video", video], ["document", document], ["guidance", guidance]] as const)("%s anonymous completion creates no account reward", async (_label, handler) => {
    state.userId = null;
    expect((await handler(request(), context)).status).toBe(200);
    expect(sync).not.toHaveBeenCalled();
  });

  it.each([["video", video], ["document", document], ["guidance", guidance]] as const)("%s canonical refusal performs no reconciliation", async (_label, handler) => {
    state.canonicalOk = false;
    expect((await handler(request(), context)).status).toBe(400);
    expect(sync).not.toHaveBeenCalled();
  });

  it.each([["video", video], ["document", document], ["guidance", guidance]] as const)("%s reward failure leaves a successful saved completion and an honest pending receipt", async (_label, handler) => {
    sync.mockRejectedValue(new Error("reward outage"));
    const response = await handler(request(), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, stage: "completed_awarded", learningRewards: { status: "pending" } });
  });

  it("clinical reaction reconciles after mutation using the canonical account", async () => {
    state.reward = receipt;
    const response = await clinical(request({ ...identity, operation: "react", reaction: { helpful: "no", comment: "", revisedPlan: "" } }));
    expect(response.status).toBe(200);
    expect((await response.json()).learningRewards).toEqual(receipt);
    expect(state.order).toEqual(["canonical-save", "reward-sync"]);
    expect(sync).toHaveBeenCalledWith(state.db, "canonical-user");
  });

  it("clinical conclusion/reference release alone does not award practice", async () => {
    const response = await clinical(request({ ...identity, operation: "conclude", expectedEventCount: 1, text: "Independent assessment" }));
    expect(response.status).toBe(200);
    expect(sync).not.toHaveBeenCalled();
  });

  it("clinical reaction reward outage cannot invalidate the committed trace", async () => {
    sync.mockRejectedValue(new Error("reward outage"));
    const response = await clinical(request({ ...identity, operation: "react", reaction: { helpful: "yes", comment: "", revisedPlan: "" } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, trace: { phase: "completed" }, learningRewards: { status: "pending" } });
  });

  it("a refused clinical mutation cannot synchronize rewards", async () => {
    save.mockRejectedValue(new Error("SAVE_FAILED"));
    expect((await clinical(request({ ...identity, operation: "react", reaction: { helpful: "yes", comment: "", revisedPlan: "" } }))).status).toBe(503);
    expect(sync).not.toHaveBeenCalled();
  });

  it("an unauthenticated clinical request cannot synchronize rewards", async () => {
    state.userId = null;
    expect((await clinical(request({ ...identity, operation: "react", reaction: { helpful: "yes", comment: "", revisedPlan: "" } }))).status).toBe(401);
    expect(sync).not.toHaveBeenCalled();
  });

  it("follow-up outcome saves before reward reconciliation, including a blocked result", async () => {
    state.reward = receipt;
    const response = await followup(request({ outcome: "BLOCKED" }), { params: Promise.resolve({ followupId: "followup-1" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, outcome: "BLOCKED", learningRewards: receipt });
    expect(state.order).toEqual(["canonical-save", "reward-sync"]);
    expect(sync).toHaveBeenCalledWith(state.db, "canonical-user");
  });

  it("follow-up reward failure preserves the outcome and exposes pending reconciliation", async () => {
    sync.mockRejectedValue(new Error("reward outage"));
    const response = await followup(request({ outcome: "BLOCKED" }), { params: Promise.resolve({ followupId: "followup-1" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, outcome: "BLOCKED", learningRewards: { status: "pending" } });
  });

  it("unowned/unknown follow-up does not trigger reward reconciliation", async () => {
    state.canonicalOk = false;
    expect((await followup(request({ outcome: "BLOCKED" }), { params: Promise.resolve({ followupId: "followup-1" }) })).status).toBe(404);
    expect(sync).not.toHaveBeenCalled();
  });

  it("a follow-up without consent does not save or synchronize", async () => {
    state.consent = false;
    expect((await followup(request({ outcome: "BLOCKED" }), { params: Promise.resolve({ followupId: "followup-1" }) })).status).toBe(403);
    expect(save).not.toHaveBeenCalled(); expect(sync).not.toHaveBeenCalled();
  });
});

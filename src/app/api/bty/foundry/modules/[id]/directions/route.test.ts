import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

/**
 * Direction Copilot route — proves the Host gate, non-disclosing ownership, draft
 * editability, request validation, the stale-problem guard, rate limiting, that
 * generation NEVER mutates the draft, and fail-closed error mapping. The domain
 * compatibility check and PROBLEM_MAX run for real (not mocked).
 */
const currentUser = vi.fn<() => { id: string } | null>();
const hostActive = vi.fn<() => boolean>();
const getOwnerDraft = vi.fn();
const generateDirections = vi.fn();
const rateLimitKV = vi.fn();
const updateDraftStep = vi.fn(); // must never be called by this route

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: async () => ({ user: currentUser(), base: NextResponse.json({ ok: true }) }),
  unauthenticated: () => NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }),
  copyCookiesAndDebug: () => {},
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("@/lib/bty/foundry/events/foundryHostService", () => ({
  isActiveFoundryHost: async () => hostActive(),
}));
vi.mock("@/lib/bty/foundry/events/foundryModuleService", () => ({
  getOwnerDraft: (...a: unknown[]) => getOwnerDraft(...a),
  updateDraftStep: (...a: unknown[]) => updateDraftStep(...a),
}));
vi.mock("@/lib/bty/foundry/events/directionCopilotService", () => ({
  generateDirections: (...a: unknown[]) => generateDirections(...a),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimitKV: (...a: unknown[]) => rateLimitKV(...a),
  getCfClientIp: () => "1.2.3.4",
}));

let POST: typeof import("./route").POST;

beforeAll(async () => {
  ({ POST } = await import("./route"));
});

const SAVED_PROBLEM = "Handoffs at shift change keep missing the double-check step.";

const DRAFT = {
  id: "d-1",
  owner_user_id: "owner-1",
  status: "draft",
  current_step: 1,
  answers: { problem: SAVED_PROBLEM },
};

const OK_SUGGESTIONS = [
  { id: "direction_1", title: "A", capability_candidate: "Cap A", rationale: "r", observable_behavior: "b", success_evidence_hint: "e", important_assumption: null },
  { id: "direction_2", title: "B", capability_candidate: "Cap B", rationale: "r", observable_behavior: "b", success_evidence_hint: "e", important_assumption: null },
  { id: "direction_3", title: "C", capability_candidate: "Cap C", rationale: "r", observable_behavior: "b", success_evidence_hint: "e", important_assumption: null },
];

beforeEach(() => {
  currentUser.mockReset();
  hostActive.mockReset();
  getOwnerDraft.mockReset();
  generateDirections.mockReset();
  rateLimitKV.mockReset();
  updateDraftStep.mockReset();
  currentUser.mockReturnValue({ id: "owner-1" });
  hostActive.mockReturnValue(true);
  getOwnerDraft.mockResolvedValue(DRAFT);
  rateLimitKV.mockResolvedValue({ allowed: true });
  generateDirections.mockResolvedValue({ ok: true, suggestions: OK_SUGGESTIONS, version: "direction_copilot_v1" });
});

function req(body?: unknown) {
  return new NextRequest("http://localhost/api/bty/foundry/modules/d-1/directions", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://x" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const params = { params: Promise.resolve({ id: "d-1" }) };
const goodBody = { problem_statement: SAVED_PROBLEM, locale: "en" };

describe("POST /modules/[id]/directions", () => {
  it("401s unauthenticated (no generation)", async () => {
    currentUser.mockReturnValue(null);
    const res = await POST(req(goodBody), params);
    expect(res.status).toBe(401);
    expect(generateDirections).not.toHaveBeenCalled();
  });

  it("403s a non-Host", async () => {
    hostActive.mockReturnValue(false);
    expect((await POST(req(goodBody), params)).status).toBe(403);
    expect(generateDirections).not.toHaveBeenCalled();
  });

  it("404 non-disclosing for a foreign/missing draft", async () => {
    getOwnerDraft.mockResolvedValue(null);
    const res = await POST(req(goodBody), params);
    expect(res.status).toBe(404);
    expect(generateDirections).not.toHaveBeenCalled();
  });

  it("409 when the draft is not editable (approved/published)", async () => {
    getOwnerDraft.mockResolvedValue({ ...DRAFT, status: "approved" });
    const res = await POST(req(goodBody), params);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("draft_not_editable");
    expect(generateDirections).not.toHaveBeenCalled();
  });

  it("400 on a missing/empty problem statement", async () => {
    expect((await POST(req({ locale: "en" }), params)).status).toBe(400);
    expect((await POST(req({ problem_statement: "   " }), params)).status).toBe(400);
    expect(generateDirections).not.toHaveBeenCalled();
  });

  it("400 on an over-long problem statement", async () => {
    const res = await POST(req({ problem_statement: "x".repeat(2001) }), params);
    expect(res.status).toBe(400);
    expect(generateDirections).not.toHaveBeenCalled();
  });

  it("409 problem_mismatch when the request problem drifted from the saved draft (stale guard)", async () => {
    const res = await POST(req({ problem_statement: "A completely different problem." }), params);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("problem_mismatch");
    expect(generateDirections).not.toHaveBeenCalled();
  });

  it("429 when rate limited (no generation)", async () => {
    rateLimitKV.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });
    const res = await POST(req(goodBody), params);
    expect(res.status).toBe(429);
    expect((await res.json()).retry_after).toBe(30);
    expect(generateDirections).not.toHaveBeenCalled();
  });

  it("200 returns validated suggestions and NEVER mutates the draft", async () => {
    const res = await POST(req(goodBody), params);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.suggestions).toHaveLength(3);
    expect(json.generation_version).toBe("direction_copilot_v1");
    expect(generateDirections).toHaveBeenCalledWith({ problemStatement: SAVED_PROBLEM, locale: "en" });
    expect(updateDraftStep).not.toHaveBeenCalled();
  });

  it("tolerates trivial whitespace/case drift via the compatibility check", async () => {
    const res = await POST(req({ problem_statement: `  ${SAVED_PROBLEM.toUpperCase()}  `, locale: "ko" }), params);
    expect(res.status).toBe(200);
    expect(generateDirections).toHaveBeenCalledWith({ problemStatement: expect.any(String), locale: "ko" });
  });

  it("maps provider_unavailable → 503, timeout → 504, invalid_output → 502 (fail-closed)", async () => {
    generateDirections.mockResolvedValue({ ok: false, code: "provider_unavailable" });
    expect((await POST(req(goodBody), params)).status).toBe(503);
    generateDirections.mockResolvedValue({ ok: false, code: "timeout" });
    expect((await POST(req(goodBody), params)).status).toBe(504);
    generateDirections.mockResolvedValue({ ok: false, code: "invalid_output" });
    const res = await POST(req(goodBody), params);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("generation_failed");
  });
});

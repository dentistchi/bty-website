import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { moduleDraftContext, moduleDraftContextFingerprint } from "@/domain/foundry/module/module-draft-copilot";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

/**
 * Module-draft route — Host gate, non-disclosing ownership, editability, insufficient
 * + stale context guards, rate limit, zero draft mutation, fail-closed mapping. The
 * domain context/fingerprint runs for real (not mocked).
 */
const currentUser = vi.fn<() => { id: string } | null>();
const hostActive = vi.fn<() => boolean>();
const getOwnerDraft = vi.fn();
const generateModuleDraft = vi.fn();
const rateLimitKV = vi.fn();
const updateDraftStep = vi.fn(); // must never be called

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: async () => ({ user: currentUser(), base: NextResponse.json({ ok: true }) }),
  unauthenticated: () => NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }),
  copyCookiesAndDebug: () => {},
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("@/lib/bty/foundry/events/foundryHostService", () => ({ isActiveFoundryHost: async () => hostActive() }));
vi.mock("@/lib/bty/foundry/events/foundryModuleService", () => ({
  getOwnerDraft: (...a: unknown[]) => getOwnerDraft(...a),
  updateDraftStep: (...a: unknown[]) => updateDraftStep(...a),
}));
vi.mock("@/lib/bty/foundry/events/moduleDraftCopilotService", () => ({
  generateModuleDraft: (...a: unknown[]) => generateModuleDraft(...a),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimitKV: (...a: unknown[]) => rateLimitKV(...a),
  getCfClientIp: () => "1.2.3.4",
}));

let POST: typeof import("./route").POST;
beforeAll(async () => {
  ({ POST } = await import("./route"));
});

const ANSWERS: BuilderAnswers = {
  problem: "Handoffs skip the double-check.",
  audienceType: "everyone",
  observableBehavior: "The charge nurse reads the dosage back before sign-off.",
  successEvidence: "Sign-offs include a witnessed read-back.",
};
const FINGERPRINT = moduleDraftContextFingerprint(moduleDraftContext(ANSWERS)!);

const DRAFT = { id: "d-1", owner_user_id: "owner-1", status: "draft", current_step: 5, answers: ANSWERS };

const OK_RESULT = {
  ok: true,
  value: {
    module_draft: {
      learning_approach: ["practice"],
      learning_approach_rationale: "r",
      completion_question: "Before sign-off, what phrase will you use to confirm the read-back?",
      arena_recommended: true,
      arena_rationale: "r",
      follow_up_days: 7,
      follow_up_guidance: "g",
      material_guidance: { recommended_types: ["written"], suggestion: "s" },
    },
    assumptions: [],
    warnings: [],
  },
  version: "module_draft_copilot_v1",
};

beforeEach(() => {
  currentUser.mockReset();
  hostActive.mockReset();
  getOwnerDraft.mockReset();
  generateModuleDraft.mockReset();
  rateLimitKV.mockReset();
  updateDraftStep.mockReset();
  currentUser.mockReturnValue({ id: "owner-1" });
  hostActive.mockReturnValue(true);
  getOwnerDraft.mockResolvedValue(DRAFT);
  rateLimitKV.mockResolvedValue({ allowed: true });
  generateModuleDraft.mockResolvedValue(OK_RESULT);
});

function req(body?: unknown) {
  return new NextRequest("http://localhost/api/bty/foundry/modules/d-1/module-draft", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://x" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const params = { params: Promise.resolve({ id: "d-1" }) };
const goodBody = { locale: "en", context_fingerprint: FINGERPRINT };

describe("POST /modules/[id]/module-draft", () => {
  it("401s unauthenticated (no generation)", async () => {
    currentUser.mockReturnValue(null);
    expect((await POST(req(goodBody), params)).status).toBe(401);
    expect(generateModuleDraft).not.toHaveBeenCalled();
  });

  it("403s a non-Host", async () => {
    hostActive.mockReturnValue(false);
    expect((await POST(req(goodBody), params)).status).toBe(403);
    expect(generateModuleDraft).not.toHaveBeenCalled();
  });

  it("404 non-disclosing for a foreign/missing draft", async () => {
    getOwnerDraft.mockResolvedValue(null);
    expect((await POST(req(goodBody), params)).status).toBe(404);
    expect(generateModuleDraft).not.toHaveBeenCalled();
  });

  it("409 when the draft is not editable", async () => {
    getOwnerDraft.mockResolvedValue({ ...DRAFT, status: "approved" });
    const res = await POST(req(goodBody), params);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("draft_not_editable");
  });

  it("422 when the canonical minimum context is incomplete", async () => {
    getOwnerDraft.mockResolvedValue({ ...DRAFT, answers: { problem: "only this" } });
    const res = await POST(req(goodBody), params);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("insufficient_context");
    expect(generateModuleDraft).not.toHaveBeenCalled();
  });

  it("409 context_mismatch when the client fingerprint is stale", async () => {
    const res = await POST(req({ locale: "en", context_fingerprint: "stale-different" }), params);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("context_mismatch");
    expect(generateModuleDraft).not.toHaveBeenCalled();
  });

  it("429 when rate limited (no generation)", async () => {
    rateLimitKV.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });
    const res = await POST(req(goodBody), params);
    expect(res.status).toBe(429);
    expect(generateModuleDraft).not.toHaveBeenCalled();
  });

  it("200 returns validated advisory data, generates from the SERVER context, and NEVER mutates", async () => {
    const res = await POST(req(goodBody), params);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.module_draft.follow_up_days).toBe(7);
    expect(json.generation_version).toBe("module_draft_copilot_v1");
    // generated from the server-reconstructed context (not client-supplied)
    const call = generateModuleDraft.mock.calls[0][0];
    expect(call.observableBehavior).toBe(ANSWERS.observableBehavior);
    expect(updateDraftStep).not.toHaveBeenCalled();
  });

  it("maps provider_unavailable → 503, timeout → 504, invalid_output → 502", async () => {
    generateModuleDraft.mockResolvedValue({ ok: false, code: "provider_unavailable" });
    expect((await POST(req(goodBody), params)).status).toBe(503);
    generateModuleDraft.mockResolvedValue({ ok: false, code: "timeout" });
    expect((await POST(req(goodBody), params)).status).toBe(504);
    generateModuleDraft.mockResolvedValue({ ok: false, code: "invalid_output" });
    expect((await POST(req(goodBody), params)).status).toBe(502);
  });
});

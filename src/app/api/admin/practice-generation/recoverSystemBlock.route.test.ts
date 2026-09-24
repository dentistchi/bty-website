import { describe, expect, it, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Slice Practice Generation System-Block Recovery V1 — the OPERATOR surface.
 *
 * Recovery is operator/system authority. These prove the gate is the canonical platform-admin
 * grant and nothing else, and that the attempt is always named rather than inferred.
 */

const authz = vi.hoisted(() => ({ requirePlatformAdmin: vi.fn() }));
vi.mock("@/lib/authz", () => authz);
const svc = vi.hoisted(() => ({ recoverPracticeGenerationSystemBlock: vi.fn() }));
vi.mock("@/lib/bty/foundry/arena/practiceGenerationRecovery.server", () => svc);
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({}) }));

import { POST } from "./recover-system-block/route";

const BODY = {
  draftId: "af921b9d-19b1-4673-a0ff-9753ecd581b1",
  blockedAttemptId: "29cfe46e-4b13-4c08-a4a2-9f639eb55195",
  recoveryReasonCode: "boundary_repair_group_expansion_fixed",
  fixedInDeploySha: "d3329f2f966dccfbd4749a823fc711bff9091734",
};
const req = (body: unknown) =>
  ({ json: async () => body } as unknown as Parameters<typeof POST>[0]);

beforeEach(() => {
  vi.clearAllMocks();
  authz.requirePlatformAdmin.mockResolvedValue({ ok: true, user: { id: "admin-1" } });
  svc.recoverPracticeGenerationSystemBlock.mockResolvedValue({
    ok: true, recoveryId: "rec-1", blockedAttemptId: BODY.blockedAttemptId, draftId: BODY.draftId,
    grantedAt: "2026-09-25T00:00:00Z", alreadyRecovered: false,
    governanceState: "ready", canStartGeneration: true,
  });
});

describe("I/J — authority", () => {
  it("a platform admin may recover, and the granter is the SESSION's id", async () => {
    const res = await POST(req(BODY));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, governanceState: "ready", canStartGeneration: true });
    expect(svc.recoverPracticeGenerationSystemBlock.mock.calls[0][1].grantedByUserId).toBe("admin-1");
  });

  it("a non-admin is refused before anything is attempted", async () => {
    authz.requirePlatformAdmin.mockResolvedValue({ ok: false, status: 403, error: "Forbidden" });
    const res = await POST(req(BODY));
    expect(res.status).toBe(403);
    expect(svc.recoverPracticeGenerationSystemBlock).not.toHaveBeenCalled();
  });

  it("the body can never name its own granter", async () => {
    await POST(req({ ...BODY, grantedByUserId: "someone-else", granted_by_user_id: "someone-else" }));
    expect(svc.recoverPracticeGenerationSystemBlock.mock.calls[0][1].grantedByUserId).toBe("admin-1");
  });
});

describe("the attempt is named, never inferred", () => {
  it("refuses a request that omits the blocked attempt", async () => {
    const { blockedAttemptId: _drop, ...without } = BODY;
    const res = await POST(req(without));
    expect(res.status).toBe(400);
    expect(svc.recoverPracticeGenerationSystemBlock).not.toHaveBeenCalled();
  });

  it("has no 'latest blocked attempt' form anywhere in the handler", () => {
    // Comments are stripped first: the handler EXPLAINS why no such form exists, and an
    // explanation of a rule must not read as a violation of it.
    const src = readFileSync(join(process.cwd(), "src/app/api/admin/practice-generation/recover-system-block/route.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/latest|order\(|most_recent/i);
  });

  it("validates ids and shas before reaching the service", async () => {
    for (const bad of [
      { ...BODY, draftId: "not-a-uuid" },
      { ...BODY, blockedAttemptId: "nope" },
      { ...BODY, fixedInDeploySha: "short" },
      { ...BODY, recoveryReasonCode: "" },
      { ...BODY, supportReference: "zzzz" },
    ]) {
      const res = await POST(req(bad));
      expect(res.status, JSON.stringify(bad).slice(0, 60)).toBe(400);
    }
    expect(svc.recoverPracticeGenerationSystemBlock).not.toHaveBeenCalled();
  });
});

describe("refusals reach the operator by name", () => {
  it.each([
    ["source_identity_unavailable", 503],
    ["blocked_attempt_not_found", 404],
    ["attempt_draft_mismatch", 404],
    ["attempt_not_system_block", 409],
    ["blocked_attempt_source_identity_unavailable", 409],
    ["source_identity_unchanged", 409],
  ])("%s → %i", async (reason, status) => {
    svc.recoverPracticeGenerationSystemBlock.mockResolvedValue({ ok: false, reason });
    const res = await POST(req(BODY));
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: reason });
  });

  it("returns no draft content, scenario or reviewer output", async () => {
    const body = await (await POST(req(BODY))).json();
    expect(Object.keys(body).sort()).toEqual(
      ["alreadyRecovered", "blockedAttemptId", "canStartGeneration", "draftId", "governanceState", "grantedAt", "ok", "recoveryId"],
    );
  });
});

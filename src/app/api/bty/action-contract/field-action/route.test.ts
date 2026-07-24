import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireUser = vi.fn();
const mockEnsure = vi.fn();
const mockLoad = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...a: unknown[]) => mockRequireUser(...a),
  unauthenticated: () => new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 }),
  copyCookiesAndDebug: () => {},
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("@/lib/bty/action-contract/fieldActionProducer.server", () => ({
  ensureFieldActionDraft: (...a: unknown[]) => mockEnsure(...a),
  loadFieldActionContract: (...a: unknown[]) => mockLoad(...a),
}));

import { POST, GET } from "./route";

const postReq = (body: unknown) =>
  new NextRequest("https://x.test/api/bty/action-contract/field-action", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
const getReq = (qs: string) => new NextRequest(`https://x.test/api/bty/action-contract/field-action${qs}`);

describe("field-action producer route", () => {
  beforeEach(() => { mockRequireUser.mockReset(); mockEnsure.mockReset(); mockLoad.mockReset(); });

  it("401 when unauthenticated (POST); service never called", async () => {
    mockRequireUser.mockResolvedValue({ user: null, base: {} });
    const res = await POST(postReq({ eventId: "e1" }));
    expect(res.status).toBe(401);
    expect(mockEnsure).not.toHaveBeenCalled();
  });

  it("POST passes the SERVER-resolved learner id (never client) + eventId to the producer", async () => {
    mockRequireUser.mockResolvedValue({ user: { id: "learner-1" }, base: {} });
    mockEnsure.mockResolvedValue({ ok: true, created: true, contract: { contractId: "c1" } });
    const res = await POST(postReq({ eventId: "e1", user_id: "SPOOF" }));
    expect(res.status).toBe(200);
    expect(mockEnsure).toHaveBeenCalledWith(expect.anything(), { learnerUserId: "learner-1", eventId: "e1" });
  });

  it("POST maps not-owner/not-found to a generic 404 (no existence leak)", async () => {
    mockRequireUser.mockResolvedValue({ user: { id: "learner-1" }, base: {} });
    mockEnsure.mockResolvedValue({ ok: false, code: "progress_not_found" });
    const res = await POST(postReq({ eventId: "e1" }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("NOT_FOUND");
  });

  it("GET loads the learner's own field_action contract for resubmit", async () => {
    mockRequireUser.mockResolvedValue({ user: { id: "learner-1" }, base: {} });
    mockLoad.mockResolvedValue({ ok: true, contract: { contractId: "c9", revisionNote: "fix" } });
    const res = await GET(getReq("?contractId=c9"));
    expect(res.status).toBe(200);
    expect((await res.json()).contract.contractId).toBe("c9");
    expect(mockLoad).toHaveBeenCalledWith(expect.anything(), { learnerUserId: "learner-1", contractId: "c9" });
  });

  it("GET foreign/non-field contract → generic 404", async () => {
    mockRequireUser.mockResolvedValue({ user: { id: "learner-1" }, base: {} });
    mockLoad.mockResolvedValue({ ok: false, code: "not_owner" });
    const res = await GET(getReq("?contractId=c9"));
    expect(res.status).toBe(404);
  });
});

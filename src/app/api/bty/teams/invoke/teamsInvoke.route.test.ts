import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * The Teams invoke route — ordering IS the security model.
 *
 * The claims that matter here are not "does it save", but: nothing is trusted before the token is
 * verified, the written user id comes only from the resolver, and an unresolvable Teams user never
 * causes a write.
 */

const verifyBotFrameworkToken = vi.fn();
const resolveBtyUserFromMicrosoftIdentity = vi.fn();
const ensureActionCapture = vi.fn();

vi.mock("@/lib/bty/teams/botTokenVerifier.server", () => ({ verifyBotFrameworkToken }));
vi.mock("@/lib/bty/identity-link/microsoftIdentityLink.server", () => ({ resolveBtyUserFromMicrosoftIdentity }));
vi.mock("@/lib/bty/action-capture/ensureActionCapture.server", () => ({ ensureActionCapture }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({}) }));

const TID = "11111111-1111-1111-1111-111111111111";
const OID = "22222222-2222-2222-2222-222222222222";
const RESOLVED_USER = "81f08aa1-0000-0000-0000-000000000000";

function req(body: unknown) {
  return new NextRequest("https://arena.btydaily.com/api/bty/teams/invoke", {
    method: "POST",
    headers: { authorization: "Bearer x", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function activity(over: Record<string, unknown> = {}) {
  return {
    name: "composeExtension/fetchTask",
    channelData: { tenant: { id: TID } },
    from: { id: "29:addr", aadObjectId: OID },
    conversation: { id: "19:abc@thread.tacv2" },
    value: { messagePayload: { id: "m1", body: { content: "hi" }, linkToMessage: "https://teams.microsoft.com/l/message/x/m1" } },
    ...over,
  };
}

async function POST(r: NextRequest) {
  const mod = await import("@/app/api/bty/teams/invoke/route");
  return mod.POST(r);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  verifyBotFrameworkToken.mockResolvedValue({ ok: true, payload: {} });
  resolveBtyUserFromMicrosoftIdentity.mockResolvedValue({ status: "RESOLVED", userId: RESOLVED_USER });
  ensureActionCapture.mockResolvedValue({ ok: true, created: true, capture: { id: "c1" } });
});

describe("POST /api/bty/teams/invoke", () => {
  it("an unverified token is 401 and NOTHING downstream runs", async () => {
    verifyBotFrameworkToken.mockResolvedValue({ ok: false, reason: "invalid_token" });
    const res = await POST(req(activity()));
    expect(res.status).toBe(401);
    expect(resolveBtyUserFromMicrosoftIdentity).not.toHaveBeenCalled();
    expect(ensureActionCapture).not.toHaveBeenCalled();
  });

  it("writes ONLY the resolver's user id — a body-supplied user_id is ignored", async () => {
    await POST(req({ ...activity(), user_id: "attacker-owned", userId: "attacker-owned" }));
    expect(ensureActionCapture).toHaveBeenCalledTimes(1);
    const params = ensureActionCapture.mock.calls[0][1];
    expect(params.userId).toBe(RESOLVED_USER);
    expect(JSON.stringify(params)).not.toContain("attacker-owned");
  });

  it("resolves identity from tenant + aadObjectId, never from.id", async () => {
    await POST(req(activity()));
    expect(resolveBtyUserFromMicrosoftIdentity).toHaveBeenCalledWith(expect.anything(), TID, OID);
    expect(resolveBtyUserFromMicrosoftIdentity).not.toHaveBeenCalledWith(expect.anything(), TID, "29:addr");
  });

  it("NOT_LINKED never creates a user and never writes a capture", async () => {
    resolveBtyUserFromMicrosoftIdentity.mockResolvedValue({ status: "NOT_LINKED" });
    const res = await POST(req(activity()));
    expect(ensureActionCapture).not.toHaveBeenCalled();
    expect((await res.json()).task.value).toBe("Sign in to BTY with Microsoft first.");
  });

  it("an ambiguous or failed lookup fails closed without writing", async () => {
    for (const status of ["AMBIGUOUS_IDENTITY", "LOOKUP_FAILED", "INVALID_INPUT"]) {
      vi.clearAllMocks();
      verifyBotFrameworkToken.mockResolvedValue({ ok: true, payload: {} });
      resolveBtyUserFromMicrosoftIdentity.mockResolvedValue({ status });
      const res = await POST(req(activity()));
      expect(ensureActionCapture).not.toHaveBeenCalled();
      expect((await res.json()).task.value).toBe("BTY couldn't save this yet.");
    }
  });

  it("a duplicate save reads as the same calm success", async () => {
    ensureActionCapture.mockResolvedValue({ ok: true, created: false, capture: { id: "c1" } });
    const res = await POST(req(activity()));
    const body = await res.json();
    expect(body.task.value).toBe("Saved to BTY.");
    expect(JSON.stringify(body)).not.toContain("Duplicate");
  });

  it("an unsupported invoke gets a safe refusal, not a general-purpose bot", async () => {
    const res = await POST(req(activity({ name: "message" })));
    expect(ensureActionCapture).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("the reply envelope follows the invoke type", async () => {
    const fetchRes = await POST(req(activity({ name: "composeExtension/fetchTask" })));
    expect((await fetchRes.json()).task.value).toBe("Saved to BTY.");
    const submitRes = await POST(req(activity({ name: "composeExtension/submitAction" })));
    expect((await submitRes.json()).composeExtension.text).toBe("Saved to BTY.");
  });

  it("never returns internal ids or Microsoft identifiers to Teams", async () => {
    const res = await POST(req(activity()));
    const body = JSON.stringify(await res.json());
    for (const secret of [RESOLVED_USER, TID, OID, "c1", "29:addr"]) {
      expect(body).not.toContain(secret);
    }
  });
});

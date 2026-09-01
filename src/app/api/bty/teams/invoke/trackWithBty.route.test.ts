import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Track with BTY — the second message action (Slice A1).
 *
 * The claims: Save to BTY is untouched, the two commands are told apart by `commandId`, opening the
 * dialog writes nothing, and every identity input is server-derived. A client-supplied owner,
 * user id, tenant or email must be incapable of reaching the write.
 */

const verifyBotFrameworkToken = vi.fn();
const resolveBtyUserFromMicrosoftIdentity = vi.fn();
const ensureActionCapture = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/bty/teams/botTokenVerifier.server", () => ({ verifyBotFrameworkToken }));
vi.mock("@/lib/bty/identity-link/microsoftIdentityLink.server", () => ({ resolveBtyUserFromMicrosoftIdentity }));
vi.mock("@/lib/bty/action-capture/ensureActionCapture.server", () => ({ ensureActionCapture }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({ rpc }) }));

const TID = "11111111-1111-1111-1111-111111111111";
const OID = "22222222-2222-2222-2222-222222222222";
const HOST = "81f08aa1-0000-0000-0000-000000000000";
const A = "33333333-3333-3333-3333-333333333333";
const B = "44444444-4444-4444-4444-444444444444";

function activity(over: Record<string, unknown> = {}, value: Record<string, unknown> = {}) {
  return {
    name: "composeExtension/submitAction",
    channelData: { tenant: { id: TID } },
    from: { id: "29:addr", aadObjectId: OID },
    conversation: { id: "19:chan@thread.tacv2" },
    value: {
      commandId: "trackWithBty",
      messagePayload: { id: "m1", body: { content: "PRIVATE CHANNEL BODY" }, linkToMessage: "https://teams.microsoft.com/l/message/x/m1" },
      ...value,
    },
    ...over,
  };
}

function req(body: unknown) {
  return new NextRequest("https://arena.btydaily.com/api/bty/teams/invoke", {
    method: "POST",
    headers: { authorization: "Bearer x", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function POST(r: NextRequest) {
  const mod = await import("@/app/api/bty/teams/invoke/route");
  return mod.POST(r);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  verifyBotFrameworkToken.mockResolvedValue({ ok: true, payload: {} });
  resolveBtyUserFromMicrosoftIdentity.mockResolvedValue({ status: "RESOLVED", userId: HOST });
  ensureActionCapture.mockResolvedValue({ ok: true, created: true, capture: { id: "cap-1" } });
  rpc.mockResolvedValue({ data: [{ announcement_id: "ann-1", resolved_count: 2, already_existed: false }], error: null });
});

describe("the dialog", () => {
  it("fetchTask returns the People Picker card scoped to the CURRENT conversation", async () => {
    const res = await POST(req(activity({ name: "composeExtension/fetchTask" })));
    const body = await res.json();
    const card = body.task.value.card.content;
    const picker = card.body.find((b: { id?: string }) => b.id === "recipients");
    expect(picker["choices.data"]).toEqual({
      type: "Data.Query",
      dataset: "graph.microsoft.com/users?scope=currentContext",
    });
    expect(picker.isMultiSelect).toBe(true);
  });

  it("opening the dialog WRITES NOTHING", async () => {
    await POST(req(activity({ name: "composeExtension/fetchTask" })));
    expect(ensureActionCapture).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("the track submit", () => {
  it("ensures the capture and creates the run from SERVER-derived identity", async () => {
    const res = await POST(
      req(activity({}, { data: { hostFraming: "Please confirm", recipients: `${A},${B}` } })),
    );
    expect(res.status).toBe(200);
    expect(ensureActionCapture).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: HOST }));
    expect(rpc).toHaveBeenCalledWith(
      "bty_track_announcement",
      expect.objectContaining({
        p_owner_user_id: HOST,
        p_source_capture_id: "cap-1",
        p_host_framing: "Please confirm",
        p_tenant_id: TID,
        p_recipient_oids: [A, B],
      }),
    );
    expect(JSON.stringify(await res.json())).toContain("2 people");
  });

  it("IGNORES every identity field a client tries to supply", async () => {
    await POST(
      req(
        activity(
          { user_id: "attacker", owner_user_id: "attacker" },
          {
            data: {
              hostFraming: "x",
              recipients: A,
              user_id: "attacker",
              ownerUserId: "attacker",
              email: "attacker@evil.test",
              organizationId: "org",
              tenantId: "99999999-9999-9999-9999-999999999999",
            },
          },
        ),
      ),
    );
    const args = rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(args.p_owner_user_id).toBe(HOST);
    expect(args.p_tenant_id).toBe(TID);
    const dump = JSON.stringify(args);
    expect(dump).not.toContain("attacker");
    expect(dump).not.toContain("evil.test");
    expect(dump).not.toContain("99999999");
  });

  it("de-duplicates the picked set before it becomes a denominator", async () => {
    await POST(req(activity({}, { data: { hostFraming: "x", recipients: `${A},${A.toUpperCase()},${B}` } })));
    expect((rpc.mock.calls[0]?.[1] as { p_recipient_oids: string[] }).p_recipient_oids).toEqual([A, B]);
  });

  it("refuses empty framing, and writes nothing", async () => {
    const res = await POST(req(activity({}, { data: { hostFraming: "   ", recipients: A } })));
    expect(rpc).not.toHaveBeenCalled();
    expect(ensureActionCapture).not.toHaveBeenCalled();
    expect(JSON.stringify(await res.json())).toContain("what they should know");
  });

  it("refuses zero usable recipients, and writes nothing", async () => {
    const res = await POST(req(activity({}, { data: { hostFraming: "x", recipients: "not-a-guid" } })));
    expect(rpc).not.toHaveBeenCalled();
    expect(JSON.stringify(await res.json())).toContain("at least one person");
  });

  it("a repeat Track returns the SAME run rather than splitting the audience", async () => {
    rpc.mockResolvedValue({
      data: [{ announcement_id: "ann-1", resolved_count: 2, already_existed: true }],
      error: null,
    });
    const res = await POST(req(activity({}, { data: { hostFraming: "x", recipients: `${A},${B}` } })));
    expect(res.status).toBe(200);
    expect(JSON.stringify(await res.json())).toContain("2 people");
  });

  it("never creates an Action Contract, Arena run, XP or Foundry row", async () => {
    await POST(req(activity({}, { data: { hostFraming: "x", recipients: A } })));
    const called = rpc.mock.calls.map((c) => String(c[0]));
    expect(called).toEqual(["bty_track_announcement"]);
    for (const forbidden of ["contract", "arena", "xp", "foundry", "activation", "verification"]) {
      expect(called.some((n) => n.toLowerCase().includes(forbidden)), `must not call ${forbidden}`).toBe(false);
    }
  });
});

describe("Save to BTY is untouched", () => {
  it("still captures, and never reaches the track path", async () => {
    const res = await POST(
      req(activity({ name: "composeExtension/fetchTask" }, { commandId: "saveToBty" })),
    );
    expect(ensureActionCapture).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalled();
    expect(JSON.stringify(await res.json())).toContain("Saved to BTY.");
  });

  it("an activity with NO commandId still behaves as Save — the historical wire", async () => {
    const a = activity({ name: "composeExtension/fetchTask" });
    delete (a.value as Record<string, unknown>).commandId;
    await POST(req(a));
    expect(ensureActionCapture).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("auth ordering is unchanged", () => {
  it("an unverified token reaches nothing, track included", async () => {
    verifyBotFrameworkToken.mockResolvedValue({ ok: false, reason: "invalid_token" });
    const res = await POST(req(activity({}, { data: { hostFraming: "x", recipients: A } })));
    expect(res.status).toBe(401);
    expect(resolveBtyUserFromMicrosoftIdentity).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("an unresolvable Host never tracks and never creates a user", async () => {
    resolveBtyUserFromMicrosoftIdentity.mockResolvedValue({ status: "NOT_LINKED" });
    await POST(req(activity({}, { data: { hostFraming: "x", recipients: A } })));
    expect(rpc).not.toHaveBeenCalled();
    expect(ensureActionCapture).not.toHaveBeenCalled();
  });
});

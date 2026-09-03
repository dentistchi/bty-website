import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { resolveServiceUrl } from "@/domain/teams/invokeActivity";

/**
 * SLICE A0.1 — the routing coordinate, captured and nothing else.
 *
 * The product claim: a recipient who has never opened BTY is never told anything was sent to
 * them, and reaching them later needs a Bot Framework routing base that BTY has always thrown
 * away. This slice keeps it. It must not send anything, must not invent a URL, and must not be
 * able to break the Track that already works.
 *
 * So the tests below are mostly about what does NOT happen.
 */

const verifyBotFrameworkToken = vi.fn();
const resolveBtyUserFromMicrosoftIdentity = vi.fn();
const ensureActionCapture = vi.fn();
const rpc = vi.fn();
const isActiveFoundryHost = vi.fn();

vi.mock("@/lib/bty/teams/botTokenVerifier.server", () => ({ verifyBotFrameworkToken }));
vi.mock("@/lib/bty/identity-link/microsoftIdentityLink.server", () => ({ resolveBtyUserFromMicrosoftIdentity }));
vi.mock("@/lib/bty/action-capture/ensureActionCapture.server", () => ({ ensureActionCapture }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({ rpc }) }));
vi.mock("@/lib/bty/foundry/events/foundryHostService", () => ({
  isActiveFoundryHost: (...a: unknown[]) => isActiveFoundryHost(...a),
}));

const TID = "11111111-1111-1111-1111-111111111111";
const OID = "22222222-2222-2222-2222-222222222222";
const HOST = "81f08aa1-0000-0000-0000-000000000000";
const A = "33333333-3333-3333-3333-333333333333";
const REAL = "https://smba.trafficmanager.net/emea/";

function activity(over: Record<string, unknown> = {}, value: Record<string, unknown> = {}) {
  return {
    name: "composeExtension/submitAction",
    channelData: { tenant: { id: TID } },
    from: { id: "29:addr", aadObjectId: OID },
    conversation: { id: "19:chan@thread.tacv2" },
    value: {
      commandId: "trackWithBty",
      messagePayload: { id: "m1", body: { content: "body" } },
      data: { hostFraming: "Please read this today.", recipients: A },
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

/** The argument the write actually received, or undefined if the RPC never ran. */
const sentServiceUrl = () => rpc.mock.calls.find((c) => c[0] === "bty_track_announcement")?.[1]?.p_service_url;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  verifyBotFrameworkToken.mockResolvedValue({ ok: true, payload: {} });
  resolveBtyUserFromMicrosoftIdentity.mockResolvedValue({ status: "RESOLVED", userId: HOST });
  ensureActionCapture.mockResolvedValue({ ok: true, created: true, capture: { id: "cap-1" } });
  rpc.mockResolvedValue({ data: [{ announcement_id: "ann-1", resolved_count: 1, already_existed: false }], error: null });
  isActiveFoundryHost.mockResolvedValue(true);
});

describe("G1 — a verified Track stores the coordinate it observed", () => {
  it("passes the activity's serviceUrl to the write, exactly as sent", async () => {
    const res = await POST(req(activity({ serviceUrl: REAL })));
    expect(res.status).toBe(200);
    expect(sentServiceUrl()).toBe(REAL);
  });

  it("still tracks, and stores NULL, when Teams sends no serviceUrl at all", async () => {
    // THE OPEN QUESTION. Whether our production invokes carry `serviceUrl` has never been
    // measurable, because nothing ever read the field. Until a real Track answers it, absence
    // must be an ordinary Track that records "not observed" — never a refusal, and never a
    // fabricated endpoint.
    const res = await POST(req(activity()));
    expect(res.status).toBe(200);
    expect(sentServiceUrl()).toBeNull();
    expect(rpc).toHaveBeenCalledWith("bty_track_announcement", expect.objectContaining({ p_recipient_oids: [A] }));
  });

  it("logs WHICH refusal happened, and never the URL", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await POST(req(activity({ serviceUrl: "http://plaintext.example.com/" })));
    const logged = spy.mock.calls.filter((c) => String(c[0]).includes("routing coordinate"));
    expect(logged).toHaveLength(1);
    expect(logged[0][1]).toEqual({ reason: "invalid" });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("plaintext.example.com");
  });
});

describe("E — the coordinate cannot come from anywhere a client controls", () => {
  it("an unverified request persists nothing at all", async () => {
    verifyBotFrameworkToken.mockResolvedValue({ ok: false, reason: "invalid_token" });
    const res = await POST(req(activity({ serviceUrl: "https://attacker.example.com/" })));
    expect(res.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
    expect(ensureActionCapture).not.toHaveBeenCalled();
  });

  it("the Track dialog's own form data cannot supply a routing URL", async () => {
    // `value.data` is the ONLY client-authored part of this activity. A serviceUrl smuggled into
    // it must be ignored — the field is read from the activity root, which Teams owns.
    const res = await POST(
      req(activity({}, { data: { hostFraming: "Read this.", recipients: A, serviceUrl: "https://attacker.example.com/" } })),
    );
    expect(res.status).toBe(200);
    expect(sentServiceUrl()).toBeNull();
  });

  it("a token whose serviceUrl claim disagrees with the body yields NOTHING", async () => {
    // Either a replayed token or a body edited in flight. Neither is a value worth keeping —
    // but Track still succeeds, because routing metadata must not gate the product loop.
    verifyBotFrameworkToken.mockResolvedValue({ ok: true, payload: { serviceUrl: "https://smba.trafficmanager.net/amer/" } });
    const res = await POST(req(activity({ serviceUrl: REAL })));
    expect(res.status).toBe(200);
    expect(sentServiceUrl()).toBeNull();
  });

  it("a token whose claim AGREES (bar a trailing slash) still stores the body's exact value", async () => {
    verifyBotFrameworkToken.mockResolvedValue({ ok: true, payload: { serviceUrl: "https://smba.trafficmanager.net/emea" } });
    await POST(req(activity({ serviceUrl: REAL })));
    expect(sentServiceUrl()).toBe(REAL);
  });

  it("no email, UPN or display name is anywhere near the routing decision", async () => {
    await POST(req(activity({ serviceUrl: REAL }, {
      messagePayload: { id: "m1", body: { content: "b" }, from: { user: { displayName: "Dr. X", email: "x@y.com" } } },
    })));
    const args = JSON.stringify(rpc.mock.calls);
    expect(args).not.toContain("@y.com");
    expect(args).not.toContain("Dr. X");
  });
});

describe("resolveServiceUrl — the pure rule", () => {
  it("accepts a real Bot Framework base", () => {
    expect(resolveServiceUrl({ serviceUrl: REAL })).toEqual({ url: REAL, reason: "ok" });
  });

  it("reports absence separately from refusal", () => {
    expect(resolveServiceUrl({}).reason).toBe("absent");
    expect(resolveServiceUrl({ serviceUrl: "   " }).reason).toBe("absent");
    expect(resolveServiceUrl({ serviceUrl: "https://x.example.com/" }).reason).toBe("ok");
  });

  it("refuses everything that is not an absolute https origin", () => {
    for (const bad of [
      "http://smba.trafficmanager.net/teams/",   // plaintext: a bot token would travel in the clear
      "javascript:alert(1)",
      "//smba.trafficmanager.net/teams/",
      "smba.trafficmanager.net",
      "https://evil@smba.trafficmanager.net/",   // credentials are not part of a base URL
      "https://smba.trafficmanager.net/?x=1",    // nor a query
      "https://smba.trafficmanager.net/#f",
      "https://",
      "https://-bad-.example.com/",
      `https://x.example.com/${"a".repeat(400)}`,
    ]) {
      expect(resolveServiceUrl({ serviceUrl: bad }), bad).toEqual({ url: null, reason: "invalid" });
    }
  });

  it("is not fooled by a non-string", () => {
    for (const bad of [null, 42, true, {}, [], undefined]) {
      expect(resolveServiceUrl({ serviceUrl: bad }).url).toBeNull();
    }
  });

  it("never throws on rubbish input", () => {
    for (const bad of [null, undefined, 42, "x", [], { serviceUrl: { nested: true } }]) {
      expect(() => resolveServiceUrl(bad)).not.toThrow();
    }
  });

  it("uses the claim ONLY to refuse — never as a substitute source", () => {
    // If the body has no URL, a claim does not become one. Whether production tokens even carry
    // this claim is unmeasured, and a silent fallback would make the authority depend on which
    // unmeasured branch fired.
    expect(resolveServiceUrl({}, "https://smba.trafficmanager.net/emea/")).toEqual({ url: null, reason: "absent" });
  });
});

describe("F/12 — this slice sends nothing", () => {
  it("no outbound Bot Framework call exists on the Track path", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    await POST(req(activity({ serviceUrl: REAL })));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("the write is still the ONLY announcement RPC the Track path calls", async () => {
    await POST(req(activity({ serviceUrl: REAL })));
    const names = rpc.mock.calls.map((c) => c[0]);
    expect(names).toEqual(["bty_track_announcement"]);
    expect(names.join()).not.toMatch(/notif|conversation|send/i);
  });
});

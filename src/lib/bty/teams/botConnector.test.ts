import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getBotFrameworkToken, __resetBotTokenCache } from "@/lib/bty/teams/botToken.server";
import {
  createOneOnOneConversation,
  sendProactiveMessage,
  CONNECTOR_TIMEOUT_MS,
  sanitizeAuthChallenge,
} from "@/lib/bty/teams/proactiveConversation.server";

/**
 * SLICE A0.2 — the two outbound calls, and the credential that does not exist yet.
 *
 * These pin the parts that are easy to get quietly wrong: a secret leaking into a log, a 403 that
 * means "install the app" being reported as a generic permission problem, and a base URL being
 * assembled with a doubled slash because the stored value ends in one.
 */

const SECRET = "super-secret-value-do-not-log";
const BOT_TENANT = "10110d5c-bd30-467e-9912-e44e67777647";
const AUTHORITY = `https://login.microsoftonline.com/${BOT_TENANT}/oauth2/v2.0/token`;
const URL_ = "https://smba.example.net/amer/tenant/";
let fetchMock: ReturnType<typeof vi.fn>;
let errSpy: ReturnType<typeof vi.spyOn>;

const res = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  __resetBotTokenCache();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("B/C — the bot token", () => {
  it("an absent secret is credential_missing, and makes NO network call", async () => {
    // The state of production today. It must be a typed answer, not a throw and not a request.
    expect(await getBotFrameworkToken({ appId: "app", appPassword: undefined, tenantId: BOT_TENANT })).toEqual({
      ok: false, reason: "credential_missing",
    });
    expect(await getBotFrameworkToken({ appId: undefined, appPassword: SECRET, tenantId: BOT_TENANT })).toEqual({
      ok: false, reason: "credential_missing",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks the BOT REGISTRATION's tenant with client_credentials", async () => {
    fetchMock.mockResolvedValue(res(200, { access_token: "tok", expires_in: 3600 }));
    expect(await getBotFrameworkToken({ appId: "app", appPassword: SECRET, tenantId: BOT_TENANT })).toEqual({ ok: true, token: "tok" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(AUTHORITY);
    const body = String(init.body);
    expect(body).toContain("grant_type=client_credentials");
    expect(body).toContain("scope=https%3A%2F%2Fapi.botframework.com%2F.default");
  });

  it("caches until shortly before expiry, so one Track does not re-authenticate", async () => {
    fetchMock.mockResolvedValue(res(200, { access_token: "tok", expires_in: 3600 }));
    await getBotFrameworkToken({ appId: "app", appPassword: SECRET, tenantId: BOT_TENANT });
    await getBotFrameworkToken({ appId: "app", appPassword: SECRET, tenantId: BOT_TENANT });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("NEVER logs the secret, the token, or the response body", async () => {
    fetchMock.mockResolvedValue(res(401, { error: "invalid_client", error_description: `bad ${SECRET}` }));
    expect(await getBotFrameworkToken({ appId: "app", appPassword: SECRET, tenantId: BOT_TENANT })).toEqual({ ok: false, reason: "auth_failed" });
    const logged = JSON.stringify(errSpy.mock.calls);
    expect(logged).not.toContain(SECRET);
    expect(logged).not.toContain("invalid_client");
    expect(logged).toContain("401");
  });

  it("a network failure is unreachable, not auth_failed", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    expect(await getBotFrameworkToken({ appId: "app", appPassword: SECRET, tenantId: BOT_TENANT })).toEqual({ ok: false, reason: "unreachable" });
  });
});

describe("E — createConversation", () => {
  const call = () =>
    createOneOnOneConversation({ token: "tok", appId: "app-id", serviceUrl: URL_, tenantId: "tid", aadObjectId: "oid" });

  it("addresses the person by Entra object id, with the tenant in channelData", async () => {
    fetchMock.mockResolvedValue(res(201, { id: "19:conv" }));
    expect(await call()).toEqual({ ok: true, conversationId: "19:conv" });
    const [url, init] = fetchMock.mock.calls[0];
    // The stored coordinate ends in a slash; a doubled one would 404 against a real endpoint.
    expect(url).toBe("https://smba.example.net/amer/tenant/v3/conversations");
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({
      bot: { id: "28:app-id" },
      members: [{ id: "oid" }],
      channelData: { tenant: { id: "tid" } },
      isGroup: false,
    });
    expect(init.headers.authorization).toBe("Bearer tok");
  });

  it("separates an INSTALLATION 403 from a permission 403", async () => {
    // These need different human actions: install the app for that person, versus fix the bot
    // registration. Reporting both as "forbidden" sends the investigation to the wrong place.
    // `toMatchObject`, not `toEqual`: slice 1A also retains Microsoft's error.code on a 403.
    // The CLASSIFICATION is what must not move, and it does not.
    fetchMock.mockResolvedValue(res(403, { error: { code: "BotNotInConversationRoster" } }));
    expect(await call()).toMatchObject({ ok: false, failure: "not_installed", ambiguous: false });

    fetchMock.mockResolvedValue(res(403, { error: { code: "MissingProperty" } }));
    expect(await call()).toMatchObject({ ok: false, failure: "forbidden", ambiguous: false });

    // A 403 whose body cannot be read stays the generic one rather than being upgraded.
    fetchMock.mockResolvedValue(new Response("not json", { status: 403 }));
    expect(await call()).toEqual({ ok: false, failure: "forbidden", ambiguous: false });
  });

  it("classifies the rest without keeping any body", async () => {
    // ★ `ambiguous` is the field the caller's release decision turns on. A 5xx is the only
    // status here that cannot rule out acceptance — the request reached Microsoft and may have
    // been taken before it failed. Every 4xx is a refusal to act, so nothing was delivered.
    for (const [status, failure, ambiguous] of [
      [401, "unauthorized", false], [429, "throttled", false],
      [502, "upstream_error", true], [400, "invalid_request", false],
    ] as const) {
      fetchMock.mockResolvedValue(res(status, { error: { message: "SENSITIVE" } }));
      expect(await call(), String(status)).toMatchObject({ ok: false, failure, ambiguous });
    }
    expect(JSON.stringify(errSpy.mock.calls)).not.toContain("SENSITIVE");
  });

  it("a 200 with no conversation id is a failure, not a silent success", async () => {
    fetchMock.mockResolvedValue(res(200, {}));
    expect(await call()).toMatchObject({ ok: false, failure: "invalid_request", ambiguous: false });
  });
});

describe("H — every failure says whether it proves non-delivery", () => {
  it("a network failure AFTER the POST began is ambiguous, on both calls", async () => {
    // This is the case that must never free the lease: Teams may have accepted the message and
    // only the response was lost.
    fetchMock.mockRejectedValue(new Error("socket hang up"));
    expect(await sendProactiveMessage({ token: "t", serviceUrl: URL_, conversationId: "c", text: "x" }))
      .toEqual({ ok: false, failure: "unreachable", ambiguous: true });
    expect(await createOneOnOneConversation({ token: "t", appId: "a", serviceUrl: URL_, tenantId: "t", aadObjectId: "o" }))
      .toEqual({ ok: false, failure: "unreachable", ambiguous: true });
  });

  it("every outbound call carries its own timeout, far shorter than the 120s lease", async () => {
    fetchMock.mockResolvedValue(res(201, { id: "19:c" }));
    await createOneOnOneConversation({ token: "t", appId: "a", serviceUrl: URL_, tenantId: "t", aadObjectId: "o" });
    await sendProactiveMessage({ token: "t", serviceUrl: URL_, conversationId: "c", text: "x" });
    for (const [, init] of fetchMock.mock.calls) {
      expect(init.signal).toBeInstanceOf(AbortSignal);
    }
    expect(CONNECTOR_TIMEOUT_MS).toBeLessThan(120_000 / 2);
  });
});

describe("F — sending one message", () => {
  it("posts exactly one markdown message activity into the conversation", async () => {
    fetchMock.mockResolvedValue(res(201, { id: "act-1" }));
    expect(await sendProactiveMessage({ token: "tok", serviceUrl: URL_, conversationId: "19:c@x", text: "hello" })).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://smba.example.net/amer/tenant/v3/conversations/19%3Ac%40x/activities");
    expect(JSON.parse(String(init.body))).toEqual({ type: "message", textFormat: "markdown", text: "hello" });
  });

  it("a refused send is a typed failure the caller can retry", async () => {
    fetchMock.mockResolvedValue(res(429, {}));
    expect(await sendProactiveMessage({ token: "t", serviceUrl: URL_, conversationId: "c", text: "x" })).toEqual({
      ok: false, failure: "throttled", ambiguous: false,
    });
  });
});


/**
 * SLICE 1A — the 401 must name itself.
 *
 * The first real Stage 1 attempt returned 401 from createConversation, and the classifier
 * returned immediately on 401 while reading `error.code` for 403. Microsoft named the cause and
 * we discarded it, so the failure could only be narrowed by reasoning about which database rows
 * existed. These pin the diagnosis WITHOUT changing a single classification.
 */
describe("1A — the 401 diagnostic contract", () => {
  const TOKEN = "eyJ0-this-is-the-access-token-and-must-never-be-logged";
  const create = () =>
    createOneOnOneConversation({ token: TOKEN, appId: "app-id", serviceUrl: URL_, tenantId: "tid", aadObjectId: "oid" });
  const send = () => sendProactiveMessage({ token: TOKEN, serviceUrl: URL_, conversationId: "19:c", text: "hello" });
  const logged = () => JSON.stringify(errSpy.mock.calls);
  const failureLine = () =>
    errSpy.mock.calls.find((c) => String(c[0]).includes("connector failure"))?.[1] as Record<string, unknown>;

  it("keeps Microsoft's error.code from a createConversation 401", async () => {
    fetchMock.mockResolvedValue(res(401, { error: { code: "InvalidBotSignature", message: "prose we do not keep" } }));
    const r = await create();
    expect(r).toMatchObject({ ok: false, failure: "unauthorized", ambiguous: false, microsoftCode: "InvalidBotSignature" });
    expect(failureLine()).toMatchObject({ operation: "create_conversation", status: 401, microsoft_code: "InvalidBotSignature" });
    // The prose is not diagnosis and is not kept.
    expect(logged()).not.toContain("prose we do not keep");
  });

  it("attributes a 401 on the message send to send_activity, not to the conversation", async () => {
    // The whole point: the next failure must not require deduction from which rows exist.
    fetchMock.mockResolvedValue(res(401, { error: { code: "Unauthorized" } }));
    await send();
    expect(failureLine()).toMatchObject({ operation: "send_activity", status: 401 });
  });

  it("classifies safely when the 401 body is not JSON at all", async () => {
    fetchMock.mockResolvedValue(new Response("<html>gateway</html>", { status: 401 }));
    const r = await create();
    expect(r).toMatchObject({ ok: false, failure: "unauthorized", ambiguous: false });
    expect((r as { microsoftCode?: string }).microsoftCode).toBeUndefined();
    expect(failureLine()).toMatchObject({ microsoft_code: "none" });
  });

  it("keeps a sanitized WWW-Authenticate, including the directory Microsoft expected", async () => {
    // `authorization_uri` is the field that would answer the open question about this bot's app
    // type. It is a public URL and carries no credential.
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), {
      status: 401,
      headers: {
        "content-type": "application/json",
        "www-authenticate":
          'Bearer realm="botframework.com", authorization_uri="https://login.windows.net/common/oauth2/authorize", error="invalid_token", error_description="signature validation failed", claims="eyJhY2Nlc3MifQ"',
      },
    }));
    const r = await create() as { authChallenge?: string };
    expect(r.authChallenge).toContain("scheme=Bearer");
    expect(r.authChallenge).toContain("error=invalid_token");
    expect(r.authChallenge).toContain("authorization_uri=https://login.windows.net/common/oauth2/authorize");
    // A claims challenge is reduced to a flag: it can be large and is not needed to diagnose.
    expect(r.authChallenge).toContain("claims=present");
    expect(r.authChallenge).not.toContain("eyJhY2Nlc3MifQ");
  });

  it("reports an unparsable challenge as present rather than echoing it", async () => {
    expect(sanitizeAuthChallenge("!!! something unexpected !!!")).toBe("present, unparsed");
    expect(sanitizeAuthChallenge(null)).toBeUndefined();
    expect(sanitizeAuthChallenge("   ")).toBeUndefined();
  });

  it("never lets a header value grow without bound", () => {
    const out = sanitizeAuthChallenge(`Bearer error_description="${"x".repeat(5000)}"`) ?? "";
    expect(out.length).toBeLessThanOrEqual(300);
  });

  it("NEVER puts the access token, the Authorization header or a secret into a log or a result", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { code: "X" }, access_token: TOKEN }), {
      status: 401,
      headers: { "content-type": "application/json", "www-authenticate": `Bearer error="bad", token="${TOKEN}"` },
    }));
    const r = await create();
    const everything = logged() + JSON.stringify(r);
    expect(everything).not.toContain(TOKEN);
    expect(everything).not.toContain("Bearer eyJ0");
    // `token=` is not on the allow-list, so it cannot reach the challenge string at all.
    expect((r as { authChallenge?: string }).authChallenge).not.toContain("token=");
    // The request's own Authorization header is never echoed anywhere.
    expect(everything).not.toContain("authorization");
  });
});

describe("1A — no behaviour changed", () => {
  it("every classification still returns exactly the failure and ambiguity it did before", async () => {
    const call = () =>
      createOneOnOneConversation({ token: "t", appId: "a", serviceUrl: URL_, tenantId: "t", aadObjectId: "o" });
    const cases: Array<[number, unknown, string, boolean]> = [
      [401, { error: { code: "C" } }, "unauthorized", false],
      [403, { error: { code: "BotNotInConversationRoster" } }, "not_installed", false],
      [403, { error: { code: "MissingProperty" } }, "forbidden", false],
      [429, {}, "throttled", false],
      [502, {}, "upstream_error", true],
      [400, {}, "invalid_request", false],
    ];
    for (const [status, body, failure, ambiguous] of cases) {
      fetchMock.mockResolvedValue(res(status, body));
      const r = await call();
      expect(r, String(status)).toMatchObject({ ok: false, failure, ambiguous });
    }
  });

  it("a success is still a plain success, with no diagnostic fields", async () => {
    fetchMock.mockResolvedValue(res(201, { id: "19:c" }));
    expect(await createOneOnOneConversation({ token: "t", appId: "a", serviceUrl: URL_, tenantId: "t", aadObjectId: "o" }))
      .toEqual({ ok: true, conversationId: "19:c" });
  });
});


/**
 * SLICE 1B — the token authority.
 *
 * The first real attempt obtained a token from `botframework.com` and was refused by the
 * Connector with a bare 401. `bty-arena-teams` is a TEAMS-MANAGED registration, which is
 * single-tenant even though its Entra app is `AzureADMultipleOrgs` — so the multi-tenant
 * authority happily ISSUES a token that the Connector will not accept. A successfully issued
 * token is not evidence of the right authority, which is what made this expensive to find.
 */
describe("1B — the token comes from the bot registration's own tenant", () => {
  it("mints at the configured BOT tenant, never at botframework.com", async () => {
    fetchMock.mockResolvedValue(res(200, { access_token: "tok", expires_in: 3600 }));
    expect(await getBotFrameworkToken({ appId: "app", appPassword: SECRET, tenantId: BOT_TENANT }))
      .toEqual({ ok: true, token: "tok" });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(AUTHORITY);
    expect(String(url)).not.toContain("botframework.com");
  });

  it("keeps client id, secret and scope exactly as they were", async () => {
    fetchMock.mockResolvedValue(res(200, { access_token: "tok", expires_in: 3600 }));
    await getBotFrameworkToken({ appId: "app", appPassword: SECRET, tenantId: BOT_TENANT });
    const body = String(fetchMock.mock.calls[0][1].body);
    expect(body).toContain("grant_type=client_credentials");
    expect(body).toContain("client_id=app");
    // The audience is unchanged — only the directory the token is minted in moved.
    expect(body).toContain("scope=https%3A%2F%2Fapi.botframework.com%2F.default");
  });

  it("FAILS CLOSED with no tenant, before any network call", async () => {
    // A fallback to botframework.com would recreate the exact ambiguity this slice removes:
    // it issues a token, so the failure would resurface later as an opaque Connector 401.
    expect(await getBotFrameworkToken({ appId: "app", appPassword: SECRET, tenantId: "" }))
      .toEqual({ ok: false, reason: "tenant_not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("FAILS CLOSED on a malformed tenant, before any network call", async () => {
    for (const bad of ["botframework.com", "common", "not-a-guid", "10110d5c", "  ", "10110d5c-bd30-467e-9912-e44e6777764"]) {
      __resetBotTokenCache();
      expect(await getBotFrameworkToken({ appId: "app", appPassword: SECRET, tenantId: bad }), bad)
        .toEqual({ ok: false, reason: "tenant_not_configured" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a missing tenant WITHOUT echoing whatever was configured", async () => {
    await getBotFrameworkToken({ appId: "app", appPassword: SECRET, tenantId: "secret-looking-garbage" });
    const logged = JSON.stringify(errSpy.mock.calls);
    expect(logged).toContain("bot tenant not configured");
    expect(logged).not.toContain("secret-looking-garbage");
  });

  it("caches per authority, so a token minted for one directory is never reused for another", async () => {
    fetchMock.mockResolvedValue(res(200, { access_token: "tok-a", expires_in: 3600 }));
    await getBotFrameworkToken({ appId: "app", appPassword: SECRET, tenantId: BOT_TENANT });
    await getBotFrameworkToken({ appId: "app", appPassword: SECRET, tenantId: BOT_TENANT });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const OTHER = "22222222-2222-2222-2222-222222222222";
    fetchMock.mockResolvedValue(res(200, { access_token: "tok-b", expires_in: 3600 }));
    expect(await getBotFrameworkToken({ appId: "app", appPassword: SECRET, tenantId: OTHER }))
      .toEqual({ ok: true, token: "tok-b" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain(OTHER);
  });

  it("a credential problem still outranks a tenant problem, so the report names the right thing", async () => {
    expect(await getBotFrameworkToken({ appId: "app", appPassword: undefined, tenantId: "" }))
      .toEqual({ ok: false, reason: "credential_missing" });
  });

  it("introduces no Graph dependency", async () => {
    fetchMock.mockResolvedValue(res(200, { access_token: "tok", expires_in: 3600 }));
    await getBotFrameworkToken({ appId: "app", appPassword: SECRET, tenantId: BOT_TENANT });
    for (const [url] of fetchMock.mock.calls) {
      expect(String(url)).not.toContain("graph.microsoft.com");
    }
  });
});

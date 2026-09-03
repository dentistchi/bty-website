import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getBotFrameworkToken, __resetBotTokenCache } from "@/lib/bty/teams/botToken.server";
import {
  createOneOnOneConversation,
  sendProactiveMessage,
  CONNECTOR_TIMEOUT_MS,
} from "@/lib/bty/teams/proactiveConversation.server";

/**
 * SLICE A0.2 — the two outbound calls, and the credential that does not exist yet.
 *
 * These pin the parts that are easy to get quietly wrong: a secret leaking into a log, a 403 that
 * means "install the app" being reported as a generic permission problem, and a base URL being
 * assembled with a doubled slash because the stored value ends in one.
 */

const SECRET = "super-secret-value-do-not-log";
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
    expect(await getBotFrameworkToken({ appId: "app", appPassword: undefined })).toEqual({
      ok: false, reason: "credential_missing",
    });
    expect(await getBotFrameworkToken({ appId: undefined, appPassword: SECRET })).toEqual({
      ok: false, reason: "credential_missing",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks Microsoft's bot audience with client_credentials", async () => {
    fetchMock.mockResolvedValue(res(200, { access_token: "tok", expires_in: 3600 }));
    expect(await getBotFrameworkToken({ appId: "app", appPassword: SECRET })).toEqual({ ok: true, token: "tok" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token");
    const body = String(init.body);
    expect(body).toContain("grant_type=client_credentials");
    expect(body).toContain("scope=https%3A%2F%2Fapi.botframework.com%2F.default");
  });

  it("caches until shortly before expiry, so one Track does not re-authenticate", async () => {
    fetchMock.mockResolvedValue(res(200, { access_token: "tok", expires_in: 3600 }));
    await getBotFrameworkToken({ appId: "app", appPassword: SECRET });
    await getBotFrameworkToken({ appId: "app", appPassword: SECRET });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("NEVER logs the secret, the token, or the response body", async () => {
    fetchMock.mockResolvedValue(res(401, { error: "invalid_client", error_description: `bad ${SECRET}` }));
    expect(await getBotFrameworkToken({ appId: "app", appPassword: SECRET })).toEqual({ ok: false, reason: "auth_failed" });
    const logged = JSON.stringify(errSpy.mock.calls);
    expect(logged).not.toContain(SECRET);
    expect(logged).not.toContain("invalid_client");
    expect(logged).toContain("401");
  });

  it("a network failure is unreachable, not auth_failed", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    expect(await getBotFrameworkToken({ appId: "app", appPassword: SECRET })).toEqual({ ok: false, reason: "unreachable" });
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
    fetchMock.mockResolvedValue(res(403, { error: { code: "BotNotInConversationRoster" } }));
    expect(await call()).toEqual({ ok: false, failure: "not_installed", ambiguous: false });

    fetchMock.mockResolvedValue(res(403, { error: { code: "MissingProperty" } }));
    expect(await call()).toEqual({ ok: false, failure: "forbidden", ambiguous: false });

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
      expect(await call(), String(status)).toEqual({ ok: false, failure, ambiguous });
    }
    expect(JSON.stringify(errSpy.mock.calls)).not.toContain("SENSITIVE");
  });

  it("a 200 with no conversation id is a failure, not a silent success", async () => {
    fetchMock.mockResolvedValue(res(200, {}));
    expect(await call()).toEqual({ ok: false, failure: "invalid_request", ambiguous: false });
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

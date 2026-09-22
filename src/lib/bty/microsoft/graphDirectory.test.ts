import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  REQUIRED_GRAPH_APPLICATION_PERMISSIONS,
  getGraphAppToken,
  graphConfigFromEnv,
  probeDirectReports,
  probeProfessionalProfile,
  resetGraphTokenCache,
} from "./graphDirectory.server";

/**
 * The Microsoft Graph surface (Microsoft Manager Authority V1).
 *
 * Two things are asserted that no amount of manual review reliably catches: that the permission
 * set stays at exactly one entry, and that a failed probe is never mistaken for "no direct
 * reports". The second is what stands between a Graph outage and a mass revocation.
 */

const TENANT = "11111111-1111-1111-1111-111111111111";
const OID = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  resetGraphTokenCache();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  resetGraphTokenCache();
});

describe("the requested permission set", () => {
  it("★ is EXACTLY User.Read.All and nothing else", () => {
    expect([...REQUIRED_GRAPH_APPLICATION_PERMISSIONS]).toEqual(["User.Read.All"]);
  });

  it("names no directory-wide, message, mail or write scope anywhere in the module", () => {
    /*
      This reads the source because the risk is a scope added in a comment, a URL or a second
      constant — somewhere a check on the exported array alone would not look.
    */
    const src = fs.readFileSync(path.join(process.cwd(), "src/lib/bty/microsoft/graphDirectory.server.ts"), "utf8");
    const forbidden = [
      "Directory.Read.All",
      "Directory.ReadWrite.All",
      "User.ReadWrite.All",
      "Chat.Read",
      "ChannelMessage.Read",
      "Mail.Read",
      "Mail.Send",
      "Group.ReadWrite",
      "Files.Read",
    ];
    for (const scope of forbidden) {
      // Allowed only as an explicit "not requested" note; there are none, so absence is the rule.
      expect(src.includes(scope), `must not name ${scope}`).toBe(false);
    }
  });
});

describe("configuration", () => {
  it("refuses a non-GUID tenant or a missing secret rather than half-configuring", () => {
    expect(graphConfigFromEnv({ AZURE_AD_TENANT_ID: "nope", AZURE_AD_CLIENT_ID: "c", AZURE_AD_CLIENT_SECRET: "s" })).toBeNull();
    expect(graphConfigFromEnv({ AZURE_AD_TENANT_ID: TENANT, AZURE_AD_CLIENT_ID: "c" })).toBeNull();
    expect(graphConfigFromEnv({})).toBeNull();
  });

  /*
    ★ THE TEAMS BOT REGISTRATION AS A GRAPH CREDENTIAL (Commander authorization).

    Measured before this: production had no MS_GRAPH_* and no AZURE_AD_* value of any kind, so
    Graph was unconfigured and both Graph-fed tables held zero rows for their whole lifetime. The
    bot registration is the one Entra credential pair BTY already holds, and it was granted
    User.Read.All rather than a new app being provisioned.
  */
  it("falls back to the TEAMS BOT registration when no Graph or sign-in credential is set", () => {
    expect(
      graphConfigFromEnv({
        TEAMS_BOT_TENANT_ID: TENANT,
        TEAMS_BOT_APP_ID: "bot-app-id",
        TEAMS_BOT_APP_PASSWORD: "bot-secret",
      }),
    ).toEqual({ tenantId: TENANT, clientId: "bot-app-id", clientSecret: "bot-secret" });
  });

  it("the bot credential is the LAST resort — every higher tier still wins", () => {
    const bot = {
      TEAMS_BOT_TENANT_ID: "99999999-9999-4999-8999-999999999999",
      TEAMS_BOT_APP_ID: "bot-app-id",
      TEAMS_BOT_APP_PASSWORD: "bot-secret",
    };
    // Tier 2 beats tier 3.
    expect(
      graphConfigFromEnv({ ...bot, AZURE_AD_TENANT_ID: TENANT, AZURE_AD_CLIENT_ID: "signin", AZURE_AD_CLIENT_SECRET: "signin-secret" }),
    ).toEqual({ tenantId: TENANT, clientId: "signin", clientSecret: "signin-secret" });
    // Tier 1 beats both.
    expect(
      graphConfigFromEnv({
        ...bot,
        AZURE_AD_TENANT_ID: "88888888-8888-4888-8888-888888888888",
        AZURE_AD_CLIENT_ID: "signin",
        AZURE_AD_CLIENT_SECRET: "signin-secret",
        MS_GRAPH_TENANT_ID: TENANT,
        MS_GRAPH_CLIENT_ID: "daemon",
        MS_GRAPH_CLIENT_SECRET: "daemon-secret",
      }),
    ).toEqual({ tenantId: TENANT, clientId: "daemon", clientSecret: "daemon-secret" });
  });

  it("resolves FIELD by field, so a half-split configuration still works", () => {
    // Only the secret is split out; tenant and client id still come from the bot registration.
    expect(
      graphConfigFromEnv({
        TEAMS_BOT_TENANT_ID: TENANT,
        TEAMS_BOT_APP_ID: "bot-app-id",
        TEAMS_BOT_APP_PASSWORD: "bot-secret",
        MS_GRAPH_CLIENT_SECRET: "rotated-secret",
      }),
    ).toEqual({ tenantId: TENANT, clientId: "bot-app-id", clientSecret: "rotated-secret" });
  });

  it("an INCOMPLETE bot credential is still refused rather than half-configured", () => {
    expect(graphConfigFromEnv({ TEAMS_BOT_TENANT_ID: TENANT, TEAMS_BOT_APP_ID: "bot-app-id" })).toBeNull();
    expect(graphConfigFromEnv({ TEAMS_BOT_APP_ID: "bot-app-id", TEAMS_BOT_APP_PASSWORD: "bot-secret" })).toBeNull();
    expect(
      graphConfigFromEnv({ TEAMS_BOT_TENANT_ID: "not-a-guid", TEAMS_BOT_APP_ID: "a", TEAMS_BOT_APP_PASSWORD: "b" }),
    ).toBeNull();
  });

  it("a different credential does NOT widen what Graph is asked for", () => {
    // The permission specification is independent of which registration is used.
    expect(REQUIRED_GRAPH_APPLICATION_PERMISSIONS).toEqual(["User.Read.All"]);
  });

  it("prefers a dedicated daemon registration when one is configured", () => {
    const cfg = graphConfigFromEnv({
      AZURE_AD_TENANT_ID: TENANT,
      AZURE_AD_CLIENT_ID: "signin",
      AZURE_AD_CLIENT_SECRET: "signin-secret",
      MS_GRAPH_CLIENT_ID: "daemon",
      MS_GRAPH_CLIENT_SECRET: "daemon-secret",
    });
    expect(cfg).toEqual({ tenantId: TENANT, clientId: "daemon", clientSecret: "daemon-secret" });
  });
});

describe("the app-only token", () => {
  const config = { tenantId: TENANT, clientId: "c", clientSecret: "s" };

  it("requests the .default scope for the granted app roles", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "tok", expires_in: 3600 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await getGraphAppToken(config)).toBe("tok");
    const body = String(fetchMock.mock.calls[0][1].body);
    expect(body).toContain("scope=https%3A%2F%2Fgraph.microsoft.com%2F.default");
    expect(body).toContain("grant_type=client_credentials");
  });

  it("returns null (never throws) when the token endpoint refuses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    expect(await getGraphAppToken(config)).toBeNull();
  });

  it("returns null when the network is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    expect(await getGraphAppToken(config)).toBeNull();
  });

  it("never logs the secret or the token", async () => {
    const errors: unknown[][] = [];
    vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => void errors.push(a));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    await getGraphAppToken({ tenantId: TENANT, clientId: "cid", clientSecret: "SUPERSECRET" });
    const dump = JSON.stringify(errors);
    expect(dump).not.toContain("SUPERSECRET");
    expect(dump).not.toContain("cid");
  });
});

describe("the direct-reports probe", () => {
  it("asks only for one id, from the directReports edge", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ value: [{ id: "x" }] }) });
    vi.stubGlobal("fetch", fetchMock);
    const r = await probeDirectReports("tok", OID);
    expect(r).toEqual({ ok: true, hasDirectReports: true });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toBe(`https://graph.microsoft.com/v1.0/users/${OID}/directReports?$top=1&$select=id`);
    // The manager direction is not app-only readable; it must not be attempted.
    expect(url).not.toContain("/manager");
    expect(url).not.toContain("jobTitle");
  });

  it("an empty edge is a definite 'not a manager'", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ value: [] }) }));
    expect(await probeDirectReports("tok", OID)).toEqual({ ok: true, hasDirectReports: false });
  });

  it("★ every non-200 is a REFUSAL, never a 'no'", async () => {
    for (const status of [403, 404, 429, 500, 503]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status }));
      const r = await probeDirectReports("tok", OID);
      expect(r.ok, `status ${status} must not answer the question`).toBe(false);
    }
  });

  it("a thrown fetch is a refusal too", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    expect(await probeDirectReports("tok", OID)).toEqual({ ok: false, reason: "network" });
  });

  it("a non-GUID object id never reaches Graph", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await probeDirectReports("tok", "not-a-guid")).toEqual({ ok: false, reason: "invalid_oid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("professional profile probe", () => {
  it("reads only the measured authority fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: OID, jobTitle: "General Dentist", employeeType: "WA - Provider" }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await probeProfessionalProfile("tok", OID)).toEqual({ ok: true, jobTitle: "General Dentist", employeeType: "WA - Provider" });
    expect(String(fetchMock.mock.calls[0][0])).toBe(`https://graph.microsoft.com/v1.0/users/${OID}?$select=id,jobTitle,employeeType`);
  });
  it("fails closed on a Graph error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    expect((await probeProfessionalProfile("tok", OID)).ok).toBe(false);
  });
});

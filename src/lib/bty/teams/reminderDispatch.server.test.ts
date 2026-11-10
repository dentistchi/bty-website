import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchTeamsReminders } from "./reminderDispatch.server";

const { getBotFrameworkToken, readTenantRoute, resolveTeamsConversation, sendProactiveMessage } = vi.hoisted(() => ({
  getBotFrameworkToken: vi.fn(),
  readTenantRoute: vi.fn(),
  resolveTeamsConversation: vi.fn(),
  sendProactiveMessage: vi.fn(),
}));
vi.mock("./botToken.server", () => ({ getBotFrameworkToken }));
vi.mock("./tenantRoute.server", () => ({ readTenantRoute }));
vi.mock("./resolveTeamsConversation.server", () => ({ resolveTeamsConversation }));
vi.mock("./proactiveConversation.server", () => ({ sendProactiveMessage }));

const route = "https://smba.trafficmanager.net/emea/";
const names = {
  claim: "bty_claim_due_teams_reminders",
  start: "bty_start_teams_reminder",
  finish: "bty_finish_teams_reminder",
};
const reminder = {
  id: "reminder-id", claim_token: "lease-id", kind: "save", tenant_id: "tenant", aad_object_id: "owner",
  subject_id: "private-subject-id",
};
const claim = { p_id: "reminder-id", p_claim_token: "lease-id" };
const rpc = vi.fn();
const from = vi.fn();
const admin = { rpc, from } as unknown as SupabaseClient;
const ok = (data: unknown) => ({ data, error: null });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("TEAMS_BOT_APP_ID", "bot");
  rpc.mockImplementation(async (name: string) => ok(name === names.claim ? [reminder] : true));
  getBotFrameworkToken.mockResolvedValue({ ok: true, token: "token" });
  readTenantRoute.mockResolvedValue(route);
  resolveTeamsConversation.mockResolvedValue({ ok: true, serviceUrl: route, conversationId: "personal-chat" });
  sendProactiveMessage.mockResolvedValue({ ok: true });
});

afterEach(() => vi.unstubAllEnvs());

describe("Teams delayed reminder dispatch", () => {
  it.each([
    ["save", "Saved for later"],
    ["track_owner", "Track announcement"],
    ["track_recipient", "Needs your response"],
  ])("sends a due %s reminder to its own personal chat after acquiring the send marker", async (kind, lane) => {
    rpc.mockImplementation(async (name: string) => ok(name === names.claim ? [{ ...reminder, kind }] : true));
    expect(await dispatchTeamsReminders(admin)).toMatchObject({ claimed: 1, sent: 1 });
    expect(readTenantRoute).toHaveBeenCalledWith(admin, "tenant");
    expect(resolveTeamsConversation).toHaveBeenCalledWith(admin, {
      tenantId: "tenant", aadObjectId: "owner", appId: "bot", token: "token", serviceUrl: route,
    });
    expect(rpc.mock.calls).toEqual([
      [names.claim, { p_limit: 24 }],
      [names.start, claim],
      [names.finish, { ...claim, p_result: "sent" }],
    ]);
    expect(rpc.mock.invocationCallOrder[1]).toBeLessThan(sendProactiveMessage.mock.invocationCallOrder[0]!);
    expect(rpc.mock.invocationCallOrder[2]).toBeGreaterThan(sendProactiveMessage.mock.invocationCallOrder[0]!);
    expect(sendProactiveMessage).toHaveBeenCalledOnce();
    expect(sendProactiveMessage).toHaveBeenCalledWith({
      token: "token", serviceUrl: route, conversationId: "personal-chat",
      text: expect.stringContaining(`Today → ${lane}`),
    });
    expect(sendProactiveMessage.mock.calls[0][0].text).toContain("https://teams.microsoft.com/l/entity/");
    expect(sendProactiveMessage.mock.calls[0][0].text).not.toContain("private-subject-id");
  });

  it("does not use Teams credentials or send when no reminder is due", async () => {
    rpc.mockResolvedValueOnce(ok([]));
    expect(await dispatchTeamsReminders(admin)).toMatchObject({ claimed: 0, sent: 0 });
    expect(getBotFrameworkToken).not.toHaveBeenCalled();
    expect(sendProactiveMessage).not.toHaveBeenCalled();
  });

  it("finds the exact Track announcement's verified route when the tenant registry is empty", async () => {
    rpc.mockResolvedValueOnce(ok([{ ...reminder, kind: "track_recipient" }]));
    readTenantRoute.mockResolvedValue(null);
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn() };
    query.maybeSingle.mockResolvedValue(ok({ service_url: route }));
    from.mockReturnValue(query);

    expect(await dispatchTeamsReminders(admin)).toMatchObject({ sent: 1 });
    expect(from).toHaveBeenCalledWith("bty_tracked_announcements");
    expect(query.select).toHaveBeenCalledWith("service_url");
    expect(query.eq.mock.calls).toEqual([
      ["id", "private-subject-id"], ["tenant_id", "tenant"], ["status", "active"],
    ]);
    expect(resolveTeamsConversation).toHaveBeenCalledWith(admin, expect.objectContaining({ serviceUrl: route }));
  });

  it("does not claim work while the bot is unconfigured", async () => {
    vi.stubEnv("TEAMS_BOT_APP_ID", "");
    expect(await dispatchTeamsReminders(admin)).toMatchObject({ botConfigured: false });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not send when the DB says the item was handled or the claim was lost", async () => {
    rpc.mockResolvedValueOnce(ok([reminder])).mockResolvedValueOnce(ok(false));
    expect(await dispatchTeamsReminders(admin)).toMatchObject({ skipped: 1, sent: 0 });
    expect(sendProactiveMessage).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenLastCalledWith(names.finish, { ...claim, p_result: "skipped" });
  });

  it.each([
    ["https://smba.trafficmanager.net.example.test/emea/", route],
    [route, "https://user@smba.trafficmanager.net/emea/"],
  ])("refuses untrusted routes before the message send marker", async (tenantRoute, conversationRoute) => {
    readTenantRoute.mockResolvedValue(tenantRoute);
    resolveTeamsConversation.mockResolvedValue({ ok: true, serviceUrl: conversationRoute, conversationId: "personal-chat" });
    expect(await dispatchTeamsReminders(admin)).toMatchObject({ skipped: 1 });
    if (tenantRoute !== route) expect(resolveTeamsConversation).not.toHaveBeenCalled();
    expect(sendProactiveMessage).not.toHaveBeenCalled();
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([names.claim, names.finish]);
  });

  it("never sends into the source chat when the personal bot is unavailable", async () => {
    resolveTeamsConversation.mockResolvedValue({ ok: false, reason: "not_installed" });
    expect(await dispatchTeamsReminders(admin)).toMatchObject({ skipped: 1 });
    expect(sendProactiveMessage).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenLastCalledWith(names.finish, { ...claim, p_result: "skipped" });
  });

  it.each([
    [{ ok: false, ambiguous: true, failure: "unreachable" }, "unknown"],
    [{ ok: false, ambiguous: false, failure: "throttled" }, "retry"],
    [{ ok: false, ambiguous: false, failure: "forbidden" }, "skipped"],
  ])("finalizes a Connector result according to whether Teams could have accepted it", async (connector, outcome) => {
    sendProactiveMessage.mockResolvedValue(connector);
    expect(await dispatchTeamsReminders(admin)).toMatchObject({ [outcome]: 1 });
    expect(sendProactiveMessage).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenLastCalledWith(names.finish, { ...claim, p_result: outcome });
  });

  it("treats an exception after the send marker as unknown", async () => {
    sendProactiveMessage.mockRejectedValueOnce(new Error("connection lost"));
    expect(await dispatchTeamsReminders(admin)).toMatchObject({ unknown: 1, retry: 0 });
    expect(rpc).toHaveBeenLastCalledWith(names.finish, { ...claim, p_result: "unknown" });
  });

  it("does not retry a confirmed send when finalizing loses its response", async () => {
    rpc.mockResolvedValueOnce(ok([reminder])).mockResolvedValueOnce(ok(true)).mockRejectedValueOnce(new Error("db unavailable"));
    expect(await dispatchTeamsReminders(admin)).toMatchObject({ unconfirmed: 1, retry: 0 });
    expect(sendProactiveMessage).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledTimes(3);
  });
});

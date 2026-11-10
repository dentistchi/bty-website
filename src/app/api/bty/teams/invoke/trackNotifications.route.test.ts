import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const verifyBotFrameworkToken = vi.fn();
const resolveBtyUserFromMicrosoftIdentity = vi.fn();
const trackAnnouncement = vi.fn();
const scheduleTrackNotifications = vi.fn();
const ensureActionCapture = vi.fn();
const scheduleActionReceipt = vi.fn();
const admin = { rpc: vi.fn() };
vi.mock("@/lib/bty/teams/botTokenVerifier.server", () => ({ verifyBotFrameworkToken }));
vi.mock("@/lib/bty/identity-link/microsoftIdentityLink.server", () => ({ resolveBtyUserFromMicrosoftIdentity }));
vi.mock("@/lib/bty/action-capture/ensureActionCapture.server", () => ({ ensureActionCapture }));
vi.mock("@/lib/bty/announcement/trackAnnouncement.server", () => ({ trackAnnouncement }));
vi.mock("@/lib/bty/announcement/trackNotifications.server", () => ({ scheduleTrackNotifications }));
vi.mock("@/lib/bty/teams/actionReceipt.server", () => ({ scheduleActionReceipt }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => admin }));
vi.mock("@/lib/bty/teams/tenantRoute.server", () => ({ rememberTenantRoute: vi.fn() }));

const TID = "11111111-1111-1111-1111-111111111111";
const OID = "22222222-2222-2222-2222-222222222222";
const RECIPIENT = "33333333-3333-3333-3333-333333333333";
const OWNER = "81f08aa1-0000-0000-0000-000000000000";

function request(data: Record<string, unknown> = {}, over: Record<string, unknown> = {}) {
  return new NextRequest("https://example.test/api/bty/teams/invoke", {
    method: "POST", headers: { authorization: "Bearer fixture", "content-type": "application/json" },
    body: JSON.stringify({
      serviceUrl: "https://smba.trafficmanager.net/emea/", name: "composeExtension/submitAction",
      channelData: { tenant: { id: TID } }, from: { id: "29:fixture", aadObjectId: OID },
      conversation: { id: "19:fixture@thread.tacv2" },
      value: {
        commandId: "trackWithBty", messagePayload: { id: "fixture-message", body: { content: "PRIVATE SOURCE" } },
        data: { trackingMode: "acknowledgment", hostFraming: "Please confirm", recipients: RECIPIENT, ...data },
      }, ...over,
    }),
  });
}
const post = async (req: NextRequest) => (await import("./route")).POST(req);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TEAMS_BOT_TENANT_ID", TID);
  vi.spyOn(console, "error").mockImplementation(() => {});
  verifyBotFrameworkToken.mockResolvedValue({ ok: true, payload: {} });
  resolveBtyUserFromMicrosoftIdentity.mockResolvedValue({ status: "RESOLVED", userId: OWNER });
  trackAnnouncement.mockResolvedValue({ ok: true, announcementId: "persisted-announcement", count: 1, alreadyExisted: false });
  scheduleTrackNotifications.mockReturnValue("scheduled");
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("initial Track delivery is scheduled after canonical persistence", () => {
  it.each(["", "   "])("empty guidance (%j) keeps the setup editable and the selected mode", async hostFraming => {
    const response = await post(request({ hostFraming, trackingMode: "response" }));
    const body = await response.json();
    const card = body.task.value.card.content;
    expect(card.body).toContainEqual(expect.objectContaining({ id: "hostFraming", value: hostFraming }));
    expect(card.body).toContainEqual(expect.objectContaining({ id: "trackingMode", value: "response" }));
    expect(card.body).toContainEqual(expect.objectContaining({ text: "Add a line about what they should know or do." }));
    expect(card.actions).toContainEqual(expect.objectContaining({ type: "Action.Submit" }));
    const audience = card.body.find((item: { id?: string }) => item.id === "recipients");
    expect(audience.value ?? "").toBe("");
    expect(trackAnnouncement).not.toHaveBeenCalled();
    expect(scheduleTrackNotifications).not.toHaveBeenCalled();
  });

  it("form recovery bounds display text and never preserves an invalid mode or audience", async () => {
    const response = await post(request({
      hostFraming: "x".repeat(1200), trackingMode: "attacker-mode", recipients: "",
      ownerUserId: "attacker", serviceUrl: "https://attacker.test",
    }));
    const body = await response.json();
    const card = body.task.value.card.content;
    const framing = card.body.find((item: { id?: string }) => item.id === "hostFraming");
    const mode = card.body.find((item: { id?: string }) => item.id === "trackingMode");
    const audience = card.body.find((item: { id?: string }) => item.id === "recipients");
    expect(framing.value).toHaveLength(1000);
    expect(mode.value).toBeUndefined();
    expect(audience.value ?? "").toBe("");
    expect(JSON.stringify(body)).not.toContain("attacker");
    expect(trackAnnouncement).not.toHaveBeenCalled();
    expect(scheduleTrackNotifications).not.toHaveBeenCalled();
  });

  it("schedules only the persisted announcement and verified owner, ignoring injected delivery fields", async () => {
    const response = await post(request({ announcementId: "injected", ownerUserId: "attacker", recipientId: "injected" }));
    expect(response.status).toBe(200);
    expect(scheduleTrackNotifications).toHaveBeenCalledWith(admin, { announcementId: "persisted-announcement", ownerUserId: OWNER });
    expect(scheduleActionReceipt).toHaveBeenCalledWith(admin, {
      tenantId: TID, aadObjectId: OID, serviceUrl: "https://smba.trafficmanager.net/emea/", action: "track", locale: "en",
    });
    expect(trackAnnouncement.mock.invocationCallOrder[0]).toBeLessThan(scheduleTrackNotifications.mock.invocationCallOrder[0]);
    expect(trackAnnouncement.mock.invocationCallOrder[0]).toBeLessThan(scheduleActionReceipt.mock.invocationCallOrder[0]);
    const body = JSON.stringify(await response.json());
    expect(body).toContain("Tracking started");
    expect(body).not.toMatch(/notification sent|message sent|PRIVATE SOURCE|attacker/i);
  });

  it("a repeated Track retries initial delivery on the same stored audience", async () => {
    trackAnnouncement.mockResolvedValue({ ok: true, announcementId: "original-announcement", count: 2, alreadyExisted: true });
    await post(request());
    expect(scheduleTrackNotifications).toHaveBeenCalledWith(admin, { announcementId: "original-announcement", ownerUserId: OWNER });
    expect(scheduleActionReceipt).not.toHaveBeenCalled();
  });

  it.each(["track_failed", "invalid_recipients"])("does not schedule when persistence returns %s", async reason => {
    trackAnnouncement.mockResolvedValue({ ok: false, reason });
    await post(request());
    expect(scheduleTrackNotifications).not.toHaveBeenCalled();
    expect(scheduleActionReceipt).not.toHaveBeenCalled();
  });

  it("does not schedule for an unverified caller, invalid routing, a missing framing or an open dialog", async () => {
    verifyBotFrameworkToken.mockResolvedValueOnce({ ok: false, reason: "invalid_token" });
    await post(request());
    await post(request({}, { serviceUrl: "http://invalid.test" }));
    await post(request({ hostFraming: " " }));
    await post(request({}, { name: "composeExtension/fetchTask" }));
    expect(scheduleTrackNotifications).not.toHaveBeenCalled();
    expect(scheduleActionReceipt).not.toHaveBeenCalled();
    expect(trackAnnouncement).not.toHaveBeenCalled();
  });

  it("background scheduling failure preserves the saved Track without claiming delivery", async () => {
    scheduleTrackNotifications.mockReturnValue("unavailable");
    const response = await post(request());
    expect(scheduleTrackNotifications).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    const body = JSON.stringify(await response.json());
    expect(body).toContain("Tracking started");
    expect(body).not.toMatch(/notification sent|message sent/i);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scheduleActionReceipt } from "./actionReceipt.server";

const { after, getBotFrameworkToken, resolveTeamsConversation, sendProactiveMessage } = vi.hoisted(() => ({
  after: vi.fn<(callback: () => Promise<void>) => void>(),
  getBotFrameworkToken: vi.fn(),
  resolveTeamsConversation: vi.fn(),
  sendProactiveMessage: vi.fn(),
}));

vi.mock("next/server", () => ({ after }));
vi.mock("./botToken.server", () => ({ getBotFrameworkToken }));
vi.mock("./resolveTeamsConversation.server", () => ({ resolveTeamsConversation }));
vi.mock("./proactiveConversation.server", () => ({ sendProactiveMessage }));

const admin = {} as never;
const serviceUrl = "https://smba.trafficmanager.net/emea/";
const input = { tenantId: "verified-tenant", aadObjectId: "verified-caller", serviceUrl };
const runAfterResponse = () => after.mock.calls[0][0]();

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("TEAMS_BOT_APP_ID", "bty-bot");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  getBotFrameworkToken.mockResolvedValue({ ok: true, token: "connector-token" });
  resolveTeamsConversation.mockResolvedValue({ ok: true, serviceUrl, conversationId: "personal-bty-chat" });
  sendProactiveMessage.mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Teams private action receipt", () => {
  it.each([
    ["save", "en", "✓ Saved. Find it in Today → Saved for later."],
    ["track", "ko", "✓ 공지 추적을 시작했습니다. 오늘 → 공지 추적에서 확인하세요."],
  ] as const)("sends %s in the verified caller's personal chat after the response", async (action, locale, text) => {
    scheduleActionReceipt(admin, { ...input, action, locale });
    expect(after).toHaveBeenCalledOnce();
    expect(getBotFrameworkToken).not.toHaveBeenCalled();
    expect(sendProactiveMessage).not.toHaveBeenCalled();

    await runAfterResponse();
    expect(resolveTeamsConversation).toHaveBeenCalledWith(admin, { ...input, appId: "bty-bot", token: "connector-token" });
    expect(sendProactiveMessage).toHaveBeenCalledOnce();
    expect(sendProactiveMessage).toHaveBeenCalledWith({
      token: "connector-token", serviceUrl, conversationId: "personal-bty-chat", text,
    });
  });

  it("does not fall back to the source chat when the personal bot is not installed", async () => {
    resolveTeamsConversation.mockResolvedValue({ ok: false, reason: "not_installed" });
    scheduleActionReceipt(admin, { ...input, action: "track", locale: "en" });
    await runAfterResponse();
    expect(sendProactiveMessage).not.toHaveBeenCalled();
  });

  it("does not use an unapproved Connector route from the invoke or the stored conversation", async () => {
    const unapproved = "https://smba.trafficmanager.net.example.test/emea/";
    scheduleActionReceipt(admin, { ...input, serviceUrl: unapproved, action: "track", locale: "en" });
    expect(after).not.toHaveBeenCalled();

    resolveTeamsConversation.mockResolvedValue({ ok: true, serviceUrl: unapproved, conversationId: "personal-bty-chat" });
    scheduleActionReceipt(admin, { ...input, action: "track", locale: "en" });
    await runAfterResponse();
    expect(sendProactiveMessage).not.toHaveBeenCalled();
  });

  it("makes no second send after an ambiguous Connector response", async () => {
    sendProactiveMessage.mockResolvedValue({ ok: false, ambiguous: true, failure: "unreachable" });
    scheduleActionReceipt(admin, { ...input, action: "save", locale: "en" });
    await runAfterResponse();
    expect(sendProactiveMessage).toHaveBeenCalledOnce();
  });

  it("keeps the invoke usable without after() support", () => {
    after.mockImplementation(() => { throw new Error("No request context"); });
    expect(() => scheduleActionReceipt(admin, { ...input, action: "save", locale: "en" })).not.toThrow();
    expect(sendProactiveMessage).not.toHaveBeenCalled();
  });
});

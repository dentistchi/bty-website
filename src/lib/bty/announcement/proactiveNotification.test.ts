import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildProactiveMessage } from "@/domain/teams/proactiveMessage";

/**
 * SLICE A0.2 — one real proactive message, and everything it must not do.
 *
 * The product claim: a person who has never opened BTY can be told, in Teams, that a Host asked
 * something of them. The dangerous half is everything around it — a delivery must not invent an
 * account, must not republish someone else's message, must not mark a person told when nothing
 * reached them, and must never be able to damage the Track it came from.
 */

const rpc = vi.fn();
const resolveDisplayNames = vi.fn();
const getBotFrameworkToken = vi.fn();
const createOneOnOneConversation = vi.fn();
const sendProactiveMessage = vi.fn();

vi.mock("@/lib/bty/announcement/recipientDisplayName.server", () => ({ resolveDisplayNames }));
vi.mock("@/lib/bty/teams/botToken.server", () => ({ getBotFrameworkToken }));
vi.mock("@/lib/bty/teams/proactiveConversation.server", () => ({
  createOneOnOneConversation,
  sendProactiveMessage,
}));

const TENANT = "10110d5c-bd30-467e-9912-e44e67777647";
const AAD = "f5767307-f693-4f8c-8e6c-5fb8a256b895";
const OWNER = "81f08aa1-44a2-40b1-9190-7866151461a7";
const RECIP = "aaaaaaaa-0000-0000-0000-000000000001";
const URL_ = "https://smba.example.net/amer/10110d5c/";
const FRAMING = "Please read this before Friday.";

const admin = { rpc } as never;
const notify = async (over: Record<string, unknown> = {}) => {
  const { notifyRecipient } = await import("@/lib/bty/announcement/notifyRecipient.server");
  return notifyRecipient(admin, { recipientId: RECIP, ownerUserId: OWNER, appId: "bot-app-id", ...over });
};

/** The default happy shape: eligible, lease granted, no stored conversation yet. */
const CLAIM = "cccccccc-0000-0000-0000-00000000000c";
const CONV_CLAIM = "dddddddd-0000-0000-0000-00000000000d";
function beginOk(conversationId: string | null = null) {
  return {
    data: [{
      result: "ok", claim_token: CLAIM, tenant_id: TENANT, aad_object_id: AAD,
      service_url: URL_, host_framing: FRAMING, conversation_id: conversationId,
    }],
    error: null,
  };
}

/** Every claim RPC answers happily unless a test overrides it. */
function claimRpc(fn: string) {
  if (fn === "bty_begin_recipient_notification") return Promise.resolve(beginOk());
  if (fn === "bty_mark_recipient_notification_sending") return Promise.resolve({ data: [{ result: "sending" }], error: null });
  if (fn === "bty_confirm_recipient_notification") return Promise.resolve({ data: [{ result: "notified" }], error: null });
  if (fn === "bty_release_recipient_notification_claim") return Promise.resolve({ data: [{ result: "released" }], error: null });
  // The per-person conversation lease (A0.2R2). The blind upsert this replaced is gone.
  if (fn === "bty_begin_teams_conversation_creation")
    return Promise.resolve({ data: [{ result: "ok", claim_token: CONV_CLAIM, service_url: URL_, conversation_id: null }], error: null });
  if (fn === "bty_mark_teams_conversation_creating")
    return Promise.resolve({ data: [{ result: "creating", service_url: null, conversation_id: null }], error: null });
  if (fn === "bty_confirm_teams_conversation_created")
    return Promise.resolve({ data: [{ result: "created", service_url: URL_, conversation_id: "19:conv@personal" }], error: null });
  if (fn === "bty_release_teams_conversation_creation_claim") return Promise.resolve({ data: [{ result: "released" }], error: null });
  return Promise.resolve({ data: null, error: null });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  rpc.mockImplementation(claimRpc);
  resolveDisplayNames.mockResolvedValue(new Map([[OWNER, "Dr. Chi"]]));
  getBotFrameworkToken.mockResolvedValue({ ok: true, token: "tok" });
  createOneOnOneConversation.mockResolvedValue({ ok: true, conversationId: "19:conv@personal" });
  sendProactiveMessage.mockResolvedValue({ ok: true });
});

const called = (fn: string) => rpc.mock.calls.filter((c) => c[0] === fn);

describe("J — the credential is allowed to be absent, and Track survives it", () => {
  it("credential_missing sends nothing, confirms nothing, and does not throw", async () => {
    getBotFrameworkToken.mockResolvedValue({ ok: false, reason: "credential_missing" });
    const r = await notify();
    expect(r).toEqual({ ok: false, reason: "credential_missing" });
    expect(createOneOnOneConversation).not.toHaveBeenCalled();
    expect(sendProactiveMessage).not.toHaveBeenCalled();
    expect(called("bty_confirm_recipient_notification")).toHaveLength(0);
  });

  it("a rejected credential is reported as auth_failed, NOT as missing", async () => {
    // The two send a human to different places: one configures a secret, the other hunts a
    // wrong password. Collapsing them wastes the first hour of the investigation.
    getBotFrameworkToken.mockResolvedValue({ ok: false, reason: "auth_failed" });
    expect(await notify()).toEqual({ ok: false, reason: "auth_failed" });
  });

  it("NOTHING about the announcement, recipients or users is ever written on any failure path", async () => {
    for (const fail of [
      () => getBotFrameworkToken.mockResolvedValue({ ok: false, reason: "credential_missing" }),
      () => createOneOnOneConversation.mockResolvedValue({ ok: false, failure: "not_installed", ambiguous: false }),
      () => sendProactiveMessage.mockResolvedValue({ ok: false, failure: "unreachable", ambiguous: true }),
    ]) {
      vi.clearAllMocks();
      rpc.mockImplementation(claimRpc);
      getBotFrameworkToken.mockResolvedValue({ ok: true, token: "tok" });
      createOneOnOneConversation.mockResolvedValue({ ok: true, conversationId: "19:c" });
      sendProactiveMessage.mockResolvedValue({ ok: true });
      fail();
      await notify();
      const written = rpc.mock.calls.map((c) => c[0]);
      expect(written).not.toContain("bty_confirm_recipient_notification");
      expect(written.join()).not.toMatch(/track_announcement|bind_announcement|respond|handle/);
    }
  });
});

describe("H — at most once, and a failure stays retryable", () => {
  it("a successful send writes notified_at, and only then", async () => {
    const r = await notify();
    expect(r).toEqual({ ok: true, conversationId: "19:conv@personal", reused: false });
    const order = rpc.mock.calls.map((c) => c[0]);
    expect(order.indexOf("bty_confirm_recipient_notification")).toBeGreaterThan(order.indexOf("bty_begin_recipient_notification"));
    expect(sendProactiveMessage).toHaveBeenCalledTimes(1);
  });

  it("an already-notified recipient sends NOTHING on a second attempt", async () => {
    rpc.mockImplementation((fn: string) =>
      fn === "bty_begin_recipient_notification"
        ? Promise.resolve({ data: [{ result: "already_notified" }], error: null })
        : claimRpc(fn));
    const r = await notify();
    expect(r).toEqual({ ok: false, reason: "already_notified" });
    expect(getBotFrameworkToken).not.toHaveBeenCalled();
    expect(sendProactiveMessage).not.toHaveBeenCalled();
  });

  it("a send failure leaves notified_at unwritten, so the next attempt still sends", async () => {
    // Definitive: the message provably was not accepted, so the lease is freed for an
    // immediate retry rather than being left to expire.
    sendProactiveMessage.mockResolvedValueOnce({ ok: false, failure: "invalid_request", ambiguous: false });
    expect(await notify()).toEqual({ ok: false, reason: "invalid_request" });
    expect(called("bty_confirm_recipient_notification")).toHaveLength(0);

    sendProactiveMessage.mockResolvedValue({ ok: true });
    expect((await notify()).ok).toBe(true);
    expect(called("bty_confirm_recipient_notification")).toHaveLength(1);
  });

  it("a conversation created but not sent to is REMEMBERED, so the retry reuses it", async () => {
    // The thread exists in Teams the moment Teams says so. Forgetting it because the message
    // failed would orphan a real conversation and open a second one on the retry.
    sendProactiveMessage.mockResolvedValue({ ok: false, failure: "throttled", ambiguous: false });
    await notify();
    expect(called("bty_confirm_teams_conversation_created")).toHaveLength(1);
    expect(called("bty_confirm_teams_conversation_created")[0][1]).toEqual({
      p_tenant_id: TENANT, p_aad_object_id: AAD, p_claim_token: CONV_CLAIM,
      p_service_url: URL_, p_conversation_id: "19:conv@personal",
    });
  });

  it("a stored conversation is reused and NOT created again", async () => {
    rpc.mockImplementation((fn: string) =>
      fn === "bty_begin_recipient_notification" ? Promise.resolve(beginOk("19:existing@personal")) : claimRpc(fn));
    const r = await notify();
    expect(r).toEqual({ ok: true, conversationId: "19:existing@personal", reused: true });
    expect(createOneOnOneConversation).not.toHaveBeenCalled();
    expect(called("bty_begin_teams_conversation_creation")).toHaveLength(0);
  });

  it("a send that succeeded but could not be recorded reports FAILURE, not success", async () => {
    // Deliberate: the row stays retryable and someone may get a second message. The opposite
    // mistake — recording a delivery that was never written — is silent and permanent.
    rpc.mockImplementation((fn: string) =>
      fn === "bty_confirm_recipient_notification" ? Promise.resolve({ data: null, error: { code: "XX000" } }) : claimRpc(fn));
    expect(await notify()).toEqual({ ok: false, reason: "confirm_failed" });
  });
});

describe("J — routing may never be improvised", () => {
  it("an announcement with no stored service_url is refused before any network call", async () => {
    rpc.mockImplementation((fn: string) =>
      fn === "bty_begin_recipient_notification"
        ? Promise.resolve({ data: [{ result: "no_service_url" }], error: null })
        : claimRpc(fn));
    expect(await notify()).toEqual({ ok: false, reason: "no_service_url" });
    expect(getBotFrameworkToken).not.toHaveBeenCalled();
    expect(createOneOnOneConversation).not.toHaveBeenCalled();
  });

  it("every outbound call uses the coordinate stored on the Track, never a constant", async () => {
    await notify();
    expect(createOneOnOneConversation).toHaveBeenCalledWith(expect.objectContaining({ serviceUrl: URL_ }));
    expect(sendProactiveMessage).toHaveBeenCalledWith(expect.objectContaining({ serviceUrl: URL_ }));
  });

  it("a non-owner is refused exactly like a missing row", async () => {
    rpc.mockImplementation((fn: string) =>
      fn === "bty_begin_recipient_notification"
        ? Promise.resolve({ data: [{ result: "not_found" }], error: null })
        : claimRpc(fn));
    expect(await notify()).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("J — identity, and the account that must not be created", () => {
  it("the person is addressed by tenant + Entra object id only", async () => {
    await notify();
    const args = createOneOnOneConversation.mock.calls[0][0];
    expect(args.tenantId).toBe(TENANT);
    expect(args.aadObjectId).toBe(AAD);
    expect(JSON.stringify(args)).not.toMatch(/@|upn|email|displayName/i);
  });

  it("no user is created, bound or mutated by sending", async () => {
    await notify();
    const fns = rpc.mock.calls.map((c) => c[0]);
    expect(fns).toEqual([
      "bty_begin_recipient_notification",
      // Conversation creation is serialized on the PERSON before anything is created.
      "bty_begin_teams_conversation_creation",
      "bty_mark_teams_conversation_creating",
      "bty_confirm_teams_conversation_created",
      // The send boundary sits between the conversation and the message, and nowhere else.
      "bty_mark_recipient_notification_sending",
      "bty_confirm_recipient_notification",
    ]);
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("p_user_id");
  });

  it("the Host's name comes from the provider-written source, never user_metadata", async () => {
    await notify();
    expect(resolveDisplayNames).toHaveBeenCalledWith(admin, [OWNER]);
  });
});

describe("F — the message itself", () => {
  const msg = (over: Partial<Parameters<typeof buildProactiveMessage>[0]> = {}) =>
    buildProactiveMessage({ hostName: "Dr. Chi", hostFraming: FRAMING, openUrl: "https://arena.btydaily.com/", ...over });

  it("answers who is asking, what they want, and where to go", async () => {
    const t = msg();
    expect(t).toContain("Dr. Chi");
    expect(t).toContain(FRAMING);
    expect(t).toContain("https://arena.btydaily.com/");
  });

  it("never carries the captured source message body", async () => {
    await notify();
    const sentText = sendProactiveMessage.mock.calls[0][0].text;
    expect(sentText).toContain(FRAMING);
    // `begin` returns the Host's framing and nothing from the tracked message; the sender has no
    // access to a source body at all, which is what makes republishing structurally impossible.
    const beginArgs = called("bty_begin_recipient_notification")[0][1];
    expect(Object.keys(beginArgs)).toEqual(["p_recipient_id", "p_owner_user_id"]);
  });

  it("builds NO Got it / Question / Need help controls", async () => {
    await notify();
    const activity = JSON.stringify(sendProactiveMessage.mock.calls[0][0]);
    for (const dupe of ["Got it", "I have a question", "I need help", "ACKNOWLEDGED", "HELP_NEEDED", "suggestedActions", "attachments"]) {
      expect(activity, dupe).not.toContain(dupe);
    }
  });

  it("degrades to a neutral phrase rather than inventing an identifier", () => {
    expect(msg({ hostName: null })).toContain("Someone on your team");
    expect(msg({ hostName: "   " })).toContain("Someone on your team");
    expect(msg({ hostName: null })).not.toMatch(/@|null|undefined/);
  });

  it("is bounded, so a long framing cannot produce an unsendable activity", () => {
    const t = msg({ hostFraming: "x".repeat(5000) });
    expect(t.length).toBeLessThanOrEqual(1400);
    expect(t.endsWith("…")).toBe(true);
  });
});

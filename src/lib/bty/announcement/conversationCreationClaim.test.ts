import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClaimFake, makeRecipient, TTL_MS } from "@/lib/bty/announcement/notificationClaimFake.testkit";

/**
 * SLICE A0.2R2 — the per-person conversation creation lease.
 *
 * A conversation is an EXTERNAL side effect: once Teams has made a thread, no database constraint
 * can un-make it. So the rules that matter here are about restraint — when NOT to call Microsoft.
 */

const resolveDisplayNames = vi.fn();
const getBotFrameworkToken = vi.fn();
const createOneOnOneConversation = vi.fn();
const sendProactiveMessage = vi.fn();

vi.mock("@/lib/bty/announcement/recipientDisplayName.server", () => ({ resolveDisplayNames }));
vi.mock("@/lib/bty/teams/botToken.server", () => ({ getBotFrameworkToken }));
vi.mock("@/lib/bty/teams/proactiveConversation.server", () => ({ createOneOnOneConversation, sendProactiveMessage }));

const OWNER = "81f08aa1-44a2-40b1-9190-7866151461a7";
const notifyOf = async () => (await import("@/lib/bty/announcement/notifyRecipient.server")).notifyRecipient;
const rpcOf = (fake: { admin: unknown }) =>
  (fake.admin as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: Array<Record<string, unknown>> }> }).rpc;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  resolveDisplayNames.mockResolvedValue(new Map([[OWNER, "Dr. Chi"]]));
  getBotFrameworkToken.mockResolvedValue({ ok: true, token: "tok" });
  createOneOnOneConversation.mockResolvedValue({ ok: true, conversationId: "19:conv" });
  sendProactiveMessage.mockResolvedValue({ ok: true });
});

describe("M — an AMBIGUOUS createConversation never leads to a second thread", () => {
  it("keeps the creation claim, records nothing, and sends nothing", async () => {
    const r = makeRecipient();
    const fake = createClaimFake([r]);
    const notify = await notifyOf();
    createOneOnOneConversation.mockResolvedValue({ ok: false, failure: "unreachable", ambiguous: true });

    expect(await notify(fake.admin, { recipientId: "r1", ownerUserId: OWNER, appId: "app" }))
      .toEqual({ ok: false, reason: "conversation_creation_unknown" });

    // A thread may exist in Teams that nobody can name. Nothing is recorded as confirmed.
    expect(fake.convRefs.size).toBe(0);
    expect(sendProactiveMessage).not.toHaveBeenCalled();
    const claim = [...fake.creationClaims.values()][0];
    expect(claim).toBeTruthy();
    expect(claim.createStartedAt).not.toBeNull();
    // The recipient's own delivery lease IS freed: the message send never began, and this
    // recipient is not the thing that is stuck.
    expect(r.claimToken).toBeNull();
    expect(r.notifiedAt).toBeNull();
  });

  it("after the lease expires, a fresh attempt STILL refuses to create", async () => {
    const r = makeRecipient();
    const fake = createClaimFake([r]);
    const notify = await notifyOf();
    createOneOnOneConversation.mockResolvedValue({ ok: false, failure: "unreachable", ambiguous: true });
    await notify(fake.admin, { recipientId: "r1", ownerUserId: OWNER, appId: "app" });
    expect(createOneOnOneConversation).toHaveBeenCalledTimes(1);

    fake.advance(TTL_MS + 1000);
    createOneOnOneConversation.mockResolvedValue({ ok: true, conversationId: "19:second" });

    expect(await notify(fake.admin, { recipientId: "r1", ownerUserId: OWNER, appId: "app" }))
      .toEqual({ ok: false, reason: "conversation_creation_unknown" });
    // The whole point: expiry is NOT permission to repeat an outbound call whose result is unknown.
    expect(createOneOnOneConversation).toHaveBeenCalledTimes(1);
    expect(sendProactiveMessage).not.toHaveBeenCalled();
    expect(fake.convRefs.size).toBe(0);
  });

  it("a DEFINITIVE create rejection releases both leases and stays retryable", async () => {
    const r = makeRecipient();
    const fake = createClaimFake([r]);
    const notify = await notifyOf();
    createOneOnOneConversation.mockResolvedValue({ ok: false, failure: "not_installed", ambiguous: false });

    expect(await notify(fake.admin, { recipientId: "r1", ownerUserId: OWNER, appId: "app" }))
      .toEqual({ ok: false, reason: "not_installed" });
    expect(fake.creationClaims.size).toBe(0);
    expect(r.claimToken).toBeNull();

    createOneOnOneConversation.mockResolvedValue({ ok: true, conversationId: "19:ok" });
    expect((await notify(fake.admin, { recipientId: "r1", ownerUserId: OWNER, appId: "app" })).ok).toBe(true);
  });
});

describe("N — a stale conversation token is inert", () => {
  it("an expired UNSTARTED claim is reclaimed, and the old token can do nothing after", async () => {
    const fake = createClaimFake([makeRecipient()]);
    const rpc = rpcOf(fake);
    const id = { p_tenant_id: "t", p_aad_object_id: "a", p_service_url: "https://x.example.net/e/" };

    const first = (await rpc("bty_begin_teams_conversation_creation", id)).data[0];
    expect(first.result).toBe("ok");
    const stale = first.claim_token as string;

    fake.advance(TTL_MS + 1000);
    const second = (await rpc("bty_begin_teams_conversation_creation", id)).data[0];
    expect(second.result).toBe("ok");
    expect(second.claim_token).not.toBe(stale);

    // The old owner may not mark, confirm, or free the new owner's claim.
    expect((await rpc("bty_mark_teams_conversation_creating", { p_tenant_id: "t", p_aad_object_id: "a", p_claim_token: stale })).data[0].result)
      .toBe("claim_mismatch");
    expect((await rpc("bty_confirm_teams_conversation_created", {
      p_tenant_id: "t", p_aad_object_id: "a", p_claim_token: stale,
      p_service_url: "https://x.example.net/e/", p_conversation_id: "19:ghost",
    })).data[0].result).toBe("claim_mismatch");
    expect((await rpc("bty_release_teams_conversation_creation_claim", { p_tenant_id: "t", p_aad_object_id: "a", p_claim_token: stale })).data[0].result)
      .toBe("claim_mismatch");

    expect(fake.convRefs.size).toBe(0);
    expect(fake.creationClaims.size).toBe(1);
  });

  it("a confirmed reference is never overwritten, not even by a well-formed token", async () => {
    const fake = createClaimFake([makeRecipient()]);
    const rpc = rpcOf(fake);
    fake.seedConversation("t", "a", { serviceUrl: "https://real.example.net/emea/", conversationId: "19:real" });

    const res = (await rpc("bty_confirm_teams_conversation_created", {
      p_tenant_id: "t", p_aad_object_id: "a", p_claim_token: "anything",
      p_service_url: "https://wrong.example.net/amer/", p_conversation_id: "19:wrong",
    })).data[0];
    expect(res.result).toBe("already_exists");
    // The canonical pair is returned, and the confirmed row is untouched.
    expect(res.service_url).toBe("https://real.example.net/emea/");
    expect(res.conversation_id).toBe("19:real");
    expect(fake.convRefs.get("t|a")).toEqual({ serviceUrl: "https://real.example.net/emea/", conversationId: "19:real" });
  });

  it("a confirm for a creation that never began cannot write a reference", async () => {
    const fake = createClaimFake([makeRecipient()]);
    const rpc = rpcOf(fake);
    const id = { p_tenant_id: "t", p_aad_object_id: "a", p_service_url: "https://x.example.net/e/" };
    const token = (await rpc("bty_begin_teams_conversation_creation", id)).data[0].claim_token;

    expect((await rpc("bty_confirm_teams_conversation_created", {
      p_tenant_id: "t", p_aad_object_id: "a", p_claim_token: token,
      p_service_url: "https://x.example.net/e/", p_conversation_id: "19:c",
    })).data[0].result).toBe("create_not_started");
    expect(fake.convRefs.size).toBe(0);
  });
});

describe("I — service_url and conversation_id are ONE coordinate", () => {
  it("a stored conversation is routed with the base URL it was created on, not the announcement's", async () => {
    // The 20260908 bug: announcement.service_url was paired with the stored conversation_id. If
    // the announcement was tracked from a different regional base, the send would be POSTed to a
    // conversation that does not exist there.
    const r = makeRecipient({ serviceUrl: "https://announcement.example.net/amer/" });
    const fake = createClaimFake([r]);
    fake.seedConversation(r.tenantId, r.aadObjectId, {
      serviceUrl: "https://where-the-thread-lives.example.net/emea/",
      conversationId: "19:existing",
    });
    const notify = await notifyOf();

    const res = await notify(fake.admin, { recipientId: "r1", ownerUserId: OWNER, appId: "app" });
    expect(res).toEqual({ ok: true, conversationId: "19:existing", reused: true });
    expect(createOneOnOneConversation).not.toHaveBeenCalled();
    expect(sendProactiveMessage).toHaveBeenCalledWith(expect.objectContaining({
      serviceUrl: "https://where-the-thread-lives.example.net/emea/",
      conversationId: "19:existing",
    }));
    // The announcement's own coordinate is NOT what carried the message.
    expect(sendProactiveMessage).not.toHaveBeenCalledWith(expect.objectContaining({
      serviceUrl: "https://announcement.example.net/amer/",
    }));
  });

  it("a NEW conversation is created against the announcement's observed coordinate", async () => {
    const r = makeRecipient({ serviceUrl: "https://announcement.example.net/amer/" });
    const fake = createClaimFake([r]);
    const notify = await notifyOf();
    await notify(fake.admin, { recipientId: "r1", ownerUserId: OWNER, appId: "app" });
    expect(createOneOnOneConversation).toHaveBeenCalledWith(expect.objectContaining({
      serviceUrl: "https://announcement.example.net/amer/",
    }));
    // ...and that same pair becomes the confirmed reference.
    expect(fake.convRefs.get(`${r.tenantId}|${r.aadObjectId}`))
      .toEqual({ serviceUrl: "https://announcement.example.net/amer/", conversationId: "19:conv" });
  });
});

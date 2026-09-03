import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClaimFake, makeRecipient, TTL_MS } from "@/lib/bty/announcement/notificationClaimFake.testkit";

/**
 * SLICE A0.2R — the two concurrency gates.
 *
 * GATE 1: two overlapping notify requests for the SAME recipient must produce exactly one
 * outbound message. Under 20260908 they produced two: both passed `begin`, both POSTed, and only
 * then did one find the other's `notified_at`.
 *
 * GATE 2: two announcements to the SAME PERSON, measured rather than assumed.
 */

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

const OWNER = "81f08aa1-44a2-40b1-9190-7866151461a7";
const notifyOf = async () => (await import("@/lib/bty/announcement/notifyRecipient.server")).notifyRecipient;

/** A network call that yields, so two in-flight attempts genuinely interleave. */
const slow = <T,>(v: T, ms = 5) => new Promise<T>((res) => setTimeout(() => res(v), ms));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  resolveDisplayNames.mockResolvedValue(new Map([[OWNER, "Dr. Chi"]]));
  getBotFrameworkToken.mockResolvedValue({ ok: true, token: "tok" });
  createOneOnOneConversation.mockImplementation(() => slow({ ok: true, conversationId: "19:conv" }));
  sendProactiveMessage.mockImplementation(() => slow({ ok: true }));
});

describe("GATE 1 — same recipient, simultaneous requests", () => {
  it("two overlapping notifies produce exactly ONE Connector message", async () => {
    // The defect, expressed directly. Both calls start before either finishes.
    const r = makeRecipient();
    const fake = createClaimFake([r]);
    const notify = await notifyOf();

    const [a, b] = await Promise.all([
      notify(fake.admin, { recipientId: "r1", ownerUserId: OWNER, appId: "app" }),
      notify(fake.admin, { recipientId: "r1", ownerUserId: OWNER, appId: "app" }),
    ]);

    expect(sendProactiveMessage).toHaveBeenCalledTimes(1);
    const outcomes = [a, b];
    expect(outcomes.filter((o) => o.ok)).toHaveLength(1);
    expect(outcomes.filter((o) => !o.ok && o.reason === "in_progress")).toHaveLength(1);
    expect(r.notifiedAt).not.toBeNull();
    // The lease is spent: the terminal representation is notified_at alone.
    expect(r.claimToken).toBeNull();
    expect(r.claimExpiresAt).toBeNull();
    expect(r.sendStartedAt).toBeNull();
  });

  it("the loser never even authenticates, let alone creates a conversation", async () => {
    const fake = createClaimFake([makeRecipient()]);
    const notify = await notifyOf();
    await Promise.all([
      notify(fake.admin, { recipientId: "r1", ownerUserId: OWNER, appId: "app" }),
      notify(fake.admin, { recipientId: "r1", ownerUserId: OWNER, appId: "app" }),
    ]);
    expect(getBotFrameworkToken).toHaveBeenCalledTimes(1);
    expect(createOneOnOneConversation).toHaveBeenCalledTimes(1);
  });

  it("a sequential retry after a confirmed delivery sends NOTHING", async () => {
    const r = makeRecipient();
    const fake = createClaimFake([r]);
    const notify = await notifyOf();
    expect((await notify(fake.admin, { recipientId: "r1", ownerUserId: OWNER, appId: "app" })).ok).toBe(true);
    vi.clearAllMocks();
    getBotFrameworkToken.mockResolvedValue({ ok: true, token: "tok" });
    const again = await notify(fake.admin, { recipientId: "r1", ownerUserId: OWNER, appId: "app" });
    expect(again).toEqual({ ok: false, reason: "already_notified" });
    expect(sendProactiveMessage).not.toHaveBeenCalled();
  });
});

describe("GATE 1 — the lease, and what expiry does and does not permit", () => {
  it("a pre-send failure releases the lease, so a retry may claim immediately", async () => {
    const r = makeRecipient();
    const fake = createClaimFake([r]);
    const notify = await notifyOf();

    getBotFrameworkToken.mockResolvedValue({ ok: false, reason: "credential_missing" });
    expect(await notify(fake.admin, { recipientId: "r1", ownerUserId: OWNER, appId: "app" }))
      .toEqual({ ok: false, reason: "credential_missing" });
    expect(r.claimToken).toBeNull();
    expect(r.sendStartedAt).toBeNull();

    getBotFrameworkToken.mockResolvedValue({ ok: true, token: "tok" });
    expect((await notify(fake.admin, { recipientId: "r1", ownerUserId: OWNER, appId: "app" })).ok).toBe(true);
  });

  it("a DEFINITIVE send rejection releases; the person provably has no message", async () => {
    const r = makeRecipient();
    const fake = createClaimFake([r]);
    const notify = await notifyOf();
    sendProactiveMessage.mockResolvedValue({ ok: false, failure: "throttled", ambiguous: false });
    expect(await notify(fake.admin, { recipientId: "r1", ownerUserId: OWNER, appId: "app" }))
      .toEqual({ ok: false, reason: "throttled" });
    expect(r.claimToken).toBeNull();
    expect(r.sendStartedAt).toBeNull();
    expect(r.notifiedAt).toBeNull();
  });

  it("an AMBIGUOUS send keeps the lease AND the send marker", async () => {
    const r = makeRecipient();
    const fake = createClaimFake([r]);
    const notify = await notifyOf();
    sendProactiveMessage.mockResolvedValue({ ok: false, failure: "unreachable", ambiguous: true });
    expect(await notify(fake.admin, { recipientId: "r1", ownerUserId: OWNER, appId: "app" }))
      .toEqual({ ok: false, reason: "delivery_unknown" });
    expect(r.claimToken).not.toBeNull();
    expect(r.sendStartedAt).not.toBeNull();
    expect(r.notifiedAt).toBeNull();
  });

  it("an expired lease with NO send started is reclaimable", async () => {
    const r = makeRecipient();
    const fake = createClaimFake([r]);
    const notify = await notifyOf();
    getBotFrameworkToken.mockResolvedValue({ ok: false, reason: "unreachable" });
    // Simulate a Worker that claimed and died before sending: leave the claim, clear nothing.
    r.claimToken = "orphan";
    r.claimExpiresAt = Date.now() + TTL_MS;
    r.sendStartedAt = null;
    fake.advance(TTL_MS + 1000);
    getBotFrameworkToken.mockResolvedValue({ ok: true, token: "tok" });
    const res = await notify(fake.admin, { recipientId: "r1", ownerUserId: OWNER, appId: "app" });
    expect(res.ok).toBe(true);
    expect(sendProactiveMessage).toHaveBeenCalledTimes(1);
  });

  it("an expired lease WITH a send started is delivery_unknown, and sends NOTHING", async () => {
    // The whole reason the third column exists: Teams may already hold that message.
    const r = makeRecipient({ claimToken: "orphan", claimExpiresAt: Date.now() + TTL_MS, sendStartedAt: Date.now() });
    const fake = createClaimFake([r]);
    fake.advance(TTL_MS + 1000);
    const notify = await notifyOf();
    expect(await notify(fake.admin, { recipientId: "r1", ownerUserId: OWNER, appId: "app" }))
      .toEqual({ ok: false, reason: "delivery_unknown" });
    expect(sendProactiveMessage).not.toHaveBeenCalled();
    expect(getBotFrameworkToken).not.toHaveBeenCalled();
    expect(r.notifiedAt).toBeNull();
  });

  it("a stale token can neither mark sending, confirm, nor free the new owner's lease", async () => {
    const r = makeRecipient({ claimToken: "current", claimExpiresAt: Date.now() + TTL_MS });
    const fake = createClaimFake([r]);
    for (const fn of [
      "bty_mark_recipient_notification_sending",
      "bty_confirm_recipient_notification",
      "bty_release_recipient_notification_claim",
    ]) {
      const { data } = await (fake.admin as unknown as { rpc: (f: string, a: unknown) => Promise<{ data: [{ result: string }] }> })
        .rpc(fn, { p_recipient_id: "r1", p_claim_token: "stale" });
      expect(data[0].result, fn).toBe("claim_mismatch");
    }
    expect(r.claimToken).toBe("current");
    expect(r.notifiedAt).toBeNull();
  });

  it("a confirm cannot invent a delivery on a row that never began sending", async () => {
    const r = makeRecipient({ claimToken: "c", claimExpiresAt: Date.now() + TTL_MS, sendStartedAt: null });
    const fake = createClaimFake([r]);
    const { data } = await (fake.admin as unknown as { rpc: (f: string, a: unknown) => Promise<{ data: [{ result: string }] }> })
      .rpc("bty_confirm_recipient_notification", { p_recipient_id: "r1", p_claim_token: "c" });
    expect(data[0].result).toBe("send_not_started");
    expect(r.notifiedAt).toBeNull();
  });
});

describe("GATE 2 — two announcements, one person, no conversation yet", () => {
  it("creates exactly ONE Teams conversation, and the loser sends nothing", async () => {
    // The measured defect: the delivery lease is per recipient ROW, so two announcements to one
    // person were two independently claimable rows that both created a thread. Creation is now
    // serialized on the PERSON.
    const shared = { tenantId: "t-1", aadObjectId: "person-1" };
    const rows = [makeRecipient({ id: "rA", ...shared }), makeRecipient({ id: "rB", ...shared })];
    const fake = createClaimFake(rows);
    const notify = await notifyOf();

    let n = 0;
    createOneOnOneConversation.mockImplementation(() => slow({ ok: true, conversationId: `19:conv-${++n}` }));

    const [a, b] = await Promise.all([
      notify(fake.admin, { recipientId: "rA", ownerUserId: OWNER, appId: "app" }),
      notify(fake.admin, { recipientId: "rB", ownerUserId: OWNER, appId: "app" }),
    ]);

    expect(createOneOnOneConversation).toHaveBeenCalledTimes(1);
    expect(fake.convRefs.size).toBe(1);

    const winner = [a, b].filter((o) => o.ok);
    const loser = [a, b].filter((o) => !o.ok);
    expect(winner).toHaveLength(1);
    expect(loser[0]).toEqual({ ok: false, reason: "conversation_in_progress" });
    // Exactly one message: the loser sent nothing at all.
    expect(sendProactiveMessage).toHaveBeenCalledTimes(1);
    // ...and it freed its own delivery lease, so the retry below is not blocked by it.
    expect(rows.find((r) => r.notifiedAt === null)!.claimToken).toBeNull();
  });

  it("the loser, retried, reuses the SAME conversation and sends its own message", async () => {
    const shared = { tenantId: "t-1", aadObjectId: "person-1" };
    const rows = [makeRecipient({ id: "rA", ...shared }), makeRecipient({ id: "rB", ...shared })];
    const fake = createClaimFake(rows);
    const notify = await notifyOf();
    createOneOnOneConversation.mockImplementation(() => slow({ ok: true, conversationId: "19:the-one" }));

    await Promise.all([
      notify(fake.admin, { recipientId: "rA", ownerUserId: OWNER, appId: "app" }),
      notify(fake.admin, { recipientId: "rB", ownerUserId: OWNER, appId: "app" }),
    ]);
    const pending = rows.find((r) => r.notifiedAt === null)!;

    const retry = await notify(fake.admin, { recipientId: pending.id, ownerUserId: OWNER, appId: "app" });
    expect(retry).toEqual({ ok: true, conversationId: "19:the-one", reused: true });

    // The end state the product needs: two announcement messages, ONE Teams thread, ONE row.
    expect(createOneOnOneConversation).toHaveBeenCalledTimes(1);
    expect(sendProactiveMessage).toHaveBeenCalledTimes(2);
    expect(fake.convRefs.size).toBe(1);
    expect(rows.every((r) => r.notifiedAt !== null)).toBe(true);
    expect(fake.creationClaims.size).toBe(0);
  });

  it("is closed once a conversation reference exists — the reuse path is sound", async () => {
    const shared = { tenantId: "t-2", aadObjectId: "person-2" };
    const rows = [makeRecipient({ id: "rA", ...shared }), makeRecipient({ id: "rB", ...shared })];
    const fake = createClaimFake(rows);
    fake.seedConversation("t-2", "person-2", { serviceUrl: "https://stored.example.net/emea/", conversationId: "19:already" });
    const notify = await notifyOf();

    await Promise.all([
      notify(fake.admin, { recipientId: "rA", ownerUserId: OWNER, appId: "app" }),
      notify(fake.admin, { recipientId: "rB", ownerUserId: OWNER, appId: "app" }),
    ]);
    expect(createOneOnOneConversation).not.toHaveBeenCalled();
    expect(sendProactiveMessage).toHaveBeenCalledTimes(2);
  });
});

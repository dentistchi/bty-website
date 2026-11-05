import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const { afterCallback, notifyRecipient } = vi.hoisted(() => ({ afterCallback: vi.fn(), notifyRecipient: vi.fn() }));
vi.mock("next/server", () => ({ after: afterCallback }));
vi.mock("./notifyRecipient.server", () => ({ notifyRecipient }));
import { dispatchTrackNotifications, scheduleTrackNotifications } from "./trackNotifications.server";

const input = { announcementId: "stored-announcement", ownerUserId: "verified-owner" };
const row = (id: string, over: Record<string, unknown> = {}) => ({
  id, opened_at: null, acknowledged_at: null, response_submitted_at: null,
  bty_tracked_announcements: { status: "active", tracking_mode: "acknowledgment" }, ...over,
});

function database(data: unknown = [row("recipient-1")], error: unknown = null) {
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockResolvedValue({ data, error }) };
  const from = vi.fn().mockReturnValue(query);
  return { admin: { from } as unknown as SupabaseClient, from, query };
}

beforeEach(() => {
  vi.clearAllMocks();
  afterCallback.mockImplementation(() => {});
  notifyRecipient.mockResolvedValue({ ok: true, conversationId: "private-conversation", reused: true });
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("response-bound background scheduling", () => {
  it("does not start a read or send until Next runs the after callback", async () => {
    const db = database();
    expect(scheduleTrackNotifications(db.admin, input)).toBe("scheduled");
    expect(db.from).not.toHaveBeenCalled();
    expect(notifyRecipient).not.toHaveBeenCalled();
    expect(afterCallback).toHaveBeenCalledWith(expect.any(Function));
    await afterCallback.mock.calls[0][0]();
    expect(notifyRecipient).toHaveBeenCalledWith(db.admin, { recipientId: "recipient-1", ownerUserId: "verified-owner" });
  });

  it("a runtime without after support sends nothing and reports unavailable", () => {
    const db = database();
    afterCallback.mockImplementation(() => { throw new Error("no request context"); });
    expect(scheduleTrackNotifications(db.admin, input)).toBe("unavailable");
    expect(db.from).not.toHaveBeenCalled();
    expect(notifyRecipient).not.toHaveBeenCalled();
  });

  it("a delayed Connector does not delay scheduling or the response", async () => {
    const db = database();
    let finish!: (value: unknown) => void;
    notifyRecipient.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    expect(scheduleTrackNotifications(db.admin, input)).toBe("scheduled");
    const background = afterCallback.mock.calls[0][0]();
    await vi.waitFor(() => expect(notifyRecipient).toHaveBeenCalledTimes(1));
    finish({ ok: true, conversationId: "fixture", reused: true });
    await background;
  });
});

describe("the frozen audience is the only delivery target", () => {
  it("reads only unnotified recipients of the stored announcement owned by the verified actor", async () => {
    const db = database();
    const result = await dispatchTrackNotifications(db.admin, input);
    expect(db.from).toHaveBeenCalledWith("bty_tracked_announcement_recipients");
    expect(db.query.eq).toHaveBeenCalledWith("announcement_id", input.announcementId);
    expect(db.query.eq).toHaveBeenCalledWith("bty_tracked_announcements.owner_user_id", input.ownerUserId);
    expect(db.query.is).toHaveBeenCalledWith("notified_at", null);
    expect(result).toMatchObject({ sent: 1, attempted: 1, lookupFailed: false });
  });

  it.each([null, { message: "private database error" }])("lookup failure sends nothing and never reports sent (%s)", async error => {
    const db = database(null, error);
    expect(await dispatchTrackNotifications(db.admin, input)).toMatchObject({ sent: 0, attempted: 0, lookupFailed: true });
    expect(notifyRecipient).not.toHaveBeenCalled();
  });

  it("an exception while reading is contained without starting a send", async () => {
    const db = database();
    db.from.mockImplementation(() => { throw new Error("database unavailable"); });
    expect(await dispatchTrackNotifications(db.admin, input)).toMatchObject({ sent: 0, lookupFailed: true });
    expect(notifyRecipient).not.toHaveBeenCalled();
  });

  it("skips closed and completed Tracks, but opening a response-required Track is not completion", async () => {
    const db = database([
      row("closed", { bty_tracked_announcements: { status: "closed", tracking_mode: "acknowledgment" } }),
      row("acknowledged", { acknowledged_at: "2026-11-05T10:00:00Z" }),
      row("responded", { bty_tracked_announcements: { status: "active", tracking_mode: "response" }, response_submitted_at: "2026-11-05T10:00:00Z" }),
      row("opened-only", { bty_tracked_announcements: { status: "active", tracking_mode: "response" }, opened_at: "2026-11-05T10:00:00Z", acknowledged_at: "2026-11-05T10:00:00Z" }),
    ]);
    const result = await dispatchTrackNotifications(db.admin, input);
    expect(result).toMatchObject({ attempted: 1, sent: 1, completed: 3 });
    expect(notifyRecipient).toHaveBeenCalledWith(db.admin, { recipientId: "opened-only", ownerUserId: input.ownerUserId });
  });

  it("keeps the existing claim outcomes honest without resetting or confirming any claim itself", async () => {
    const reasons = ["already_notified", "in_progress", "conversation_in_progress", "delivery_unknown", "conversation_creation_unknown", "confirm_failed", "claim_lost", "not_installed", "credential_missing"];
    const db = database(reasons.map(id => row(id)));
    notifyRecipient.mockImplementation(async (_admin, { recipientId }) => ({ ok: false, reason: recipientId }));
    expect(await dispatchTrackNotifications(db.admin, input)).toMatchObject({
      attempted: 9, sent: 0, alreadyNotified: 1, waiting: 2, needsReview: 4, failed: 2,
    });
    // The only database operation here is the owned audience read. All durable delivery
    // transitions belong to the existing, independently tested notifyRecipient service.
    expect(db.from).toHaveBeenCalledTimes(1);
  });

  it("an unexpected post-boundary exception needs review and does not retry within the dispatch", async () => {
    const db = database();
    notifyRecipient.mockRejectedValue(new Error("secret-bearing transport error"));
    expect(await dispatchTrackNotifications(db.admin, input)).toMatchObject({ sent: 0, needsReview: 1 });
    expect(notifyRecipient).toHaveBeenCalledTimes(1);
  });

  it("limits parallel sends while awaiting every recipient", async () => {
    const db = database(Array.from({ length: 9 }, (_, i) => row(`recipient-${i}`)));
    let active = 0;
    let maximum = 0;
    notifyRecipient.mockImplementation(async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise(resolve => setTimeout(resolve, 1));
      active -= 1;
      return { ok: true, conversationId: "fixture", reused: true };
    });
    expect(await dispatchTrackNotifications(db.admin, input)).toMatchObject({ attempted: 9, sent: 9 });
    expect(maximum).toBe(4);
    expect(active).toBe(0);
  });

  it("background logs contain counts, never recipient identity, content or conversation addresses", async () => {
    const db = database();
    scheduleTrackNotifications(db.admin, input);
    await afterCallback.mock.calls[0][0]();
    const logs = JSON.stringify(vi.mocked(console.info).mock.calls);
    expect(logs).toContain('"sent":1');
    expect(logs).not.toMatch(/recipient-1|verified-owner|stored-announcement|private-conversation/);
  });
});

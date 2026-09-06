import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  allMessageIds,
  loadReadReceipts,
  loadThreadMeta,
  messageCountFrom,
  postThreadMessage,
  readThread,
  resolveThreadRole,
  unreadFrom,
} from "./announcementThread.server";
import { respondToAnnouncement } from "./announcementService.server";
import { makeStore, makeThreadAdmin, makeRecipientRow, type ThreadStore } from "./announcementThreadFake.testkit";

/**
 * TRACK — CONTINUOUS CONVERSATION. The security and continuity properties, driven through the real
 * service functions over a store that models `20260912000000_bty_announcement_thread_v1.sql`.
 *
 * ★ WHY A STORE AND NOT MOCKS. The property is ISOLATION between recipients of ONE announcement.
 * A mock returning a canned answer would pass whether or not anything was ever scoped. These tests
 * build a real three-recipient announcement and ask each person, in turn, for somebody else's
 * conversation.
 */

const HOST = "host-1";
const OTHER_HOST = "host-2";
const A = "user-a";
const B = "user-b";
const C = "user-c";

/** One announcement, three recipients, exactly the shape the privacy model is about. */
function threeRecipients(): ThreadStore {
  return makeStore({
    announcements: [
      { id: "ann-1", ownerUserId: HOST },
      { id: "ann-2", ownerUserId: OTHER_HOST },
    ],
    recipients: [
      makeRecipientRow({ id: "r-a", announcementId: "ann-1", userId: A }),
      makeRecipientRow({ id: "r-b", announcementId: "ann-1", userId: B }),
      makeRecipientRow({ id: "r-c", announcementId: "ann-1", userId: null }),
      makeRecipientRow({ id: "r-other", announcementId: "ann-2", userId: C }),
    ],
    messages: [],
  });
}

let store: ThreadStore;
let admin: SupabaseClient;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  store = threeRecipients();
  admin = makeThreadAdmin(store) as unknown as SupabaseClient;
});

/* ────────────────────────────  AUTHORITY  ──────────────────────────── */

describe("★ 1-5 — who is a party to a conversation, and who is answered like a missing row", () => {
  it("1 — the OWNING Host is HOST on every recipient of their own run", async () => {
    expect(await resolveThreadRole(admin, "r-a", HOST)).toBe("HOST");
    expect(await resolveThreadRole(admin, "r-b", HOST)).toBe("HOST");
  });

  it("2 — the bound RECIPIENT is RECIPIENT on their own row", async () => {
    expect(await resolveThreadRole(admin, "r-a", A)).toBe("RECIPIENT");
  });

  it("★ 3 — ANOTHER RECIPIENT OF THE SAME ANNOUNCEMENT is nobody", async () => {
    // The whole privacy model in one assertion: B was picked out of the same Teams message as A,
    // and that grants B nothing at all in A's conversation.
    expect(await resolveThreadRole(admin, "r-a", B)).toBeNull();
    expect(await resolveThreadRole(admin, "r-b", A)).toBeNull();
  });

  it("4 — a DIFFERENT Host is nobody", async () => {
    expect(await resolveThreadRole(admin, "r-a", OTHER_HOST)).toBeNull();
  });

  it("5 — an arbitrary recipient uuid grants nothing, and is indistinguishable from a real refusal", async () => {
    expect(await resolveThreadRole(admin, "r-does-not-exist", HOST)).toBeNull();
    expect(await resolveThreadRole(admin, "r-other", HOST)).toBeNull();
  });

  it("an UNBOUND recipient row matches nobody — not even a null actor", async () => {
    expect(await resolveThreadRole(admin, "r-c", A)).toBeNull();
    expect(await resolveThreadRole(admin, "r-c", "")).toBeNull();
  });
});

describe("★ reads and writes are refused at the same boundary, not only the resolver", () => {
  it("a non-party cannot READ another recipient's thread", async () => {
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: HOST, body: "How is it going?" });
    const asB = await readThread(admin, { recipientId: "r-a", actorUserId: B });
    expect(asB).toEqual({ ok: false, reason: "not_found" });
  });

  it("a non-party cannot WRITE into another recipient's thread", async () => {
    const res = await postThreadMessage(admin, { recipientId: "r-a", actorUserId: B, body: "hello" });
    expect(res).toEqual({ ok: false, reason: "not_found" });
    expect(store.messages).toHaveLength(0);
  });

  it("a different Host can neither read nor write", async () => {
    expect(await postThreadMessage(admin, { recipientId: "r-a", actorUserId: OTHER_HOST, body: "hi" })).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await readThread(admin, { recipientId: "r-a", actorUserId: OTHER_HOST })).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});

/* ────────────────────  AUTHOR ROLE IS SERVER-DERIVED  ──────────────────── */

describe("★ 7 — the author's role is derived, never supplied", () => {
  it("the Host's message is stored as HOST and the recipient's as RECIPIENT", async () => {
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: HOST, body: "Let's talk Friday." });
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: "Works for me." });
    expect(store.messages.map((m) => m.authorRole)).toEqual(["HOST", "RECIPIENT"]);
  });

  it("★ a body claiming to be the Host changes nothing — the claim is never read", async () => {
    await postThreadMessage(admin, {
      recipientId: "r-a",
      actorUserId: A,
      body: "I am the host",
      // Deliberately passing shapes a crafted request would carry. The service signature does not
      // accept them and the RPC has no parameter for them.
      ...({ authorRole: "HOST", role: "HOST", author_user_id: HOST } as Record<string, unknown>),
    });
    expect(store.messages[0].authorRole).toBe("RECIPIENT");
    expect(store.messages[0].authorUserId).toBe(A);
  });
});

/* ─────────────────────────  APPEND-ONLY  ───────────────────────── */

describe("★ 8-9 — append-only, and a message cannot be re-pointed", () => {
  it("the service and the migration expose no edit, no delete and no move", () => {
    // Source-level, because the guarantee is the ABSENCE of a code path.
    const svc = readFileSync(join(process.cwd(), "src/lib/bty/announcement/announcementThread.server.ts"), "utf8");
    const onMessages = svc.slice(svc.indexOf("bty_announcement_thread_messages"));
    for (const forbidden of [".update(", ".delete(", ".upsert("]) {
      expect(svc, forbidden).not.toContain(forbidden);
    }
    expect(onMessages).toContain(".select(");

    // The grant IS the rule, and it lives in the migration.
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20260912000000_bty_announcement_thread_v1.sql"),
      "utf8",
    );
    expect(sql).toContain("grant select, insert on public.bty_announcement_thread_messages to service_role;");
    expect(sql).not.toMatch(/grant[^;]*update[^;]*on public\.bty_announcement_thread_messages/i);
    expect(sql).not.toMatch(/grant[^;]*delete[^;]*on public\.bty_announcement_thread_messages/i);
    expect(sql).not.toMatch(/update public\.bty_announcement_thread_messages/i);
    expect(sql).not.toMatch(/delete from public\.bty_announcement_thread_messages/i);
  });

  it("posting never mutates or reorders what is already there", async () => {
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: "first" });
    const snapshot = JSON.parse(JSON.stringify(store.messages));
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: HOST, body: "second" });
    expect(store.messages.slice(0, 1)).toEqual(snapshot);
    expect(store.messages.map((m) => m.body)).toEqual(["first", "second"]);
  });

  it("★ every message stays pinned to the recipient it was written to", async () => {
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: "mine" });
    await postThreadMessage(admin, { recipientId: "r-b", actorUserId: B, body: "hers" });
    expect(store.messages.map((m) => [m.recipientId, m.body])).toEqual([
      ["r-a", "mine"],
      ["r-b", "hers"],
    ]);
  });
});

/* ───────────────────────  MESSAGE VALIDITY  ─────────────────────── */

describe("★ 13 — empty and oversize are refused", () => {
  it("an empty or whitespace-only message is refused and writes nothing", async () => {
    for (const body of ["", "   ", "\n\t"]) {
      expect(await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body })).toEqual({
        ok: false,
        reason: "empty_message",
      });
    }
    expect(store.messages).toHaveLength(0);
  });

  it("a non-string is refused as empty rather than coerced into a message", async () => {
    expect(await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: { text: "hi" } })).toEqual({
      ok: false,
      reason: "empty_message",
    });
  });

  it("1000 characters is accepted; 1001 is refused", async () => {
    expect((await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: "x".repeat(1000) })).ok).toBe(true);
    expect(await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: "x".repeat(1001) })).toEqual({
      ok: false,
      reason: "message_too_long",
    });
    expect(store.messages).toHaveLength(1);
  });

  it("the stored body is TRIMMED, so leading whitespace cannot pad past the bound", async () => {
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: "  padded  " });
    expect(store.messages[0].body).toBe("padded");
  });
});

/* ─────────────────────────  IDEMPOTENCY  ───────────────────────── */

describe("★ 10 — a double submit does not duplicate a message", () => {
  it("the same nonce returns the FIRST message and writes nothing new", async () => {
    const first = await postThreadMessage(admin, {
      recipientId: "r-a",
      actorUserId: A,
      body: "Sending twice by accident",
      clientMessageId: "nonce-1",
    });
    const second = await postThreadMessage(admin, {
      recipientId: "r-a",
      actorUserId: A,
      body: "Sending twice by accident",
      clientMessageId: "nonce-1",
    });
    expect(first.ok && second.ok).toBe(true);
    expect(first.ok && second.ok && first.messageId).toBe(second.ok ? second.messageId : "");
    expect(second.ok && second.duplicate).toBe(true);
    expect(store.messages).toHaveLength(1);
  });

  it("a DIFFERENT nonce is a different thing said, and is stored", async () => {
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: "one", clientMessageId: "n1" });
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: "two", clientMessageId: "n2" });
    expect(store.messages).toHaveLength(2);
  });

  it("★ a nonce is scoped to ONE person in ONE thread — it addresses nothing", async () => {
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: "A's", clientMessageId: "same" });
    // The Host reusing the identical string in the same thread is a different author, so it is a
    // different message — a nonce can neither collide with nor reach another person's row.
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: HOST, body: "Host's", clientMessageId: "same" });
    await postThreadMessage(admin, { recipientId: "r-b", actorUserId: B, body: "B's", clientMessageId: "same" });
    expect(store.messages.map((m) => m.body)).toEqual(["A's", "Host's", "B's"]);
  });

  it("no nonce at all means no idempotency, and two sends are two messages", async () => {
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: "dup" });
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: "dup" });
    expect(store.messages).toHaveLength(2);
  });
});

/* ──────────────────  FIRST RESPONSE → THREAD BRIDGE  ────────────────── */

describe("★ the first response bridges into the conversation, atomically", () => {
  it("★ QUESTION with text becomes the FIRST recipient-authored message, in the same step", async () => {
    const res = await respondToAnnouncement(admin, {
      announcementId: "ann-1",
      userId: A,
      response: "QUESTION",
      questionText: "Does this apply to part-time staff?",
    });
    expect(res).toMatchObject({ ok: true, response: "QUESTION" });

    const row = store.recipients.find((r) => r.id === "r-a")!;
    // The legacy disposition is UNTOUCHED: the funnel still reads the column it always read.
    expect(row.response).toBe("QUESTION");
    expect(row.questionText).toBe("Does this apply to part-time staff?");

    expect(store.messages).toHaveLength(1);
    expect(store.messages[0]).toMatchObject({
      recipientId: "r-a",
      authorRole: "RECIPIENT",
      body: "Does this apply to part-time staff?",
    });
    // ONE product action: the disposition and its first message share an instant.
    expect(store.messages[0].createdAt).toBe(row.respondedAt);
  });

  it("★ GOT_IT still works and writes NO message", async () => {
    const res = await respondToAnnouncement(admin, {
      announcementId: "ann-1",
      userId: A,
      response: "ACKNOWLEDGED",
      questionText: null,
    });
    expect(res).toMatchObject({ ok: true, response: "ACKNOWLEDGED" });
    expect(store.recipients.find((r) => r.id === "r-a")!.response).toBe("ACKNOWLEDGED");
    expect(store.messages).toHaveLength(0);
  });

  it("★ HELP_NEEDED is recorded and NO message is fabricated — the UI captures no text for it", async () => {
    const res = await respondToAnnouncement(admin, {
      announcementId: "ann-1",
      userId: A,
      response: "HELP_NEEDED",
      questionText: null,
    });
    expect(res).toMatchObject({ ok: true, response: "HELP_NEEDED" });
    expect(store.messages).toHaveLength(0);
    // Putting words in somebody's mouth inside a conversation their manager reads is the fault
    // being avoided. A HELP_NEEDED thread starts empty and they write the first line themselves.
    const after = await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: "The form errors out." });
    expect(after.ok).toBe(true);
    expect(store.messages).toHaveLength(1);
  });

  it("stray text on a non-QUESTION response is discarded, and becomes no message either", async () => {
    await respondToAnnouncement(admin, {
      announcementId: "ann-1",
      userId: A,
      response: "ACKNOWLEDGED",
      questionText: "text nobody agreed to store",
    });
    expect(store.recipients.find((r) => r.id === "r-a")!.questionText).toBeNull();
    expect(store.messages).toHaveLength(0);
  });

  it("write-once survives: a second response neither overwrites nor appends a second message", async () => {
    await respondToAnnouncement(admin, { announcementId: "ann-1", userId: A, response: "QUESTION", questionText: "first" });
    const again = await respondToAnnouncement(admin, {
      announcementId: "ann-1",
      userId: A,
      response: "ACKNOWLEDGED",
      questionText: null,
    });
    expect(again).toMatchObject({ ok: true, alreadyResponded: true, response: "QUESTION" });
    expect(store.messages).toHaveLength(1);
  });

  it("a non-recipient answering writes neither a response nor a message", async () => {
    expect(await respondToAnnouncement(admin, { announcementId: "ann-1", userId: C, response: "QUESTION", questionText: "x" }))
      .toEqual({ ok: false, reason: "not_a_recipient" });
    expect(store.messages).toHaveLength(0);
  });
});

/* ──────────────────────  CONTINUOUS CONVERSATION  ────────────────────── */

describe("★ the conversation continues, with no artificial limit", () => {
  it("★ Host reply → recipient reply → Host reply → recipient reply, in order", async () => {
    await respondToAnnouncement(admin, { announcementId: "ann-1", userId: A, response: "QUESTION", questionText: "Q1" });
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: HOST, body: "H1" });
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: "R2" });
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: HOST, body: "H2" });
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: "R3" });

    const read = await readThread(admin, { recipientId: "r-a", actorUserId: A });
    expect(read.ok).toBe(true);
    expect(read.ok && read.messages.map((m) => [m.authorRole, m.body])).toEqual([
      ["RECIPIENT", "Q1"],
      ["HOST", "H1"],
      ["RECIPIENT", "R2"],
      ["HOST", "H2"],
      ["RECIPIENT", "R3"],
    ]);
  });

  it("both sides read the SAME messages — only the role they are told differs", async () => {
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: HOST, body: "hello" });
    const asHost = await readThread(admin, { recipientId: "r-a", actorUserId: HOST });
    const asRecipient = await readThread(admin, { recipientId: "r-a", actorUserId: A });
    expect(asHost.ok && asHost.role).toBe("HOST");
    expect(asRecipient.ok && asRecipient.role).toBe("RECIPIENT");
    expect(asHost.ok && asHost.messages.map((m) => m.body)).toEqual(asRecipient.ok ? asRecipient.messages.map((m) => m.body) : []);
  });

  it("★ 11 — one announcement with three recipients produces three ISOLATED conversations", async () => {
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: "A speaks" });
    await postThreadMessage(admin, { recipientId: "r-b", actorUserId: B, body: "B speaks" });
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: HOST, body: "to A only" });

    const a = await readThread(admin, { recipientId: "r-a", actorUserId: A });
    const b = await readThread(admin, { recipientId: "r-b", actorUserId: B });
    expect(a.ok && a.messages.map((m) => m.body)).toEqual(["A speaks", "to A only"]);
    expect(b.ok && b.messages.map((m) => m.body)).toEqual(["B speaks"]);

    // The Host holds all three independently, and never as one merged stream.
    const hostA = await readThread(admin, { recipientId: "r-a", actorUserId: HOST });
    const hostB = await readThread(admin, { recipientId: "r-b", actorUserId: HOST });
    expect(hostA.ok && hostA.messages).toHaveLength(2);
    expect(hostB.ok && hostB.messages).toHaveLength(1);
    // Nothing A wrote appears in B's conversation, in either direction.
    expect(JSON.stringify(hostB.ok && hostB.messages)).not.toContain("A speaks");
    expect(JSON.stringify(b.ok && b.messages)).not.toContain("to A only");
  });
});

/* ────────────────────────  UNREAD / READ MARKING  ──────────────────────── */

/** Unread for one viewer, loading exactly what the list surfaces load. */
async function unread(rowIds: string[], viewer: "HOST" | "RECIPIENT", reader: string, row: string) {
  const meta = await loadThreadMeta(admin, rowIds);
  const readIds = await loadReadReceipts(admin, allMessageIds(meta), reader);
  return unreadFrom(meta, row, viewer, readIds);
}

describe("★ unread is persistent truth for both sides, as RECEIPTS", () => {
  it("★ the Host's unread counts the recipient's messages, not their own", async () => {
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: "1" });
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: "2" });
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: HOST, body: "mine" });
    expect(await unread(["r-a"], "HOST", HOST, "r-a")).toBe(2);
  });

  it("★ the recipient's unread counts the Host's messages, not their own", async () => {
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: HOST, body: "h1" });
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: "mine" });
    expect(await unread(["r-a"], "RECIPIENT", A, "r-a")).toBe(1);
  });

  it("★ opening the thread writes receipts for ONLY the opener's side", async () => {
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: "from A" });
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: HOST, body: "from Host" });

    await readThread(admin, { recipientId: "r-a", actorUserId: HOST });
    expect(await unread(["r-a"], "HOST", HOST, "r-a")).toBe(0);
    // The Host reading cannot mark the recipient's side. There is no parameter for it.
    expect(await unread(["r-a"], "RECIPIENT", A, "r-a")).toBe(1);
    expect(store.reads.every((r) => r.readerUserId === HOST)).toBe(true);
  });

  it("★ a receipt is per MESSAGE, so a later message is unread even though earlier ones were read", async () => {
    // This is the shape the timestamp cursor could not express: reading is not a watermark.
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: "first" });
    await readThread(admin, { recipientId: "r-a", actorUserId: HOST });
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: "second" });
    expect(await unread(["r-a"], "HOST", HOST, "r-a")).toBe(1);
  });

  it("★ read state survives a refresh — it is stored, not component state", async () => {
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: "x" });
    await readThread(admin, { recipientId: "r-a", actorUserId: HOST });

    // A completely fresh admin over the SAME store is what "another device, later" looks like.
    const fresh = makeThreadAdmin(store) as unknown as SupabaseClient;
    const meta = await loadThreadMeta(fresh, ["r-a"]);
    const readIds = await loadReadReceipts(fresh, allMessageIds(meta), HOST);
    expect(unreadFrom(meta, "r-a", "HOST", readIds)).toBe(0);

    await postThreadMessage(fresh, { recipientId: "r-a", actorUserId: A, body: "y" });
    const meta2 = await loadThreadMeta(fresh, ["r-a"]);
    const readIds2 = await loadReadReceipts(fresh, allMessageIds(meta2), HOST);
    expect(unreadFrom(meta2, "r-a", "HOST", readIds2)).toBe(1);
  });

  it("★ marking read twice writes nothing new — a receipt is a key, not a counter", async () => {
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: "x" });
    await readThread(admin, { recipientId: "r-a", actorUserId: HOST });
    const after = store.reads.length;
    await readThread(admin, { recipientId: "r-a", actorUserId: HOST });
    expect(store.reads).toHaveLength(after);
  });

  it("★ unread is per recipient — B's messages never appear in A's count", async () => {
    await postThreadMessage(admin, { recipientId: "r-b", actorUserId: B, body: "B" });
    const meta = await loadThreadMeta(admin, ["r-a", "r-b"]);
    const readIds = await loadReadReceipts(admin, allMessageIds(meta), HOST);
    expect(unreadFrom(meta, "r-a", "HOST", readIds)).toBe(0);
    expect(unreadFrom(meta, "r-b", "HOST", readIds)).toBe(1);
    expect(messageCountFrom(meta, "r-a")).toBe(0);
    expect(messageCountFrom(meta, "r-b")).toBe(1);
  });

  it("★ receipts are scoped to ONE reader — a Host cannot learn what a recipient has read", async () => {
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: HOST, body: "h" });
    await readThread(admin, { recipientId: "r-a", actorUserId: A });
    const meta = await loadThreadMeta(admin, ["r-a"]);
    // The recipient read it; asking as the HOST returns none of the recipient's receipts.
    expect((await loadReadReceipts(admin, allMessageIds(meta), HOST)).size).toBe(0);
    expect((await loadReadReceipts(admin, allMessageIds(meta), A)).size).toBe(1);
  });

  it("★ the list projection carries NO message bodies", async () => {
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: "a secret about my pay" });
    const meta = await loadThreadMeta(admin, ["r-a"]);
    expect(JSON.stringify([...meta])).not.toContain("secret");
    /*
      `createdAt` joined this projection for the Today dismissal rule ("has anything happened since
      this card was removed?"). It is a TIMESTAMP, not content — the assertion that matters is
      unchanged and asserted above: no body reaches a list surface.
    */
    expect(Object.keys(meta.get("r-a")![0]).sort()).toEqual(["authorRole", "createdAt", "messageId", "recipientId"]);
  });

  it("no recipient ids means no query at all", async () => {
    const meta = await loadThreadMeta(admin, []);
    expect(meta.size).toBe(0);
    expect((await loadReadReceipts(admin, [], HOST)).size).toBe(0);
  });
});

/* ────────────────────  HANDLED / REOPEN  ──────────────────── */

describe("★ B — a new recipient message reopens a settled item; reading never does", () => {
  const settle = () => {
    const row = store.recipients.find((r) => r.id === "r-a")!;
    row.handledAt = "2026-09-12T09:30:00.000Z";
    row.handledByUserId = HOST;
    return row;
  };

  it("★ a RECIPIENT message clears handled, and the call reports it", async () => {
    const row = settle();
    const res = await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: "one more thing" });
    expect(res.ok && res.reopened).toBe(true);
    expect(row.handledAt).toBeNull();
    expect(row.handledByUserId).toBeNull();
  });

  it("★ a HOST message does NOT reopen — answering somebody must not re-list them", async () => {
    const row = settle();
    const res = await postThreadMessage(admin, { recipientId: "r-a", actorUserId: HOST, body: "here you go" });
    expect(res.ok && res.reopened).toBe(false);
    expect(row.handledAt).not.toBeNull();
  });

  it("★ READING is not RESOLVING — opening the thread leaves handled exactly as it was", async () => {
    const row = settle();
    await readThread(admin, { recipientId: "r-a", actorUserId: HOST });
    expect(row.handledAt).not.toBeNull();
    expect(row.handledByUserId).toBe(HOST);
  });

  it("a duplicate reopens nothing — no NEW thing was said", async () => {
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: "x", clientMessageId: "n1" });
    const row = settle();
    const dup = await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: "x", clientMessageId: "n1" });
    expect(dup.ok && dup.duplicate).toBe(true);
    expect(dup.ok && dup.reopened).toBe(false);
    expect(row.handledAt).not.toBeNull();
  });

  it("the reopen erases nothing a person said", async () => {
    await respondToAnnouncement(admin, { announcementId: "ann-1", userId: A, response: "QUESTION", questionText: "original" });
    const row = settle();
    await postThreadMessage(admin, { recipientId: "r-a", actorUserId: A, body: "follow-up" });
    expect(row.handledAt).toBeNull();
    expect(row.response).toBe("QUESTION");
    expect(row.questionText).toBe("original");
    expect(store.messages.map((m) => m.body)).toEqual(["original", "follow-up"]);
  });
});

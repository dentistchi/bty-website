import { describe, expect, it } from "vitest";
import {
  conversationKeyOf,
  groupByConversation,
  type GroupableCapture,
} from "@/domain/action-capture/conversationGroup";

/**
 * The grouping key, pinned against the ways it could be wrong (Slice T2.1).
 *
 * Two of these tests are not hypothetical: they encode shapes measured on live production data,
 * where one sender owns both a 1:1 chat and a private-channel post. If grouping ever regresses to
 * sender or to channel_id, those two fail first.
 */

const cap = (id: string, over: Partial<GroupableCapture> & { meta?: Record<string, unknown> } = {}): GroupableCapture => ({
  id,
  // `??` would swallow an explicit null, which is exactly the case 7b needs to exercise.
  capturedAt: "capturedAt" in over ? (over.capturedAt as string | null) : "2026-08-31T10:00:00Z",
  sourceMetadata: over.meta ?? { tenant_id: "T1", conversation_id: "19:chat-a@unq.gbl.spaces", sender_display: "Ana" },
});

describe("1-5. what makes two captures the same conversation", () => {
  it("1. same tenant + same conversation → one group", () => {
    const g = groupByConversation([cap("a"), cap("b")]);
    expect(g).toHaveLength(1);
    expect(g[0].count).toBe(2);
    expect(conversationKeyOf(cap("a"))).toBe(conversationKeyOf(cap("b")));
  });

  it("2. same SENDER, different conversation → different groups (measured on live data)", () => {
    // Production shape: Dr. Su-Young Choi owns both a 1:1 chat and a private-channel post.
    const chat = cap("x", { meta: { tenant_id: "T1", conversation_id: "19:chat-a@unq.gbl.spaces", sender_display: "Dr. Su-Young Choi" } });
    const channel = cap("y", { meta: { tenant_id: "T1", conversation_id: "19:chan-z@thread.tacv2", sender_display: "Dr. Su-Young Choi" } });
    expect(groupByConversation([chat, channel])).toHaveLength(2);
  });

  it("2b. channel_id / chat_id are not consulted at all", () => {
    // The private-channel provenance defect mislabels these; grouping must not care.
    const a = cap("a", { meta: { tenant_id: "T1", conversation_id: "19:same@thread.tacv2", chat_id: "19:same@thread.tacv2" } });
    const b = cap("b", { meta: { tenant_id: "T1", conversation_id: "19:same@thread.tacv2", channel_id: "19:other" } });
    expect(groupByConversation([a, b])).toHaveLength(1);
  });

  it("3. same conversation id under a DIFFERENT tenant → different groups", () => {
    const a = cap("a", { meta: { tenant_id: "T1", conversation_id: "19:same@unq.gbl.spaces" } });
    const b = cap("b", { meta: { tenant_id: "T2", conversation_id: "19:same@unq.gbl.spaces" } });
    expect(groupByConversation([a, b])).toHaveLength(2);
  });

  it("4+5. a capture missing either id stands alone, and unknowns never merge with each other", () => {
    const noTenant = cap("a", { meta: { conversation_id: "19:c@x" } });
    const noConv = cap("b", { meta: { tenant_id: "T1" } });
    const blank = cap("c", { meta: { tenant_id: "   ", conversation_id: "  " } });
    const groups = groupByConversation([noTenant, noConv, blank]);
    expect(groups).toHaveLength(3);
    expect(new Set(groups.map((g) => g.key)).size).toBe(3);
  });
});

describe("6-8. the group's shape", () => {
  it("6. three captures in one conversation group correctly and stay individually addressable", () => {
    const rows = [cap("a"), cap("b"), cap("c")];
    const [g] = groupByConversation(rows);
    expect(g.count).toBe(3);
    expect(g.captures.map((c) => c.id)).toEqual(["a", "b", "c"]); // input order preserved
  });

  it("7. latestCapture is the newest captured_at in the group, not the first row", () => {
    const rows = [
      cap("older", { capturedAt: "2026-08-31T10:00:00Z" }),
      cap("newest", { capturedAt: "2026-08-31T12:00:00Z" }),
      cap("middle", { capturedAt: "2026-08-31T11:00:00Z" }),
    ];
    expect(groupByConversation(rows)[0].latestCapture.id).toBe("newest");
  });

  it("7b. a missing timestamp never wins, and ties are stable", () => {
    const rows = [cap("a", { capturedAt: null }), cap("b", { capturedAt: "2026-08-31T09:00:00Z" })];
    expect(groupByConversation(rows)[0].latestCapture.id).toBe("b");
    const tied = [cap("z", { capturedAt: "2026-08-31T10:00:00Z" }), cap("a", { capturedAt: "2026-08-31T10:00:00Z" })];
    expect(groupByConversation(tied)[0].latestCapture.id).toBe("a");
  });

  it("8. does not mutate the input array or its elements", () => {
    const rows = [cap("b"), cap("a")];
    const snapshot = JSON.parse(JSON.stringify(rows));
    groupByConversation(rows);
    expect(rows.map((r) => r.id)).toEqual(["b", "a"]);
    expect(rows).toEqual(snapshot);
  });

  it("keeps the lane's ordering: groups appear where their first capture appeared", () => {
    const other = { tenant_id: "T1", conversation_id: "19:other@unq.gbl.spaces" };
    const rows = [cap("first"), cap("second", { meta: other }), cap("third")];
    expect(groupByConversation(rows).map((g) => g.captures[0].id)).toEqual(["first", "second"]);
  });

  it("an empty lane produces no groups", () => {
    expect(groupByConversation([])).toEqual([]);
  });
});

describe("the key is opaque", () => {
  it("never contains the tenant or conversation id", () => {
    const key = conversationKeyOf(
      cap("a", { meta: { tenant_id: "10110d5c-bd30-467e", conversation_id: "19:secret-thread@unq.gbl.spaces" } }),
    );
    expect(key).not.toContain("10110d5c");
    expect(key).not.toContain("secret-thread");
    expect(key).not.toContain("19:");
  });

  it("is deterministic across calls", () => {
    expect(conversationKeyOf(cap("a"))).toBe(conversationKeyOf(cap("a")));
  });
});

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listHostHistory, getHostHistoryDetail } from "./foundryHostHistoryService";

/**
 * These tests pin the HOST History archive contract: owner-scoping (no foreign
 * disclosure), terminal-only qualification (open excluded), canonical counts, and
 * the PRIVACY guarantee — the returned view models never carry response text,
 * reflection bodies, session hashes, join tokens, or storage paths.
 */

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

/** A small chainable fake for the Supabase query surface these services use. */
function makeFakeAdmin(tables: Tables) {
  function from(table: string) {
    const rows = tables[table] ?? [];
    const q: Record<string, unknown> = {
      _rows: rows.slice(),
      select() {
        return this;
      },
      eq(this: { _rows: Row[] }, c: string, v: unknown) {
        this._rows = this._rows.filter((r) => r[c] === v);
        return this;
      },
      in(this: { _rows: Row[] }, c: string, vs: unknown[]) {
        this._rows = this._rows.filter((r) => vs.includes(r[c]));
        return this;
      },
      not(this: { _rows: Row[] }, c: string, _op: string, _v: unknown) {
        // Only usage: .not(col, "is", null) => col is not null.
        this._rows = this._rows.filter((r) => r[c] !== null && r[c] !== undefined);
        return this;
      },
      order() {
        return this;
      },
      returns() {
        return this;
      },
      maybeSingle(this: { _rows: Row[] }) {
        return Promise.resolve({ data: this._rows[0] ?? null, error: null });
      },
      then(this: { _rows: Row[] }, onF: (v: { data: Row[]; error: null }) => unknown) {
        return Promise.resolve({ data: this._rows, error: null }).then(onF);
      },
    };
    return q;
  }
  return { from } as unknown as SupabaseClient;
}

const HOST = "host-1";
const OTHER = "host-2";

function seed(): Tables {
  return {
    foundry_events: [
      // owned + closed (historical), youtube
      {
        id: "ev-closed-1",
        owner_user_id: HOST,
        title: "Handling Difficult Conversations",
        status: "closed",
        content_type: "youtube",
        created_at: "2026-07-01T00:00:00.000Z",
        closed_at: "2026-07-05T00:00:00.000Z",
      },
      // owned + closed (historical), document, ended more recently
      {
        id: "ev-closed-2",
        owner_user_id: HOST,
        title: "Safety Manual Review",
        status: "closed",
        content_type: "document",
        created_at: "2026-07-02T00:00:00.000Z",
        closed_at: "2026-07-10T00:00:00.000Z",
      },
      // owned + OPEN (current — must be excluded from history)
      {
        id: "ev-open-1",
        owner_user_id: HOST,
        title: "Live Session",
        status: "open",
        content_type: "youtube",
        created_at: "2026-07-03T00:00:00.000Z",
        closed_at: null,
      },
      // foreign + closed (must never appear for HOST)
      {
        id: "ev-foreign-1",
        owner_user_id: OTHER,
        title: "Someone Else's Event",
        status: "closed",
        content_type: "youtube",
        created_at: "2026-07-01T00:00:00.000Z",
        closed_at: "2026-07-09T00:00:00.000Z",
      },
    ],
    foundry_event_participants: [
      { id: "p1", event_id: "ev-closed-1", display_name: "Alice", status: "joined", joined_at: "2026-07-01T01:00:00.000Z" },
      { id: "p2", event_id: "ev-closed-1", display_name: "Bob", status: "joined", joined_at: "2026-07-01T02:00:00.000Z" },
      { id: "p3", event_id: "ev-closed-1", display_name: "Removed Person", status: "removed", joined_at: "2026-07-01T03:00:00.000Z" },
      { id: "p4", event_id: "ev-closed-2", display_name: "Carol", status: "joined", joined_at: "2026-07-02T01:00:00.000Z" },
    ],
    foundry_event_training_progress: [
      // ev-closed-1: p1 completed (with private text that must NEVER surface), p2 not
      {
        event_id: "ev-closed-1",
        participant_id: "p1",
        video_started_at: "2026-07-01T01:10:00.000Z",
        video_completed_at: "2026-07-01T01:30:00.000Z",
        completed_at: "2026-07-01T01:40:00.000Z",
        xp_awarded_at: "2026-07-01T01:41:00.000Z",
        document_last_page: null,
        document_active_read_ms: 0,
        document_read_completed_at: null,
        response_text: "SECRET PRIVATE REFLECTION BODY",
        reflection: { livingSentence: "SECRET AI LINE" },
      },
      {
        event_id: "ev-closed-1",
        participant_id: "p2",
        video_started_at: "2026-07-01T02:10:00.000Z",
        video_completed_at: null,
        completed_at: null,
        xp_awarded_at: null,
        document_last_page: null,
        document_active_read_ms: 0,
        document_read_completed_at: null,
        response_text: null,
        reflection: null,
      },
      // ev-closed-2: p4 completed (document)
      {
        event_id: "ev-closed-2",
        participant_id: "p4",
        video_started_at: null,
        video_completed_at: null,
        completed_at: "2026-07-02T02:00:00.000Z",
        xp_awarded_at: null,
        document_last_page: 5,
        document_active_read_ms: 120000,
        document_read_completed_at: "2026-07-02T01:50:00.000Z",
        response_text: "ANOTHER SECRET",
        reflection: null,
      },
    ],
    foundry_event_training_content: [
      {
        event_id: "ev-closed-1",
        youtube_video_id: "dQw4w9WgXcQ",
        youtube_title: "The Video",
        completion_prompt: "What will you change?",
      },
    ],
    foundry_event_document_content: [
      {
        event_id: "ev-closed-2",
        file_name: "safety.pdf",
        page_count: 12,
        source_type: "uploaded_pdf",
        completion_prompt: "What did you learn?",
        storage_bucket: "foundry-docs",
        storage_path: "host-1/secret/path.pdf",
        content_hash: "deadbeef",
      },
    ],
  };
}

describe("listHostHistory", () => {
  it("returns only the host's terminal events, most-recently-ended first", async () => {
    const admin = makeFakeAdmin(seed());
    const items = await listHostHistory(admin, HOST);
    expect(items.map((i) => i.eventId)).toEqual(["ev-closed-2", "ev-closed-1"]);
    // open event excluded; foreign event excluded
    expect(items.find((i) => i.eventId === "ev-open-1")).toBeUndefined();
    expect(items.find((i) => i.eventId === "ev-foreign-1")).toBeUndefined();
  });

  it("counts joined participants and completions from canonical tables", async () => {
    const admin = makeFakeAdmin(seed());
    const items = await listHostHistory(admin, HOST);
    const ev1 = items.find((i) => i.eventId === "ev-closed-1")!;
    // 2 joined (removed person excluded), 1 completed
    expect(ev1.participantCount).toBe(2);
    expect(ev1.completionCount).toBe(1);
    const ev2 = items.find((i) => i.eventId === "ev-closed-2")!;
    expect(ev2.participantCount).toBe(1);
    expect(ev2.completionCount).toBe(1);
    expect(ev2.contentType).toBe("document");
  });

  it("a host with no events gets an empty list (honest, not an error)", async () => {
    const admin = makeFakeAdmin(seed());
    expect(await listHostHistory(admin, "nobody")).toEqual([]);
  });

  it("list payload never carries reflection/response/token fields", async () => {
    const admin = makeFakeAdmin(seed());
    const items = await listHostHistory(admin, HOST);
    const json = JSON.stringify(items);
    expect(json).not.toContain("SECRET");
    expect(json).not.toContain("response_text");
    expect(json).not.toContain("reflection");
    expect(json).not.toContain("join_token");
    expect(json).not.toContain("storage_path");
  });
});

describe("getHostHistoryDetail", () => {
  it("opens an owned terminal event with counts + material + completion-only roster", async () => {
    const admin = makeFakeAdmin(seed());
    const d = (await getHostHistoryDetail(admin, HOST, "ev-closed-1"))!;
    expect(d.title).toBe("Handling Difficult Conversations");
    expect(d.status).toBe("closed");
    expect(d.participantCount).toBe(2);
    expect(d.completionCount).toBe(1);
    expect(d.material).toEqual({
      kind: "youtube",
      videoId: "dQw4w9WgXcQ",
      title: "The Video",
      completionPrompt: "What will you change?",
    });
    const alice = d.participants.find((p) => p.displayName === "Alice")!;
    const bob = d.participants.find((p) => p.displayName === "Bob")!;
    expect(alice.status).toBe("complete");
    expect(bob.status).toBe("watching");
    // removed participant is not in the roster
    expect(d.participants.find((p) => p.displayName === "Removed Person")).toBeUndefined();
  });

  it("document event exposes a safe material summary (no storage path)", async () => {
    const admin = makeFakeAdmin(seed());
    const d = (await getHostHistoryDetail(admin, HOST, "ev-closed-2"))!;
    expect(d.material).toEqual({
      kind: "document",
      fileName: "safety.pdf",
      pageCount: 12,
      sourceType: "uploaded_pdf",
      completionPrompt: "What did you learn?",
    });
    expect(JSON.stringify(d)).not.toContain("storage_path");
    expect(JSON.stringify(d)).not.toContain("path.pdf");
  });

  it("rejects a foreign event id (no cross-host disclosure)", async () => {
    const admin = makeFakeAdmin(seed());
    expect(await getHostHistoryDetail(admin, HOST, "ev-foreign-1")).toBeNull();
  });

  it("rejects an open (current) event — not historical", async () => {
    const admin = makeFakeAdmin(seed());
    expect(await getHostHistoryDetail(admin, HOST, "ev-open-1")).toBeNull();
  });

  it("rejects an unknown event id", async () => {
    const admin = makeFakeAdmin(seed());
    expect(await getHostHistoryDetail(admin, HOST, "does-not-exist")).toBeNull();
  });

  it("detail payload never carries reflection/response/token fields", async () => {
    const admin = makeFakeAdmin(seed());
    const d = await getHostHistoryDetail(admin, HOST, "ev-closed-1");
    const json = JSON.stringify(d);
    expect(json).not.toContain("SECRET");
    expect(json).not.toContain("response_text");
    expect(json).not.toContain("reflection");
    expect(json).not.toContain("join_token");
  });
});

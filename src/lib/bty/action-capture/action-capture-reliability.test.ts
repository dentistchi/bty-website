import { describe, expect, it, vi } from "vitest";
import { ensureActionCapture, listMyActionCaptures, setActionCaptureTriage } from "@/lib/bty/action-capture/ensureActionCapture.server";

const input = { provider: "teams", tenant_id: "tenant", conversation_id: "conversation", message_id: "message" };
const capture = (over: Record<string, unknown> = {}) => ({
  id: "capture", user_id: "owner", source_type: "teams_message", external_key: "teams:tenant:conversation:message",
  preview_text: "Synthetic QA", source_url: null, source_metadata: {}, status: "captured",
  captured_at: "2026-10-01T00:00:00Z", triage_choice: null, triaged_at: null,
  saved_at: null, saved_removed_at: null, ...over,
});

/** Stateful in-memory DB. It applies the actual WHERE clauses and can inject a concurrent
 * Track insert or denied update. No connection, credentials, listeners or network. */
function db(options: { existing?: Record<string, unknown>; failUpdate?: boolean; race?: boolean } = {}) {
  const rows: Record<string, unknown>[] = options.existing ? [options.existing] : [];
  const writes: Record<string, unknown>[] = [];
  const from = vi.fn((table: string) => {
    expect(table).toBe("bty_action_captures");
    const filters: ((r: Record<string, unknown>) => boolean)[] = [];
    let patch: Record<string, unknown> | null = null;
    const chain: any = {
      select: () => chain,
      eq: (k: string, v: unknown) => (filters.push(r => r[k] === v), chain),
      is: (k: string, v: unknown) => (filters.push(r => v === null ? r[k] == null : r[k] === v), chain),
      not: (k: string, _op: string, v: unknown) => (filters.push(r => v === null ? r[k] != null : r[k] !== v), chain),
      update: (v: Record<string, unknown>) => (patch = v, chain),
      maybeSingle: async () => {
        const row = rows.find(r => filters.every(f => f(r))) ?? null;
        if (patch && options.failUpdate) return { data: null, error: { code: "42501" } };
        if (patch && row) { writes.push(patch); Object.assign(row, patch); }
        return { data: row, error: null };
      },
      order: async () => ({ data: rows.filter(r => filters.every(f => f(r))), error: null }),
      insert: () => ({ select: () => ({ single: async () => {
        if (options.race && !rows.length) rows.push(capture());
        return { data: null, error: { code: "23505" } };
      } }) }),
    };
    return chain;
  });
  return { admin: { from } as never, rows, writes };
}

describe("Save success means the caller's item is actually in the Saved lane", () => {
  it("does not report Saved when stamping a Track-only capture fails", async () => {
    const { admin, rows } = db({ existing: capture(), failUpdate: true });
    const r = await ensureActionCapture(admin, { userId: "owner", input, intent: "save" });
    expect(r.ok).toBe(false);
    expect(rows[0].saved_at).toBeNull();
    expect(await listMyActionCaptures(admin, "owner")).toEqual([]);
  });
  it("does not report Saved when restoration of a previously removed item fails", async () => {
    const removedAt = "2026-10-02T00:00:00Z";
    const { admin, rows } = db({ existing: capture({ saved_at: "2026-10-01T00:00:00Z", saved_removed_at: removedAt }), failUpdate: true });
    expect((await ensureActionCapture(admin, { userId: "owner", input, intent: "save" })).ok).toBe(false);
    expect(rows[0].saved_removed_at).toBe(removedAt);
    expect(await listMyActionCaptures(admin, "owner")).toEqual([]);
  });
  it("applies Save intent to a concurrent Track-only insert winner without rewriting its source", async () => {
    const { admin, rows, writes } = db({ race: true });
    const r = await ensureActionCapture(admin, { userId: "owner", input, intent: "save" });
    expect(r).toMatchObject({ ok: true, created: false, capture: { id: "capture" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].saved_at).toBeTruthy();
    expect(await listMyActionCaptures(admin, "owner")).toHaveLength(1);
    expect(writes).toHaveLength(1);
    expect(Object.keys(writes[0])).not.toContain("preview_text");
    expect(rows[0].preview_text).toBe("Synthetic QA");
  });
});

 describe("Saved lane triage eligibility", () => {
  it("cannot triage a Track-only source row that was never saved", async () => {
    const { admin, rows } = db({ existing: capture() });
    expect(await setActionCaptureTriage(admin, { userId: "owner", captureId: "capture", choice: "soon" })).toEqual({ ok: false, code: "not_found" });
    expect(rows[0].triage_choice).toBeNull();
  });
  it("does not acknowledge stale triage on an already removed item", async () => {
    const { admin, rows } = db({ existing: capture({ saved_at: "2026-10-01T00:00:00Z", saved_removed_at: "2026-10-02T00:00:00Z", triage_choice: "later", triaged_at: "2026-10-01T01:00:00Z" }) });
    expect(await setActionCaptureTriage(admin, { userId: "owner", captureId: "capture", choice: "soon" })).toEqual({ ok: false, code: "not_found" });
    expect(rows[0].saved_removed_at).toBe("2026-10-02T00:00:00Z");
  });
 });

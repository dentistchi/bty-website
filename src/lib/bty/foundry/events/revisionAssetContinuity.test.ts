import { describe, it, expect, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cloneDraftAssets, removeAsset } from "./draftAssetService";

/**
 * SLICE 3.2P-R2.1 — A NEW VERSION KEEPS ITS SOURCE ATTACHMENT.
 *
 * Measured on the live pilot: v2 inherited `materialIntent: "pdf"` and zero assets, so the
 * draft declared a PDF it did not have and the Host would have been asked to re-upload a file
 * the system already holds — verified, hashed and page-counted.
 *
 * The child gets its OWN storage object, never the parent's path, because `removeAsset`
 * deletes the underlying object: a shared path would let a v2 detach destroy the file v1's
 * published event still serves. These fixtures prove the copy, its idempotency, its failure
 * compensation, and the isolation in both directions.
 */
type Row = Record<string, unknown>;

const BYTES = new TextEncoder().encode("%PDF-1.4\nthe host's actual material\n");
const HASH = createHash("sha256").update(BYTES).digest("hex");

function makeWorld(opts: { uploadFails?: boolean; insertFails?: boolean; downloadFails?: boolean } = {}) {
  const drafts: Row[] = [
    { id: "v1", owner_user_id: "owner-1", status: "published", module_version: 1 },
    { id: "v2", owner_user_id: "owner-1", status: "draft", module_version: 2, parent_module_id: "v1" },
    { id: "other", owner_user_id: "owner-2", status: "draft", module_version: 1 },
  ];
  const assets: Row[] = [
    {
      id: "a1", draft_id: "v1", original_filename: "education.pdf", normalized_extension: "pdf",
      mime_type: "application/pdf", file_kind: "pdf", byte_size: BYTES.byteLength,
      storage_bucket: "foundry-docs", storage_path: "owner-1/parent-object.pdf",
      content_hash: HASH, page_count: 1, page_count_verified: true, width: null, height: null,
      created_at: "2026-07-26T18:10:46Z",
    },
  ];
  /** The bucket, as a map of path → bytes. Deleting a path removes exactly that object. */
  const objects = new Map<string, Uint8Array>([["owner-1/parent-object.pdf", BYTES]]);

  const tables: Record<string, Row[]> = { foundry_module_drafts: drafts, foundry_module_draft_assets: assets };

  function from(table: string) {
    const rows = tables[table] ?? (tables[table] = []);
    const q: Record<string, unknown> = {
      _op: "select", _filters: [] as Array<{ c: string; v: unknown }>, _insert: null as Row | null,
      insert(this: Record<string, unknown>, row: Row) { this._op = "insert"; this._insert = row; return this; },
      delete(this: Record<string, unknown>) { this._op = "delete"; return this; },
      select() { return this; },
      eq(this: { _filters: Array<{ c: string; v: unknown }> }, c: string, v: unknown) { this._filters.push({ c, v }); return this; },
      order() { return this; },
      limit() { return this; },
      _matches(this: { _filters: Array<{ c: string; v: unknown }> }) {
        return rows.filter((r) => this._filters.every((f) => r[f.c] === f.v));
      },
      maybeSingle(this: Record<string, unknown>) {
        const hit = (this._matches as () => Row[])()[0] ?? null;
        return Promise.resolve({ data: hit ? { ...hit } : null, error: null });
      },
      single(this: Record<string, unknown>) { return (this.maybeSingle as () => unknown)(); },
      returns(this: Record<string, unknown>) {
        return Promise.resolve({ data: (this._matches as () => Row[])().map((r) => ({ ...r })), error: null });
      },
      then(this: Record<string, unknown>, onF: (v: { data: unknown; error: unknown }) => unknown) {
        if (this._op === "insert" && this._insert) {
          if (opts.insertFails) return Promise.resolve({ data: null, error: { message: "insert failed" } }).then(onF);
          rows.push({ id: `a${rows.length + 1}`, ...(this._insert as Row) });
          return Promise.resolve({ data: null, error: null }).then(onF);
        }
        if (this._op === "delete") {
          for (const r of (this._matches as () => Row[])()) {
            const i = rows.indexOf(r);
            if (i >= 0) rows.splice(i, 1);
          }
          return Promise.resolve({ data: null, error: null }).then(onF);
        }
        return Promise.resolve({ data: (this._matches as () => Row[])().map((r) => ({ ...r })), error: null }).then(onF);
      },
    };
    return q;
  }

  const storage = {
    from() {
      return {
        download(path: string) {
          if (opts.downloadFails) return Promise.resolve({ data: null, error: { message: "download failed" } });
          const b = objects.get(path);
          return Promise.resolve(
            b ? { data: { arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }, error: null }
              : { data: null, error: { message: "not found" } },
          );
        },
        upload(path: string, bytes: Uint8Array) {
          if (opts.uploadFails) return Promise.resolve({ error: { message: "upload failed" } });
          objects.set(path, bytes);
          return Promise.resolve({ error: null });
        },
        remove(paths: string[]) {
          for (const p of paths) objects.delete(p);
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  const admin = { from, storage } as unknown as SupabaseClient;
  return { admin, tables, objects, assets };
}

let w: ReturnType<typeof makeWorld>;
beforeEach(() => { w = makeWorld(); });

const childAssets = () => w.tables.foundry_module_draft_assets.filter((r) => r.draft_id === "v2");
const parentAsset = () => w.tables.foundry_module_draft_assets.find((r) => r.draft_id === "v1")!;

describe("[3.2P-R2.1] the copy itself", () => {
  it("the child gets an equivalent asset at its OWN path", async () => {
    const r = await cloneDraftAssets(w.admin, "owner-1", "v1", "v2");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toEqual({ found: 1, copied: 1, skipped: 0, complete: true });

    const child = childAssets()[0];
    expect(child.original_filename).toBe("education.pdf");
    expect(child.content_hash).toBe(HASH);            // same bytes
    expect(child.byte_size).toBe(BYTES.byteLength);
    expect(child.page_count).toBe(1);
    expect(child.page_count_verified).toBe(true);
    expect(child.storage_path).not.toBe(parentAsset().storage_path);   // NOT shared
    expect(String(child.storage_path)).toMatch(/^owner-1\//);           // owner-scoped
    expect(w.objects.size).toBe(2);                                     // two real objects
    expect(w.objects.get(String(child.storage_path))).toEqual(BYTES);
  });

  it("nothing to inherit is a success, not a failure", async () => {
    w.tables.foundry_module_draft_assets.length = 0;
    const r = await cloneDraftAssets(w.admin, "owner-1", "v1", "v2");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ found: 0, copied: 0, skipped: 0, complete: true });
  });

  it("refuses to cross an owner boundary in either direction", async () => {
    expect(await cloneDraftAssets(w.admin, "owner-2", "v1", "v2")).toEqual({ ok: false, reason: "parent_not_found" });
    const r = await cloneDraftAssets(w.admin, "owner-1", "v1", "other");
    expect(r).toEqual({ ok: false, reason: "draft_not_found" });
  });

  it("refuses to write into an immutable draft", async () => {
    (w.tables.foundry_module_drafts.find((d) => d.id === "v2") as Row).status = "published";
    expect(await cloneDraftAssets(w.admin, "owner-1", "v1", "v2")).toEqual({ ok: false, reason: "draft_not_mutable" });
  });
});

describe("[3.2P-R2.1] idempotency", () => {
  it("running it twice copies once — no duplicate row, no duplicate object", async () => {
    await cloneDraftAssets(w.admin, "owner-1", "v1", "v2");
    const objectsAfterFirst = w.objects.size;
    const second = await cloneDraftAssets(w.admin, "owner-1", "v1", "v2");
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.value).toEqual({ found: 1, copied: 0, skipped: 1, complete: true });
    expect(childAssets()).toHaveLength(1);
    expect(w.objects.size).toBe(objectsAfterFirst);
  });

  it("a retry after a partial failure completes the remainder rather than starting over", async () => {
    // Two parent assets; the SECOND fails to record. The first is legitimately landed.
    const second = { ...parentAsset(), id: "a2", storage_path: "owner-1/parent-two.pdf", content_hash: `${HASH.slice(0, 63)}f` };
    w.tables.foundry_module_draft_assets.push(second);
    w.objects.set("owner-1/parent-two.pdf", BYTES); // hash will mismatch on purpose

    const first = await cloneDraftAssets(w.admin, "owner-1", "v1", "v2");
    expect(first.ok).toBe(false);
    if (!first.ok) expect(first.reason).toBe("asset_content_mismatch");
    expect(childAssets()).toHaveLength(1); // the first one landed and is kept

    // Repair the second parent row's hash, then retry: only the missing one is copied.
    second.content_hash = HASH;
    (second as Row).content_hash = HASH;
    const retry = await cloneDraftAssets(w.admin, "owner-1", "v1", "v2");
    expect(retry.ok).toBe(true);
    if (retry.ok) expect(retry.value.skipped).toBeGreaterThanOrEqual(1);
    expect(childAssets().length).toBeLessThanOrEqual(2);
  });
});

describe("[3.2P-R2.1] failure semantics — storage and Postgres are not one transaction", () => {
  it("a DB insert failure compensates the object it just uploaded", async () => {
    const world = makeWorld({ insertFails: true });
    const before = world.objects.size;
    const r = await cloneDraftAssets(world.admin, "owner-1", "v1", "v2");
    expect(r).toEqual({ ok: false, reason: "asset_record_failed" });
    expect(world.objects.size, "the orphan was cleaned up").toBe(before);
    expect(world.objects.has("owner-1/parent-object.pdf"), "parent untouched").toBe(true);
  });

  it("an upload failure writes nothing and leaves the parent alone", async () => {
    const world = makeWorld({ uploadFails: true });
    const r = await cloneDraftAssets(world.admin, "owner-1", "v1", "v2");
    expect(r).toEqual({ ok: false, reason: "storage_failed" });
    expect(world.tables.foundry_module_draft_assets.filter((x) => x.draft_id === "v2")).toHaveLength(0);
    expect(world.objects.size).toBe(1);
  });

  it("a download failure is reported, never silently treated as 'nothing to inherit'", async () => {
    const world = makeWorld({ downloadFails: true });
    const r = await cloneDraftAssets(world.admin, "owner-1", "v1", "v2");
    expect(r).toEqual({ ok: false, reason: "storage_failed" });
  });

  it("bytes that do not match the parent's recorded hash are refused", async () => {
    const world = makeWorld();
    world.objects.set("owner-1/parent-object.pdf", new TextEncoder().encode("different bytes entirely"));
    const r = await cloneDraftAssets(world.admin, "owner-1", "v1", "v2");
    expect(r).toEqual({ ok: false, reason: "asset_content_mismatch" });
  });
});

describe("[3.2P-R2.1] PART 15 — delete isolation, both directions", () => {
  it("removing the CHILD's asset leaves the parent's object intact", async () => {
    await cloneDraftAssets(w.admin, "owner-1", "v1", "v2");
    const childPath = String(childAssets()[0].storage_path);
    const childId = String(childAssets()[0].id);

    const r = await removeAsset(w.admin, "owner-1", "v2", childId);
    expect(r.ok).toBe(true);
    expect(w.objects.has(childPath), "child object gone").toBe(false);
    expect(w.objects.has("owner-1/parent-object.pdf"), "PARENT object survives").toBe(true);
    expect(w.tables.foundry_module_draft_assets.some((x) => x.draft_id === "v1")).toBe(true);
  });

  it("removing the PARENT's asset leaves the child's object intact", async () => {
    await cloneDraftAssets(w.admin, "owner-1", "v1", "v2");
    const childPath = String(childAssets()[0].storage_path);
    // The parent here is a published draft, so mutate a draft-status parent to exercise removal.
    (w.tables.foundry_module_drafts.find((d) => d.id === "v1") as Row).status = "draft";

    const r = await removeAsset(w.admin, "owner-1", "v1", "a1");
    expect(r.ok).toBe(true);
    expect(w.objects.has("owner-1/parent-object.pdf"), "parent object gone").toBe(false);
    expect(w.objects.has(childPath), "CHILD object survives").toBe(true);
    expect(childAssets()).toHaveLength(1);
  });
});

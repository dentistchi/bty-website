import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const getOwnerDraft = vi.fn();
const deleteFoundryDocument = vi.fn(async (..._a: unknown[]) => undefined);

vi.mock("./foundryModuleService", () => ({
  getOwnerDraft: (...a: unknown[]) => getOwnerDraft(...a),
}));
vi.mock("./documentStorage", () => ({
  FOUNDRY_DOC_BUCKET: "foundry-docs",
  deleteFoundryDocument: (...a: unknown[]) => deleteFoundryDocument(...a),
}));

import { attachAsset, removeAsset, listDraftAssets } from "./draftAssetService";

const PDF_BYTES = new Uint8Array([...Array.from("%PDF-1.4\n").map((c) => c.charCodeAt(0)), 0x0a]);
function pdfFile(name = "Care.pdf") {
  return new File([PDF_BYTES], name, { type: "application/pdf" });
}
function exeFile() {
  return new File([new Uint8Array([0x4d, 0x5a, 0, 0])], "x.exe", { type: "application/octet-stream" });
}

/** Fake admin covering the count-list, insert, asset-lookup, delete, and storage. */
function makeAdmin(opts: { existing?: { byte_size: number }[]; uploadError?: unknown; insertError?: unknown; asset?: unknown; removeError?: unknown } = {}) {
  const storageUpload = vi.fn(async () => ({ error: opts.uploadError ?? null }));
  const storageRemove = vi.fn(async () => ({ error: opts.removeError ?? null }));
  const admin = {
    from() {
      const q: Record<string, unknown> = {};
      Object.assign(q, {
        _row: null as unknown,
        select() {
          return q;
        },
        eq() {
          return q;
        },
        order() {
          return q;
        },
        insert(row: unknown) {
          (q as { _row: unknown })._row = row;
          return q;
        },
        delete() {
          return q;
        },
        returns() {
          return Promise.resolve({ data: opts.existing ?? [] });
        },
        maybeSingle() {
          return Promise.resolve({ data: opts.asset ?? null });
        },
        single() {
          if (opts.insertError) return Promise.resolve({ data: null, error: opts.insertError });
          const row = (q as { _row: Record<string, unknown> })._row;
          return Promise.resolve({ data: { id: "asset-1", created_at: "t", ...row }, error: null });
        },
        then(res: (v: { error: null }) => unknown) {
          return Promise.resolve({ error: null }).then(res);
        },
      });
      return q;
    },
    storage: { from: () => ({ upload: storageUpload, remove: storageRemove }) },
  } as unknown as SupabaseClient;
  return { admin, storageUpload, storageRemove };
}

const OWNER = "owner-1";

beforeEach(() => {
  getOwnerDraft.mockReset();
  deleteFoundryDocument.mockReset();
  deleteFoundryDocument.mockResolvedValue(undefined);
});

describe("attachAsset", () => {
  it("attaches a valid PDF and returns a safe projection (no path/bucket/hash)", async () => {
    getOwnerDraft.mockResolvedValue({ id: "d-1", status: "draft" });
    const { admin, storageUpload } = makeAdmin();
    const r = await attachAsset(admin, OWNER, "d-1", pdfFile());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.asset.file_kind).toBe("pdf");
    expect(r.value.asset.filename).toBe("Care.pdf");
    expect(r.value.asset.participant_delivery_ready).toBe(true);
    expect(JSON.stringify(r.value.asset)).not.toMatch(/foundry-docs|owner-1\//);
    expect(storageUpload).toHaveBeenCalled();
  });

  it("rejects an unsupported type before uploading", async () => {
    getOwnerDraft.mockResolvedValue({ id: "d-1", status: "draft" });
    const { admin, storageUpload } = makeAdmin();
    expect(await attachAsset(admin, OWNER, "d-1", exeFile())).toEqual({ ok: false, reason: "unsupported_file_type" });
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it("rejects an approved/published draft", async () => {
    getOwnerDraft.mockResolvedValue({ id: "d-1", status: "approved" });
    const { admin } = makeAdmin();
    expect(await attachAsset(admin, OWNER, "d-1", pdfFile())).toEqual({ ok: false, reason: "draft_not_mutable" });
  });

  it("non-disclosing not-found for a foreign/missing draft", async () => {
    getOwnerDraft.mockResolvedValue(null);
    const { admin } = makeAdmin();
    expect(await attachAsset(admin, OWNER, "d-1", pdfFile())).toEqual({ ok: false, reason: "draft_not_found" });
  });

  it("enforces the per-draft file count", async () => {
    getOwnerDraft.mockResolvedValue({ id: "d-1", status: "draft" });
    const existing = Array.from({ length: 10 }, () => ({ byte_size: 1 }));
    const { admin } = makeAdmin({ existing });
    expect(await attachAsset(admin, OWNER, "d-1", pdfFile())).toEqual({ ok: false, reason: "too_many_files" });
  });

  it("compensates storage when the DB insert fails", async () => {
    getOwnerDraft.mockResolvedValue({ id: "d-1", status: "draft" });
    const { admin } = makeAdmin({ insertError: { message: "boom" } });
    const r = await attachAsset(admin, OWNER, "d-1", pdfFile());
    expect(r).toEqual({ ok: false, reason: "asset_record_failed" });
    expect(deleteFoundryDocument).toHaveBeenCalled(); // uploaded object cleaned up
  });
});

describe("removeAsset", () => {
  it("removes the object then the row", async () => {
    getOwnerDraft.mockResolvedValue({ id: "d-1", status: "draft" });
    const { admin, storageRemove } = makeAdmin({ asset: { id: "asset-1", storage_bucket: "foundry-docs", storage_path: "owner-1/a.pdf" } });
    const r = await removeAsset(admin, OWNER, "d-1", "asset-1");
    expect(r.ok).toBe(true);
    expect(storageRemove).toHaveBeenCalledWith(["owner-1/a.pdf"]);
  });

  it("a storage failure keeps the row (honest)", async () => {
    getOwnerDraft.mockResolvedValue({ id: "d-1", status: "draft" });
    const { admin } = makeAdmin({ asset: { id: "asset-1", storage_bucket: "foundry-docs", storage_path: "owner-1/a.pdf" }, removeError: { message: "down" } });
    expect(await removeAsset(admin, OWNER, "d-1", "asset-1")).toEqual({ ok: false, reason: "storage_failed" });
  });

  it("non-disclosing when the asset is not on this draft", async () => {
    getOwnerDraft.mockResolvedValue({ id: "d-1", status: "draft" });
    const { admin } = makeAdmin({ asset: null });
    expect(await removeAsset(admin, OWNER, "d-1", "asset-x")).toEqual({ ok: false, reason: "asset_not_found" });
  });
});

describe("listDraftAssets", () => {
  it("returns null for a foreign/missing draft", async () => {
    getOwnerDraft.mockResolvedValue(null);
    const { admin } = makeAdmin();
    expect(await listDraftAssets(admin, OWNER, "d-1")).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serializeDocumentRef } from "./moduleClient";

const getOwnerDraft = vi.fn();
const uploadFoundryDocument = vi.fn();
const deleteFoundryDocument = vi.fn(async (..._a: unknown[]) => undefined);

vi.mock("./foundryModuleService", () => ({
  getOwnerDraft: (...a: unknown[]) => getOwnerDraft(...a),
}));
vi.mock("./documentStorage", () => ({
  uploadFoundryDocument: (...a: unknown[]) => uploadFoundryDocument(...a),
  deleteFoundryDocument: (...a: unknown[]) => deleteFoundryDocument(...a),
}));

import { attachDocument, removeDocument } from "./moduleDocumentService";

/** Fake admin: the ref-persist update chain + storage.remove. */
function fakeAdmin(removeError: unknown = null) {
  const storageRemove = vi.fn(async () => ({ error: removeError }));
  const updateChain = {
    update() {
      return this;
    },
    eq() {
      return this;
    },
    then(res: (v: { error: null }) => unknown) {
      return Promise.resolve({ error: null }).then(res);
    },
  };
  const admin = {
    from: () => updateChain,
    storage: { from: () => ({ remove: storageRemove }) },
  } as unknown as SupabaseClient;
  return { admin, storageRemove };
}

const OWNER = "owner-1";
const UP_OK = {
  ok: true,
  value: { bucket: "foundry-docs", path: "owner-1/new.pdf", byteSize: 2048, pageCount: 12, pageCountVerified: true, contentHash: "abc" },
};

beforeEach(() => {
  getOwnerDraft.mockReset();
  uploadFoundryDocument.mockReset();
  deleteFoundryDocument.mockReset();
  deleteFoundryDocument.mockResolvedValue(undefined);
});

describe("attachDocument", () => {
  it("attaches a PDF and returns safe metadata (no path/bucket/hash)", async () => {
    getOwnerDraft.mockResolvedValueOnce({ id: "d-1", status: "draft", document_asset_ref: null });
    getOwnerDraft.mockResolvedValueOnce({ id: "d-1", status: "draft", document_asset_ref: "…" });
    uploadFoundryDocument.mockResolvedValue(UP_OK);
    const { admin } = fakeAdmin();

    const r = await attachDocument(admin, OWNER, "d-1", { name: "Care Standard.pdf" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.attachment).toEqual({
      present: true,
      filename: "Care Standard.pdf",
      byte_size: 2048,
      page_count: 12,
      page_count_verified: true,
      uploaded_at: expect.any(String),
    });
    expect(JSON.stringify(r.value.attachment)).not.toMatch(/owner-1\/new\.pdf|foundry-docs|abc/);
    expect(deleteFoundryDocument).not.toHaveBeenCalled(); // nothing to replace
  });

  it("replaces: removes the OLD object only after the new ref is authoritative", async () => {
    const oldRef = serializeDocumentRef({
      bucket: "foundry-docs", path: "owner-1/old.pdf", filename: "Old.pdf", byteSize: 1, pageCount: 1, pageCountVerified: true, contentHash: "x", uploadedAt: "t",
    });
    getOwnerDraft.mockResolvedValueOnce({ id: "d-1", status: "draft", document_asset_ref: oldRef });
    getOwnerDraft.mockResolvedValueOnce({ id: "d-1", status: "draft", document_asset_ref: "…" });
    uploadFoundryDocument.mockResolvedValue(UP_OK);
    const { admin } = fakeAdmin();

    const r = await attachDocument(admin, OWNER, "d-1", { name: "New.pdf" });
    expect(r.ok).toBe(true);
    expect(deleteFoundryDocument).toHaveBeenCalledWith(admin, "foundry-docs", "owner-1/old.pdf");
  });

  it("surfaces upload validation failure and persists nothing", async () => {
    getOwnerDraft.mockResolvedValueOnce({ id: "d-1", status: "draft", document_asset_ref: null });
    uploadFoundryDocument.mockResolvedValue({ ok: false, reason: "file_not_pdf" });
    const { admin } = fakeAdmin();
    const r = await attachDocument(admin, OWNER, "d-1", { name: "fake.pdf" });
    expect(r).toEqual({ ok: false, reason: "file_not_pdf" });
    expect(deleteFoundryDocument).not.toHaveBeenCalled();
  });

  it("rejects an approved/published draft before uploading", async () => {
    getOwnerDraft.mockResolvedValueOnce({ id: "d-1", status: "approved", document_asset_ref: null });
    const { admin } = fakeAdmin();
    const r = await attachDocument(admin, OWNER, "d-1", { name: "x.pdf" });
    expect(r).toEqual({ ok: false, reason: "draft_not_mutable" });
    expect(uploadFoundryDocument).not.toHaveBeenCalled();
  });

  it("returns non-disclosing not-found for a foreign/missing draft", async () => {
    getOwnerDraft.mockResolvedValueOnce(null);
    const { admin } = fakeAdmin();
    const r = await attachDocument(admin, OWNER, "d-1", { name: "x.pdf" });
    expect(r).toEqual({ ok: false, reason: "draft_not_found" });
  });
});

describe("removeDocument", () => {
  it("removes the object then clears the reference", async () => {
    const ref = serializeDocumentRef({
      bucket: "foundry-docs", path: "owner-1/a.pdf", filename: "A.pdf", byteSize: 1, pageCount: 1, pageCountVerified: true, contentHash: "x", uploadedAt: "t",
    });
    getOwnerDraft.mockResolvedValueOnce({ id: "d-1", status: "draft", document_asset_ref: ref });
    getOwnerDraft.mockResolvedValueOnce({ id: "d-1", status: "draft", document_asset_ref: null });
    const { admin, storageRemove } = fakeAdmin();
    const r = await removeDocument(admin, OWNER, "d-1");
    expect(r.ok).toBe(true);
    expect(storageRemove).toHaveBeenCalledWith(["owner-1/a.pdf"]);
  });

  it("a storage-removal failure does NOT clear the reference (honest)", async () => {
    const ref = serializeDocumentRef({
      bucket: "foundry-docs", path: "owner-1/a.pdf", filename: "A.pdf", byteSize: 1, pageCount: 1, pageCountVerified: true, contentHash: "x", uploadedAt: "t",
    });
    getOwnerDraft.mockResolvedValueOnce({ id: "d-1", status: "draft", document_asset_ref: ref });
    const { admin } = fakeAdmin({ message: "storage down" });
    const r = await removeDocument(admin, OWNER, "d-1");
    expect(r).toEqual({ ok: false, reason: "remove_failed" });
  });

  it("rejects removal on an approved/published draft", async () => {
    getOwnerDraft.mockResolvedValueOnce({ id: "d-1", status: "published", document_asset_ref: null });
    const { admin } = fakeAdmin();
    expect(await removeDocument(admin, OWNER, "d-1")).toEqual({ ok: false, reason: "draft_not_mutable" });
  });
});

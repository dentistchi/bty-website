import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FOUNDRY_DOC_ALLOWED_MIME,
  FOUNDRY_DOC_MAX_BYTES,
  isAllowedPdfMime,
  isPdfFilename,
  validatePageCount,
} from "@/domain/foundry/events/foundry-document";
import { verifyPdfSignature, derivePdfPageCount } from "@/domain/foundry/events/foundry-pdf-inspect";
import type { ValidationResult } from "@/domain/foundry/events/foundry-event";

/**
 * Foundry PDF storage — service layer.
 *
 * The 'foundry-docs' bucket is PRIVATE (no anon/authenticated policy). Uploads
 * and reads run ONLY through the caller-provided service-role client, after the
 * route has verified the manager (upload) or the joined participant (read). The
 * storage path is SERVER-OWNED: `${ownerUserId}/${uuid}.pdf`.
 *
 * SERVER-AUTHORITATIVE INTAKE: the upload path reads the actual bytes and derives
 * every integrity-relevant value itself — the "%PDF-" signature (a renamed/
 * mislabeled non-PDF is rejected here, not by filename/MIME), the byte size (from
 * the bytes the server received), the page count (server-parsed; flagged
 * unverified only when a compressed PDF is server-undeterminable), and a content
 * hash. The client's page count/byte size are NEVER trusted as canonical.
 */

export const FOUNDRY_DOC_BUCKET = "foundry-docs";
export const FOUNDRY_DOC_SIGNED_URL_TTL_SECONDS = 600;

/** Preliminary (fast-fail) check on the File wrapper before reading bytes. */
export function validatePdfUpload(file: unknown): ValidationResult<{ byteSize: number }> {
  if (!(file instanceof File)) return { ok: false, reason: "file_required" };
  if (file.size <= 0) return { ok: false, reason: "file_empty" };
  if (file.size > FOUNDRY_DOC_MAX_BYTES) return { ok: false, reason: "file_too_large" };
  if (!isAllowedPdfMime(file.type)) return { ok: false, reason: "file_not_pdf" };
  if (!isPdfFilename(file.name)) return { ok: false, reason: "file_not_pdf" };
  return { ok: true, value: { byteSize: file.size } };
}

export function buildDocumentStoragePath(ownerUserId: string): string {
  return `${ownerUserId}/${crypto.randomUUID()}.pdf`;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export type CanonicalUpload = {
  bucket: string;
  path: string;
  byteSize: number;
  pageCount: number;
  pageCountVerified: boolean;
  contentHash: string;
};

export type UploadResult = { ok: true; value: CanonicalUpload } | { ok: false; reason: string };

/**
 * Upload a PDF to the private bucket at a server-owned path, deriving every
 * canonical value from the received bytes. `pageCountHint` (the host browser's
 * preliminary read) is used ONLY as a last-resort fallback when the server cannot
 * parse the count from a compressed PDF, and the result is flagged unverified.
 */
export async function uploadFoundryDocument(
  admin: SupabaseClient,
  ownerUserId: string,
  file: unknown,
  pageCountHint?: unknown,
): Promise<UploadResult> {
  const pre = validatePdfUpload(file);
  if (!pre.ok) return { ok: false, reason: pre.reason };

  const bytes = new Uint8Array(await (file as File).arrayBuffer());

  // Authoritative content check — a renamed/mislabeled non-PDF fails here.
  if (!verifyPdfSignature(bytes)) return { ok: false, reason: "file_not_pdf" };

  // Server-observed byte size (never the client's claim).
  const byteSize = bytes.byteLength;
  if (byteSize <= 0) return { ok: false, reason: "file_empty" };
  if (byteSize > FOUNDRY_DOC_MAX_BYTES) return { ok: false, reason: "file_too_large" };

  // Server-derived page count; fall back to the (flagged) hint only if undeterminable.
  const derived = derivePdfPageCount(bytes);
  let pageCount: number | null = derived.count;
  let pageCountVerified = derived.count != null;
  if (pageCount == null) {
    const hint = validatePageCount(pageCountHint);
    if (!hint.ok) return { ok: false, reason: "page_count_unverifiable" };
    pageCount = hint.value;
    pageCountVerified = false;
  }

  const contentHash = sha256Hex(bytes);
  const path = buildDocumentStoragePath(ownerUserId);

  const { error } = await admin.storage.from(FOUNDRY_DOC_BUCKET).upload(path, bytes, {
    contentType: FOUNDRY_DOC_ALLOWED_MIME,
    upsert: false,
  });
  if (error) return { ok: false, reason: "upload_failed" };

  return {
    ok: true,
    value: { bucket: FOUNDRY_DOC_BUCKET, path, byteSize, pageCount, pageCountVerified, contentHash },
  };
}

/** Mint a short-lived signed read url for a stored document (null on failure). */
export async function createDocumentSignedUrl(
  admin: SupabaseClient,
  bucket: string,
  path: string,
  expiresInSeconds: number = FOUNDRY_DOC_SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Unconditional object removal — callers must first prove the object is safe to delete. */
export async function deleteFoundryDocument(
  admin: SupabaseClient,
  bucket: string,
  path: string,
): Promise<void> {
  await admin.storage
    .from(bucket)
    .remove([path])
    .then(
      () => undefined,
      () => undefined,
    );
}

import { createHmac, timingSafeEqual } from "node:crypto";
import { resolveFoundryRoomSecret } from "./foundry-room-token";

/**
 * Foundry document staging ticket — a signed, tamper-proof capability that binds
 * a staged PDF object to the host + request that produced it, and carries the
 * SERVER-DERIVED canonical values (byte size, page count) so event creation never
 * has to trust the client for them.
 *
 * Why a signed ticket (not raw fields): the client round-trips the ticket between
 * upload and create. If it carried plain `{path, pageCount}`, a caller could edit
 * them. The HMAC makes the payload unforgeable — create verifies the signature,
 * that the ticket's `ownerId` matches the authenticated host, and that it has not
 * expired, then trusts the canonical values and treats the path as provably
 * staged by this host (safe to clean up on failure).
 *
 * Wire format: `btyfrdoc1.<base64url(json)>.<base64url(hmac-sha256)>` — same
 * approach/secret as the room join token, distinct prefix + payload.
 */
export type DocumentUploadTicketPayload = {
  type: "foundry_doc_upload";
  ownerId: string;
  bucket: string;
  path: string;
  byteSize: number;
  pageCount: number;
  pageCountVerified: boolean;
  contentHash: string;
  fileName: string | null;
  sourceType: "uploaded_pdf" | "google_drive";
  originalFileId: string | null;
  iat: number; // epoch ms at mint (used for expiry)
};

export const DOCUMENT_UPLOAD_TICKET_PREFIX = "btyfrdoc1";

/** A staged upload must be attached to an event within this window. */
export const DOCUMENT_UPLOAD_TICKET_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function signDocumentUploadTicket(payload: DocumentUploadTicketPayload): string {
  const json = JSON.stringify(payload);
  const secret = resolveFoundryRoomSecret();
  const sig = createHmac("sha256", secret).update(json).digest("base64url");
  const b64 = Buffer.from(json, "utf8").toString("base64url");
  return `${DOCUMENT_UPLOAD_TICKET_PREFIX}.${b64}.${sig}`;
}

export type VerifyTicketResult =
  | { ok: true; payload: DocumentUploadTicketPayload }
  | { ok: false; reason: string };

/**
 * Verify HMAC + parse + shape + freshness. Returns a stable machine reason on
 * failure; never echoes the ticket. Does NOT check owner match or object
 * existence — the caller checks ownerId against the authenticated host.
 */
export function verifyDocumentUploadTicket(ticket: unknown, nowMs: number): VerifyTicketResult {
  const trimmed = typeof ticket === "string" ? ticket.trim() : "";
  if (!trimmed) return { ok: false, reason: "ticket_invalid" };

  const parts = trimmed.split(".");
  if (parts.length !== 3 || parts[0] !== DOCUMENT_UPLOAD_TICKET_PREFIX) {
    return { ok: false, reason: "ticket_invalid" };
  }
  const [, b64, sig] = parts;
  if (!b64 || !sig) return { ok: false, reason: "ticket_invalid" };

  let json: string;
  try {
    json = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return { ok: false, reason: "ticket_invalid" };
  }

  let secret: string;
  try {
    secret = resolveFoundryRoomSecret();
  } catch {
    return { ok: false, reason: "server_misconfigured" };
  }

  const expectedSig = createHmac("sha256", secret).update(json).digest("base64url");
  const sigBuf = Buffer.from(sig, "utf8");
  const expBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false, reason: "ticket_bad_signature" };
  }

  let payload: DocumentUploadTicketPayload;
  try {
    payload = JSON.parse(json) as DocumentUploadTicketPayload;
  } catch {
    return { ok: false, reason: "ticket_invalid" };
  }

  if (
    payload.type !== "foundry_doc_upload" ||
    typeof payload.ownerId !== "string" ||
    payload.ownerId.length < 1 ||
    typeof payload.bucket !== "string" ||
    typeof payload.path !== "string" ||
    typeof payload.byteSize !== "number" ||
    typeof payload.pageCount !== "number" ||
    typeof payload.pageCountVerified !== "boolean" ||
    typeof payload.contentHash !== "string" ||
    (payload.sourceType !== "uploaded_pdf" && payload.sourceType !== "google_drive") ||
    typeof payload.iat !== "number"
  ) {
    return { ok: false, reason: "ticket_invalid" };
  }

  if (nowMs - payload.iat > DOCUMENT_UPLOAD_TICKET_TTL_MS || nowMs + 60_000 < payload.iat) {
    return { ok: false, reason: "ticket_expired" };
  }

  return { ok: true, payload };
}

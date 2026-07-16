import { describe, it, expect, beforeAll } from "vitest";
import {
  signDocumentUploadTicket,
  verifyDocumentUploadTicket,
  DOCUMENT_UPLOAD_TICKET_TTL_MS,
  type DocumentUploadTicketPayload,
} from "./documentUploadTicket";

beforeAll(() => {
  process.env.FOUNDRY_ROOM_QR_SECRET = "test-foundry-ticket-secret-0123456789";
});

const NOW = 1_800_000_000_000;

function payload(over: Partial<DocumentUploadTicketPayload> = {}): DocumentUploadTicketPayload {
  return {
    type: "foundry_doc_upload",
    ownerId: "owner-1",
    bucket: "foundry-docs",
    path: "owner-1/abc.pdf",
    byteSize: 12345,
    pageCount: 7,
    pageCountVerified: true,
    contentHash: "deadbeef",
    fileName: "handbook.pdf",
    sourceType: "uploaded_pdf",
    originalFileId: null,
    iat: NOW,
    ...over,
  };
}

describe("document upload ticket", () => {
  it("round-trips the SERVER canonical values", () => {
    const t = signDocumentUploadTicket(payload());
    const v = verifyDocumentUploadTicket(t, NOW);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.payload.pageCount).toBe(7);
      expect(v.payload.byteSize).toBe(12345);
      expect(v.payload.ownerId).toBe("owner-1");
    }
  });

  it("rejects a tampered payload (page count edited by the client)", () => {
    const t = signDocumentUploadTicket(payload({ pageCount: 1 }));
    // Forge: swap the base64 payload for one claiming pageCount 999, keep the sig.
    const [prefix, , sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify(payload({ pageCount: 999 })), "utf8").toString("base64url");
    const tampered = `${prefix}.${forged}.${sig}`;
    expect(verifyDocumentUploadTicket(tampered, NOW)).toEqual({ ok: false, reason: "ticket_bad_signature" });
  });

  it("rejects an expired ticket", () => {
    const t = signDocumentUploadTicket(payload({ iat: NOW - DOCUMENT_UPLOAD_TICKET_TTL_MS - 1000 }));
    expect(verifyDocumentUploadTicket(t, NOW)).toEqual({ ok: false, reason: "ticket_expired" });
  });

  it("rejects a garbage / wrong-prefix ticket", () => {
    expect(verifyDocumentUploadTicket("btyfr1.x.y", NOW).ok).toBe(false);
    expect(verifyDocumentUploadTicket("", NOW).ok).toBe(false);
    expect(verifyDocumentUploadTicket(null, NOW).ok).toBe(false);
  });
});

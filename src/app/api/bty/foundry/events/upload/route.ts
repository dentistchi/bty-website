import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { uploadFoundryDocument } from "@/lib/bty/foundry/events/documentStorage";
import { signDocumentUploadTicket } from "@/lib/bty/foundry/events/documentUploadTicket";

export const runtime = "nodejs";

/**
 * POST /api/bty/foundry/events/upload — stage a PDF for a Study Room.
 *
 * Manager-gated (active Foundry Host). Reads the ACTUAL bytes and derives every
 * integrity value server-side (PDF signature, byte size, page count, content
 * hash) — the client's page-count/byte-size are never trusted. Stores the file in
 * the private 'foundry-docs' bucket at a server-owned path and returns a SIGNED
 * staging ticket binding those canonical values to this host + this object. The
 * create call presents the ticket; the file is not attached to any event yet (a
 * ticket that is never used just leaves a short-lived orphan, cleaned up on the
 * next failed create for the same path or ignorable — it is private + unreferenced).
 */
export async function POST(req: NextRequest) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return managerJson(base, req, { error: "invalid_form" }, 400);
  }

  const file = formData.get("file");
  const pageCountHint = formData.get("page_count_hint");
  const result = await uploadFoundryDocument(admin, user.id, file, pageCountHint ?? undefined);
  if (!result.ok) {
    const status = result.reason === "upload_failed" ? 500 : 400;
    return managerJson(base, req, { error: result.reason }, status);
  }

  const c = result.value;
  const fileName = file instanceof File ? file.name : null;
  const ticket = signDocumentUploadTicket({
    type: "foundry_doc_upload",
    ownerId: user.id,
    bucket: c.bucket,
    path: c.path,
    byteSize: c.byteSize,
    pageCount: c.pageCount,
    pageCountVerified: c.pageCountVerified,
    contentHash: c.contentHash,
    fileName,
    sourceType: "uploaded_pdf",
    originalFileId: null,
    iat: Date.now(),
  });

  // Display-only echo (never the storage path); `ticket` carries the canonical truth.
  return managerJson(
    base,
    req,
    {
      ticket,
      file_name: fileName,
      page_count: c.pageCount,
      page_count_verified: c.pageCountVerified,
      byte_size: c.byteSize,
    },
    201,
  );
}

import { NextRequest } from "next/server";
import { requireManager, managerJson, attachJoinUrl } from "@/lib/bty/foundry/events/managerGate";
import { listOwnerEvents } from "@/lib/bty/foundry/events/foundryEventService";
import { createTrainingEvent } from "@/lib/bty/foundry/events/foundryTrainingService";
import { createDocumentEvent } from "@/lib/bty/foundry/events/foundryDocumentService";
import { verifyDocumentUploadTicket } from "@/lib/bty/foundry/events/documentUploadTicket";

export const runtime = "nodejs";

/**
 * Foundry Training Rooms — manager collection.
 *
 * POST /api/bty/foundry/events  — create a room. Branches on content_type:
 *   - 'youtube' (default): body { title, youtube_url, completion_prompt }.
 *   - 'document': body { title, content_type:'document', completion_prompt,
 *     document:{ bucket, path, byteSize, fileName }, page_count } — the PDF was
 *     already staged via POST /events/upload.
 *   Both store event + content atomically (compensating delete on failure) and
 *   return the control-room snapshot incl. join_url. 201 on success, 400 on bad input.
 * GET  /api/bty/foundry/events  — list the caller's own events (newest first) with
 *   joined counts. Never returns another owner's events (service is owner-scoped).
 */
export async function POST(req: NextRequest) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const body = await req.json().catch(() => ({}));

  if (body?.content_type === "document") {
    // The staging ticket carries the SERVER-derived canonical values; the client
    // supplies none of them. Verify signature + owner + freshness before trusting.
    const verified = verifyDocumentUploadTicket(body?.staging_ticket, Date.now());
    if (!verified.ok) return managerJson(base, req, { error: verified.reason }, 400);
    if (verified.payload.ownerId !== user.id) {
      return managerJson(base, req, { error: "upload_invalid" }, 403);
    }
    const p = verified.payload;
    const result = await createDocumentEvent(admin, user.id, {
      title: body?.title,
      intro: body?.intro,
      completion_prompt: body?.completion_prompt,
      canonical: {
        bucket: p.bucket,
        path: p.path,
        byteSize: p.byteSize,
        pageCount: p.pageCount,
        pageCountVerified: p.pageCountVerified,
        contentHash: p.contentHash,
        fileName: p.fileName,
        sourceType: p.sourceType,
        originalFileId: p.originalFileId,
      },
    });
    if (!result.ok) return managerJson(base, req, { error: result.reason }, 400);
    return managerJson(base, req, attachJoinUrl(req, result.value), 201);
  }

  const result = await createTrainingEvent(admin, user.id, {
    title: body?.title,
    youtube_url: body?.youtube_url,
    completion_prompt: body?.completion_prompt,
  });
  if (!result.ok) return managerJson(base, req, { error: result.reason }, 400);

  return managerJson(base, req, attachJoinUrl(req, result.value), 201);
}

export async function GET(req: NextRequest) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const events = await listOwnerEvents(admin, user.id);
  return managerJson(base, req, { events });
}

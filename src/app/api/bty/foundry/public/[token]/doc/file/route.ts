import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveDocumentForRead } from "@/lib/bty/foundry/events/foundryDocumentService";
import {
  createDocumentSignedUrl,
  FOUNDRY_DOC_SIGNED_URL_TTL_SECONDS,
} from "@/lib/bty/foundry/events/documentStorage";
import { jsonNoStore, readParticipantSession, PUBLIC_REASON_STATUS } from "@/lib/bty/foundry/events/publicRoute";

export const runtime = "nodejs";

/**
 * GET /api/bty/foundry/public/[token]/doc/file — mint a short-lived SIGNED read
 * url for the room's PDF. Requires a valid participant session (a joined
 * participant of THIS event) — the private bucket is never publicly readable and
 * the storage path is never exposed. The signed url is returned to the caller and
 * never logged; it expires quickly so a leaked url has a small blast radius.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return jsonNoStore({ ok: false, error: "unavailable" }, 503);

  const { token } = await ctx.params;
  const session = readParticipantSession(req, token);

  const resolved = await resolveDocumentForRead(admin, token, session);
  if (!resolved.ok) {
    return jsonNoStore({ ok: false, error: resolved.reason }, PUBLIC_REASON_STATUS[resolved.reason] ?? 400);
  }

  const url = await createDocumentSignedUrl(admin, resolved.bucket, resolved.path);
  if (!url) return jsonNoStore({ ok: false, error: "document_unavailable" }, 404);

  return jsonNoStore({ ok: true, url, expires_in: FOUNDRY_DOC_SIGNED_URL_TTL_SECONDS });
}

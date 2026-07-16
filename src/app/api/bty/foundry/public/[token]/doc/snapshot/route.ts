import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getPublicDocumentSnapshot } from "@/lib/bty/foundry/events/foundryDocumentService";
import { jsonNoStore, readParticipantSession } from "@/lib/bty/foundry/events/publicRoute";

export const runtime = "nodejs";

/**
 * GET /api/bty/foundry/public/[token]/doc/snapshot — the anonymous snapshot for a
 * PDF Study Room. Serves pre-join AND every stage (read/response/completed/
 * claimable). No auth. Never exposes owner id, internal event id, roster, storage
 * path, signed url, or another participant's response/reading. A returning visitor
 * is recognised via their per-event HttpOnly session cookie. The reflection prompt
 * is included only once the reading requirement is server-marked met (unlocked).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return jsonNoStore({ error: "unavailable" }, 503);

  const { token } = await ctx.params;
  const session = readParticipantSession(req, token);
  const snapshot = await getPublicDocumentSnapshot(admin, token, session);
  return jsonNoStore(snapshot);
}

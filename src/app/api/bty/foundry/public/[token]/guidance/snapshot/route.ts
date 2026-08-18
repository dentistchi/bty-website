import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getPublicGuidanceSnapshot, resolveGuidanceType } from "@/lib/bty/foundry/events/foundryGuidanceService";
import { jsonNoStore, readParticipantSession } from "@/lib/bty/foundry/events/publicRoute";

export const runtime = "nodejs";

/**
 * GET /api/bty/foundry/public/[token]/guidance/snapshot — the anonymous snapshot for a
 * written-guidance or live-discussion room (Slice R4-R2G). No auth. Never exposes owner id,
 * internal event id, roster, or another participant's answers.
 *
 * THE CONTENT TYPE IS RESOLVED SERVER-SIDE from the signed token, never accepted from the
 * caller — a client cannot ask to be treated as a different type than the room it holds.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return jsonNoStore({ error: "unavailable" }, 503);

  const { token } = await ctx.params;
  const contentType = await resolveGuidanceType(admin, token);
  if (!contentType) return jsonNoStore({ error: "guidance_unavailable" }, 404);

  const session = readParticipantSession(req, token);
  const snapshot = await getPublicGuidanceSnapshot(admin, token, session, contentType);
  return jsonNoStore(snapshot);
}

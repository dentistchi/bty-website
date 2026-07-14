import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getPublicTrainingSnapshot } from "@/lib/bty/foundry/events/foundryTrainingService";
import { jsonNoStore, readParticipantSession } from "@/lib/bty/foundry/events/publicRoute";

export const runtime = "nodejs";

/**
 * GET /api/bty/foundry/public/[token] — the anonymous training snapshot for the
 * QR landing page. Serves pre-join AND every training stage (watch/response/
 * completed/claimable). No auth. Never exposes owner id, internal event id,
 * roster, or another employee's response. A returning visitor is recognised via
 * their per-event HttpOnly session cookie. The completion prompt is included
 * only once the video is server-marked complete (unlocked).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return jsonNoStore({ error: "unavailable" }, 503);

  const { token } = await ctx.params;
  const session = readParticipantSession(req, token);
  const snapshot = await getPublicTrainingSnapshot(admin, token, session);
  return jsonNoStore(snapshot);
}

import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
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
  /*
    OPTIONAL AUTH — the same read the three completion routes already ship (R4-R5C3A1).
    This route stays PUBLIC: no 401 gate, an anonymous caller resolves to null, and any failure
    degrades to null. It exists so the server can tell whether this browser's participant belongs
    to the account that is actually signed in (account-switch containment).
  */
  let authUserId: string | null = null;
  try {
    const supa = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supa.auth.getUser();
    authUserId = user?.id ?? null;
  } catch {
    authUserId = null;
  }

  const snapshot = await getPublicGuidanceSnapshot(admin, token, session, contentType, authUserId);
  return jsonNoStore(snapshot);
}

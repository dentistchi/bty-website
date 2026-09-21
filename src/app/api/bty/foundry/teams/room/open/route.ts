import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { readContentType } from "@/domain/foundry/events/content-type";
import { parseTrainingTarget } from "@/domain/teams/trainingTarget";
import { openAccountRoom } from "@/lib/bty/foundry/events/accountParticipant";
import { jsonNoStore, PUBLIC_REASON_STATUS } from "@/lib/bty/foundry/events/publicRoute";

export const runtime = "nodejs";

/**
 * POST /api/bty/foundry/teams/room/open — open a training as the SIGNED-IN learner.
 *
 * The one server seam Teams-native delivery needed. It exists because the public room recognises
 * a learner by a cookie that a Teams tab cannot carry, while the Teams learner is not anonymous at
 * all: the tab has already turned Teams SSO into a canonical Supabase session.
 *
 * WHAT IT ACCEPTS: `{ target }` — the deep link's `subEntityId`, in the one grammar
 * `parseTrainingTarget` admits. Nothing else in the body is read. In particular the caller cannot
 * name a user, a participant, an event id, a display name or a route.
 *
 * WHAT DECIDES IDENTITY: the request's own session, read server-side. `auth.getUser()` here
 * resolves from the cookie on web or from the `Authorization` bearer the Teams tab transport
 * attaches — both end at the same canonical Supabase user. An unauthenticated caller is refused:
 * this route has no anonymous mode, because the anonymous mode is the existing public path.
 *
 * WHAT IT RETURNS: the join token, the resolved content type, the participant's server-resolved
 * display label, and the participant session token for the caller to hold IN MEMORY and present
 * on the existing public endpoints. That token is a capability for one participant on one event —
 * `findParticipantBySession` scopes every lookup by `event_id`, so it cannot be replayed against
 * another room.
 */
export async function POST(req: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) return jsonNoStore({ ok: false, error: "unavailable" }, 503);

  let authUserId: string | null = null;
  try {
    const supa = await getSupabaseServerClient();
    authUserId = (await supa.auth.getUser()).data.user?.id ?? null;
  } catch {
    authUserId = null;
  }
  // No anonymous mode. The anonymous learner has `/f/<token>`, which is unchanged.
  if (!authUserId) return jsonNoStore({ ok: false, error: "unauthenticated" }, 401);

  const body = await req.json().catch(() => ({}));
  const target = parseTrainingTarget((body as { target?: unknown })?.target);
  if (!target) return jsonNoStore({ ok: false, error: "target_invalid" }, 400);

  const opened = await openAccountRoom(admin, target.joinToken, authUserId);
  if (!opened.ok) {
    return jsonNoStore({ ok: false, error: opened.reason }, PUBLIC_REASON_STATUS[opened.reason] ?? 404);
  }

  const contentType = readContentType(opened.event.content_type);
  if (contentType === null) return jsonNoStore({ ok: false, error: "unsupported_room" }, 409);

  return jsonNoStore({
    ok: true,
    joinToken: target.joinToken,
    contentType,
    title: opened.event.title,
    displayName: opened.participant.display_name,
    participantSession: opened.participantSession,
  });
}

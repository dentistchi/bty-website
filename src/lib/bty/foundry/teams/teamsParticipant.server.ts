import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveBtyUserFromMicrosoftIdentity } from "@/lib/bty/identity-link/microsoftIdentityLink.server";
import { resolveDisplayNames } from "@/lib/bty/announcement/recipientDisplayName.server";

/**
 * THE TEAMS-CHAT LEARNER'S PARTICIPANT ROW.
 * SERVER ONLY. Slice Teams Chat-Native Text Training + Quiz V1.
 *
 * ★ IDENTITY IS THE VERIFIED MICROSOFT TUPLE, AND NOTHING ELSE.
 *
 * A learner answering a card in Teams is identified by `(tenant_id, aad_object_id)` taken from an
 * activity whose Bot Framework token has ALREADY been verified. Never an email, never a UPN, never
 * a display name, never anything in the card's data. The caller passes values it derived; this
 * function has no way to accept a client-supplied one because it takes no payload.
 *
 * ★ WHY NOT THE PARTICIPANT SESSION COOKIE. There is no browser here at all. The public room's
 * per-device cookie has no meaning in a chat, which is exactly why this path exists.
 *
 * The database admits a new Teams participant only while the event is open. The partial unique
 * index identifies one Teams participant per (training, person) and leaves web participants alone.
 *
 * ★ THE ACCOUNT LINK IS OPTIONAL, AND ITS ABSENCE NEVER BLOCKS LEARNING. `user_id` is set when the
 * resolver says RESOLVED and left NULL otherwise. An employee who has never signed into BTY can
 * still read, answer, score and complete; the Microsoft tuple on the row is what lets a later
 * sign-in reconcile the account, XP and assignment claim without asking them to do anything.
 */

export type TeamsParticipant = {
  id: string;
  eventId: string;
  displayName: string;
  /** The canonical BTY user when one exists today. NULL is ordinary, not a failure. */
  userId: string | null;
};

const PARTICIPANT_COLS =
  "id, event_id, display_name, status, joined_at, last_seen_at, user_id, microsoft_tenant_id, microsoft_aad_object_id";

/** The honest stand-in when Microsoft supplied no name for this person. */
export const TEAMS_PARTICIPANT_FALLBACK_NAME = "BTY member";

type Row = {
  id: string;
  event_id: string;
  display_name: string;
  status: string;
  user_id: string | null;
};

async function readByMicrosoftIdentity(
  admin: SupabaseClient,
  eventId: string,
  tenantId: string,
  aadObjectId: string,
): Promise<Row | null> {
  const { data } = await admin
    .from("foundry_event_participants")
    .select(PARTICIPANT_COLS)
    .eq("event_id", eventId)
    .eq("microsoft_tenant_id", tenantId)
    .eq("microsoft_aad_object_id", aadObjectId)
    .maybeSingle<Row>();
  return data ?? null;
}

/**
 * A display LABEL for this learner. PRESENTATION ONLY — it never decides anything and is never a
 * key. Read from provider-written identity data when the person has a BTY account, so a learner
 * cannot rename themselves into a colleague on a Host's roster; otherwise the Host's own snapshot
 * of the name Graph returned at send time, and otherwise an honest generic.
 */
async function resolveLabel(
  admin: SupabaseClient,
  userId: string | null,
  fallbackSnapshot: string | null,
): Promise<string> {
  if (userId) {
    try {
      const names = await resolveDisplayNames(admin, [userId]);
      const name = names.get(userId);
      if (name && name.trim()) return name.trim().slice(0, 60);
    } catch {
      /* a name is never the reason a learner cannot take their training */
    }
  }
  const snapshot = (fallbackSnapshot ?? "").trim();
  if (snapshot) return snapshot.slice(0, 60);
  return TEAMS_PARTICIPANT_FALLBACK_NAME;
}

/**
 * Find or create THIS person's participant for THIS training.
 *
 * `tenantId` / `aadObjectId` must already have come from a verified activity. `displayNameSnapshot`
 * is the name Graph returned when the Host sent the training, used only if the learner has no BTY
 * account to read a provider name from.
 */
export async function ensureTeamsParticipant(
  admin: SupabaseClient,
  input: { eventId: string; tenantId: string; aadObjectId: string; displayNameSnapshot?: string | null },
): Promise<{ ok: true; participant: TeamsParticipant } | { ok: false; reason: string }> {
  const { eventId, tenantId, aadObjectId } = input;

  const existing = await readByMicrosoftIdentity(admin, eventId, tenantId, aadObjectId);
  if (existing) {
    if (existing.status !== "joined") return { ok: false, reason: "removed" };
    return {
      ok: true,
      participant: {
        id: existing.id,
        eventId: existing.event_id,
        displayName: existing.display_name,
        userId: existing.user_id,
      },
    };
  }

  // The canonical account, when this person has one. NOT_LINKED is ordinary and never refuses.
  let userId: string | null = null;
  try {
    const resolution = await resolveBtyUserFromMicrosoftIdentity(admin, tenantId, aadObjectId);
    if (resolution.status === "RESOLVED") userId = resolution.userId ?? null;
  } catch {
    console.error("[teams-training] identity resolve threw");
  }

  const displayName = await resolveLabel(admin, userId, input.displayNameSnapshot ?? null);

  const { data, error } = await admin.rpc("join_foundry_teams_training", {
    p_event_id: eventId,
    p_tenant_id: tenantId,
    p_aad_object_id: aadObjectId,
    p_user_id: userId,
    p_display_name: displayName,
  });
  if (error) {
    console.error("[teams-training] participant admission failed", { code: error.code });
    return { ok: false, reason: "participant_write_failed" };
  }
  if (data?.state === "removed" || data?.state === "event_closed") return { ok: false, reason: data.state };
  if (data?.state !== "joined" || !data.participant?.id) return { ok: false, reason: "participant_write_failed" };

  const participant = data.participant as Pick<Row, "id" | "event_id" | "display_name" | "user_id">;
  return {
    ok: true,
    participant: { id: participant.id, eventId: participant.event_id, displayName: participant.display_name, userId: participant.user_id },
  };
}

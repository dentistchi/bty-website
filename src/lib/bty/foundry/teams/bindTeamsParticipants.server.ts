import type { SupabaseClient } from "@supabase/supabase-js";
import { finalizeCanonicalTrainingCompletion } from "@/lib/bty/foundry/events/foundryTrainingService";
import type { EventRow, ParticipantRow } from "@/lib/bty/foundry/events/foundryEventService";

/**
 * LATE ACCOUNT BINDING — the employee who learned before they ever signed in.
 * SERVER ONLY. Slice Teams Chat-Native Text Training + Quiz V1.
 *
 * ★ THE PRODUCT DECISION THIS IMPLEMENTS. An employee can receive a training in Teams, read it,
 * answer the quiz and complete it without having a BTY account. That completion is REAL: the
 * attempt is canonical, the score is canonical, and the Host's reporting is correct. The only
 * thing that cannot exist yet is XP, because XP belongs to an `auth.users` row and there is none —
 * and BTY does not fabricate one.
 *
 * So the participant row keeps the verified Microsoft tuple, and when that same tuple later
 * resolves to a canonical user — the person signs into BTY with Microsoft — this settles the
 * account side. No claim code, no Google login, no learner action, and nothing they have to know
 * happened.
 *
 * ★ WHAT IT WILL NOT DO. It never re-points a participant already bound to a DIFFERENT user: the
 * update is filtered on `user_id is null`, so an existing binding is left exactly as it is. It
 * creates nothing. It decides no identity — the caller has already verified tenant + oid and
 * resolved the canonical user.
 *
 * ★ BEST EFFORT, ALWAYS. This runs inside Microsoft sign-in. A failure here must never stop
 * somebody signing in, so every error is swallowed and counted rather than thrown.
 */

type Bound = { id: string; event_id: string; display_name: string; user_id: string | null };

export async function bindTeamsTrainingParticipants(
  admin: SupabaseClient,
  userId: string,
  tenantId: string,
  aadObjectId: string,
): Promise<number> {
  if (!userId || !tenantId || !aadObjectId) return 0;
  try {
    /*
      BIND, FILTERED ON UNBOUND. `is("user_id", null)` is the whole safety property: a row already
      belonging to someone else is not matched, so it cannot be taken over by a later sign-in.
    */
    const { data: bound, error } = await admin
      .from("foundry_event_participants")
      .update({ user_id: userId })
      .eq("microsoft_tenant_id", tenantId)
      .eq("microsoft_aad_object_id", aadObjectId)
      .is("user_id", null)
      .select("id, event_id, display_name, user_id")
      .returns<Bound[]>();
    if (error) {
      console.error("[teams-training] late bind failed", { code: error.code ?? "unknown" });
      return 0;
    }
    const rows = bound ?? [];
    if (rows.length === 0) return 0;

    /*
      SETTLE THE ACCOUNT SIDE OF ANY COMPLETION THAT ALREADY HAPPENED.

      The canonical finalizer is idempotent — it is the same function the learner's own completion
      ran, and every consequence it has (XP award, identity link, follow-up, apply window,
      assignment claim) is written once. Re-running it now, with a user id that did not exist then,
      is what makes the XP arrive without anyone claiming anything.

      A participant with no completed progress is simply skipped: binding the row is the whole
      benefit for them, and their completion will settle normally when it happens.
    */
    for (const row of rows) {
      try {
        const { data: progress } = await admin
          .from("foundry_event_training_progress")
          .select("id, completed_at")
          .eq("event_id", row.event_id)
          .eq("participant_id", row.id)
          .maybeSingle<{ id: string; completed_at: string | null }>();
        if (!progress?.completed_at) continue;

        const { data: event } = await admin
          .from("foundry_events")
          .select("id, owner_user_id, title, status, content_type, join_version, created_at, closed_at")
          .eq("id", row.event_id)
          .maybeSingle<EventRow>();
        if (!event) continue;

        const participant = {
          id: row.id,
          event_id: row.event_id,
          display_name: row.display_name,
          status: "joined",
          user_id: userId,
        } as ParticipantRow;

        await finalizeCanonicalTrainingCompletion(admin, {
          event,
          participant,
          progressId: progress.id,
          completedAt: progress.completed_at,
          authUserId: userId,
        });
      } catch {
        // One participant's settlement must not stop the others, and must not fail the sign-in.
        console.error("[teams-training] late settle threw");
      }
    }
    return rows.length;
  } catch {
    console.error("[teams-training] late bind threw");
    return 0;
  }
}

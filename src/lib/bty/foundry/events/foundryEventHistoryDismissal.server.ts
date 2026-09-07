import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ★ "REMOVE THIS FINISHED TRAINING FROM MY HISTORY."
 *
 * Personal projection state over a SHARED object. A closed session has participants, progress and
 * completion records belonging to other people, so cleanup can never be a column on the session
 * itself — one person tidying their list would decide what everybody else sees. It is a row about a
 * person's own view, and this module is the only writer of it.
 *
 * ★ WHAT IT CANNOT REACH, STRUCTURALLY. Every statement here names exactly two tables:
 * `foundry_events` (read only, to check ownership) and the dismissal table (insert only). It
 * changes no status, no participant, no progress, no completion record and no content. There is no
 * DELETE anywhere — `service_role` holds none on the dismissal table, deliberately, because V1 has
 * no Restore.
 *
 * ★ NO RESURFACE, AND THAT IS THE HONEST DESIGN. Track cards return because somebody wrote to you.
 * Nobody writes to a closed session, so a hide that expired would be a hide that never expires.
 * Once removed, it stays removed.
 */

export type DismissTrainingResult =
  | { ok: true; changed: boolean }
  | { ok: false; code: "not_found" | "not_closed" | "write_failed" };

/**
 * The set of sessions this person has hidden. Owner-scoped by the caller, and used to subtract
 * from the history projection rather than to mutate anything.
 */
export async function loadHistoryDismissals(
  admin: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const uid = (userId ?? "").trim();
  if (!uid) return new Set();
  const { data, error } = await admin
    .from("bty_foundry_event_history_dismissals")
    .select("event_id")
    .eq("user_id", uid)
    .returns<{ event_id: string }[]>();
  if (error) {
    /*
      FAIL OPEN, deliberately. This subtracts from a list; if it cannot be read, showing a person
      something they had tidied away is a far smaller harm than hiding their whole history behind
      an error. The Track surfaces make the same choice for the same reason.
    */
    console.error("[foundry-history] dismissal read failed", { code: error.code ?? "unknown" });
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.event_id));
}

/**
 * Hide one CLOSED session from the caller's own history.
 *
 * OWNERSHIP AND LIFECYCLE ARE BOTH RE-DERIVED HERE, from the session row, never from the request.
 * Measured: the Past-training section and the history archive are both owner-scoped Host surfaces
 * behind `requireManager`, so the only person with history to tidy is the owner.
 *
 * A session that is not theirs and a session that does not exist return the SAME `not_found`, so
 * this cannot be used to discover whether one exists.
 */
export async function dismissTrainingFromHistory(
  admin: SupabaseClient,
  params: { userId: string; eventId: string },
): Promise<DismissTrainingResult> {
  const userId = (params.userId ?? "").trim();
  const eventId = (params.eventId ?? "").trim();
  if (!userId || !eventId) return { ok: false, code: "not_found" };

  const { data: event, error: exErr } = await admin
    .from("foundry_events")
    .select("id, status")
    .eq("id", eventId)
    .eq("owner_user_id", userId)
    .maybeSingle<{ id: string; status: string }>();
  if (exErr) {
    console.error("[foundry-history] ownership read failed", { code: exErr.code ?? "unknown" });
    return { ok: false, code: "write_failed" };
  }
  // Not theirs, or not there. Indistinguishable, on purpose.
  if (!event) return { ok: false, code: "not_found" };

  /*
    ★ ONLY A FINISHED SESSION MAY BE TIDIED AWAY. An open one is live work, and hiding it would
    hide an obligation rather than a record. Checked on the STORED status, not on anything the
    client believed when it drew the row.
  */
  if (event.status !== "closed") return { ok: false, code: "not_closed" };

  const { error: insErr } = await admin
    .from("bty_foundry_event_history_dismissals")
    .insert({ user_id: userId, event_id: eventId });

  if (!insErr) return { ok: true, changed: true };

  /*
    23505 = the primary key already holds this pair. Removing something already gone from your
    history is not a second decision, so it is a success that changed nothing — and the KEY is what
    makes that true, rather than a read-then-write the service layer would have to get right.
  */
  if ((insErr as { code?: string }).code === "23505") return { ok: true, changed: false };

  console.error("[foundry-history] dismissal insert failed", { code: (insErr as { code?: string }).code ?? "unknown" });
  return { ok: false, code: "write_failed" };
}

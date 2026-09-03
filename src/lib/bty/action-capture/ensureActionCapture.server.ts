import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveTeamsCaptureSource,
  type TeamsCaptureInput,
} from "@/domain/action-capture/captureSource";
import {
  triageGroupRank,
  triageStateOf,
  type TriageChoice,
  type TriageState,
} from "@/domain/action-capture/triage";

/**
 * Action Capture producer (Slice R1B-C2) — the ONLY writer of `public.bty_action_captures`.
 *
 * CAPTURE != COMMITMENT. This function writes exactly one row to exactly one table. It never
 * touches `bty_action_contracts`, `arena_runs`, `foundry_*`, `core_xp_ledger` or any verification
 * log, and there is no code path here that could: the single `.from()` target is a constant.
 *
 * OWNERSHIP IS THE SESSION. `userId` arrives as its own argument, separate from the payload, so a
 * client-supplied `user_id` cannot reach the insert even by accident. `status` is always
 * `'captured'`; `promoted_at` and `promoted_action_contract_id` are NEVER written here — promotion
 * is a later explicit user decision, and this producer is not it.
 *
 * IDEMPOTENCY IS THE DATABASE. `UNIQUE (user_id, source_type, external_key)` is the authority.
 * We attempt the insert, and on 23505 re-read by that exact tuple and return the EXISTING row.
 * This is deliberately NOT an upsert: a second save is not permission to rewrite the original
 * capture's preview, URL or provenance. History is not editable by repetition.
 *
 * (R1A measured why this matters: `fieldActionProducer` documents idempotency from
 * "UNIQUE(user_id, session_id)" — a constraint that does not exist live. Here the constraint named
 * in the comment is the constraint the migration creates and the proof exercises.)
 */

/** Explicit column allow-list — never select('*'); the DTO shape is decided here, not by the table. */
const CAPTURE_COLS =
  // `saved_at` is selected but NOT projected: the service needs it to decide whether a Save must
  // stamp an existing row, and no client has any use for it.
  "id, source_type, external_key, preview_text, source_url, source_metadata, status, captured_at, triage_choice, triaged_at, saved_at";

export type ActionCapture = {
  id: string;
  sourceType: string;
  externalKey: string;
  previewText: string | null;
  sourceUrl: string | null;
  sourceMetadata: Record<string, unknown>;
  status: string;
  capturedAt: string | null;
  /** The user's own decision, or null when they have not made one. Never written by this producer. */
  triageChoice: TriageState;
  triagedAt: string | null;
};

export type EnsureActionCaptureResult =
  | { ok: true; capture: ActionCapture; created: boolean }
  | { ok: false; code: "unsupported_provider" | "missing_identifier" | "not_owner" | "insert_failed" | "load_failed" };

type Row = {
  id: string;
  source_type: string | null;
  external_key: string | null;
  preview_text: string | null;
  source_url: string | null;
  source_metadata: Record<string, unknown> | null;
  status: string | null;
  captured_at: string | null;
  triage_choice: string | null;
  triaged_at: string | null;
};

function project(row: Row): ActionCapture {
  return {
    id: String(row.id),
    sourceType: row.source_type ?? "",
    externalKey: row.external_key ?? "",
    previewText: row.preview_text,
    sourceUrl: row.source_url,
    sourceMetadata: (row.source_metadata ?? {}) as Record<string, unknown>,
    status: row.status ?? "",
    capturedAt: row.captured_at,
    triageChoice: triageStateOf(row.triage_choice),
    triagedAt: row.triaged_at,
  };
}

/**
 * Create (or return the already-existing) capture for this user + external item.
 *
 * ★ TWO CALLERS, TWO INTENTS, ONE ROW.
 *
 * "Save to BTY" is a person putting a message on their own list. "Track with BTY" needs the same
 * message as SOURCE EVIDENCE, because the announcement has a foreign key to a capture — and it
 * must reuse the existing row rather than create a second, which the UNIQUE
 * (user_id, source_type, external_key) enforces.
 *
 * Until 2026-09-02 those were indistinguishable, so tracking a message silently added it to the
 * person's Saved for later list. `saved_at` records which of the two happened, at the moment it is
 * actually known:
 *
 *   save         stamps `saved_at` — on insert, and on an existing row that Track created first
 *   track_source never sets it, and NEVER clears one that Save already set
 *
 * @param userId server-derived `auth.users.id`. NEVER from the request body.
 * @param input  the synthetic source payload; only its SOURCE fields are read.
 * @param intent why this row is being ensured. REQUIRED, with no default: the two callers mean
 *               opposite things by the same row, and a default would silently pick one of them for
 *               whoever forgot. A new call site that omits it fails to compile, which is the only
 *               moment the author is still thinking about which it is.
 */
export async function ensureActionCapture(
  admin: SupabaseClient,
  params: { userId: string; input: TeamsCaptureInput; intent: "save" | "track_source" },
): Promise<EnsureActionCaptureResult> {
  const intent = params.intent;
  const userId = typeof params.userId === "string" ? params.userId.trim() : "";
  if (!userId) return { ok: false, code: "not_owner" };

  const resolved = resolveTeamsCaptureSource(params.input);
  if (!resolved.ok) return { ok: false, code: resolved.code };

  const { sourceType, externalKey } = resolved;

  // 1. Already captured? Owner-scoped by the exact unique tuple.
  const { data: existing, error: exErr } = await admin
    .from("bty_action_captures")
    .select(CAPTURE_COLS)
    .eq("user_id", userId)
    .eq("source_type", sourceType)
    .eq("external_key", externalKey)
    .maybeSingle();
  if (exErr) return { ok: false, code: "load_failed" };
  if (existing) {
    /*
      SAVE AFTER TRACK promotes the row's intent; TRACK AFTER SAVE leaves it alone.
      The `is("saved_at", null)` guard is what makes the second true: a row already stamped is not
      re-stamped, so a later Track can never move a save's timestamp, and neither can a second Save.
    */
    const row = existing as Row & { saved_at?: string | null };
    if (intent === "save" && !row.saved_at) {
      const { data: stamped } = await admin
        .from("bty_action_captures")
        .update({ saved_at: new Date().toISOString() })
        .eq("id", row.id)
        .is("saved_at", null)
        .select(CAPTURE_COLS)
        .maybeSingle();
      if (stamped) return { ok: true, capture: project(stamped as Row), created: false };
    }
    return { ok: true, capture: project(existing as Row), created: false };
  }

  // 2. Insert. status='captured' always; promotion columns deliberately absent.
  const { data: inserted, error: insErr } = await admin
    .from("bty_action_captures")
    .insert({
      user_id: userId,
      source_type: sourceType,
      external_key: externalKey,
      preview_text: resolved.previewText,
      source_url: resolved.sourceUrl,
      source_metadata: resolved.sourceMetadata,
      status: "captured",
      // NULL for track_source: the row exists, but nobody asked for it to be on their list.
      saved_at: intent === "save" ? new Date().toISOString() : null,
    })
    .select(CAPTURE_COLS)
    .single();

  if (!insErr && inserted) return { ok: true, capture: project(inserted as Row), created: true };

  // 3. 23505 → a concurrent save won the unique tuple. Re-read it; do NOT overwrite it.
  if ((insErr as { code?: string } | null)?.code === "23505") {
    const { data: again } = await admin
      .from("bty_action_captures")
      .select(CAPTURE_COLS)
      .eq("user_id", userId)
      .eq("source_type", sourceType)
      .eq("external_key", externalKey)
      .maybeSingle();
    if (again) return { ok: true, capture: project(again as Row), created: false };
  }

  console.error("[actionCapture] insert failed", {
    user: userId.slice(0, 8),
    sourceType,
    code: (insErr as { code?: string } | null)?.code ?? null,
  });
  return { ok: false, code: "insert_failed" };
}

/**
 * The caller's ACTIVE Saved-for-later list: `status='captured'` only, newest first.
 *
 * `promoted` and `dismissed` are deliberately excluded — a promoted capture lives on as an Action
 * Contract and a dismissed one was let go; neither is still "saved for later". Throws on a query
 * error so the route can return a non-200 (the UI must tell error apart from empty).
 */
export async function listMyActionCaptures(
  admin: SupabaseClient,
  userId: string,
): Promise<ActionCapture[]> {
  const uid = (userId ?? "").trim();
  if (!uid) return [];
  const { data, error } = await admin
    .from("bty_action_captures")
    .select(CAPTURE_COLS)
    .eq("user_id", uid)
    .eq("status", "captured")
    // ★ EXPLICIT SAVES ONLY. A capture that exists solely as an announcement's source evidence was
    // never put here by anybody, and showing it made "Track with BTY" quietly mean "and save it".
    .not("saved_at", "is", null)
    .order("captured_at", { ascending: false });
  if (error) throw new Error(`listMyActionCaptures: ${error.message}`);
  return ((data ?? []) as Row[]).map(project).sort(compareForSavedLane);
}

/**
 * The saved lane's canonical order (Slice T2): undecided first, then soon, then later.
 *
 * Sorted HERE rather than in SQL because the rule is a product decision, not a storage one, and
 * PostgREST cannot express the group rank without a view. Sorted here rather than in the component
 * because a surface renders an order, it does not decide one.
 *
 * Within a group: the undecided are newest-SAVED first (nothing else has happened to them), while
 * the decided are newest-DECIDED first — what the person most recently chose is what they most
 * recently thought about. Timing is never inferred from `captured_at` for a decided row.
 */
function compareForSavedLane(a: ActionCapture, b: ActionCapture): number {
  const rank = triageGroupRank(a.triageChoice) - triageGroupRank(b.triageChoice);
  if (rank !== 0) return rank;
  const key = (c: ActionCapture) => (c.triageChoice === null ? c.capturedAt : c.triagedAt) ?? "";
  const ka = key(a);
  const kb = key(b);
  if (ka === kb) return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; // deterministic tie-break
  return ka < kb ? 1 : -1;
}

export type SetTriageResult =
  | { ok: true; capture: ActionCapture; changed: boolean }
  | { ok: false; code: "not_found" | "update_failed" | "load_failed" };

/**
 * Record the user's decision about one of their own captures.
 *
 * OWNERSHIP AND ELIGIBILITY ARE IN THE WHERE CLAUSE, not in a prior read: the UPDATE matches
 * `id` AND `user_id` AND `status='captured'` AND `triage_choice IS NULL`, so a row belonging to
 * someone else is not merely rejected — it is never selected, and two concurrent taps cannot both
 * write. The pair is written together because the DB constraint requires it.
 *
 * ALREADY DECIDED IS NOT AN ERROR. When the conditional update matches nothing, we re-read the
 * caller's OWN row: if it exists and is already triaged, the decision stands and is returned with
 * `changed: false` — mirroring the capture producer's `created: false` for a repeat save, which is
 * this codebase's existing convention for "your intent was already satisfied". Anything else is a
 * single opaque `not_found`, so a probe cannot tell "someone else's row" from "no such row".
 *
 * This function writes EXACTLY two columns. It cannot touch provenance, `status`, promotion, an
 * Action Contract, Arena or XP — the update payload is a literal with two keys.
 */
export async function setActionCaptureTriage(
  admin: SupabaseClient,
  params: { userId: string; captureId: string; choice: TriageChoice },
): Promise<SetTriageResult> {
  const userId = typeof params.userId === "string" ? params.userId.trim() : "";
  const captureId = typeof params.captureId === "string" ? params.captureId.trim() : "";
  if (!userId || !captureId) return { ok: false, code: "not_found" };

  const { data: updated, error: upErr } = await admin
    .from("bty_action_captures")
    .update({ triage_choice: params.choice, triaged_at: new Date().toISOString() })
    .eq("id", captureId)
    .eq("user_id", userId)
    .eq("status", "captured")
    .is("triage_choice", null)
    .select(CAPTURE_COLS)
    .maybeSingle();

  if (upErr) {
    console.error("[actionCapture] triage update failed", { user: userId.slice(0, 8), code: (upErr as { code?: string }).code ?? null });
    return { ok: false, code: "update_failed" };
  }
  if (updated) return { ok: true, capture: project(updated as Row), changed: true };

  // Nothing matched. Either it is already decided (return that, unchanged) or it is not the
  // caller's to see. Owner-scoped so the second case stays indistinguishable from absence.
  const { data: existing, error: exErr } = await admin
    .from("bty_action_captures")
    .select(CAPTURE_COLS)
    .eq("id", captureId)
    .eq("user_id", userId)
    .maybeSingle();
  if (exErr) return { ok: false, code: "load_failed" };
  if (existing && (existing as Row).triage_choice !== null) {
    return { ok: true, capture: project(existing as Row), changed: false };
  }
  return { ok: false, code: "not_found" };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveTeamsCaptureSource,
  type TeamsCaptureInput,
} from "@/domain/action-capture/captureSource";

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
  "id, source_type, external_key, preview_text, source_url, source_metadata, status, captured_at";

export type ActionCapture = {
  id: string;
  sourceType: string;
  externalKey: string;
  previewText: string | null;
  sourceUrl: string | null;
  sourceMetadata: Record<string, unknown>;
  status: string;
  capturedAt: string | null;
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
  };
}

/**
 * Create (or return the already-existing) capture for this user + external item.
 *
 * @param userId server-derived `auth.users.id`. NEVER from the request body.
 * @param input  the synthetic source payload; only its SOURCE fields are read.
 */
export async function ensureActionCapture(
  admin: SupabaseClient,
  params: { userId: string; input: TeamsCaptureInput },
): Promise<EnsureActionCaptureResult> {
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
  if (existing) return { ok: true, capture: project(existing as Row), created: false };

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
    .order("captured_at", { ascending: false });
  if (error) throw new Error(`listMyActionCaptures: ${error.message}`);
  return ((data ?? []) as Row[]).map(project);
}

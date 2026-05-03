/**
 * Persists {@link applyPatternSignatureTransition} to `user_pattern_signatures` (service role).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePatternFamilyId } from "@/domain/pattern-family";
import {
  applyPatternSignatureTransition,
  type PatternSignaturePrevSnapshot,
} from "@/domain/arena/patternSignatureAggregation";
import type { ReexposureValidationPayload } from "@/lib/bty/arena/reexposureValidation.server";

function normalizeFamilyKey(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  const n = normalizePatternFamilyId(t);
  return n && n.length > 0 ? n : t.toLowerCase();
}

export async function upsertUserPatternSignatureFromValidation(params: {
  admin: SupabaseClient;
  userId: string;
  payload: ReexposureValidationPayload;
  pendingOutcomeId: string;
  sourceChoiceHistoryId: string;
  /** Next follow-up pending scheduled time, or null if loop closed / no schedule. */
  nextWatchpointIso: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const axis =
    (params.payload.after_axis || params.payload.before_axis || "").trim();
  const famRaw = params.payload.after_pattern_family ?? params.payload.before_pattern_family;
  const patternKey = normalizeFamilyKey(famRaw);
  if (!patternKey || !axis) {
    console.warn("[pattern_signature][skip]", { patternKey, axis, userId: params.userId });
    return { ok: true };
  }

  const { data: existing, error: selErr } = await params.admin
    .from("user_pattern_signatures")
    .select(
      "pattern_family, axis, repeat_count, confidence_score, lifetime_changed_count, current_state, first_seen_at",
    )
    .eq("user_id", params.userId)
    .eq("pattern_family", patternKey)
    .eq("axis", axis)
    .maybeSingle();

  if (selErr) return { ok: false, error: selErr.message };

  const prevRow = existing as
    | {
        repeat_count?: number;
        confidence_score?: number;
        lifetime_changed_count?: number;
        current_state?: string;
        first_seen_at?: string;
      }
    | null;

  const prev: PatternSignaturePrevSnapshot | null =
    prevRow &&
    typeof prevRow.repeat_count === "number" &&
    typeof prevRow.confidence_score === "number" &&
    typeof prevRow.lifetime_changed_count === "number" &&
    typeof prevRow.current_state === "string"
      ? {
          current_state: prevRow.current_state as PatternSignaturePrevSnapshot["current_state"],
          repeat_count: prevRow.repeat_count,
          confidence_score: prevRow.confidence_score,
          lifetime_changed_count: prevRow.lifetime_changed_count,
        }
      : null;

  const step = applyPatternSignatureTransition(prev, {
    validation_result: params.payload.validation_result,
  });

  const nowIso = new Date().toISOString();
  const repeat_count = prev ? prev.repeat_count + step.repeat_count_delta : step.repeat_count_delta;

  console.info("[pattern_signature][upsert]", {
    user_id: params.userId,
    pattern_family: patternKey,
    axis,
    before_state: prev?.current_state ?? null,
    after_state: step.current_state,
    repeat_count,
    confidence_score: step.confidence_score,
    current_state: step.current_state,
    validation_result: params.payload.validation_result,
  });

  const insertOrMerge = {
    user_id: params.userId,
    pattern_family: patternKey,
    axis,
    first_seen_at: (prevRow?.first_seen_at as string | undefined) ?? nowIso,
    last_seen_at: nowIso,
    repeat_count,
    current_state: step.current_state,
    last_validation_result: params.payload.validation_result,
    confidence_score: step.confidence_score,
    lifetime_changed_count: step.lifetime_changed_count,
    last_source_pending_outcome_id: params.pendingOutcomeId,
    last_source_choice_history_id: params.sourceChoiceHistoryId,
    next_watchpoint: params.nextWatchpointIso,
    updated_at: nowIso,
  };

  const { error: upErr } = await params.admin.from("user_pattern_signatures").upsert(insertOrMerge, {
    onConflict: "user_id,pattern_family,axis",
  });

  if (upErr) return { ok: false, error: upErr.message };
  return { ok: true };
}

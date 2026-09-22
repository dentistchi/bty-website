import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * DELIVERY ATTEMPT EVIDENCE. SERVER ONLY. Slice Teams Delivery Diagnostics V1.
 *
 * ★ WHY. Measured on production: 0 deliveries, 0 sessions, 0 conversation claims, and two
 * conversation refs untouched for hours. A training that was never sent and a training whose send
 * FAILED produced exactly the same numbers — because the delivery row is only written after Graph
 * validation and conversation resolution have both succeeded. Everything that refused before that
 * point left no trace, so "it didn't work" could not be told apart from "nobody tried".
 *
 * This records one row per (recipient, stage) outcome, success or failure, and nothing else.
 *
 * ★ IT IS EVIDENCE, NOT AUTHORITY. Nothing reads it to decide anything: not delivery, not
 * identity, not eligibility, not scoring, not completion. Removing the table would change no
 * behaviour at all — only what an operator can find out afterwards.
 *
 * ★ FAIL-SOFT, ALWAYS. A diagnostic write must never become the reason a real delivery fails, so
 * every error here is swallowed. An audit row that did not get written is a gap in evidence; an
 * exception thrown from one would be a gap in the product.
 */

export type DeliveryStage = "graph_validation" | "conversation_resolution" | "card_send";

export type DeliveryResult =
  | "eligible"
  | "not_eligible"
  | "not_installed"
  | "conversation_failed"
  | "send_failed"
  | "delivery_unknown"
  | "delivered";

/**
 * Microsoft's short symbolic code, if the Connector classifier extracted one. Never a payload.
 *
 * ★ AN ALLOW-LIST GRAMMAR, NOT A LENGTH CHECK. The first version refused anything long or
 * containing whitespace, and a test immediately produced the case that defeats it:
 * `{"error":{"code":"Forbidden","message":"denied"}}` is 48 characters with no spaces at all. A
 * compact JSON body would have been stored verbatim in a diagnostic table.
 *
 * So the rule is what a symbolic code IS — letters, digits, dot, underscore, hyphen — and
 * everything else is dropped. Braces, quotes, colons, slashes and spaces cannot appear, which
 * excludes bodies, URLs and auth challenges by construction rather than by guessing their shape.
 */
const SYMBOLIC_CODE = /^[A-Za-z0-9._-]{1,80}$/;

function safeCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  return SYMBOLIC_CODE.test(v) ? v : null;
}

export async function recordDeliveryAttempt(
  admin: SupabaseClient,
  input: {
    eventId: string;
    ownerUserId: string;
    tenantId: string;
    aadObjectId: string;
    displayName?: string | null;
    stage: DeliveryStage;
    result: DeliveryResult;
    microsoftFailureCode?: unknown;
  },
): Promise<void> {
  try {
    const { error } = await admin.from("foundry_teams_training_delivery_attempts").insert({
      event_id: input.eventId,
      owner_user_id_snapshot: input.ownerUserId,
      tenant_id: input.tenantId,
      aad_object_id: input.aadObjectId,
      display_name_snapshot: input.displayName ?? null,
      stage: input.stage,
      result: input.result,
      microsoft_failure_code: safeCode(input.microsoftFailureCode),
    });
    // Code only — an audit failure is logged as a fact, never with the row it failed to write.
    if (error) console.error("[teams-delivery-audit] insert failed", { code: error.code ?? "unknown" });
  } catch {
    console.error("[teams-delivery-audit] insert threw");
  }
}

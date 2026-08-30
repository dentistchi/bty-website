/**
 * Action Capture — source contract (PURE). Slice R1B-C2.
 *
 * Turns the payload a future Teams adapter will send into the SERVER-OWNED identity and
 * provenance of a `bty_action_captures` row. No I/O, no DB, no side effects.
 *
 * CAPTURE != COMMITMENT. Nothing here derives a deadline, a priority, a category, a task title
 * or any interpretation of the message. A capture means "the user chose not to lose this", and
 * the only things this module produces are: where it came from, how to recognise it again, and
 * how to open it. There is deliberately no enrichment step to add one later by accident.
 *
 * IDENTITY IS SERVER-OWNED. `source_type` and `external_key` are DERIVED here from the source
 * identifiers, never accepted from a caller. A client that sends `external_key`, `source_type`,
 * `user_id`, `status`, `promoted_at` or `promoted_action_contract_id` is sending fields it does
 * not own; the route strips them and this module could not consume them if it tried.
 */

/** The one source this slice speaks. A second provider gets its own derivation, not a flag. */
export const CAPTURE_PROVIDER_TEAMS = "teams" as const;
/** Stored `source_type`. Names the KIND of thing captured, not just the app it came from. */
export const CAPTURE_SOURCE_TYPE_TEAMS = "teams_message" as const;

/** Longest preview we retain. A preview is for recognition, never for meaning. */
export const PREVIEW_MAX = 280;

/**
 * The synthetic payload a Teams adapter will POST. Deliberately generic:
 * `conversation_id` is the ONE conversational address, and canonicalizing Teams' chat-vs-channel
 * distinction into it is the FUTURE ADAPTER'S job — this seam does not invent Microsoft semantics.
 * `channel_id` / `chat_id` ride along as provenance only and never touch identity.
 */
export type TeamsCaptureInput = {
  provider: string;
  tenant_id: string;
  conversation_id: string;
  message_id: string;
  preview_text?: string | null;
  source_url?: string | null;
  sender_display?: string | null;
  captured_at?: string | null;
  channel_id?: string | null;
  chat_id?: string | null;
  /**
   * WHY the user has this item, not what it means. Slice T1 adds the one reason that exists today
   * (`explicit_save`); a future @mention path needs to be distinguishable from a deliberate save,
   * and recording it at capture time is the only moment the distinction is knowable. Provenance
   * only: it never reaches `external_key`, so the same message saved twice by different routes is
   * still one capture.
   */
  capture_reason?: string | null;
};

export type CaptureSourceResolution =
  | {
      ok: true;
      sourceType: typeof CAPTURE_SOURCE_TYPE_TEAMS;
      externalKey: string;
      previewText: string | null;
      sourceUrl: string | null;
      sourceMetadata: Record<string, string>;
    }
  | { ok: false; code: "unsupported_provider" | "missing_identifier" };

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
/** Provenance strings are stored only when they actually say something. */
const optional = (v: unknown): string | null => {
  const s = str(v);
  return s === "" ? null : s;
};

/**
 * Only schemes that can open a Teams message. `javascript:` and `data:` would become an
 * XSS vector the moment the URL is rendered as "Open in Teams", so the allow-list is
 * positive: anything not named here is dropped and the button simply does not render.
 */
const OPENABLE_SCHEMES = new Set(["https:", "msteams:"]);

export function safeSourceUrl(raw: unknown): string | null {
  const s = str(raw);
  if (s === "") return null;
  try {
    return OPENABLE_SCHEMES.has(new URL(s).protocol) ? s : null;
  } catch {
    return null;
  }
}

/**
 * `teams:<tenant_id>:<conversation_id>:<message_id>` — the canonical external key.
 *
 * All three identifiers are REQUIRED and trimmed; a blank one is a rejection, never an empty
 * segment, because `teams::c:m` would collide across tenants. Preview text and sender display
 * are NEVER part of identity: the same message re-saved with different surrounding text is the
 * same message, and a person renaming themselves does not create a new capture.
 */
export function resolveTeamsCaptureSource(input: TeamsCaptureInput): CaptureSourceResolution {
  if (str(input?.provider) !== CAPTURE_PROVIDER_TEAMS) return { ok: false, code: "unsupported_provider" };

  const tenantId = str(input?.tenant_id);
  const conversationId = str(input?.conversation_id);
  const messageId = str(input?.message_id);
  if (!tenantId || !conversationId || !messageId) return { ok: false, code: "missing_identifier" };

  // Provenance only — every value is a fact about the SOURCE, never an interpretation of it.
  const sourceMetadata: Record<string, string> = {
    provider: CAPTURE_PROVIDER_TEAMS,
    tenant_id: tenantId,
    conversation_id: conversationId,
    message_id: messageId,
  };
  const senderDisplay = optional(input?.sender_display);
  if (senderDisplay) sourceMetadata.sender_display = senderDisplay;
  const channelId = optional(input?.channel_id);
  if (channelId) sourceMetadata.channel_id = channelId;
  const chatId = optional(input?.chat_id);
  if (chatId) sourceMetadata.chat_id = chatId;
  // Named `_source` because it is what the SOURCE reported, never BTY's own captured_at column.
  const capturedAtSource = optional(input?.captured_at);
  if (capturedAtSource) sourceMetadata.captured_at_source = capturedAtSource;
  const captureReason = optional(input?.capture_reason);
  if (captureReason) sourceMetadata.capture_reason = captureReason;

  const preview = optional(input?.preview_text);

  return {
    ok: true,
    sourceType: CAPTURE_SOURCE_TYPE_TEAMS,
    externalKey: `teams:${tenantId}:${conversationId}:${messageId}`,
    previewText: preview ? preview.slice(0, PREVIEW_MAX) : null,
    sourceUrl: safeSourceUrl(input?.source_url),
    sourceMetadata,
  };
}

/**
 * Foundry content-type authority — the ONE place that decides what a stored
 * `foundry_events.content_type` means (Slice R4-R2G). Pure: no DB, no I/O.
 *
 * WHY THIS FILE EXISTS.
 *
 * Before R4-R2G the discriminator had two legal values and nine independent places
 * that read it. Six of them were normalizing ternaries of the shape
 *
 *     const contentType = raw === "document" ? "document" : "youtube";
 *
 * and two were if/else pairs whose `else` silently meant "YouTube" — including the
 * learner's own front door (`/f/[token]`), where an unrecognised value would have
 * handed the learner the video room for a training that has no video.
 *
 * That shape is safe only while exactly two values exist. The moment a third is
 * added it becomes a silent downgrade: a written-guidance event read through any of
 * those ternaries reports itself as YouTube, to the Host's history, to My Learning,
 * to the share controls, to the completion review, and to the learner. Nothing
 * throws. Nothing is logged. The type just disappears.
 *
 * So the Founder's ordering for this slice was explicit: eliminate every silent
 * mapping BEFORE the new types can reach production. This module is that
 * elimination. Reading the discriminator now has exactly two outcomes — one of the
 * four known types, or `null` meaning UNKNOWN — and every caller must handle the
 * `null`. There is no third outcome and no default.
 *
 * FAIL CLOSED means: an unknown value is never rendered as some other type, never
 * routed to another type's runtime, and never completed. It surfaces as "this
 * training cannot be opened", which is recoverable, rather than as the wrong
 * training, which is not.
 */

/**
 * The four V1 learning-material delivery types, as stored on `foundry_events.content_type`.
 *
 * `youtube` and `document` are the pre-existing values and their spelling is FROZEN —
 * 46 production rows carry them (19/27 at the time of writing) and nothing here
 * reinterprets a stored row.
 */
export type FoundryContentType = "youtube" | "document" | "written_guidance" | "live_discussion";

export const FOUNDRY_CONTENT_TYPES: readonly FoundryContentType[] = [
  "youtube",
  "document",
  "written_guidance",
  "live_discussion",
];

/** Strict membership test. Nothing else in the codebase should compare against the literals. */
export function isFoundryContentType(raw: unknown): raw is FoundryContentType {
  return typeof raw === "string" && (FOUNDRY_CONTENT_TYPES as readonly string[]).includes(raw);
}

/**
 * Read a `content_type` value as one of the four known types, or `null` for UNKNOWN.
 *
 * ABSENT IS NOT UNKNOWN. The column is `not null default 'youtube'`, so a row cannot
 * hold null — but a SELECT that omits the column yields `undefined` in the row object,
 * and `EventRow.content_type` has been typed optional since the discriminator was added.
 * A missing FIELD is a read-shape artifact and resolves to the column's own default; a
 * present but unrecognised VALUE is data this build does not understand, and fails closed.
 *
 * Those two are deliberately not collapsed. Collapsing them is exactly how the old
 * ternaries turned a future value into YouTube.
 */
export function readContentType(raw: unknown): FoundryContentType | null {
  if (raw === null || raw === undefined || raw === "") return "youtube";
  return isFoundryContentType(raw) ? raw : null;
}

/**
 * The two types whose learner content is the Host's own text, read from the immutable
 * `foundry_event_module.module_snapshot` rather than from a content table (Slice R4-R2G).
 * Neither has — or may acquire — a content table of its own.
 */
export type GuidanceContentType = Extract<FoundryContentType, "written_guidance" | "live_discussion">;

export function isGuidanceContentType(t: FoundryContentType): t is GuidanceContentType {
  return t === "written_guidance" || t === "live_discussion";
}

/**
 * The evidence column that records EXPOSURE for each content type.
 *
 * This is the honest name of each stamp, and the mapping is total so a new type cannot
 * be added without deciding what its evidence is. Read the column names literally:
 *
 * - `video_completed_at`             — the video reached its end.
 * - `document_read_completed_at`     — every page visited AND the minimum reading time met.
 * - `written_guidance_read_at`       — the learner pressed "I've read this guidance" AFTER the
 *                                      guidance was rendered. Exposure/read evidence ONLY; it is
 *                                      not, and must never be described as, understanding.
 * - `discussion_self_reported_at`    — the learner pressed "I participated in this discussion".
 *                                      PARTICIPANT-REPORTED. It is not attendance, not verified,
 *                                      not observed, and no Host action contributes to it. The
 *                                      column is named for what it is so that no later reader can
 *                                      mistake it for a record of the discussion having happened.
 */
export const CONTENT_TYPE_EVIDENCE_COLUMN: Readonly<Record<FoundryContentType, string>> = {
  youtube: "video_completed_at",
  document: "document_read_completed_at",
  written_guidance: "written_guidance_read_at",
  live_discussion: "discussion_self_reported_at",
};

/**
 * Builder material intent → the content type it publishes to. TOTAL by construction:
 * `MaterialIntent` gains a member and this map stops compiling.
 *
 * Kept as an explicit map rather than relying on the two names matching, because
 * `written` and `written_guidance` deliberately do NOT match: the Builder's vocabulary
 * and the durable discriminator are separate namespaces, and a rename in one must not
 * silently re-point the other.
 */
export const MATERIAL_INTENT_CONTENT_TYPE = {
  youtube: "youtube",
  pdf: "document",
  written: "written_guidance",
  live_discussion: "live_discussion",
} as const satisfies Record<"youtube" | "pdf" | "written" | "live_discussion", FoundryContentType>;

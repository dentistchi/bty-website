import type { FoundryContentType } from "@/domain/foundry/events/content-type";

/**
 * The learner/Host-facing NAME of a training's material type (Slice R4-R2G).
 *
 * ONE TABLE, FOUR TYPES, AND AN HONEST UNKNOWN. Before this slice each surface carried its own
 * two-entry ternary — `it.contentType === "document" ? t.document : t.video` — repeated in My
 * Learning, the Center feed, the history archive and the completion review. Every one of them
 * printed "Video" for anything it did not recognise.
 *
 * `null` means the stored discriminator is one this build does not know. It renders as a neutral
 * dash rather than as a guess: an unlabelled row is a small confusion, a row labelled "Video"
 * for a written guidance is a false statement about what the learner did.
 *
 * Deliberately NOT enum names. The Host and the learner see "Written guidance" and "Discussion",
 * never `written_guidance` or `live_discussion`.
 */
const LABEL: Readonly<Record<"en" | "ko", Readonly<Record<FoundryContentType, string>>>> = {
  en: {
    youtube: "Video",
    document: "PDF",
    written_guidance: "Guidance",
    live_discussion: "Discussion",
  },
  ko: {
    youtube: "영상",
    document: "PDF",
    written_guidance: "가이드",
    live_discussion: "논의",
  },
};

/** The neutral stand-in for a type this build cannot name. Never one of the four labels. */
export const UNKNOWN_CONTENT_TYPE_LABEL = "—";

export function contentTypeLabel(contentType: FoundryContentType | null, locale: "en" | "ko"): string {
  if (contentType === null) return UNKNOWN_CONTENT_TYPE_LABEL;
  return (LABEL[locale] ?? LABEL.en)[contentType];
}

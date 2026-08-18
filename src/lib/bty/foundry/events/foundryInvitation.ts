/**
 * Foundry invitation — pure builder for distributing a room.
 *
 * ONE builder produces the human-readable invitation that Copy-invitation writes
 * to the clipboard, plus the concise message + official URL for Share-to-Teams.
 * All three distribution paths (QR, Copy invitation, Share to Teams) encode the
 * SAME canonical participant URL — this module never mints a token or a URL, it
 * only formats a URL it is given.
 *
 * Pure (no I/O, no DOM). Localized copy lives here (mirrors reflectionExpression),
 * so no UI component hardcodes invitation construction. It emits ONLY host-facing/
 * participant-facing content: title, activity instruction, optional host intro,
 * and the join URL — never internal ids, tokens (beyond the join URL), host ids,
 * XP internals, storage/signed URLs, or DB terminology.
 */

import { isFoundryContentType, type FoundryContentType } from "@/domain/foundry/events/content-type";

/**
 * R4-R2G — all four approved V1 material types. This used to be `"youtube" | "document"` and
 * the instruction builder's `else` branch meant "watch the training video", so a written-guidance
 * room would have invited the team to watch a video that does not exist.
 */
export type FoundryInvitationContentType = FoundryContentType;
export type InvitationLocale = "en" | "ko";

export type BuildInvitationInput = {
  locale: InvitationLocale;
  title: string;
  contentType: FoundryInvitationContentType;
  participantUrl: string;
  /** Optional host introduction/description. Omitted from the invitation when blank. */
  intro?: string | null;
  /** Optional ISO end/deadline — included ONLY when honestly present (never invented). */
  deadline?: string | null;
  /** Optional canonical duration in minutes — included ONLY when present (never invented). */
  estimatedMinutes?: number | null;
  /**
   * Omit the "Open the Foundry room: <url>" section. Used for the native share
   * sheet, where the URL is passed as a SEPARATE `url` field so it must not be
   * duplicated in the body text. Copy-invitation keeps the URL (self-contained).
   */
  omitUrl?: boolean;
};

/** Teams share message limit is small; keep the prefilled text well under it. */
export const TEAMS_MESSAGE_MAX = 200;

type Strings = {
  instruction: Readonly<Record<FoundryInvitationContentType, string>>;
  progressSavedLine: string;
  openRoom: string;
  aboutMinutes: (m: number) => string;
  completeBy: (d: string) => string;
  teamsPlease: string;
};

const STR: Record<InvitationLocale, Strings> = {
  en: {
    /*
      A TOTAL MAP, not a ternary (Slice R4-R2G). Every content type states what the learner is
      actually being asked to do, and the live-discussion line says "with your team" without
      claiming BTY will know whether it happened.
    */
    instruction: {
      youtube: "Watch the training video and complete the reflection.",
      document: "Read the document and complete the reflection.",
      written_guidance: "Read the guidance and complete the reflection.",
      live_discussion: "Take part in the team discussion, then complete the reflection.",
    },
    progressSavedLine: "Your reading progress will be saved.",
    openRoom: "Open the Foundry room:",
    aboutMinutes: (m) => `About ${m} minutes`,
    completeBy: (d) => `Please complete by ${d}`,
    teamsPlease: "Please complete this Foundry room.",
  },
  ko: {
    instruction: {
      youtube: "훈련 영상을 보고 성찰을 완료해 주세요.",
      document: "문서를 읽고 성찰을 완료해 주세요.",
      written_guidance: "가이드를 읽고 성찰을 완료해 주세요.",
      live_discussion: "팀 논의에 참여한 뒤 성찰을 완료해 주세요.",
    },
    progressSavedLine: "읽은 위치는 저장됩니다.",
    openRoom: "Foundry 방 열기:",
    aboutMinutes: (m) => `약 ${m}분`,
    completeBy: (d) => `${d}까지 완료해 주세요`,
    teamsPlease: "이 Foundry 방을 완료해 주세요.",
  },
};

/** Collapse internal blank runs; trim; drop control chars except newlines. */
function cleanMultiline(raw: string): string {
  let out = "";
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    const isNewline = code === 0x0a || code === 0x0d;
    if (!isNewline && (code <= 0x1f || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029)) continue;
    out += ch;
  }
  return out.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Build the full human-readable invitation. Sections: title · instruction (+ the
 * progress-saved line for documents) · optional host intro · optional honest
 * time/deadline · open-room label + canonical URL. Never invents a duration or
 * deadline; omits any absent field.
 */
export function buildFoundryInvitation(input: BuildInvitationInput): string {
  const s = STR[input.locale] ?? STR.en;
  const title = cleanMultiline(String(input.title ?? "")).trim();
  const url = String(input.participantUrl ?? "").trim();

  /*
    The saved-progress line is TRUE ONLY FOR THE PDF ROOM, which is the one content type that
    stores a reading position. It stays attached to `document` alone rather than to "anything
    you read", so no invitation promises a behaviour its room does not have.
  */
  const contentType: FoundryInvitationContentType = isFoundryContentType(input.contentType)
    ? input.contentType
    : "youtube";
  const instructionBlock =
    contentType === "document"
      ? `${s.instruction.document}\n${s.progressSavedLine}`
      : s.instruction[contentType];

  const intro = input.intro != null ? cleanMultiline(String(input.intro)) : "";

  const meta: string[] = [];
  if (typeof input.estimatedMinutes === "number" && Number.isFinite(input.estimatedMinutes) && input.estimatedMinutes > 0) {
    meta.push(s.aboutMinutes(Math.round(input.estimatedMinutes)));
  }
  if (typeof input.deadline === "string" && input.deadline.trim().length > 0) {
    meta.push(s.completeBy(input.deadline.trim()));
  }

  const sections = [
    title,
    instructionBlock,
    intro,
    meta.join(" · "),
    input.omitUrl ? "" : `${s.openRoom}\n${url}`,
  ].filter((sec) => sec && sec.trim().length > 0);

  return sections.join("\n\n");
}

/** Concise Share-to-Teams prefill message (kept under the platform limit). */
export function buildTeamsMessage(input: { locale: InvitationLocale; title: string }): string {
  const s = STR[input.locale] ?? STR.en;
  const title = cleanMultiline(String(input.title ?? "")).trim();
  const msg = `${title}\n${s.teamsPlease}`;
  return msg.length > TEAMS_MESSAGE_MAX ? msg.slice(0, TEAMS_MESSAGE_MAX - 1).trimEnd() + "…" : msg;
}

/**
 * Official Microsoft "Share to Teams" deep link (URL-based method — no external
 * launcher script, so no CSP change and nothing to inject/clean up). Encodes the
 * SAME canonical participant URL as `href`; the concise message as `msgText`.
 */
export function buildTeamsShareUrl(input: { participantUrl: string; message: string }): string {
  const href = encodeURIComponent(String(input.participantUrl ?? "").trim());
  const msg = encodeURIComponent(String(input.message ?? ""));
  return `https://teams.microsoft.com/share?href=${href}&msgText=${msg}`;
}

// Guest-to-App web invitation — pure domain (BUILD 19C). Frequency rules, funnel event
// types, and copy. No I/O, no DOM. The invitation is a non-blocking contextual card shown at
// most ONCE per guest session per Event after the first successful request; a new Event may
// show it again. Reuses the BUILD 19B handoff (does not redesign tokens/AASA/native routing).

export const GUEST_FUNNEL_EVENTS = [
  'INVITE_ELIGIBLE',
  'INVITE_SHOWN',
  'APP_OPEN_TAPPED',
  'APP_STORE_TAPPED',
  'CONTINUE_WEB',
  // BUILD 19C — the PERSISTENT app-entry CTA (always under the hero), recorded SEPARATELY from the
  // one-time invitation events above so the two funnels never merge.
  'PERSISTENT_APP_CTA_SHOWN',
  'PERSISTENT_APP_CTA_TAPPED',
] as const;
export type GuestFunnelEvent = (typeof GUEST_FUNNEL_EVENTS)[number];

/** Per guest-session, per-Event storage key so the invite shows at most once per Event and a
 *  new Event (different eventId → different key) may show it again. Mirrors myRequestsKey. */
export function inviteShownKey(slug: string, eventId?: string | null): string {
  return `bty:appinvite:${slug}:${eventId ?? ''}`;
}

/**
 * Whether to show the invitation now. Show only when: the request succeeded, this is the first
 * success this session/Event (not already shown), and a Universal Link is available. Idempotent:
 * a replayed success (already shown) never re-shows or double-counts.
 */
export function shouldShowInvite(input: {
  succeeded: boolean;
  alreadyShownThisEvent: boolean;
  hasUniversalLink: boolean;
}): boolean {
  return input.succeeded && !input.alreadyShownThisEvent && input.hasUniversalLink;
}

/**
 * The App Store action for V1. No public product page exists yet (deferred to BUILD 19D), so the
 * public action is HIDDEN — never a dead link. Returns the URL only when genuinely configured.
 */
export function appStoreAction(appStoreUrl: string | null | undefined): { visible: boolean; url: string | null } {
  const url = (appStoreUrl ?? '').trim();
  return url ? { visible: true, url } : { visible: false, url: null };
}

/** The invitation copy (Korean, action-first). Non-blocking; never forces installation. */
export const INVITE_COPY = {
  title: '노래가 신청되었습니다',
  body: 'BTY Norebang 앱에서 이 파티를 계속하고\n다음 파티도 더 편하게 준비해 보세요.',
  openApp: '앱에서 열기',
  getApp: 'App Store에서 받기',
  continueWeb: '웹에서 계속하기',
} as const;

// MARK: - Persistent web-to-app entry (BUILD 19C — always-present CTA)
//
// A PERSISTENT app-entry CTA that lives under the Room hero regardless of the one-time invitation.
// Before the first successful request no BUILD 19B handoff exists (a handoff REQUIRES a
// source_request_id — no fake request is ever created), so the CTA renders INFORMATIONAL. After
// the first success it ACTIVATES with the canonical Universal Link (persisted client-side so it
// survives reloads within the Event, since a handoff replay returns no fresh link). No App Store
// action and never the words 앱 설치하기 / App Store에서 받기 until BUILD 19D provides a real URL.

/** The persistent CTA copy. Verbatim product contract. */
export const PERSISTENT_CTA_COPY = {
  label: '앱에서 보기',
  supporting: '내 노래 순서와 준비 상태를 앱에서 바로 확인하세요',
} as const;

/** Client-side persistence of the minted Universal Link so the persistent CTA stays ACTIVE across
 *  reloads within the same Event (a handoff replay does not re-emit the link). Per room+event. */
export function appUrlKey(slug: string, eventId?: string | null): string {
  return `bty:appurl:${slug}:${eventId ?? ''}`;
}

/** Fires PERSISTENT_APP_CTA_SHOWN at most once per session/Event when the CTA activates. */
export function persistentCtaShownKey(slug: string, eventId?: string | null): string {
  return `bty:appcta:shown:${slug}:${eventId ?? ''}`;
}

/** The persistent CTA is ACTIVE (a real Universal Link to open) only when one exists — otherwise
 *  it renders in the INFORMATIONAL state. Never a dead link, never an App Store link before 19D. */
export function resolvePersistentCta(input: { universalLink: string | null | undefined }): { active: boolean } {
  return { active: (input.universalLink ?? '').trim().length > 0 };
}

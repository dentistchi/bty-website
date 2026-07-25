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

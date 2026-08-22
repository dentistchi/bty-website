// BUILD 26G — the ONE localization source for the QR Browser Guest UI. PURE.
//
// Every shipped Guest string lives here with an `en` and a `ko` value. There is no second
// dictionary anywhere in the app, and no component decides copy by branching on language —
// components call `guestT(locale, key)` and render the result.
//
// Korean values are the SHIPPED strings, preserved verbatim unless noted. English is
// authored for natural product English, not translated word-for-word.
//
// NOT here: server error codes, resolution codes, plan codes, brand/design tokens. Those
// are contract, not copy — only their PRESENTATION is localized.

import { DEFAULT_GUEST_LOCALE, type GuestLocale } from './guest-locale';

/**
 * A count-sensitive message. English needs `one`/`other` or it renders "1 songs"; Korean
 * has no plural agreement, so it declares `other` only — which is correct, not a gap.
 */
export interface PluralMessage {
  readonly one?: string;
  readonly other: string;
}

export type Message = string | PluralMessage;

export interface MessageEntry {
  readonly en: Message;
  readonly ko: Message;
}

/** `{name}`-style placeholders and the `count` that drives plural selection. */
export type MessageParams = Readonly<Record<string, string | number>>;

export const GUEST_MESSAGES = {
  // ─────────────────────────────────────────────────────── Language switcher
  'guest.language.label': { en: 'Language', ko: '언어' },
  'guest.language.a11y': {
    en: 'Choose your language',
    ko: '언어를 선택하세요',
  },

  // ─────────────────────────────────────────────────────── Brand / room header
  'guest.brand.tagline': { en: "Today's songs, sung together", ko: '함께 부르는 오늘의 노래' },
  'guest.room.logo_alt': { en: '{name} logo', ko: '{name} 로고' },
  'guest.room.status.open': { en: 'Open', ko: '열림' },
  'guest.room.status.closed': { en: 'Closed', ko: '닫힘' },
  'guest.room.lead': {
    en: 'Search for a song, request it, and start your own turn when it comes.',
    ko: '노래를 검색해 신청하고, 내 차례가 되면 직접 시작하세요.',
  },
  'guest.room.not_found.title': { en: 'Room not found', ko: '노래방을 찾을 수 없습니다' },
  'guest.room.not_found.body': { en: 'No room exists for “{slug}”.', ko: '“{slug}” 노래방이 없습니다.' },

  // ─────────────────────────────────────────────────────── Event lifecycle
  'guest.event.ended.eyebrow': { en: 'Event ended', ko: '이벤트 종료' },
  'guest.event.ended.title': { en: 'This norebang event has ended', ko: '이 노래방 이벤트는 종료됐어요' },
  'guest.event.ended.lead': {
    en: 'Please ask your host for the new event QR.',
    ko: '새 이벤트 QR을 Host에게 받아 주세요.',
  },
  'guest.event.none.title': { en: 'No norebang is running right now', ko: '지금 진행 중인 노래방이 없습니다' },
  'guest.event.none.body': {
    en: 'Once your host starts a new event, you can request songs with the new QR.',
    ko: '진행자가 새 이벤트를 시작하면 새 QR로 신청할 수 있어요.',
  },
  'guest.event.rotated.body': {
    en: 'This event has ended. Scan the new QR to join the next one.',
    ko: '이 이벤트는 종료되었어요. 새 이벤트에 참여하려면 새 QR을 스캔해 주세요.',
  },
  'guest.event.just_ended.body': {
    en: "This event just ended. Today's record is kept exactly as it is.",
    ko: '이 이벤트가 방금 종료되었어요. 오늘의 기록은 그대로 보존됩니다.',
  },
  'guest.event.ended.retry': {
    en: 'Once your host starts a new event, you can request songs again with the new QR.',
    ko: '진행자가 새 이벤트를 시작하면 새 QR로 다시 신청할 수 있어요.',
  },

  // ─────────────────────────────────────────────────────── Queue board
  'guest.queue.a11y': { en: 'Queue status', ko: '대기 현황' },
  'guest.queue.now_singing': { en: 'Singing now', ko: '지금 부르는 중' },
  'guest.queue.me': { en: 'Me', ko: '나' },
  'guest.queue.up_next': { en: 'Up next', ko: '다음 대기' },
  'guest.queue.count': { en: { one: '{count} song', other: '{count} songs' }, ko: { other: '{count}곡' } },
  'guest.queue.empty': { en: 'No songs are waiting.', ko: '대기 중인 곡이 없어요.' },

  // ─────────────────────────────────────────────────────── Recently sung
  'guest.recently_sung.title': { en: 'Just Sung', ko: '방금 부른 노래' },

  // ─────────────────────────────────────────────────────── Guest identity / name
  'guest.name.requester': { en: 'Requested by', ko: '신청자' },
  'guest.name.change': { en: 'Change', ko: '변경' },
  'guest.name.label': { en: 'Name', ko: '이름' },
  'guest.name.placeholder': { en: 'e.g. Alex', ko: '예: 한빛' },
  'guest.name.done': { en: 'Done', ko: '완료' },
  'guest.name.required': { en: 'Please enter your name first', ko: '먼저 이름을 입력해 주세요' },
  /**
   * How a Guest's own name is addressed. Korean appends the honorific 님; English uses the
   * bare name — an honorific has no English equivalent and inventing one reads as a bug.
   */
  'guest.name.honorific': { en: '{name}', ko: '{name}님' },

  // ─────────────────────────────────────────────────────── Search
  'guest.search.prompt': { en: 'What do you want to sing?', ko: '무슨 노래를 부르고 싶으세요?' },
  'guest.search.placeholder': { en: 'Song title or artist', ko: '노래 제목 또는 가수' },
  'guest.search.action': { en: 'Search', ko: '검색' },
  'guest.search.style_a11y': { en: 'Performance style', ko: '공연 스타일' },
  'guest.search.failed': { en: 'Search failed', ko: '검색에 실패했어요' },
  'guest.search.network_error': { en: 'Network error — please try again', ko: '네트워크 오류 — 다시 시도해 주세요' },
  'guest.search.warming_up': {
    en: 'Search is warming up. Find it on YouTube, or paste a link below.',
    ko: '검색을 준비 중이에요. YouTube에서 찾거나 아래에 링크를 붙여넣어 주세요.',
  },
  'guest.search.quota': {
    en: "Today's YouTube search limit is used up.\nPaste a YouTube link below and you can keep requesting.",
    ko: '오늘 YouTube 검색 한도를 모두 사용했어요.\n아래에 YouTube 링크를 붙여 넣으면 계속 신청할 수 있어요.',
  },
  'guest.search.busy': {
    en: 'Search is busy right now. Open it on YouTube, or paste a link below.',
    ko: '검색이 잠시 붐벼요. YouTube에서 열거나 아래에 링크를 붙여넣어 주세요.',
  },
  'guest.search.no_results': {
    en: 'No results. Try different words, or paste a link below.',
    ko: '결과가 없어요. 다른 단어로 검색하거나 아래에 링크를 붙여넣어 주세요.',
  },
  'guest.search.open_youtube': { en: 'Open on YouTube ↗', ko: 'YouTube에서 열기 ↗' },
  // BUILD 26U-R1 (R1-A) — the per-result free open. Distinct key from the search-level
  // `open_youtube` fallback above because this one is UNCONDITIONAL and per video: it is the
  // free path itself, not a degraded-search consolation. The wording is a plain user action
  // and makes no commercial claim of any kind.
  'guest.result.open_youtube': { en: 'Open on YouTube ↗', ko: 'YouTube에서 열기 ↗' },
  'guest.result.open_youtube.a11y': {
    en: 'Open {title} on YouTube',
    ko: 'YouTube에서 {title} 열기',
  },
  'guest.search.mr_fallback': {
    en: "We couldn't find an exact MR track, so close karaoke and original results are shown too.",
    ko: '정확한 MR 영상을 찾지 못했어요. 가까운 노래방·원곡 결과도 함께 보여드려요.',
  },
  'guest.search.show_more': {
    en: { one: 'Show {count} more result', other: 'Show {count} more results' },
    ko: { other: '결과 더 보기 ({count})' },
  },
  'guest.search.recommendations': { en: 'Goes well with this song', ko: '이 노래와 잘 어울려요' },
  'guest.search.paste_link': { en: 'Paste a YouTube link directly', ko: 'YouTube 링크 직접 붙여넣기' },
  'guest.search.paste_placeholder': {
    en: 'https://youtu.be/… or dQw4w9WgXcQ',
    ko: 'https://youtu.be/… 또는 dQw4w9WgXcQ',
  },
  'guest.search.paste_submit': { en: 'Request this link', ko: '이 링크로 신청' },

  // ─────────────────────────────────────────────────────── Performance style chips
  'guest.style.mr.label': { en: '🎹 MR', ko: '🎹 MR' },
  'guest.style.mr.hint': {
    en: 'Instrumental-first — finds versions with the vocals removed',
    ko: '반주 중심 — 보컬이 빠진 버전을 찾아요',
  },
  'guest.style.karaoke.label': { en: '🎤 Karaoke', ko: '🎤 노래방' },
  'guest.style.karaoke.hint': {
    en: 'Videos most likely to show the words on screen',
    ko: '화면에 가사가 나올 가능성이 높은 영상',
  },
  'guest.style.original.label': { en: '🎵 Original', ko: '🎵 원곡' },
  'guest.style.original.hint': {
    en: 'The official recording or music video',
    ko: '공식 음원 또는 뮤직비디오',
  },

  // ─────────────────────────────────────────────────────── Request CTA / result card
  'guest.request.cta': { en: 'Request →', ko: '신청 →' },
  'guest.request.cta.pending': { en: 'Requesting…', ko: '신청 중…' },
  'guest.request.cta.done': { en: '✓ Requested', ko: '✓ 신청됨' },
  'guest.request.cta.blocked': { en: "Can't request", ko: '신청 불가' },
  'guest.request.swipe_action': { en: 'Request', ko: '신청하기' },
  'guest.request.too_long_note': {
    en: "Over 15 minutes, so it can't be requested · pick a shorter version",
    ko: '15분을 초과해 신청할 수 없어요 · 더 짧은 버전을 선택해 주세요',
  },
  'guest.request.a11y': { en: 'Request {title}', ko: '{title} 신청하기' },
  'guest.request.a11y.blocked': {
    en: '{title} — over 15 minutes, so it cannot be requested',
    ko: '{title} — 15분을 초과해 신청할 수 없습니다',
  },

  // ─────────────────────────────────────────────────────── Submit outcome (server codes → copy)
  'guest.submit.error.offline': {
    en: 'Please check your internet connection and try again.',
    ko: '인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
  },
  'guest.submit.error.timeout': {
    en: "We're confirming your request. Please wait a moment instead of tapping again.",
    ko: '신청 결과를 확인하고 있어요. 다시 누르지 말고 잠시 기다려 주세요.',
  },
  'guest.submit.error.quota': {
    en: 'There are a lot of requests right now. Please try again shortly.',
    ko: '지금은 요청이 많아 잠시 후에 다시 시도해 주세요.',
  },
  'guest.submit.error.server_temporary': {
    en: "We couldn't complete your request. Please try again.",
    ko: '지금은 신청을 완료하지 못했습니다. 다시 시도해 주세요.',
  },
  'guest.submit.error.event_closed': {
    en: 'This norebang event has ended. Please check with your host for a new one.',
    ko: '이 노래방 이벤트가 종료되었습니다. Host에게 새 이벤트를 확인해 주세요.',
  },
  'guest.submit.error.room_unavailable': {
    en: "We can't connect to this norebang. Please check the QR code or invite link again.",
    ko: '이 노래방에 연결할 수 없습니다. QR 코드나 초대 링크를 다시 확인해 주세요.',
  },
  'guest.submit.error.unauthorized': {
    en: 'Your session expired. Please join the norebang again.',
    ko: '세션이 만료되었어요. 노래방에 다시 입장해 주세요.',
  },
  'guest.submit.error.validation': {
    en: 'Please check the details and choose the song again.',
    ko: '신청 정보를 확인한 뒤 곡을 다시 선택해 주세요.',
  },
  'guest.submit.error.song_too_long': {
    en: "This video is over 15 minutes, so it can't be requested. Please pick a shorter version.",
    ko: '이 영상은 15분을 초과해 신청할 수 없어요. 더 짧은 버전을 선택해 주세요.',
  },
  'guest.submit.error.idempotency_conflict': {
    en: 'Please try your request again.',
    ko: '신청을 다시 시도해 주세요.',
  },
  'guest.submit.submitting': { en: 'Requesting your song…', ko: '노래를 신청하고 있어요…' },
  'guest.submit.succeeded': { en: 'Your song was added to the queue.', ko: '노래가 대기열에 추가되었습니다.' },
  'guest.submit.retry': { en: 'Try again', ko: '다시 시도' },

  // ─────────────────────────────────────────────────────── My requests — status
  'guest.status.checking': { en: 'Checking status…', ko: '상태 확인 중…' },
  'guest.status.now_playing': { en: "It's your turn to sing 🎤", ko: '지금 부를 차례입니다 🎤' },
  'guest.status.up_next': { en: "You're up next", ko: '곧 당신 차례예요' },
  'guest.status.waiting': { en: 'Currently #{position} in line', ko: '현재 대기 순서 #{position}' },
  'guest.status.done': { en: 'This song is finished 🎉', ko: '이 곡이 끝났어요 🎉' },
  'guest.status.cancelled': { en: 'Your request was cancelled', ko: '신청이 취소됐어요' },
  'guest.status.gone': { en: 'Not in the queue', ko: '대기열에 없어요' },

  // ─────────────────────────────────────────────────────── My requests — summary line
  'guest.summary.on_stage': { en: 'On stage', ko: '무대 위' },
  'guest.summary.earliest': { en: 'Earliest at #{position}', ko: '가장 빠른 순번 {position}번' },
  'guest.summary.waiting_at': { en: 'Waiting at #{position}', ko: '지금 대기 {position}번' },
  'guest.subtitle.now_playing': { en: "You're singing now", ko: '지금 부르는 중입니다' },
  'guest.subtitle.done': { en: 'You sang this one', ko: '이 곡을 불렀어요' },
  'guest.subtitle.not_ready': {
    en: "Mark yourself ready and you'll be added to the playing order",
    ko: '준비되면 재생 순서에 반영됩니다',
  },
  'guest.subtitle.ready_ahead': {
    en: { one: '{count} ready song is ahead of you', other: '{count} ready songs are ahead of you' },
    ko: { other: '앞에 준비된 노래 {count}곡이 있어요' },
  },
  'guest.subtitle.first_up': { en: "You're ready to open the stage", ko: '첫 곡으로 시작할 준비가 됐어요' },
  'guest.subtitle.auto_follow': {
    en: 'You follow automatically when the current song finishes',
    ko: '현재 무대가 끝나면 자동으로 이어집니다',
  },

  // ─────────────────────────────────────────────────────── My requests — stage card
  'guest.stage.on_stage_named': { en: '{name} on stage', ko: '{name} 무대 위' },
  'guest.stage.on_stage': { en: 'On stage now', ko: '지금 무대 위' },
  'guest.stage.singing_now': { en: 'Singing now', ko: '지금 노래하는 중' },
  'guest.stage.singing_note': {
    en: "Your song is playing on the TV. When it ends, your host moves on to the next turn.",
    ko: 'TV에서 노래가 재생되고 있어요. 노래가 끝나면 Admin이 다음 차례로 넘깁니다.',
  },
  'guest.stage.next_named': { en: '{name}, you are up next', ko: '{name}, 다음은 당신의 무대예요' },
  'guest.stage.next': { en: 'You are up next', ko: '다음은 당신의 무대예요' },
  'guest.stage.next_note': {
    en: 'Tap when you are ready · you follow as soon as the current song ends.',
    ko: '준비되면 눌러주세요 · 앞의 무대가 끝나면 바로 이어집니다.',
  },
  'guest.stage.ready_action': { en: "I'm ready", ko: '준비됐어요' },
  'guest.stage.readying': { en: 'Getting ready…', ko: '준비하는 중…' },
  'guest.stage.ready_title': { en: 'Ready', ko: '준비 완료' },
  'guest.stage.ready_note': {
    en: 'Your turn has started · your host is opening the song.',
    ko: '무대가 시작되었습니다 · Admin 화면에서 노래를 열고 있어요.',
  },
  'guest.stage.cancel_ready': { en: 'Cancel ready', ko: '준비 취소' },
  'guest.stage.prepare_note': {
    en: 'Get ready now and your turn starts automatically when it comes',
    ko: '미리 준비해두면 차례가 오면 자동으로 시작돼요',
  },
  'guest.stage.working': { en: 'Working…', ko: '처리 중…' },
  'guest.stage.ready_check': { en: '✓ Ready', ko: '✓ 준비 완료' },

  // ─────────────────────────────────────────────────────── My requests — dock
  'guest.dock.open_a11y': {
    en: { one: 'Open my {count} request', other: 'Open my {count} requests' },
    ko: { other: '내 신청곡 {count}곡 열기' },
  },
  'guest.dock.title': { en: 'My Requests {count}', ko: '내 신청곡 {count}' },
  'guest.dock.a11y': { en: 'My requests', ko: '내 신청곡' },
  'guest.dock.subtitle': { en: 'Songs you added to today’s queue', ko: '오늘 대기열에 올린 노래' },
  'guest.dock.close': { en: 'Close', ko: '닫기' },
  'guest.dock.empty': { en: "You haven't requested a song yet.", ko: '현재 신청한 노래가 없어요.' },
  'guest.dock.cancel_request': { en: 'Cancel request', ko: '신청 취소' },
  'guest.dock.cancel_a11y': { en: 'Cancel request for {title}', ko: '{title} 신청 취소' },
  'guest.dock.cancel_confirm': { en: 'Cancel this request?', ko: '이 신청곡을 취소할까요?' },
  'guest.dock.keep_waiting': { en: 'Keep waiting', ko: '계속 대기' },
  'guest.dock.cancel_unavailable': { en: "Can't cancel from this device", ko: '이 기기에서 취소 불가' },
  'guest.dock.history': { en: 'Songs you sang today {count}', ko: '오늘 부른 노래 {count}' },
  'guest.dock.history_status': { en: 'You sang this one', ko: '이 곡을 불렀어요' },
  'guest.dock.already_requested': { en: 'Already requested', ko: '이미 신청됨' },
  'guest.dock.request_again': { en: 'Request again', ko: '다시 신청' },
  'guest.dock.resolved_title': { en: 'Request results', ko: '신청 결과' },
  'guest.dock.requested_song': { en: 'Requested song', ko: '신청곡' },

  // ─────────────────────────────────────────────────────── My requests — action errors
  'guest.cancel.error.not_this_device': {
    en: "This request can't be cancelled from this device.",
    ko: '이 신청은 이 기기에서 취소할 수 없어요.',
  },
  'guest.cancel.error.forbidden': {
    en: "This device can't cancel this request.",
    ko: '이 기기에서는 이 신청을 취소할 수 없어요.',
  },
  'guest.cancel.error.conflict': {
    en: "This song has already started, or can no longer be cancelled.",
    ko: '이미 시작되었거나 취소할 수 없는 곡이에요.',
  },
  'guest.cancel.error.not_found': { en: "We couldn't find that request.", ko: '신청곡을 찾을 수 없어요.' },
  'guest.cancel.error.generic': { en: "You can't cancel it right now.", ko: '지금은 취소할 수 없어요.' },
  'guest.cancel.error.network': {
    en: 'Network error — please try again. Your request is still there.',
    ko: '네트워크 오류 — 다시 시도해 주세요. 신청은 그대로 유지돼요.',
  },
  'guest.ready.error.not_this_device': {
    en: "You can't get ready for this request from this device.",
    ko: '이 신청은 이 기기에서 준비할 수 없어요.',
  },
  'guest.ready.error.forbidden': {
    en: "This device can't mark it ready.",
    ko: '이 기기에서는 준비할 수 없어요.',
  },
  'guest.ready.error.conflict': { en: 'Your turn has already passed.', ko: '이미 차례가 지나갔어요.' },
  'guest.ready.error.not_found': { en: "We couldn't find that request.", ko: '신청곡을 찾을 수 없어요.' },
  'guest.ready.error.generic': { en: "You can't get ready right now.", ko: '지금은 준비할 수 없어요.' },
  'guest.ready.error.network': {
    en: 'Network error — please try again.',
    ko: '네트워크 오류 — 다시 시도해 주세요.',
  },

  // ─────────────────────────────────────────────────────── Request resolution (BUILD 25)
  'guest.resolution.guest_cancelled': { en: 'You cancelled this request.', ko: '신청을 취소했어요.' },
  'guest.resolution.host_removed': {
    en: 'Your host removed this song from the queue.',
    ko: 'Host가 이 곡을 대기열에서 제거했어요.',
  },
  'guest.resolution.host_skipped': {
    en: 'Your host ended playback of this song.',
    ko: 'Host가 이 곡의 재생을 종료했어요.',
  },
  'guest.resolution.event_ended': {
    en: "The norebang ended, so this request didn't go ahead.",
    ko: '노래방이 종료되어 이 신청곡의 진행이 끝났어요.',
  },
  'guest.resolution.unknown': {
    en: 'This song is no longer in the queue.',
    ko: '이 곡은 더 이상 대기열에 없어요.',
  },
  'guest.resolution.a11y': { en: '{title}. {reason}', ko: '{title}. {reason}' },

  // ─────────────────────────────────────────────────────── App invitation
  'guest.app_invite.a11y': { en: 'Continue in the app', ko: '앱에서 계속하기' },
  'guest.app_invite.title': { en: 'Your song is requested', ko: '노래가 신청되었습니다' },
  'guest.app_invite.body': {
    en: 'Keep this party going in the BTY Norebang app,\nand set up your next one more easily.',
    ko: 'BTY Norebang 앱에서 이 파티를 계속하고\n다음 파티도 더 편하게 준비해 보세요.',
  },
  'guest.app_invite.open_app': { en: 'Open in the app', ko: '앱에서 열기' },
  'guest.app_invite.get_app': { en: 'Get it on the App Store', ko: 'App Store에서 받기' },
  'guest.app_invite.continue_web': { en: 'Continue on the web', ko: '웹에서 계속하기' },
  'guest.app_entry.label': { en: 'View in the app', ko: '앱에서 보기' },
  'guest.app_entry.supporting': {
    en: 'Follow your place in line and your ready status right in the app',
    ko: '내 노래 순서와 준비 상태를 앱에서 바로 확인하세요',
  },
  'guest.app_entry.title': {
    en: 'Request your first song and you can pick it up in the app',
    ko: '첫 노래를 신청하면 앱에서 바로 이어볼 수 있어요',
  },

  // ─────────────────────────────────────────────────────── Universal-link fallback
  'guest.join.loading': { en: 'Loading…', ko: '불러오는 중…' },
  'guest.join.ready.title': { en: 'BTY Norebang app link ready', ko: 'BTY Norebang 앱 연결 준비 완료' },
  'guest.join.ready.body': {
    en: 'If the app is installed, tap the link again.\nYou can also go back to the web guest screen.',
    ko: '앱이 설치되어 있다면 링크를 다시 눌러 주세요.\n웹 게스트 화면으로 돌아갈 수 있습니다.',
  },
  'guest.join.ended.title': { en: 'This party has ended', ko: '이 파티는 종료되었습니다' },
  'guest.join.invalid.title': { en: "This app link can't be opened", ko: '이 앱 연결 링크를 열 수 없습니다' },
  'guest.join.invalid.body': {
    en: 'The link has expired or is not valid. Please scan the QR code again.',
    ko: '링크가 만료되었거나 올바르지 않아요. QR 코드를 다시 스캔해 주세요.',
  },

  // ─────────────────────────────────────────────────────── Legal (Guest-visible)
  'guest.legal.a11y': { en: 'Legal', ko: '법적 고지' },
  'guest.legal.privacy': { en: 'Privacy Policy', ko: '개인정보처리방침' },
  'guest.legal.terms': { en: 'Terms of Service', ko: '이용약관' },
  'guest.legal.contact': { en: 'Contact', ko: '문의' },
  'guest.consent.a11y': { en: 'Consent', ko: '이용 동의' },
  'guest.consent.title': { en: 'Before you start', ko: '시작하기 전에' },
  'guest.consent.body.before_privacy': { en: "I've read BTY Norebang's ", ko: 'BTY Norebang의 ' },
  'guest.consent.body.between_links': { en: ' and ', ko: '과 ' },
  'guest.consent.body.before_youtube': {
    en: ', and I agree that the ',
    ko: '을 확인했으며, YouTube 기능 이용 시 ',
  },
  'guest.consent.body.after_youtube': {
    en: ' applies when I use YouTube features.',
    ko: '이 적용되는 것에 동의합니다.',
  },
  'guest.consent.youtube_terms': { en: 'YouTube Terms of Service', ko: 'YouTube 이용약관' },
  'guest.consent.agree': { en: 'Agree & continue', ko: '동의하고 계속' },
} as const satisfies Record<string, MessageEntry>;

export type GuestMessageKey = keyof typeof GUEST_MESSAGES;

export const GUEST_MESSAGE_KEYS = Object.keys(GUEST_MESSAGES) as GuestMessageKey[];

function selectPlural(locale: GuestLocale, message: PluralMessage, count: unknown): string {
  if (typeof count !== 'number' || !Number.isFinite(count)) return message.other;
  // ICU decides the category; nothing here hard-codes "is it 1?". Korean's rules yield
  // `other` for every count, which is why its entries declare only `other`.
  const category = new Intl.PluralRules(locale).select(count);
  if (category === 'one' && message.one) return message.one;
  return message.other;
}

function interpolate(template: string, params: MessageParams | undefined): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

/**
 * The ONE lookup. A missing localization falls back to English — never to Korean — which is
 * the same rule an unsupported browser language follows.
 */
export function guestT(
  locale: GuestLocale,
  key: GuestMessageKey,
  params?: MessageParams,
): string {
  const entry = GUEST_MESSAGES[key] as MessageEntry | undefined;
  if (!entry) return key;
  const message = entry[locale] ?? entry[DEFAULT_GUEST_LOCALE];
  const template = typeof message === 'string' ? message : selectPlural(locale, message, params?.count);
  return interpolate(template, params);
}

/** A bound translator, so components read `t('guest.x')` instead of threading the locale. */
export type GuestTranslator = (key: GuestMessageKey, params?: MessageParams) => string;

export function guestTranslator(locale: GuestLocale): GuestTranslator {
  return (key, params) => guestT(locale, key, params);
}

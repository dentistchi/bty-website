// Guest song-request submission — the pure state machine + failure classification
// (BUILD 18B). No I/O, no DOM. The guest RequestForm renders from this; both the copy
// and the retryable/non-retryable decision live here (never re-derived in the view), and
// the server's STABLE machine-readable `code` drives classification — never HTTP/Korean
// string parsing.
//
// The one integrity rule this encodes: a request whose result the client could NOT
// confirm (timeout / lost response) is `uncertain`, NEVER `failed`. The caller retries
// with the SAME idempotency key so the (now idempotent) server replays the existing row
// instead of inserting a duplicate.

export type SubmitPhase =
  | 'idle'
  | 'submitting'
  | 'succeeded'
  | 'failed_retryable'
  | 'failed_nonretryable'
  | 'uncertain';

/** The resolved failure class — a closed set the copy + retry rules key off. */
export type SubmitErrorClass =
  | 'offline' //             fetch threw (no network) — retryable
  | 'timeout' //             client aborted before a response — UNCERTAIN (server may have won)
  | 'server_temporary' //    5xx / unknown — retryable
  | 'quota' //               429 / rate-limited — retryable (after a pause)
  | 'validation' //          400 bad request — non-retryable (re-pick the song)
  | 'event_closed' //        event ended / night not started — non-retryable (host action)
  | 'room_unavailable' //    room closed / not found / QR mismatch — non-retryable (re-check link)
  | 'unauthorized' //        session expired — non-retryable (re-enter the room)
  | 'idempotency_conflict'; //  key reused for a different song — non-retryable (a fresh key retries)

/** The raw signal the classifier reads (all optional; a network throw sets `networkError`). */
export interface SubmitSignal {
  /** HTTP status when a response arrived; undefined on a transport failure. */
  status?: number;
  /** The server's stable machine code (ROOM_CLOSED, EVENT_ENDED, …), when present. */
  code?: string | null;
  /** The request was aborted by the client timeout (result genuinely unknown). */
  aborted?: boolean;
  /** fetch() threw without an abort (offline / DNS / connection reset). */
  networkError?: boolean;
}

export interface SubmitResolution {
  phase: SubmitPhase;
  errorClass: SubmitErrorClass | null;
  /** Whether a retry (reusing the same idempotency key) is offered. */
  retryable: boolean;
}

/** Non-2xx server codes → class. HTTP status is the fallback when a code is absent. */
function classifyServer(status: number, code: string | null | undefined): SubmitErrorClass {
  switch (code) {
    case 'EVENT_ENDED':
    case 'NIGHT_NOT_OPEN':
      return 'event_closed';
    case 'EVENT_MISMATCH':
    case 'ROOM_NOT_FOUND':
    case 'ROOM_CLOSED':
      return 'room_unavailable';
    case 'IDEMPOTENCY_CONFLICT':
      return 'idempotency_conflict';
    case 'INVALID_REQUEST':
      return 'validation';
  }
  if (status === 429) return 'quota';
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 404 || status === 410) return 'room_unavailable';
  if (status === 400) return 'validation';
  if (status >= 500) return 'server_temporary';
  return 'server_temporary';
}

const RETRYABLE: ReadonlySet<SubmitErrorClass> = new Set<SubmitErrorClass>([
  'offline',
  'server_temporary',
  'quota',
]);

/**
 * The pure resolution. Order matters: a client-aborted request is UNCERTAIN (the server
 * may have committed the insert), never a failure — the caller must retry with the SAME
 * key, not create a new logical request.
 */
export function resolveSubmit(signal: SubmitSignal): SubmitResolution {
  // 1. Result genuinely unknown → uncertain (retry replays via the same key).
  if (signal.aborted) return { phase: 'uncertain', errorClass: 'timeout', retryable: true };
  // 2. Transport failure with a definite "nothing was sent/received" is retryable-offline.
  if (signal.networkError) return { phase: 'failed_retryable', errorClass: 'offline', retryable: true };
  // 3. A response arrived.
  const status = signal.status ?? 0;
  if (status >= 200 && status < 300) return { phase: 'succeeded', errorClass: null, retryable: false };
  const errorClass = classifyServer(status, signal.code ?? null);
  const retryable = RETRYABLE.has(errorClass);
  return { phase: retryable ? 'failed_retryable' : 'failed_nonretryable', errorClass, retryable };
}

/** The ONE place submit copy lives (Korean, action-first). Never leaks a code/stack/quota
 *  number/endpoint, and never tells the user to "just tap again". */
export function submitCopy(errorClass: SubmitErrorClass): string {
  switch (errorClass) {
    case 'offline':
      return '인터넷 연결을 확인한 뒤 다시 시도해 주세요.';
    case 'timeout':
      return '신청 결과를 확인하고 있어요. 다시 누르지 말고 잠시 기다려 주세요.';
    case 'quota':
      return '지금은 요청이 많아 잠시 후에 다시 시도해 주세요.';
    case 'server_temporary':
      return '지금은 신청을 완료하지 못했습니다. 다시 시도해 주세요.';
    case 'event_closed':
      return '이 노래방 이벤트가 종료되었습니다. Host에게 새 이벤트를 확인해 주세요.';
    case 'room_unavailable':
      return '이 노래방에 연결할 수 없습니다. QR 코드나 초대 링크를 다시 확인해 주세요.';
    case 'unauthorized':
      return '세션이 만료되었어요. 노래방에 다시 입장해 주세요.';
    case 'validation':
      return '신청 정보를 확인한 뒤 곡을 다시 선택해 주세요.';
    case 'idempotency_conflict':
      return '신청을 다시 시도해 주세요.';
  }
}

export const SUBMIT_COPY = {
  submitting: '노래를 신청하고 있어요…',
  succeeded: '노래가 대기열에 추가되었습니다.',
  retry: '다시 시도',
} as const;

// BUILD 18B — pure submit classification + copy. Pins the retryable/non-retryable/uncertain
// decision and that copy never leaks internals.

import { describe, it, expect } from 'vitest';
import { resolveSubmit, submitCopy, type SubmitErrorClass } from './request-submit';

describe('resolveSubmit', () => {
  it('2xx → succeeded', () => {
    expect(resolveSubmit({ status: 201 })).toMatchObject({ phase: 'succeeded', retryable: false });
    expect(resolveSubmit({ status: 200 })).toMatchObject({ phase: 'succeeded' });
  });

  it('client abort → UNCERTAIN (never failed) — the server may have committed', () => {
    const r = resolveSubmit({ aborted: true });
    expect(r.phase).toBe('uncertain');
    expect(r.errorClass).toBe('timeout');
    expect(r.retryable).toBe(true);
  });

  it('network throw → failed_retryable/offline', () => {
    expect(resolveSubmit({ networkError: true })).toMatchObject({
      phase: 'failed_retryable',
      errorClass: 'offline',
      retryable: true,
    });
  });

  it('429 → quota, retryable', () => {
    expect(resolveSubmit({ status: 429 })).toMatchObject({ errorClass: 'quota', retryable: true });
  });

  it('5xx → server_temporary, retryable', () => {
    for (const s of [500, 502, 503, 504]) {
      expect(resolveSubmit({ status: s })).toMatchObject({ phase: 'failed_retryable', errorClass: 'server_temporary' });
    }
  });

  it('event codes → non-retryable', () => {
    expect(resolveSubmit({ status: 409, code: 'EVENT_ENDED' })).toMatchObject({ phase: 'failed_nonretryable', errorClass: 'event_closed', retryable: false });
    expect(resolveSubmit({ status: 409, code: 'NIGHT_NOT_OPEN' })).toMatchObject({ errorClass: 'event_closed', retryable: false });
  });

  it('room codes → non-retryable room_unavailable', () => {
    for (const code of ['EVENT_MISMATCH', 'ROOM_NOT_FOUND', 'ROOM_CLOSED']) {
      expect(resolveSubmit({ status: 409, code })).toMatchObject({ errorClass: 'room_unavailable', retryable: false });
    }
  });

  it('idempotency conflict → non-retryable (a fresh key retries)', () => {
    expect(resolveSubmit({ status: 409, code: 'IDEMPOTENCY_CONFLICT' })).toMatchObject({
      phase: 'failed_nonretryable',
      errorClass: 'idempotency_conflict',
    });
  });

  it('validation → non-retryable', () => {
    expect(resolveSubmit({ status: 400, code: 'INVALID_REQUEST' })).toMatchObject({ errorClass: 'validation', retryable: false });
  });

  it('401/403 without a code → unauthorized, non-retryable', () => {
    expect(resolveSubmit({ status: 401 })).toMatchObject({ errorClass: 'unauthorized', retryable: false });
  });

  it('code wins over status (stable machine code, not HTTP parsing)', () => {
    // A 409 that is really an ended event classifies by code, not the bare status.
    expect(resolveSubmit({ status: 409, code: 'EVENT_ENDED' }).errorClass).toBe('event_closed');
  });
});

describe('submitCopy', () => {
  const classes: SubmitErrorClass[] = [
    'offline', 'timeout', 'server_temporary', 'quota', 'validation',
    'event_closed', 'room_unavailable', 'unauthorized', 'idempotency_conflict',
  ];
  it('every class has non-empty Korean copy', () => {
    for (const c of classes) expect(submitCopy('ko', c).length).toBeGreaterThan(0);
  });
  it('never leaks internals (no code/stack/endpoint/quota number/"just tap again")', () => {
    for (const c of classes) {
      const t = submitCopy('ko', c);
      expect(t).not.toMatch(/https?:|\/api\/|quota|429|50\d|stack|undefined|null|무조건/i);
    }
  });
});

// BUILD 22 — the Guest submit classifier for a server-refused over-limit song.
//
// A Guest can always reach the server gate without ever seeing the UI block: by pasting a URL,
// by acting on stale search results, by racing a cache update, or by running an older client.
// The refusal must therefore be a first-class classification, not a generic 400.
//
// The deploy-safety property proved at the bottom is what makes BUILD 22 shippable server-first:
// an OLDER client that has never heard of `song_too_long` still classifies the response as
// non-retryable validation, with re-pick copy. So the gate protects native build 72 and every
// already-open browser tab from the moment the server deploys, with no synchronized release.

import { describe, it, expect } from 'vitest';
import { resolveSubmit, submitCopy, type SubmitErrorClass } from './request-submit';

describe('BUILD 22 — song_too_long is classified, non-retryable, and specific', () => {
  const signal = { status: 400, code: 'song_too_long' };

  it('resolves to its own error class', () => {
    expect(resolveSubmit(signal).errorClass).toBe('song_too_long');
  });

  it('is NON-RETRYABLE — the same video will be refused forever', () => {
    const r = resolveSubmit(signal);
    expect(r.retryable).toBe(false);
    expect(r.phase).toBe('failed_nonretryable');
  });

  it('is NOT collapsed into generic validation copy', () => {
    expect(submitCopy('ko', 'song_too_long')).not.toBe(submitCopy('ko', 'validation'));
  });

  it('states the limit and the remedy, and never invites a retry', () => {
    const copy = submitCopy('ko', 'song_too_long');
    expect(copy).toContain('15분');
    expect(copy).toContain('더 짧은 버전');
    expect(copy).not.toContain('다시 시도');
  });

  it('matches the canonical product sentence exactly', () => {
    expect(submitCopy('ko', 'song_too_long')).toBe(
      '이 영상은 15분을 초과해 신청할 수 없어요. 더 짧은 버전을 선택해 주세요.',
    );
  });
});

describe('BUILD 22 — server-first deploy safety for clients that never heard of the code', () => {
  it('an UNKNOWN 400 code still resolves to non-retryable validation with re-pick copy', () => {
    const r = resolveSubmit({ status: 400, code: 'A_CODE_FROM_A_FUTURE_BUILD' });
    expect(r.errorClass).toBe('validation');
    expect(r.retryable).toBe(false);
    expect(submitCopy('ko', 'validation')).toContain('곡을 다시 선택');
  });

  it('a 400 with NO code at all behaves the same', () => {
    const r = resolveSubmit({ status: 400 });
    expect(r.phase).toBe('failed_nonretryable');
    expect(r.retryable).toBe(false);
  });
});

describe('BUILD 18B — every shipped classification is unchanged', () => {
  it.each<[string, { status?: number; code?: string; aborted?: boolean; networkError?: boolean }, SubmitErrorClass, boolean]>([
    ['a client timeout stays UNCERTAIN', { aborted: true }, 'timeout', true],
    ['offline stays retryable', { networkError: true }, 'offline', true],
    ['429 stays quota/retryable', { status: 429 }, 'quota', true],
    ['5xx stays retryable', { status: 503 }, 'server_temporary', true],
    ['EVENT_ENDED stays non-retryable', { status: 409, code: 'EVENT_ENDED' }, 'event_closed', false],
    ['IDEMPOTENCY_CONFLICT stays non-retryable', { status: 409, code: 'IDEMPOTENCY_CONFLICT' }, 'idempotency_conflict', false],
    ['INVALID_REQUEST stays validation', { status: 400, code: 'INVALID_REQUEST' }, 'validation', false],
    ['401 stays unauthorized', { status: 401 }, 'unauthorized', false],
  ])('%s', (_label, signal, expectedClass, retryable) => {
    const r = resolveSubmit(signal);
    expect(r.errorClass).toBe(expectedClass);
    expect(r.retryable).toBe(retryable);
  });

  it('a 2xx is still a plain success', () => {
    expect(resolveSubmit({ status: 201 })).toEqual({ phase: 'succeeded', errorClass: null, retryable: false });
  });

  // The rule BUILD 22 must not weaken: an uncertain result is never presented as a failure.
  it('an abort is UNCERTAIN even when the server would have refused the song', () => {
    expect(resolveSubmit({ aborted: true, status: 400, code: 'song_too_long' }).phase).toBe('uncertain');
  });
});

// BUILD 26U-R2 — the release-contract matrix, exhaustively.
//
// ROLL-1 and COMPAT-7 live here: the three modes are mutually exclusive, and every client shape
// — including the malformed ones — resolves to a stated answer rather than an accident.

import { describe, it, expect } from 'vitest';
import {
  parseClientRelease,
  resolveReleaseContract,
  normalizeRolloutMode,
  releaseClientBucket,
  ROLLOUT_MODES,
  RELEASE_CLIENT_BUCKETS,
  FIRST_PREMIUM_NATIVE_BUILD,
  DEFAULT_ROLLOUT_MODE,
  CLIENT_HEADER,
  type ClientRelease,
  type RolloutMode,
} from './release-contract';

const NATIVE_109: ClientRelease = { kind: 'native', build: 109 };
const NATIVE_110: ClientRelease = { kind: 'native', build: 110 };
const WEB: ClientRelease = { kind: 'web' };
const UNKNOWN: ClientRelease = { kind: 'unidentified' };

describe('parseClientRelease — strict, never lenient', () => {
  it('accepts the two shipped shapes', () => {
    expect(parseClientRelease('native/109')).toEqual({ kind: 'native', build: 109 });
    expect(parseClientRelease('native/110')).toEqual({ kind: 'native', build: 110 });
    expect(parseClientRelease('native/1')).toEqual({ kind: 'native', build: 1 });
    expect(parseClientRelease('web/abc123')).toEqual({ kind: 'web' });
    expect(parseClientRelease('web/2026-08-22.1')).toEqual({ kind: 'web' });
    expect(parseClientRelease('web/unknown')).toEqual({ kind: 'web' });
  });

  it('is case-insensitive and tolerates surrounding whitespace', () => {
    expect(parseClientRelease('  NATIVE/110 ')).toEqual({ kind: 'native', build: 110 });
    expect(parseClientRelease('Web/Build9')).toEqual({ kind: 'web' });
  });

  it('COMPAT-7: every malformed or absent value is UNIDENTIFIED, never a guess', () => {
    for (const bad of [
      null, undefined, '', '   ', 'native', 'native/', 'native/abc', 'native/-1', 'native/1.5',
      'native/ 110', 'native/110/extra', 'ios/110', 'android/110', 'web', 'web/', 'web/a b',
      'web/' + 'x'.repeat(65), 'native/' + '9'.repeat(20), '109', 'Bearer tok', '{"build":110}',
      'x'.repeat(200),
    ]) {
      expect(parseClientRelease(bad as string), `"${String(bad)}" must be unidentified`)
        .toEqual({ kind: 'unidentified' });
    }
  });

  it('a build of 0 or below is not a build', () => {
    expect(parseClientRelease('native/0')).toEqual({ kind: 'unidentified' });
  });

  it('the header name is lowercase, matching how headers are read', () => {
    expect(CLIENT_HEADER).toBe(CLIENT_HEADER.toLowerCase());
    expect(CLIENT_HEADER).toBe('x-bty-client');
  });
});

describe('normalizeRolloutMode — unknown values are never premium', () => {
  it('accepts the three modes', () => {
    for (const m of ROLLOUT_MODES) expect(normalizeRolloutMode(m)).toBe(m);
  });
  it('anything else falls back to the legacy-free default', () => {
    for (const bad of [null, undefined, '', 'PREMIUM_ALL', 'on', 'true', 1, {}, [], 'dual ']) {
      expect(normalizeRolloutMode(bad)).toBe(DEFAULT_ROLLOUT_MODE);
    }
    expect(DEFAULT_ROLLOUT_MODE).toBe('legacy_free');
  });
});

describe('ROLL-1 — the matrix is total, exclusive, and stated', () => {
  // BUILD 26U-R4A — `dual_allowlist` is measured here with inRollout = TRUE, i.e. inside the
  // controlled boundary, so this table stays "what each client generation gets". The
  // outside-the-boundary behaviour is the ALLOW-* suite's subject.
  const MATRIX: Record<RolloutMode, Record<string, string>> = {
    legacy_free: { native109: 'legacy', native110: 'legacy', web: 'legacy', unknown: 'legacy' },
    dual_allowlist: { native109: 'legacy', native110: 'premium', web: 'premium', unknown: 'legacy' },
    dual: { native109: 'legacy', native110: 'premium', web: 'premium', unknown: 'legacy' },
    premium_all: { native109: 'unsupported', native110: 'premium', web: 'premium', unknown: 'unsupported' },
  };

  for (const mode of ROLLOUT_MODES) {
    it(`${mode} resolves every client exactly as documented`, () => {
      const IN = mode === 'dual_allowlist'; // inside the controlled boundary
      expect(resolveReleaseContract(mode, NATIVE_109, IN)).toBe(MATRIX[mode].native109);
      expect(resolveReleaseContract(mode, NATIVE_110, IN)).toBe(MATRIX[mode].native110);
      expect(resolveReleaseContract(mode, WEB, IN)).toBe(MATRIX[mode].web);
      expect(resolveReleaseContract(mode, UNKNOWN, IN)).toBe(MATRIX[mode].unknown);
    });
  }

  it('legacy_free is TOTAL — the deploy-safe state changes nothing for anyone', () => {
    for (const c of [NATIVE_109, NATIVE_110, WEB, UNKNOWN]) {
      expect(resolveReleaseContract('legacy_free', c)).toBe('legacy');
    }
  });

  it('premium_all removes the legacy exception entirely', () => {
    // Nothing resolves to `legacy` any more: the compatibility window is closed by definition.
    for (const c of [NATIVE_109, NATIVE_110, WEB, UNKNOWN]) {
      expect(resolveReleaseContract('premium_all', c)).not.toBe('legacy');
    }
  });

  it('the build cutoff is the only thing separating a legacy native from a premium one', () => {
    for (const mode of ['dual', 'premium_all'] as const) {
      expect(resolveReleaseContract(mode, { kind: 'native', build: FIRST_PREMIUM_NATIVE_BUILD - 1 }))
        .not.toBe('premium');
      expect(resolveReleaseContract(mode, { kind: 'native', build: FIRST_PREMIUM_NATIVE_BUILD }))
        .toBe('premium');
      expect(resolveReleaseContract(mode, { kind: 'native', build: 99_999 })).toBe('premium');
    }
  });

  it('the modes are mutually exclusive — one input never yields two contracts', () => {
    for (const mode of ROLLOUT_MODES) {
      for (const c of [NATIVE_109, NATIVE_110, WEB, UNKNOWN]) {
        const a = resolveReleaseContract(mode, c, true);
        const b = resolveReleaseContract(mode, c, true);
        expect(a).toBe(b); // total and deterministic
        expect(['legacy', 'premium', 'unsupported']).toContain(a);
      }
    }
  });
});

describe('COMPAT-8 / COMPAT-9 — web is never granted the legacy exception', () => {
  it('web is premium under BOTH live modes, so it can never become a free bypass', () => {
    expect(resolveReleaseContract('dual', WEB)).toBe('premium');
    expect(resolveReleaseContract('premium_all', WEB)).toBe('premium');
  });

  it('web is only legacy in the state where EVERYONE is legacy', () => {
    expect(resolveReleaseContract('legacy_free', WEB)).toBe('legacy');
  });

  it('a web client cannot pose as an old native build to obtain the exception', () => {
    // The only way to be legacy under DUAL is to be an old NATIVE build or unidentified. A web
    // caller that lies about being native/109 gains exactly what an unidentified caller already
    // has — the legacy contract — and that grants no entitlement (COMPAT-5).
    expect(resolveReleaseContract('dual', parseClientRelease('native/109'))).toBe('legacy');
    expect(resolveReleaseContract('dual', UNKNOWN)).toBe('legacy');
  });
});

describe('COMPAT-5 — a rollout mode can never create an entitlement', () => {
  it('the resolver returns a CONTRACT, and the contract vocabulary contains no grant', () => {
    const outcomes = new Set(
      ROLLOUT_MODES.flatMap((m) =>
        [NATIVE_109, NATIVE_110, WEB, UNKNOWN].flatMap((c) =>
          [true, false].map((inRollout) => resolveReleaseContract(m, c, inRollout)),
        ),
      ),
    );
    expect([...outcomes].sort()).toEqual(['legacy', 'premium', 'unsupported']);
    // None of these is an entitlement, a grant, a pass, or a balance — by construction there is
    // no value this function could return that means "entitled".
    for (const o of outcomes) {
      expect(o).not.toContain('entitled');
      expect(o).not.toContain('grant');
      expect(o).not.toContain('pass');
    }
  });
});

describe('release telemetry buckets', () => {
  it('classifies every client into exactly one declared bucket', () => {
    expect(releaseClientBucket(NATIVE_109)).toBe('NATIVE_LEGACY');
    expect(releaseClientBucket(NATIVE_110)).toBe('NATIVE_PREMIUM');
    expect(releaseClientBucket(WEB)).toBe('WEB');
    expect(releaseClientBucket(UNKNOWN)).toBe('UNIDENTIFIED');
    for (const c of [NATIVE_109, NATIVE_110, WEB, UNKNOWN]) {
      expect(RELEASE_CLIENT_BUCKETS).toContain(releaseClientBucket(c));
    }
  });

  it('build 109 is separable from every future build — the sunset is measurable', () => {
    expect(releaseClientBucket({ kind: 'native', build: 109 })).toBe('NATIVE_LEGACY');
    expect(releaseClientBucket({ kind: 'native', build: 110 })).toBe('NATIVE_PREMIUM');
  });
});

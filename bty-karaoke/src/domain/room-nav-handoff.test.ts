// BUILD 26H — the room-only navigation identifier: provably disjoint from the request-backed
// handoff token, and provably free of any name/song/request prerequisite.
//
// These are the PURE half of the contract. The resolver/route/CTA halves live in
// `src/lib/room-nav-handoff.server.test.ts` and `src/app/r/[slug]/RequestForm.app-cta.test.tsx`.

import { describe, it, expect } from 'vitest';
import {
  LEGACY_HANDOFF_TOKEN_LENGTH,
  ROOM_NAV_PREFIX,
  extractHandoffToken,
  isRoomNavIdentifier,
  parseRoomNavIdentifier,
  roomNavHandoffMarker,
  roomNavIdentifier,
  MIN_HANDOFF_IDENTIFIER_LENGTH,
} from './guest-handoff';
import { canonicalUniversalLink, CANONICAL_APP_LINK_ORIGIN } from './app-link';

/** The REAL generator, reproduced exactly (lib/dj-auth.server randomToken). */
function randomToken(bytes = 24): string {
  const buf = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buf);
  let bin = '';
  for (const b of buf) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('H24 — the two identifier forms cannot be confused', () => {
  it('the legacy token length is a genuine INVARIANT, not an assumption', () => {
    // 24 bytes is divisible by 3 → base64 never pads → always exactly 32 chars.
    const lengths = new Set<number>();
    const alphabet = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const t = randomToken(24);
      lengths.add(t.length);
      for (const c of t) alphabet.add(c);
    }
    expect([...lengths]).toEqual([LEGACY_HANDOFF_TOKEN_LENGTH]);
    // The token alphabet is the FULL base64url set — the same charset the native parser
    // accepts. That is WHY disjointness cannot be character-based and must be length-based.
    expect(alphabet.size).toBe(64);
    expect([...alphabet].every((c) => /[A-Za-z0-9_-]/.test(c))).toBe(true);
  });

  it('a room-nav identifier is NEVER the legacy token length, for ANY slug length', () => {
    for (let n = 1; n <= 120; n++) {
      const slug = 'a'.repeat(n);
      const id = roomNavIdentifier(slug);
      expect(id, `slug length ${n}`).not.toBeNull();
      expect(id!.length, `slug length ${n} collided with the token length`).not.toBe(
        LEGACY_HANDOFF_TOKEN_LENGTH,
      );
    }
  });

  it('…including the exact slug length that would otherwise collide', () => {
    // prefix(6) + slug(26) = 32 — the one case the deterministic pad exists for.
    const collidingSlug = 'a'.repeat(LEGACY_HANDOFF_TOKEN_LENGTH - ROOM_NAV_PREFIX.length);
    expect(ROOM_NAV_PREFIX.length + collidingSlug.length).toBe(LEGACY_HANDOFF_TOKEN_LENGTH);
    const id = roomNavIdentifier(collidingSlug)!;
    expect(id.length).toBe(LEGACY_HANDOFF_TOKEN_LENGTH + 1);
    expect(parseRoomNavIdentifier(id)).toBe(collidingSlug); // the pad is transparent
  });

  it('round-trips every realistic slug shape', () => {
    for (const slug of ['bty-home', 'joy-0jyownt8', 'chi-norebang-xqjbyszq', 'a', 'a1', '0', 'x-1-y-2']) {
      const id = roomNavIdentifier(slug)!;
      expect(parseRoomNavIdentifier(id)).toBe(slug);
      expect(isRoomNavIdentifier(id)).toBe(true);
    }
  });

  it('a REAL token is never parsed as room navigation', () => {
    for (let i = 0; i < 3000; i++) {
      expect(parseRoomNavIdentifier(randomToken(24))).toBeNull();
    }
  });

  it('even a hand-crafted 32-char string in the room-nav namespace is refused', () => {
    // The prefix alone is NOT the proof — the length rule is. This asserts that directly.
    const spoof = (ROOM_NAV_PREFIX + 'a'.repeat(LEGACY_HANDOFF_TOKEN_LENGTH)).slice(0, LEGACY_HANDOFF_TOKEN_LENGTH);
    expect(spoof.length).toBe(LEGACY_HANDOFF_TOKEN_LENGTH);
    expect(spoof.startsWith(ROOM_NAV_PREFIX)).toBe(true);
    expect(parseRoomNavIdentifier(spoof)).toBeNull();
  });
});

describe('H26 — malformed identifiers refuse safely', () => {
  it('rejects anything outside the canonical slug shape', () => {
    for (const bad of [
      '', 'rnav1-', 'rnav1--', 'notrnav-bty-home', 'rnav1-BTY-HOME', 'rnav1-bty_home',
      'rnav1-bty home', 'rnav1--bty--', 'rnav1--', 'rnav1-bty-home/admin', 'rnav1-bty.home',
      'rnav1-한국어', 'rnav2-bty-home',
    ]) {
      expect(parseRoomNavIdentifier(bad), bad).toBeNull();
    }
  });

  it('refuses a slug with a leading or trailing hyphen (never a canonical slug)', () => {
    expect(roomNavIdentifier('-bty-home')).toBeNull();
    expect(roomNavIdentifier('bty-home-')).toBeNull();
    expect(roomNavIdentifier('  ')).toBeNull();
  });

  it('never emits a link for an un-encodable slug', () => {
    expect(roomNavIdentifier('Bty Home')).toBeNull();
    expect(roomNavIdentifier('../admin')).toBeNull();
  });
});

describe('H5 — the identifier carries room identity and nothing else', () => {
  it('contains the slug and NO name / song / request / locale', () => {
    const id = roomNavIdentifier('bty-home')!;
    // The identifier is EXACTLY prefix + slug. There is no field for anything else, so a
    // name, a song, a requestId or a locale cannot be smuggled in even by a careless caller.
    expect(id).toBe(`${ROOM_NAV_PREFIX}bty-home`);
    expect(parseRoomNavIdentifier(id)).toBe('bty-home');
  });

  it('H22/H23 — no locale (Web, Native, or Host) can ride along', () => {
    // Two Guests reading the SAME room in different languages produce the SAME identifier,
    // because language is not an input at all.
    expect(roomNavIdentifier('bty-home')).toBe(roomNavIdentifier('bty-home'));
    expect(roomNavIdentifier.length).toBe(1); // arity: slug only — no locale parameter exists
  });
});

describe('the Universal Link the app will actually receive', () => {
  it('is on the ONE canonical AASA-claimed origin and path', () => {
    const url = canonicalUniversalLink(roomNavIdentifier('bty-home')!)!;
    expect(url).toBe(`${CANONICAL_APP_LINK_ORIGIN}/app/join/rnav1-bty-home`);
  });

  it('survives the native path parser contract (same rule as GuestUniversalLink)', () => {
    const id = roomNavIdentifier('bty-home')!;
    // `extractHandoffToken` mirrors the Swift parser: /app/join/{single URL-safe segment}.
    expect(extractHandoffToken(`/app/join/${id}`)).toBe(id);
    expect(extractHandoffToken(`/app/join/${id}/extra`)).toBeNull();
  });

  it('is long enough to clear the resolver’s minimum-length guard, for ANY slug', () => {
    // The route refuses anything shorter than this before it looks anything up. A 1-char slug
    // would otherwise produce a 7-char identifier and fail for a reason unrelated to the room.
    for (let n = 1; n <= 120; n++) {
      const id = roomNavIdentifier('a'.repeat(n))!;
      expect(id.length, `slug length ${n}`).toBeGreaterThanOrEqual(MIN_HANDOFF_IDENTIFIER_LENGTH);
    }
    for (const slug of ['a', 'ab', 'joy', 'bty-home']) {
      const id = roomNavIdentifier(slug)!;
      expect(id.length).toBeGreaterThanOrEqual(MIN_HANDOFF_IDENTIFIER_LENGTH);
      expect(parseRoomNavIdentifier(id)).toBe(slug); // padding stays transparent
    }
  });
});

describe('H25 — the room-nav handoff marker fabricates no UUID', () => {
  it('is an explicit non-UUID navigation marker', () => {
    const marker = roomNavHandoffMarker('bty-home');
    expect(marker).toBe('room-nav:bty-home');
    expect(marker).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('is self-describing, so no analytics join can mistake it for a real handoff id', () => {
    expect(roomNavHandoffMarker('joy')).toContain('room-nav:');
  });
});

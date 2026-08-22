// BUILD 26U-R1 (R1-I) — THE PERMANENT YOUTUBE BOUNDARY INVARIANTS: YT-1 … YT-5.
//
// These are STATIC SCANS of the served source, in the style of `b2-served-code-scan.smoke.test.ts`.
// A scan is the right instrument here because what has to be guaranteed is an ABSENCE — that no
// paid predicate sits on a YouTube path — and an absence cannot be demonstrated by exercising the
// happy path. A future edit that reintroduces one fails HERE, before it can ship.
//
// Every file is read fail-closed: an unreadable path throws rather than vacuously passing.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

/** Strip line and block comments so prose about a rule can never satisfy a scan for it. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const searchRoute = code(read('../app/api/youtube/search/route.ts'));
const resultCard = code(read('../app/r/[slug]/RequestResultCard.tsx'));
const djAddSheet = code(read('../app/r/[slug]/dj/DjAddSongSheet.tsx'));
const playerClient = code(read('../app/r/[slug]/player/PlayerClient.tsx'));
const premiumRoomRpc = code(read('./premium-room.server.ts'));
const premiumRoomGuard = code(read('./premium-room-guard.server.ts'));
const premiumDomain = code(read('../domain/premium-room.ts'));
const migration = read('../../supabase/migrations/20260822120000_karaoke_premium_room_session_entitlement_v1.sql');
const migrationCode = migration.replace(/^\s*--.*$/gm, '');
const metering = code(read('./metering.server.ts'));
const eventsServer = code(read('./events.server.ts'));
const qrServer = code(read('./qr.server.ts'));
const eventLinks = code(read('./event-links.server.ts'));
const guestQrRoute = code(read('../app/api/rooms/[slug]/guest-qr/route.ts'));
const timedPassServer = code(read('./timed-pass.server.ts'));

/** Every token that names a paid/entitlement decision anywhere in this codebase. */
const PAID_PREDICATES = [
  'premium_room_required',
  'PREMIUM_ROOM_REQUIRED',
  'PREMIUM_ROOM_EXPIRED',
  'assertPremiumRoomSession',
  'readPremiumRoomEntitlement',
  'readRoomPremiumEntitlement',
  'timed_access_pass_grants',
  'readTimedPassState',
  'upgrade_required',
  'pass_insufficient',
  'is_active',
  'karaoke_product_catalog',
  'entitled',
];

describe('YT-1 — free YouTube discovery does not depend on any paid entitlement', () => {
  it('the search route contains no paid predicate at all', () => {
    for (const p of PAID_PREDICATES) {
      expect(searchRoute, `search route must not reference "${p}"`).not.toContain(p);
    }
  });

  it('the search route requires no session, credential, room or event', () => {
    for (const auth of ['authorizeHost', 'authorizeDj', 'authorizeAdmin', 'hostTokenFromRequest',
                        'bearerFromHeader', 'roomCredentialFromRequest', 'getCanonicalEvent',
                        'resolveEventAccess']) {
      expect(searchRoute, `search route must not call ${auth}`).not.toContain(auth);
    }
  });

  it('is still a real, reachable GET (the scan is not passing because the file is empty)', () => {
    expect(searchRoute).toContain('export async function GET');
    expect(searchRoute).toContain('searchYoutube');
  });
});

describe('YT-2 — the open/play-through-YouTube path does not depend on paid entitlement', () => {
  it('the web result card renders an UNCONDITIONAL watch link', () => {
    expect(resultCard).toContain('safeYoutubeWatchUrl(item.videoId)');
    // The link is guarded ONLY by the URL being valid — never by an entitlement value.
    expect(resultCard).toContain('{watchUrl && (');
  });

  it('the result card holds no paid predicate whatsoever', () => {
    for (const p of PAID_PREDICATES) {
      expect(resultCard, `result card must not reference "${p}"`).not.toContain(p);
    }
  });

  it('the open link is not gated on the request-side `blocked` state either', () => {
    // A card the Guest may not REQUEST is still a video they may WATCH. If a future edit ties
    // the two together, this catches it: `watchUrl` must not be derived from `blocked`.
    expect(resultCard).not.toMatch(/watchUrl\s*=\s*[^;]*blocked/);
    expect(resultCard).not.toMatch(/\{\s*!?blocked\s*&&\s*watchUrl/);
    expect(resultCard).not.toMatch(/watchUrl\s*&&\s*!?blocked/);
  });

  it('the Host add-song sheet carries the same unconditional link', () => {
    expect(djAddSheet).toContain('safeYoutubeWatchUrl(item.videoId)');
    expect(djAddSheet).toContain('{watchUrl && (');
  });

  it("the player's unplayable fallback link is still ungated", () => {
    expect(playerClient).toContain('safeYoutubeWatchUrl(unplayable)');
    for (const p of PAID_PREDICATES) {
      expect(playerClient, `player must not reference "${p}"`).not.toContain(p);
    }
  });
});

describe('YT-3 — premium expiration cannot convert a playback action into a purchase gate', () => {
  it('the guard is never reachable from a YouTube-open surface', () => {
    for (const [name, src] of [
      ['result card', resultCard],
      ['dj add sheet', djAddSheet],
      ['player', playerClient],
      ['search route', searchRoute],
    ] as const) {
      expect(src, `${name} must not call the premium guard`).not.toContain('assertPremiumRoomSession');
      expect(src, `${name} must not import the guard module`).not.toContain('premium-room-guard');
    }
  });

  it('the guard ends the SESSION and never touches media', () => {
    expect(premiumRoomGuard).toContain('endEvent(live.id)');
    // It must not stop, skip, complete or open anything on the playback axis.
    for (const f of ['beginSong', 'endSong', 'ensurePlaying', 'safeYoutubeWatchUrl',
                     'youtubeWatchUrl', 'passTurnAndPromote']) {
      expect(premiumRoomGuard, `guard must not call ${f}`).not.toContain(f);
    }
  });

  it('the expiry path routes through the proven end_karaoke_event, not a new one', () => {
    expect(premiumRoomGuard).toContain("from './events.server'");
    expect(migrationCode).not.toContain('karaoke_events set status');
    expect(migrationCode).not.toContain("status = 'ended'");
  });
});

describe('YT-4 — premium time is BTY room-session time and never consumes media duration', () => {
  it('the migration reads no video duration anywhere', () => {
    for (const t of ['karaoke_video_durations', 'duration_seconds is null', 'v_dur',
                     'youtube_video_id', 'karaoke_requests', 'lease_seconds', 'lease_ends_at',
                     'free_limit_seconds', 'charged_window']) {
      expect(migrationCode, `migration must not reference "${t}"`).not.toContain(t);
    }
  });

  it('the migration DOES anchor the clock to the Event, and to nothing else', () => {
    expect(migrationCode).toContain('karaoke_start_premium_room_session');
    expect(migrationCode).toContain('insert into public.karaoke_events');
    // expires_at = now + (duration + carryover). No media term is admissible in that sum.
    expect(migrationCode).toContain('make_interval(secs => v_sel_dur + v_sel_carry)');
  });

  it('the premium service layer reads no duration and imports no duration resolver', () => {
    for (const src of [premiumRoomRpc, premiumRoomGuard, premiumDomain]) {
      expect(src).not.toContain('youtube-duration');
      expect(src).not.toContain('resolveVideoDuration');
      expect(src).not.toContain('durationSeconds');
      expect(src).not.toContain('karaoke_video_durations');
    }
  });

  it('the three retired admission outcomes are never PRODUCED by the served path', () => {
    // They survive in the type union for shipped clients (documented there); what must not
    // exist is any code that returns one.
    expect(metering).not.toMatch(/return\s*\{\s*outcome:\s*'duration_unavailable'/);
    expect(metering).not.toMatch(/return\s*\{\s*outcome:\s*'pass_insufficient'/);
    expect(metering).not.toMatch(/return\s*\{\s*outcome:\s*'upgrade_required'/);
  });

  it('a start no longer refuses on an unresolved or over-length duration', () => {
    // The BUILD 21 fail-closed pre-check is gone; the resolution is best-effort for the clock.
    expect(metering).not.toContain("if (!dur.ok) return");
    expect(metering).toContain('await resolveVideoDuration(videoId)');
  });
});

describe('YT-5 — a QR or room code cannot create an entitlement', () => {
  it('no QR/link/room-code module writes a grant or resolves entitlement', () => {
    for (const [name, src] of [
      ['qr.server', qrServer],
      ['event-links.server', eventLinks],
      ['guest-qr route', guestQrRoute],
    ] as const) {
      for (const p of ['timed_access_pass_grants', 'issue_timed_access_pass', 'fulfil_apple_purchase',
                       'karaoke_premium_room_entitlement_at', 'karaoke_start_premium_room_session',
                       'assertPremiumRoomSession', 'karaoke_product_catalog']) {
        expect(src, `${name} must not reference "${p}"`).not.toContain(p);
      }
    }
  });

  it('a QR encodes only a locator — a slug, and at most an event scope', () => {
    expect(guestQrRoute).toContain('canonicalGuestRoomUrl(slug, event?.id)');
    expect(qrServer).toContain('QRCode.toString');
  });

  it('entitlement is resolved from the ROOM OWNER, never from the presented credential', () => {
    // This is what makes a delegated credential (QR join, DJ pairing) safe: it can act on a
    // room, and the room's entitlement belongs to its owner account.
    expect(migrationCode).toContain('karaoke_room_owner_account(p_room_id)');
    expect(premiumRoomRpc).toContain('karaoke_room_premium_entitlement_at');
  });

  it('only two writers of a pass grant exist, and neither is a code path', () => {
    expect(timedPassServer).toContain('issue_timed_access_pass'); // manager, attributed (26O)
    // The session-start RPC ACTIVATES an existing grant; it never issues one.
    expect(migrationCode).toContain("set status = 'ACTIVE'");
    expect(migrationCode).not.toContain('insert into public.timed_access_pass_grants');
  });
});

describe('the session-start authority is entitlement-gated and has no ungated twin', () => {
  it('events.server exposes the gated start and NOT an unconditional one', () => {
    expect(eventsServer).toContain('export async function startHostedRoomSession');
    expect(eventsServer).not.toContain('export async function startNewEvent');
  });

  it('the gated start refuses before it creates anything', () => {
    // In the RPC the refusal returns BEFORE the INSERT, so a refusal can never leave an Event.
    const refuseAt = migrationCode.indexOf("'premium_room_required'");
    const insertAt = migrationCode.indexOf('insert into public.karaoke_events');
    expect(refuseAt).toBeGreaterThan(-1);
    expect(insertAt).toBeGreaterThan(-1);
    expect(refuseAt).toBeLessThan(insertAt);
  });

  it('activation happens AFTER the Event insert, so a code collision cannot spend a pass', () => {
    const insertAt = migrationCode.indexOf('insert into public.karaoke_events');
    const activateAt = migrationCode.indexOf("set status = 'ACTIVE'");
    expect(activateAt).toBeGreaterThan(insertAt);
  });

  it('a lost activation race RAISES, rolling the Event back with it (fail closed)', () => {
    expect(migrationCode).toContain("raise exception 'premium_room_activation_conflict'");
  });
});

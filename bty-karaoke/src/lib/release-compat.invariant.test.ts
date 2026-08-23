// BUILD 26U-R2 — the remaining COMPAT / ROLL invariants, as permanent scans.
//
// These guard the properties that must hold no matter which rollout mode is in force, and they
// are scans because what has to be guaranteed is an ABSENCE — that the rollout switch cannot
// reach the free YouTube path, that a QR cannot reach entitlement, and that no surface other
// than the single authority decides a contract.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ROLLOUT_MODES,
  resolveReleaseContract,
  parseClientRelease,
} from '@/domain/release-contract';
import { classifyDurationAdmission } from '@/domain/duration-admission';
import { safeYoutubeWatchUrl } from '@/domain/youtube';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function servedFiles(dir = root, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}${e.name}`;
    if (e.isDirectory()) servedFiles(`${p}/`, acc);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|spec)\.(ts|tsx)$/.test(e.name)) acc.push(p);
  }
  return acc;
}
const SOURCES = new Map(servedFiles().map((f) => [f.replace(root, 'src/'), strip(readFileSync(f, 'utf8'))]));

const rolloutSql = read('../../supabase/migrations/20260823120000_karaoke_premium_room_rollout_v1.sql')
  .replace(/^\s*--.*$/gm, '');

/** Every token by which the rollout decision could leak into a file. */
const ROLLOUT_TOKENS = [
  'resolveRelease',
  'readRolloutMode',
  'premium_room_mode',
  'karaoke_premium_room_mode',
  'x-bty-client',
  'parseClientRelease',
  'resolveReleaseContract',
  'RolloutMode',
];

describe('ROLL-1 — the rollout decision is centralized, not scattered', () => {
  it('exactly one served module reads the mode from the database', () => {
    const readers = [...SOURCES]
      .filter(([, src]) => src.includes('karaoke_premium_room_mode'))
      .map(([f]) => f);
    expect(readers).toEqual(['src/lib/release-contract.server.ts']);
  });

  it('the ROOM authority and the CATALOG projection use different scopes, on purpose', () => {
    // BUILD 26U-R4A §6 — enforcement is exact (account, room); visibility is account-level.
    // Conflating them would let allowlisting one room make every room of that account premium.
    const svc = SOURCES.get('src/lib/release-contract.server.ts')!;
    expect(svc).toContain('karaoke_room_in_premium_rollout');
    expect(svc).toContain('karaoke_account_in_premium_rollout');
    for (const f of ['src/app/api/rooms/[slug]/dj/start/route.ts',
                     'src/app/api/rooms/[slug]/dj/start-event/route.ts']) {
      expect(SOURCES.get(f)!, `${f} must use the ROOM scope`).toContain('resolveRoomRelease(req, auth.room.id)');
      expect(SOURCES.get(f)!, `${f} must NOT use the account scope`).not.toContain('resolveAccountRelease');
    }
    const cat = SOURCES.get('src/app/api/host/commerce/catalog/route.ts')!;
    expect(cat).toContain('resolveAccountRelease(req, acct.id)');
    expect(cat).not.toContain('resolveRoomRelease');
  });

  it('the header is DEFINED in one place and READ in one place', () => {
    const holders = [...SOURCES]
      .filter(([, src]) => src.includes('CLIENT_HEADER'))
      .map(([f]) => f)
      .sort();
    // The domain module owns the name; the server module is the only thing that reads it off a
    // request. `admin-auth.ts` WRITES the header on the web client and is deliberately not here
    // — writing a header is not deciding a contract.
    expect(holders).toEqual([
      'src/domain/release-contract.ts',
      'src/lib/release-contract.server.ts',
    ]);
    const readers = [...SOURCES]
      .filter(([, src]) => src.includes('headers.get(CLIENT_HEADER)'))
      .map(([f]) => f);
    expect(readers).toEqual(['src/lib/release-contract.server.ts']);
  });

  it('exactly one served module implements the matrix', () => {
    const deciders = [...SOURCES]
      .filter(([f, src]) => src.includes('function resolveReleaseContract') && f.endsWith('.ts'))
      .map(([f]) => f);
    expect(deciders).toEqual(['src/domain/release-contract.ts']);
  });

  it('only the premium-gated routes and the commerce PROJECTION consume the resolution', () => {
    const consumers = [...SOURCES]
      .filter(([, src]) => /resolve(Room|Account)?Release\(/.test(src))
      .map(([f]) => f)
      .sort();
    expect(consumers).toEqual([
      // BUILD 26U-R4 §0 — the commerce catalog is a READ projection, not an entitlement gate:
      // it decides only what a client is SHOWN. `/verify` and `/fulfil` are deliberately absent
      // from this list, and COMMERCE-COMPAT-4 asserts they stay absent.
      'src/app/api/host/commerce/catalog/route.ts',
      'src/app/api/rooms/[slug]/admin/start-event/route.ts',
      'src/app/api/rooms/[slug]/dj/pass-turn/route.ts',
      'src/app/api/rooms/[slug]/dj/start-event/route.ts',
      'src/app/api/rooms/[slug]/dj/start/route.ts',
      'src/app/api/rooms/[slug]/requests/[id]/route.ts',
      'src/lib/release-contract.server.ts',
    ]);
  });

  it('no client component decides a contract', () => {
    for (const [name, src] of SOURCES) {
      if (!name.endsWith('.tsx')) continue;
      for (const t of ROLLOUT_TOKENS) {
        expect(src, `${name} (a component) must not reference "${t}"`).not.toContain(t);
      }
    }
  });
});

describe('ROLL-2 / COMPAT-3 / COMPAT-4 — the free YouTube path is invariant across all modes', () => {
  const FREE_PATH = [
    'src/app/api/youtube/search/route.ts',
    'src/app/r/[slug]/RequestResultCard.tsx',
    'src/app/r/[slug]/dj/DjAddSongSheet.tsx',
    'src/app/r/[slug]/player/PlayerClient.tsx',
    'src/domain/youtube.ts',
    'src/domain/youtube-search.ts',
  ];

  it('no free-path source can even observe the rollout mode', () => {
    for (const f of FREE_PATH) {
      const src = SOURCES.get(f);
      expect(src, `${f} must be a served source`).toBeDefined();
      for (const t of ROLLOUT_TOKENS) {
        expect(src!, `${f} must not reference "${t}"`).not.toContain(t);
      }
    }
  });

  it('the search route still requires no session, credential, room or event', () => {
    const s = SOURCES.get('src/app/api/youtube/search/route.ts')!;
    for (const auth of ['authorizeHost', 'authorizeDj', 'authorizeAdmin', 'resolveEventAccess',
                        'assertPremiumRoomSession', 'resolveRelease']) {
      expect(s, `search must not call ${auth}`).not.toContain(auth);
    }
    expect(s).toContain('export async function GET');
  });

  it('the per-result watch link is built from the video id alone, in every mode', () => {
    // A pure function of the id cannot vary with a server-side mode: there is no input for it.
    for (const _mode of ROLLOUT_MODES) {
      expect(safeYoutubeWatchUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    }
    expect(safeYoutubeWatchUrl(null)).toBeNull();
  });

  it('the rollout migration itself touches nothing on the YouTube path', () => {
    for (const t of ['karaoke_video_durations', 'youtube', 'karaoke_requests', 'begin_song']) {
      expect(rolloutSql.toLowerCase(), `rollout migration must not touch ${t}`)
        .not.toContain(t.toLowerCase());
    }
  });
});

describe('COMPAT-5 — no rollout mode or client identity can create a paid entitlement', () => {
  it('the legacy branch of the RPC neither reads entitlement nor activates a grant', () => {
    // The entitlement resolution and the activation both sit inside `if not v_legacy` / a flag
    // that only that branch can set. Assert the structure, not the prose.
    const guardAt = rolloutSql.indexOf('if not v_legacy then');
    const legacyAt = rolloutSql.indexOf("v_source := 'LEGACY_FREE';");
    expect(guardAt).toBeGreaterThan(-1);
    expect(legacyAt).toBeGreaterThan(guardAt); // the legacy assignment is the ELSE of that guard

    // The premium-only work sits BETWEEN the guard and the legacy assignment, i.e. inside the
    // `if not v_legacy` arm. Assert each such statement occurs exactly once, and in that window.
    // THE LEGACY ELSE-BLOCK ITSELF is the thing that must be inert. Slicing "everything before
    // the legacy assignment" was not enough: a mutant that inserts `v_activated := true;` on the
    // line ABOVE it still lands inside that window and survives. The block is therefore bounded
    // by the `else` that opens it, so anything added to it is caught.
    const elseAt = rolloutSql.lastIndexOf('else', legacyAt);
    expect(elseAt, 'the legacy branch is the ELSE of the v_legacy guard').toBeGreaterThan(guardAt);
    const legacyBlock = rolloutSql.slice(elseAt, rolloutSql.indexOf('end if;', legacyAt));
    for (const forbidden of ['v_activated', 'karaoke_premium_room_entitlement_at', 'timed_access_pass_grants',
                             'v_entitled', 'v_armable', 'premium_room_required']) {
      expect(legacyBlock, `the legacy branch must not touch "${forbidden}"`).not.toContain(forbidden);
    }
    // The legacy branch does exactly ONE thing.
    expect(legacyBlock.replace(/\s+/g, ' ').trim()).toBe("else v_source := 'LEGACY_FREE';");

    // …and every premium-only statement really is inside the premium arm.
    // (`premium_room_required` legitimately appears twice — the not-entitled refusal and the
    // lost-the-race-for-the-armed-grant refusal — so EVERY occurrence is checked.)
    for (const stmt of ['v_activated := true;', 'karaoke_premium_room_entitlement_at(v_account, v_now)',
                        "'outcome','premium_room_required'"]) {
      const at: number[] = [];
      for (let i = rolloutSql.indexOf(stmt); i !== -1; i = rolloutSql.indexOf(stmt, i + 1)) at.push(i);
      expect(at.length, `${stmt} must exist`).toBeGreaterThan(0);
      for (const i of at) {
        expect(i, `${stmt} must be inside the premium branch`).toBeGreaterThan(guardAt);
        expect(i, `${stmt} must be inside the premium branch`).toBeLessThan(elseAt);
      }
    }
  });

  it('an absent or unrecognised contract can never select the free path', () => {
    // The three-valued-logic hole (`p_contract = 'legacy'` is NULL for a NULL argument) is
    // closed explicitly. A regression here would silently hand out free hosted rooms.
    expect(rolloutSql).toContain("coalesce(p_contract, 'premium') = 'legacy'");
    expect(rolloutSql).not.toMatch(/v_legacy boolean := \(p_contract = 'legacy'\)/);
  });

  it('the rollout migration creates and grants nothing', () => {
    expect(rolloutSql).not.toContain('insert into public.timed_access_pass_grants');
    expect(rolloutSql).not.toContain('fulfil_apple_purchase');
    expect(rolloutSql).not.toContain('issue_timed_access_pass');
    expect(rolloutSql).not.toContain('karaoke_product_catalog');
    expect(rolloutSql).not.toContain('is_active');
  });

  it('the mode read fails to legacy_free, never to a paid state', () => {
    expect(rolloutSql).toContain("'legacy_free')");
    expect(SOURCES.get('src/lib/release-contract.server.ts')!).toContain('return DEFAULT_ROLLOUT_MODE;');
  });
});

describe('COMPAT-6 — QR cannot manufacture entitlement under ANY rollout mode', () => {
  it('no QR/link/room-code module can observe the rollout or reach entitlement', () => {
    for (const f of ['src/lib/qr.server.ts', 'src/lib/event-links.server.ts',
                     'src/app/api/rooms/[slug]/guest-qr/route.ts']) {
      const src = SOURCES.get(f)!;
      for (const t of [...ROLLOUT_TOKENS, 'timed_access_pass_grants', 'issue_timed_access_pass',
                       'assertPremiumRoomSession', 'karaoke_start_premium_room_session']) {
        expect(src, `${f} must not reference "${t}"`).not.toContain(t);
      }
    }
  });

  it('entitlement still resolves from the room OWNER in the rollout RPC', () => {
    expect(rolloutSql).toContain('karaoke_room_owner_account(p_room_id)');
  });
});

describe('COMPAT-8 / COMPAT-9 — web behaviour', () => {
  it('COMPAT-8: the Host web console announces itself, so it cannot inherit the legacy exception', () => {
    const auth = SOURCES.get('src/domain/admin-auth.ts')!;
    expect(auth).toContain("'x-bty-client'");
    expect(auth).toContain('webReleaseClient');
    // Under both live modes, a web caller is held to the same authority as native v1.1.
    expect(resolveReleaseContract('dual', parseClientRelease('web/abc'))).toBe('premium');
    expect(resolveReleaseContract('premium_all', parseClientRelease('web/abc'))).toBe('premium');
  });

  it('COMPAT-9: no guest surface consumes the release resolution or the premium guard', () => {
    const GUEST = [
      'src/app/api/rooms/[slug]/requests/route.ts',        // guest submit
      'src/app/api/rooms/[slug]/requests/[id]/cancel/route.ts',
      'src/app/api/rooms/[slug]/requests/[id]/ready/route.ts',
      'src/app/api/events/[guestSlug]/live/route.ts',
      'src/app/r/[slug]/RequestForm.tsx',
      'src/app/r/[slug]/QueueBoard.tsx',
    ];
    for (const f of GUEST) {
      const src = SOURCES.get(f);
      if (!src) continue; // a route that does not exist cannot be an authority
      expect(src, `${f} must not resolve a release contract`).not.toContain('resolveRelease(');
      expect(src, `${f} must not be an entitlement authority`).not.toContain('assertPremiumRoomSession');
      expect(src, `${f} must not read the rollout mode`).not.toContain('premium_room_mode');
    }
  });

  it('COMPAT-9: a guest can never start or continue a hosted session', () => {
    // Both self-service lifecycle routes are hard-closed at 410 (V6 Single Admin Player).
    for (const f of ['src/app/api/rooms/[slug]/requests/[id]/start/route.ts',
                     'src/app/api/rooms/[slug]/requests/[id]/finish/route.ts']) {
      const src = SOURCES.get(f)!;
      expect(src).toContain('410');
    }
  });
});

describe('COMPAT-10 / 11 / 12 — the 15-minute queue rule is kept, and contained', () => {
  const TOO_LONG_SECONDS = 2400; // 40 minutes

  it('COMPAT-10: a >15-minute result still opens on YouTube in FREE mode', () => {
    // The free open is a pure function of the video id. It has no duration input at all, so a
    // 40-minute video produces exactly the same watch URL as a 3-minute one.
    expect(safeYoutubeWatchUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    const card = SOURCES.get('src/app/r/[slug]/RequestResultCard.tsx')!;
    expect(card).toContain('safeYoutubeWatchUrl(item.videoId)');
    expect(card).not.toMatch(/watchUrl\s*=\s*[^;]*blocked/);
  });

  it('COMPAT-11: the same result IS classified too_long for the shared queue', () => {
    expect(classifyDurationAdmission(TOO_LONG_SECONDS)).toBe('too_long');
    expect(classifyDurationAdmission(200)).not.toBe('too_long');
    const submit = SOURCES.get('src/app/api/rooms/[slug]/requests/route.ts')!;
    expect(submit).toContain("admission === 'too_long'");
    expect(submit).toContain("code: 'song_too_long'");
  });

  it('COMPAT-11: the queue rule is independent of entitlement and of the rollout', () => {
    const submit = SOURCES.get('src/app/api/rooms/[slug]/requests/route.ts')!;
    for (const t of [...ROLLOUT_TOKENS, 'assertPremiumRoomSession', 'readRoomPremiumEntitlement',
                     'timed_access_pass_grants', 'premium_room_required']) {
      expect(submit, `the queue rule must not consult "${t}"`).not.toContain(t);
    }
    // …so it answers identically whether the Host's Room time came from a paid consumable, a
    // manager promotional grant, or nothing at all: it never learns which.
  });

  it('COMPAT-12: the queue refusal carries no payment, pass or playback-time language', () => {
    const submit = SOURCES.get('src/app/api/rooms/[slug]/requests/route.ts')!;
    const line = submit.slice(submit.indexOf("error: '이 영상은 15분"), submit.indexOf("code: 'song_too_long'"));
    for (const b of ['이용권', '구매', '결제', 'PRO', '프리미엄', 'BTY 룸', '재생 시간', '남은 시간']) {
      expect(line, `the queue refusal must not mention "${b}"`).not.toContain(b);
    }
    // It says what it must: the limit, and the remedy.
    expect(line).toContain('15분');
    expect(line).toContain('더 짧은 버전');
  });

  it('COMPAT-12: the Guest-facing card note is equally free of commercial language', () => {
    const msgs = SOURCES.get('src/domain/guest-messages.ts')!;
    const at = msgs.indexOf("'guest.request.too_long_note'");
    const note = msgs.slice(at, at + 400);
    for (const b of ['이용권', '구매', '프리미엄', 'BTY 룸', 'pass', 'Premium']) {
      expect(note, `the too-long note must not mention "${b}"`).not.toContain(b);
    }
  });
});

// BUILD 26U-R4 — ROOM-1 … ROOM-8: the Premium Room timer's lifecycle, pinned.
//
// These are the properties a live Sandbox purchase will demonstrate on a device, asserted here
// so they cannot silently regress between validations. Every one is read from the SQL the
// database actually runs plus the served TypeScript, comment-stripped so prose about a rule can
// never satisfy a scan for it.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MIG = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url));
const sqlOf = (f: string) => readFileSync(`${MIG}${f}`, 'utf8').replace(/^\s*--.*$/gm, '');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (rel: string) => strip(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));

/** The CURRENT session-start authority: the newest migration that defines it. */
const startSql = (() => {
  const owner = readdirSync(MIG)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .reverse()
    .find((f) => sqlOf(f).includes('create or replace function public.karaoke_start_premium_room_session'));
  if (!owner) throw new Error('no migration defines karaoke_start_premium_room_session');
  const s = sqlOf(owner);
  const a = s.indexOf('create or replace function public.karaoke_start_premium_room_session');
  return { file: owner, body: s.slice(a, s.indexOf('$$;', a)) };
})();

/** The CURRENT playback authority — E1's body, which must stay ungated. */
const beginSql = (() => {
  const owner = readdirSync(MIG)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .reverse()
    .find((f) => sqlOf(f).includes('karaoke_begin_song_v2(p_room_id uuid, p_request_id uuid, p_mode text)'));
  const s = sqlOf(owner!);
  const a = s.indexOf('karaoke_begin_song_v2(p_room_id uuid, p_request_id uuid, p_mode text)');
  return { file: owner!, body: s.slice(a, s.indexOf('$function$;', a)) };
})();

const fulfilSql = (() => {
  const f = '20260816120000_karaoke_apple_paid_fulfilment_v1.sql';
  return { file: f, body: sqlOf(f) };
})();

describe('ROOM-1 — purchase fulfilment does not start the timer', () => {
  it('a fulfilled paid grant is created AVAILABLE, with no clock fields', () => {
    // The grant schema's CHECK makes it structural: AVAILABLE requires activated_at IS NULL and
    // expires_at IS NULL, so a fulfilment cannot produce a running clock even by accident.
    const grants = sqlOf('20260728120000_karaoke_timed_access_passes.sql');
    expect(grants).toContain("when 'AVAILABLE' then activated_at is null and expires_at is null");
    expect(fulfilSql.body).toContain("'AVAILABLE'");
  });

  it('the fulfilment RPC never sets activated_at or expires_at', () => {
    expect(fulfilSql.body).not.toMatch(/activated_at\s*=\s*(?!null)/);
    expect(fulfilSql.body).not.toMatch(/expires_at\s*=\s*(?!null)/);
  });
});

describe('ROOM-2 — selection does not start the timer', () => {
  it('SELECTED is structurally clock-free', () => {
    const grants = sqlOf('20260728120000_karaoke_timed_access_passes.sql');
    expect(grants).toContain(
      "when 'SELECTED'  then selected_at is not null and activated_at is null and expires_at is null",
    );
  });

  it('the select RPC sets selected_at only — never an activation', () => {
    const grants = sqlOf('20260728120000_karaoke_timed_access_passes.sql');
    const a = grants.indexOf('function public.select_timed_access_pass');
    const body = grants.slice(a, grants.indexOf('$$;', a));
    expect(body).toContain('selected_at');
    expect(body).not.toContain("status = 'ACTIVE'");
    expect(body).not.toContain("status='ACTIVE'");
  });

  it('the service layer says so too, and routes selection through the RPC', () => {
    const svc = read('./timed-pass.server.ts');
    expect(svc).toContain('select_timed_access_pass');
  });
});

describe('ROOM-3 — the Event becoming active is what starts the timer', () => {
  it('activation lives in the session-start transaction, after the Event INSERT', () => {
    const i = startSql.body.indexOf('insert into public.karaoke_events');
    const a = startSql.body.indexOf("set status = 'ACTIVE'");
    expect(i).toBeGreaterThan(-1);
    expect(a).toBeGreaterThan(i);
  });

  it('it is audited as an Event-anchored activation, not a playback one', () => {
    expect(startSql.body).toContain("'ACTIVATED', 'SELECTED', 'ACTIVE'");
    expect(startSql.body).toContain("'anchor', 'event_active'");
    expect(startSql.body).toContain("'premium_room_session'");
  });

  it('a lost activation race rolls the Event back rather than opening a clockless session', () => {
    expect(startSql.body).toContain("raise exception 'premium_room_activation_conflict'");
  });
});

describe('ROOM-4 — the timer is wall-clock room time', () => {
  it('expires_at = activation instant + (duration + carried residual), and nothing else', () => {
    expect(startSql.body).toContain('v_now + make_interval(secs => v_sel_dur + v_sel_carry)');
  });

  it('the anchor is the server clock taken inside the transaction', () => {
    expect(startSql.body).toContain('v_now := clock_timestamp();');
    expect(startSql.body).toContain('activated_at = v_now');
  });

  it('the schema forbids any other arithmetic', () => {
    const carry = sqlOf('20260813120000_karaoke_timed_pass_carryover_v1.sql');
    expect(carry).toContain(
      'expires_at = activated_at + make_interval(secs => duration_seconds + carryover_seconds)',
    );
  });
});

describe('ROOM-5 — a video duration cannot change the expiry', () => {
  it('the session-start authority reads no media anything', () => {
    for (const t of ['karaoke_video_durations', 'youtube', 'v_dur', 'duration_seconds from',
                     'karaoke_requests', 'lease_seconds']) {
      expect(startSql.body.toLowerCase(), `session start must not read ${t}`)
        .not.toContain(t.toLowerCase());
    }
  });

  it('the playback authority never writes a grant', () => {
    // E1 removed activation from playback entirely; `v_activate` is initialised false and never
    // assigned, so the `if v_activate` block is unreachable. Assert the absence of an assignment.
    expect(beginSql.body).not.toMatch(/v_activate\s*:=\s*true/);
    expect(beginSql.body).not.toContain('v_pass_covered := true');
  });

  it('playback writes an unmetered segment with no pass and no lease', () => {
    expect(beginSql.body).toContain("'metered', false");
  });

  it('the premium service layer imports no duration resolver', () => {
    for (const f of ['./premium-room.server.ts', './premium-room-guard.server.ts']) {
      const src = read(f);
      expect(src).not.toContain('youtube-duration');
      expect(src).not.toContain('resolveVideoDuration');
      expect(src).not.toContain('durationSeconds');
    }
  });
});

describe('ROOM-6 — QR cannot grant entitlement', () => {
  it('no QR module touches a grant, the catalog or the session authority', () => {
    for (const f of ['./qr.server.ts', './event-links.server.ts']) {
      const src = read(f);
      for (const t of ['timed_access_pass_grants', 'issue_timed_access_pass', 'fulfil_apple_purchase',
                       'karaoke_start_premium_room_session', 'karaoke_product_catalog',
                       'assertPremiumRoomSession']) {
        expect(src, `${f} must not reference "${t}"`).not.toContain(t);
      }
    }
  });

  it('entitlement is resolved from the room OWNER, which no credential can influence', () => {
    expect(startSql.body).toContain('karaoke_room_owner_account(p_room_id)');
  });
});

describe('ROOM-7 — expiry does not gate the free YouTube open', () => {
  it('the guard ends the SESSION and touches no playback path', () => {
    const guard = read('./premium-room-guard.server.ts');
    expect(guard).toContain('endEvent(live.id)');
    for (const f of ['beginSong', 'endSong', 'ensurePlaying', 'safeYoutubeWatchUrl', 'passTurnAndPromote']) {
      expect(guard, `guard must not call ${f}`).not.toContain(f);
    }
  });

  it('no free-path surface can reach the guard, the rollout or the catalog', () => {
    for (const f of ['../app/api/youtube/search/route.ts', '../app/r/[slug]/RequestResultCard.tsx']) {
      const src = read(f);
      for (const t of ['assertPremiumRoomSession', 'premium-room-guard', 'resolveRelease',
                       'premium_room_mode', 'readActiveCommerceCatalog']) {
        expect(src, `${f} must not reference "${t}"`).not.toContain(t);
      }
    }
  });

  it('the canonical event close does not stop media — it is the one used on expiry', () => {
    const endSql = sqlOf('20260719120000_karaoke_end_event_rpc.sql');
    // WAITING -> removed, PLAYING -> skipped, event -> ended.
    expect(endSql).toContain("set status = 'ended'");

    // The ONLY youtube-named thing it touches is `youtube_queued_at`, BTY's own bookkeeping for
    // "was this song queued on the TV" — a lifecycle column, not a media command. Asserted
    // precisely rather than as a blanket "no youtube", which was wrong: there is no command to
    // stop playback anywhere in this product, because the server never controls the player.
    const ytRefs = [...endSql.matchAll(/youtube[a-z_]*/gi)].map((m) => m[0].toLowerCase());
    expect([...new Set(ytRefs)]).toEqual(['youtube_queued_at']);

    // And nothing that could command a player exists in it.
    for (const t of ['stop', 'pause', 'player_channel', 'playback_command', 'safeYoutubeWatchUrl']) {
      expect(endSql.toLowerCase(), `end_karaoke_event must not contain "${t}"`).not.toContain(t.toLowerCase());
    }
  });
});

describe('ROOM-8 — a legacy build cannot see active commerce', () => {
  it('the catalog route projects through the release contract before reading the DB', () => {
    const src = read('../app/api/host/commerce/catalog/route.ts');
    const r = src.indexOf('resolveRelease(req)');
    const d = src.indexOf('readActiveCommerceCatalog()');
    expect(r).toBeGreaterThan(-1);
    expect(d).toBeGreaterThan(r); // the DB is not even consulted for a legacy caller
    expect(src).toContain("release.contract !== 'premium'");
  });

  it('the projection is a READ rule only — settlement is untouched', () => {
    for (const f of ['../app/api/host/purchases/apple/verify/route.ts',
                     '../app/api/host/purchases/apple/fulfil/route.ts']) {
      const src = read(f);
      expect(src, `${f} must not consult the release contract`).not.toContain('resolveRelease');
    }
  });
});

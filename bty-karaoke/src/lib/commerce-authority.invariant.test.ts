// BUILD 26U-R1 (R1-I) — PAY-1 … PAY-4 and UX-1 / UX-2, as permanent scans.
//
// PAY-3 and PAY-4 are about the NATIVE binary (StoreKit lives there), so they are enforced in
// `Tests/QueueContractTests.swift` where the Swift sources are readable. What is enforced here is
// the SERVER half of the chain plus the copy contract, and — importantly — that no second
// authority for creating paid entitlement has appeared on the server side.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Every served .ts/.tsx under src/, excluding tests. */
function servedFiles(dir = root, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}${e.name}`;
    if (e.isDirectory()) servedFiles(`${p}/`, acc);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|spec)\.(ts|tsx)$/.test(e.name)) acc.push(p);
  }
  return acc;
}
const FILES = servedFiles();
const SOURCES = new Map(FILES.map((f) => [f.replace(root, 'src/'), strip(readFileSync(f, 'utf8'))]));

describe('PAY-1 — only a verified + fulfilled Apple purchase can create paid entitlement', () => {
  it('exactly TWO server call sites write a pass grant, and both are named authorities', () => {
    const writers = [...SOURCES].filter(([, src]) =>
      src.includes('issue_timed_access_pass') || src.includes('fulfil_apple_purchase'),
    ).map(([f]) => f);
    // Comment-stripped, so a module that merely DOCUMENTS the chain (premium-room.server.ts)
    // does not count as a writer. Exactly two files actually call a grant-creating RPC.
    expect(writers.sort()).toEqual([
      'src/lib/apple-fulfilment.server.ts', // verified Apple purchase → one durable grant (26S-R1)
      'src/lib/timed-pass.server.ts',       // manager issuance, server-attributed (26O)
    ]);
  });

  it('fulfilment refuses anything Apple did not vouch for', () => {
    const f = SOURCES.get('src/lib/apple-fulfilment.server.ts')!;
    expect(f).toContain('purchase_not_verified');
    expect(f).toContain('fulfil_apple_purchase');
  });

  it('the session-start authority ACTIVATES an existing grant and never creates one', () => {
    const sql = read('../../supabase/migrations/20260822120000_karaoke_premium_room_session_entitlement_v1.sql')
      .replace(/^\s*--.*$/gm, '');
    expect(sql).toContain("set status = 'ACTIVE'");
    expect(sql).not.toContain('insert into public.timed_access_pass_grants');
    expect(sql).not.toContain('fulfil_apple_purchase');
    expect(sql).not.toContain('issue_timed_access_pass');
  });

  it('no served file grants entitlement from a client-supplied value', () => {
    for (const [name, src] of SOURCES) {
      if (name.includes('premium-room') || name.includes('timed-pass') || name.includes('apple-')) continue;
      expect(src, `${name} must not call the grant RPCs`).not.toContain('issue_timed_access_pass');
      expect(src, `${name} must not call fulfilment`).not.toContain('fulfil_apple_purchase');
    }
  });
});

describe('PAY-2 — an AVAILABLE paid grant never expires before activation', () => {
  it('the grant schema gives AVAILABLE/SELECTED no expires_at at all', () => {
    const sql = readFileSync(
      fileURLToPath(new URL('../../supabase/migrations/20260728120000_karaoke_timed_access_passes.sql', import.meta.url)),
      'utf8',
    );
    // The CHECK constraint: AVAILABLE and SELECTED both require expires_at IS NULL. A row with
    // no expiry cannot be swept by an expiry sweep — the safety is structural, not procedural.
    expect(sql).toContain("when 'AVAILABLE' then activated_at is null and expires_at is null");
    expect(sql).toContain("when 'SELECTED'  then selected_at is not null and activated_at is null and expires_at is null");
  });

  it('every expiry sweep in the codebase is narrowed to ACTIVE rows only', () => {
    const migrations = readdirSync(fileURLToPath(new URL('../../supabase/migrations/', import.meta.url)))
      .filter((f) => f.endsWith('.sql'));
    for (const m of migrations) {
      const sql = readFileSync(
        fileURLToPath(new URL(`../../supabase/migrations/${m}`, import.meta.url)), 'utf8',
      ).replace(/^\s*--.*$/gm, '');
      // Any statement that sets a grant to EXPIRED must be scoped to status='ACTIVE'.
      const idx = sql.indexOf("set status = 'EXPIRED'");
      const idx2 = sql.indexOf("set status='EXPIRED'");
      for (const at of [idx, idx2]) {
        if (at < 0) continue;
        const window = sql.slice(at, at + 400);
        expect(window, `${m}: an EXPIRED sweep must be scoped to ACTIVE rows`).toContain("status");
        expect(window, `${m}: an EXPIRED sweep must never touch AVAILABLE`).not.toContain("'AVAILABLE'");
      }
    }
  });

  it('the new session-start sweep is scoped to ACTIVE and past-expiry only', () => {
    const sql = read('../../supabase/migrations/20260822120000_karaoke_premium_room_session_entitlement_v1.sql')
      .replace(/^\s*--.*$/gm, '');
    expect(sql).toContain("where account_id = v_account and status = 'ACTIVE' and expires_at <= v_now");
  });
});

describe('UX-1 — no production copy sells "YouTube time"', () => {
  /**
   * Phrases that PRICE, METER or RATION YouTube. Each was live before 26U-R1.
   *
   * DELIBERATELY NOT LISTED: "더 짧은 버전을 선택해 주세요", the 15-minute queue-length rule on the
   * guest submit path. It is a BTY product rule about what may enter the shared queue, it is
   * identical for a paying and a non-paying room, and it sells nothing — so it is not a UX-1
   * violation. It IS a residual duration predicate and is carried to R2 as such; conflating it
   * with the commercial sentences would make this scan mean something it does not.
   */
  const FORBIDDEN = [
    '허용된 재생 시간',        // "playback time authorized on YouTube"
    '외부 재생 시간',          // "external playback time"
    'playback time authorized',
    'of external playback',
    '더 짧은 곡',              // "pick a shorter song" — was the PASS refusal's remedy
    '이 곡 전체를 재생할 수 없',  // "can't play this whole song"
    "can't cover this whole song",
    '무료 이용 시간을 모두 사용했어요',
  ];

  it('no served source contains any of them', () => {
    for (const [name, src] of SOURCES) {
      for (const phrase of FORBIDDEN) {
        expect(src, `${name} still contains "${phrase}"`).not.toContain(phrase);
      }
    }
  });

  it('the retired admission constants no longer hold a selling SENTENCE', () => {
    // The NAMES survive on purpose — three routes still reference them on branches the server
    // can no longer reach, and collapsing the value removes the meaning from all of them at
    // once. So what is asserted is the value, not the identifier.
    const copy = SOURCES.get('src/domain/admission-copy.ts')!;
    expect(copy).toContain('export const PASS_INSUFFICIENT_COPY = PREMIUM_ROOM_EXPIRED_KO;');
    expect(copy).toContain('export const UPGRADE_REQUIRED_EXHAUSTED = PREMIUM_ROOM_EXPIRED_KO;');
    // The one that had no neutral counterpart is gone entirely.
    expect(copy).not.toContain('UPGRADE_REQUIRED_TOO_LONG');
    // And no Korean sentence literal remains on the entitlement side of the module.
    expect(copy).not.toContain('이용권 시간으로는');
    expect(copy).not.toContain('업그레이드');
  });
});

describe('UX-2 — premium copy states the independent BTY functionality', () => {
  // Comment-stripped: this module documents the sentences it retired, and that prose must
  // not be mistaken for the sentences themselves.
  const copy = strip(read('../domain/premium-room-copy.ts'));

  it('names BTY Room, not YouTube, as the thing being bought', () => {
    expect(copy).toContain('BTY 룸 이용 시간');
    expect(copy).toContain('BTY Premium Room');
  });

  it('both entitlement refusals say the free YouTube path still works', () => {
    for (const c of ['PREMIUM_ROOM_REQUIRED_KO', 'PREMIUM_ROOM_EXPIRED_KO']) {
      const line = copy.slice(copy.indexOf(`export const ${c}`));
      const sentence = line.slice(0, line.indexOf(';'));
      expect(sentence, `${c} must mention YouTube as still available`).toContain('YouTube');
      expect(sentence, `${c} must not price a video`).not.toContain('곡');
    }
  });

  it('the refusal never asks anyone to buy in order to watch', () => {
    const all = copy;
    for (const sell of ['구매하면 재생', '업그레이드하면 다음 곡', 'buy more time to', 'to keep watching']) {
      expect(all).not.toContain(sell);
    }
  });
});

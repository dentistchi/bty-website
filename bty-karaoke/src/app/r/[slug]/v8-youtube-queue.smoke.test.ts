// V8 Admin YouTube Queue Assist — wiring + invariant guards. Assert the semi-
// automatic TV-queue flow is wired end to end: an additive queued signal, an
// Admin-only queued route, atomic first-song start, pass-turn auto-promotion, the
// Queue-Prep UI, and the honest "BTY never controls YouTube / never auto-finishes"
// boundaries. Pairs with the pure vectors in src/domain/queue-assist.test.ts.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('../../', import.meta.url)); // src/app/
const libRoot = fileURLToPath(new URL('../../../lib/', import.meta.url));
const domRoot = fileURLToPath(new URL('../../../domain/', import.meta.url));
const migRoot = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url));
const readApp = (p: string) => readFileSync(appRoot + p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const rooms = readFileSync(libRoot + 'rooms.server.ts', 'utf8');
const events = readFileSync(libRoot + 'events.server.ts', 'utf8');
const domain = readFileSync(domRoot + 'queue-assist.ts', 'utf8');
const queuedRoute = readApp('api/rooms/[slug]/dj/requests/[id]/queued/route.ts');
const startRoute = readApp('api/rooms/[slug]/dj/start/route.ts');
const passTurnRoute = readApp('api/rooms/[slug]/dj/pass-turn/route.ts');
const djConsole = readApp('r/[slug]/dj/DjConsole.tsx');
const djBoard = readApp('r/[slug]/dj/DjBoard.tsx');
const dock = readApp('r/[slug]/MyRequestsDock.tsx');

describe('migration — additive youtube_queued_at (distinct from ready_at)', () => {
  it('a migration adds youtube_queued_at to karaoke_requests', () => {
    const file = readdirSync(migRoot).find((f) => f.includes('youtube_queue_assist'));
    expect(file).toBeTruthy();
    const sql = readFileSync(migRoot + file, 'utf8');
    expect(sql).toMatch(/add column if not exists youtube_queued_at timestamptz/i);
  });
});

describe('server — queued signal + pass-turn auto-promotion', () => {
  it('setRequestQueued is status-guarded to waiting (mirrors Ready, never occupies stage)', () => {
    const body = rooms.slice(rooms.indexOf('function setRequestQueued'));
    expect(body.slice(0, 600)).toContain('youtube_queued_at:');
    expect(body.slice(0, 600)).toMatch(/\.eq\('status', 'waiting'\)/);
  });
  it('passTurnAndPromote completes current, then auto-starts next ONLY if Ready+Queued', () => {
    const body = rooms.slice(rooms.indexOf('function passTurnAndPromote'));
    const scoped = body.slice(0, 1400);
    expect(scoped).toContain('finishOwnRequest'); // complete current
    expect(scoped).toContain('isAutoPromotable'); // Ready+Queued gate
    expect(scoped).toContain('startOwnRequest'); // atomic one-playing start
    expect(scoped).toContain('canonicalRank'); // next = canonical FIRST waiting
    expect(scoped).toContain('eventId'); // V7.1 event scope
  });
  it('endEvent clears youtube_queued_at (never carries into the next event)', () => {
    const body = events.slice(events.indexOf('function endEvent'));
    expect(body.slice(0, 1400)).toMatch(/youtube_queued_at: null/);
  });
});

describe('routes — Admin-only, event-gated, no YouTube control', () => {
  it('queued route is DJ/Admin-authed + event-gated + sets the signal only', () => {
    expect(queuedRoute).toContain('authorizeDj');
    expect(queuedRoute).toContain('resolveEventAccess');
    expect(queuedRoute).toContain('setRequestQueued');
    // Pure signal — never starts a song here.
    expect(strip(queuedRoute)).not.toContain('startOwnRequest');
  });
  it('start route uses the atomic RPC start (one-playing invariant)', () => {
    expect(startRoute).toContain('authorizeDj');
    expect(startRoute).toContain('startOwnRequest');
  });
  it('pass-turn route scopes next to the live event and returns the reason', () => {
    expect(passTurnRoute).toContain('authorizeDj');
    expect(passTurnRoute).toContain('passTurnAndPromote');
    expect(passTurnRoute).toContain('getCanonicalEvent');
    expect(passTurnRoute).toMatch(/reason/);
  });
});

describe('Admin UI — Queue Prep + first song + pass-turn + drift', () => {
  it('DjConsole wires setQueued / startFirst / passTurn to their routes', () => {
    expect(djConsole).toContain('/dj/requests/${encodeURIComponent(id)}/queued');
    expect(djConsole).toContain('/dj/start');
    expect(djConsole).toContain('/dj/pass-turn');
    expect(djConsole).toContain('onSetQueued={setQueued}');
    expect(djConsole).toContain('onStartFirst={startFirst}');
    expect(djConsole).toContain('onPassTurn={passTurn}');
  });
  it('YouTube open is a pure open — the Queue-Prep row never mutates state', () => {
    // The prep list uses onReopen (open the video), NOT a play/start mutation.
    const prep = djBoard.slice(djBoard.indexOf('TV QUEUE PREP'), djBoard.indexOf('TV QUEUE PREP') + 3000);
    expect(prep).toContain('onReopen(r.youtube_video_id)');
    expect(prep).toContain('onSetQueued(r.id, true)');
    expect(prep).toContain('대기열에 추가했어요');
  });
  it('the Queue-Prep list is the first few canonical waiting songs with Ready/Queued badges', () => {
    expect(djBoard).toContain('displayQueue.slice(0, 5)');
    expect(djBoard).toContain('queuePrepLabel');
    expect(djBoard).toContain('READY + QUEUED');
  });
  it('the first song is an atomic start (▶ 첫 곡 시작), not a per-song play', () => {
    expect(djBoard).toContain('▶ 첫 곡 시작');
    expect(djBoard).toContain('onStartFirst(playTarget.id');
  });
  it('pass-turn is a 2-step confirm with the TV-queue copy, calling onPassTurn', () => {
    expect(djBoard).toContain('TV에서 다음 곡이 시작됐나요?');
    expect(djBoard).toContain('onPassTurn(current.id)');
    expect(djBoard).toContain('네, 다음 차례로');
  });
  it('a reorder-drift warning appears (never claims the real TV queue changed)', () => {
    expect(djBoard).toContain('preparedOrderDrifted');
    expect(djBoard).toContain('YouTube TV 대기열 순서도 확인해 주세요');
  });
  it('the Admin summary shows event-scoped prepared/ready counts', () => {
    expect(djBoard).toContain('곡 준비됨');
    expect(djBoard).toContain('명 Ready');
  });
});

describe('Guest UI — never sees the TV-queue mechanics', () => {
  it('Ready-confirmed copy says the turn auto-progresses, without queue jargon', () => {
    expect(dock).toContain('TV에 곡이 준비되면 자동으로 차례가 진행됩니다');
    // No YouTube / queue-prep controls leak to the guest.
    expect(strip(dock)).not.toContain('youtube_queued_at');
    expect(strip(dock)).not.toContain('대기열에 추가');
  });
});

describe('invariants — no YouTube control, no auto-finish, guest self-play stays removed', () => {
  it('BTY never programmatically controls the YouTube player (no embed/postMessage API)', () => {
    for (const src of [djBoard, djConsole]) {
      expect(src).not.toContain('postMessage');
      expect(src).not.toContain('pauseVideo');
      expect(src).not.toContain('playVideo');
      expect(src).not.toContain('<iframe');
    }
  });
  it('no automatic finish — completion is only via the explicit pass-turn action', () => {
    // pass-turn completes the CURRENT song on the Admin's explicit confirm; there is
    // no onended / duration / timer auto-finish anywhere in the flow.
    const code = strip(rooms) + strip(djBoard) + strip(djConsole);
    expect(code).not.toContain('onended');
    expect(code).not.toContain('.duration');
  });
  it('the pure auto-promote rule requires BOTH ready and queued', () => {
    expect(domain).toContain('readyAt != null');
    expect(domain).toContain('youtubeQueuedAt != null');
  });
});

// @vitest-environment jsdom
//
// V8.1 GUEST READY CONTROL — REAL render + interaction tests.
//
// The V8 Device Gate failed because the string smoke tests only checked copy and
// never proved a Ready BUTTON actually renders where the guest can reach it. These
// tests mount the real component, drive it with a mocked network, and assert the
// button is present, reachable at queue #2/#3, independent per request, and wired
// to the /ready route — the exact gaps the earlier tests missed.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import type { MyRequest } from '@/domain/guest-requests';
import MyRequestsDock from './MyRequestsDock';

type Status = {
  requestId: string;
  state: 'waiting' | 'up_next' | 'now_playing' | 'done' | 'removed' | 'not_found';
  position: number;
  aheadCount: number;
  isUpNext: boolean;
  isNowPlaying: boolean;
  readyAt: string | null;
};

const mkReq = (id: string, title: string, artist = ''): MyRequest =>
  ({ requestId: id, title, artist, cancelToken: `cap-${id}` }) as MyRequest;

const st = (over: Partial<Status>): Status => ({
  requestId: '',
  state: 'waiting',
  position: 2,
  aheadCount: 1,
  isUpNext: false,
  isNowPlaying: false,
  readyAt: null,
  ...over,
});

// ── mocked network ────────────────────────────────────────────────────────────
let statusById: Record<string, Status>;
let display: { playing: { id: string } | null; next: { id: string } | null };
let readyCalls: Array<{ id: string; ready: boolean }>;
let readyResponder: (id: string, ready: boolean) => Record<string, unknown>;
let hangReady = false;

const jsonRes = (obj: unknown, ok = true, status = 200) => ({
  ok,
  status,
  headers: { get: () => null },
  json: async () => obj,
});

function installFetch() {
  readyCalls = [];
  hangReady = false;
  // Default: persist ready_at like the real server so later polls reflect it.
  readyResponder = (id, ready) => {
    statusById[id] = { ...statusById[id], readyAt: ready ? '2026-01-01T00:00:00Z' : null };
    return { ok: true, ready, autoStarted: false };
  };
  global.fetch = vi.fn(async (url: unknown, opts?: { method?: string; body?: string }) => {
    const u = String(url);
    const rm = u.match(/\/requests\/([^/]+)\/ready$/);
    if (rm && opts?.method === 'POST') {
      const id = decodeURIComponent(rm[1]);
      const body = JSON.parse(opts.body ?? '{}') as { ready?: boolean };
      const ready = body.ready !== false;
      readyCalls.push({ id, ready });
      if (hangReady) return new Promise(() => {}); // never resolves — for dedup test
      return jsonRes(readyResponder(id, ready));
    }
    if (u.endsWith('/display')) return jsonRes(display);
    const gm = u.match(/\/requests\/([^/]+)$/);
    if (gm) {
      const id = decodeURIComponent(gm[1]);
      const s = statusById[id];
      if (!s) return jsonRes({}, false, 404);
      return jsonRes({ status: { ...s, requestId: id } });
    }
    return jsonRes({});
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  statusById = {};
  display = { playing: { id: 'someone-else' }, next: null }; // stage busy by default
  installFetch();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const onRemoved = () => {};

describe('V8.1 — compact dock exposes Ready for the nearest waiting song (even at #2)', () => {
  it('a queue #2 waiting song shows a reachable 준비됐어요 button (the regression)', async () => {
    statusById = { a: st({ state: 'waiting', position: 2, aheadCount: 1 }) };
    render(<MyRequestsDock slug="bty-home" requests={[mkReq('a', 'Song A')]} onRemoved={onRemoved} />);
    const btn = await screen.findByRole('button', { name: '준비됐어요' });
    expect(btn).toBeTruthy();
    expect(screen.getByText('가장 빠른 순번 2번')).toBeTruthy();
  });

  it('a queue #3 waiting song still shows Ready (never gated to first-in-line)', async () => {
    statusById = { a: st({ state: 'waiting', position: 3, aheadCount: 2 }) };
    render(<MyRequestsDock slug="bty-home" requests={[mkReq('a', 'Song A')]} onRemoved={onRemoved} />);
    expect(await screen.findByRole('button', { name: '준비됐어요' })).toBeTruthy();
    expect(screen.getByText('가장 빠른 순번 3번')).toBeTruthy();
  });

  it('tapping dock Ready calls /ready (ready:true) and does NOT open the sheet', async () => {
    statusById = { a: st({ state: 'waiting', position: 2, aheadCount: 1 }) };
    render(<MyRequestsDock slug="bty-home" requests={[mkReq('a', 'Song A')]} onRemoved={onRemoved} />);
    fireEvent.click(await screen.findByRole('button', { name: '준비됐어요' }));
    await waitFor(() => expect(readyCalls).toEqual([{ id: 'a', ready: true }]));
    // The modal (dialog) must not have opened from the Ready tap.
    expect(screen.queryByRole('dialog')).toBeNull();
    // The dock flips to the ready state after the refresh.
    expect(await screen.findByRole('button', { name: '준비 취소' })).toBeTruthy();
  });

  it('a now-playing song shows NO Ready button in the dock', async () => {
    statusById = { a: st({ state: 'now_playing', isNowPlaying: true, position: 0, aheadCount: 0 }) };
    display = { playing: { id: 'a' }, next: null };
    render(<MyRequestsDock slug="bty-home" requests={[mkReq('a', 'Song A')]} onRemoved={onRemoved} />);
    await screen.findByText('지금 노래하는 중');
    expect(screen.queryByRole('button', { name: '준비됐어요' })).toBeNull();
  });
});

describe('V8.1 — first-in-line Ready auto-starts (honest, no TV-autoplay claim)', () => {
  it('autoStarted:true surfaces "무대가 시작되었습니다"', async () => {
    statusById = { a: st({ state: 'up_next', position: 1, aheadCount: 0, isUpNext: true }) };
    display = { playing: null, next: { id: 'a' } }; // stage open, I am next → my_turn
    readyResponder = (id, ready) => {
      statusById[id] = { ...statusById[id], readyAt: '2026-01-01T00:00:00Z' };
      return { ok: true, ready, autoStarted: true, request: { id } };
    };
    render(<MyRequestsDock slug="bty-home" requests={[mkReq('a', 'Song A')]} onRemoved={onRemoved} />);
    fireEvent.click(await screen.findByRole('button', { name: '준비됐어요' }));
    expect(await screen.findByText(/무대가 시작되었습니다/)).toBeTruthy();
  });

  it('autoStarted:false (a later song) shows the plain "준비 완료" continuation copy', async () => {
    statusById = { a: st({ state: 'waiting', position: 2, aheadCount: 1 }) };
    render(<MyRequestsDock slug="bty-home" requests={[mkReq('a', 'Song A')]} onRemoved={onRemoved} />);
    fireEvent.click(await screen.findByRole('button', { name: '준비됐어요' }));
    expect(await screen.findByText(/끝나면 자동으로 이어집니다/)).toBeTruthy();
    expect(screen.queryByText(/무대가 시작되었습니다/)).toBeNull();
  });
});

describe('V8.1 — expanded list offers Ready per song, independently', () => {
  async function openSheet() {
    fireEvent.click(await screen.findByRole('button', { name: /내 신청곡 .*열기/ }));
    return screen.findByRole('dialog');
  }

  it('two own waiting songs each render their own 준비됐어요; readying one leaves the other', async () => {
    statusById = {
      a: st({ state: 'waiting', position: 2, aheadCount: 1 }),
      b: st({ state: 'waiting', position: 3, aheadCount: 2 }),
    };
    render(
      <MyRequestsDock
        slug="bty-home"
        requests={[mkReq('a', 'Song A'), mkReq('b', 'Song B')]}
        onRemoved={onRemoved}
      />,
    );
    const dialog = await openSheet();
    await waitFor(() =>
      expect(within(dialog).getAllByRole('button', { name: '준비됐어요' }).length).toBe(2),
    );
    // Ready ONLY song B (the 2nd row).
    const rows = within(dialog).getAllByRole('button', { name: '준비됐어요' });
    fireEvent.click(rows[1]);
    await waitFor(() => expect(readyCalls).toEqual([{ id: 'b', ready: true }]));
    // Now exactly one row is ready (준비 취소) and one is still 준비됐어요.
    await waitFor(() => {
      expect(within(dialog).getAllByRole('button', { name: '준비 취소' }).length).toBe(1);
      expect(within(dialog).getAllByRole('button', { name: '준비됐어요' }).length).toBe(1);
    });
  });

  it('a now-playing row shows no Ready button (Ready is waiting-only)', async () => {
    statusById = {
      a: st({ state: 'now_playing', isNowPlaying: true, position: 0, aheadCount: 0 }),
    };
    display = { playing: { id: 'a' }, next: null };
    render(<MyRequestsDock slug="bty-home" requests={[mkReq('a', 'Song A')]} onRemoved={onRemoved} />);
    const dialog = await openSheet();
    expect(within(dialog).queryByRole('button', { name: '준비됐어요' })).toBeNull();
  });

  it('a waiting row keeps its 신청 취소 affordance alongside Ready', async () => {
    statusById = { a: st({ state: 'waiting', position: 2, aheadCount: 1 }) };
    render(<MyRequestsDock slug="bty-home" requests={[mkReq('a', 'Song A')]} onRemoved={onRemoved} />);
    const dialog = await openSheet();
    // Both affordances coexist: Ready (primary) and the destructive cancel link.
    expect(await within(dialog).findByRole('button', { name: '준비됐어요' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: /신청 취소/ })).toBeTruthy();
  });
});

describe('V8.1 — resilience: restore, rollback, dedup', () => {
  it('mounting with an already-ready song restores the ready state (refresh persistence)', async () => {
    statusById = { a: st({ state: 'waiting', position: 2, aheadCount: 1, readyAt: '2026-01-01T00:00:00Z' }) };
    render(<MyRequestsDock slug="bty-home" requests={[mkReq('a', 'Song A')]} onRemoved={onRemoved} />);
    expect(await screen.findByRole('button', { name: '준비 취소' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '준비됐어요' })).toBeNull();
  });

  it('a failed Ready rolls back — the button returns to 준비됐어요 (not stuck)', async () => {
    statusById = { a: st({ state: 'waiting', position: 2, aheadCount: 1 }) };
    readyResponder = () => ({}); // ignored — force a non-ok below
    global.fetch = vi.fn(async (url: unknown, opts?: { method?: string; body?: string }) => {
      const u = String(url);
      if (/\/ready$/.test(u) && opts?.method === 'POST') {
        readyCalls.push({ id: 'a', ready: true });
        return jsonRes({ error: 'boom' }, false, 500);
      }
      if (u.endsWith('/display')) return jsonRes(display);
      const gm = u.match(/\/requests\/([^/]+)$/);
      if (gm) return jsonRes({ status: { ...statusById.a, requestId: 'a' } });
      return jsonRes({});
    }) as unknown as typeof fetch;
    readyCalls = [];
    render(<MyRequestsDock slug="bty-home" requests={[mkReq('a', 'Song A')]} onRemoved={onRemoved} />);
    fireEvent.click(await screen.findByRole('button', { name: '준비됐어요' }));
    // After the failure the control recovers to 준비됐어요 (server never persisted ready).
    await waitFor(() => expect(screen.getByRole('button', { name: '준비됐어요' })).toBeTruthy());
    expect(screen.queryByRole('button', { name: '준비 취소' })).toBeNull();
  });

  it('a double-tap while in flight sends only ONE /ready call', async () => {
    statusById = { a: st({ state: 'waiting', position: 2, aheadCount: 1 }) };
    hangReady = true; // the POST never resolves, so the guard must block the 2nd tap
    render(<MyRequestsDock slug="bty-home" requests={[mkReq('a', 'Song A')]} onRemoved={onRemoved} />);
    const btn = await screen.findByRole('button', { name: '준비됐어요' });
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(readyCalls.length).toBeGreaterThan(0));
    expect(readyCalls.length).toBe(1);
  });
});

// ── Queue Truth V1 — active/history separation, honest copy, re-request ─────────
const mkReqV = (id: string, title: string, videoId: string): MyRequest =>
  ({ requestId: id, title, artist: '', cancelToken: `cap-${id}`, videoId }) as MyRequest;

describe('Queue Truth V1 — current requests vs completed history', () => {
  it('completed songs are NOT in the current list; count uses active only', async () => {
    statusById = {
      a: st({ state: 'waiting', position: 1, aheadCount: 0, readyAt: '2026-01-01T00:00:00Z' }),
      c1: st({ state: 'done', position: 0 }),
      c2: st({ state: 'done', position: 0 }),
    };
    render(
      <MyRequestsDock
        slug="bty-home"
        requests={[mkReq('a', 'Active A'), mkReq('c1', 'Done One'), mkReq('c2', 'Done Two')]}
        onRemoved={onRemoved}
      />,
    );
    // Count = active (1), not 3.
    const pill = await screen.findByRole('button', { name: '내 신청곡 1곡 열기' });
    fireEvent.click(pill);
    const dialog = await screen.findByRole('dialog');
    // Current list has the active song; completed titles are NOT in the current list.
    expect(within(dialog).getByText('Active A')).toBeTruthy();
    // History is collapsed by default — completed titles not yet visible.
    expect(within(dialog).queryByText('Done One')).toBeNull();
    // The history disclosure shows the completed count.
    expect(within(dialog).getByText(/오늘 부른 노래 2/)).toBeTruthy();
  });

  it('expanding history reveals completed rows with 다시 신청', async () => {
    statusById = {
      a: st({ state: 'waiting', position: 1, aheadCount: 0 }),
      c1: st({ state: 'done', position: 0 }),
    };
    const onReRequest = vi.fn();
    render(
      <MyRequestsDock
        slug="bty-home"
        requests={[mkReq('a', 'Active A'), mkReqV('c1', 'Done One', 'VIDDONE')]}
        onRemoved={onRemoved}
        onReRequest={onReRequest}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: '내 신청곡 1곡 열기' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByText(/오늘 부른 노래 1/));
    expect(within(dialog).getByText('Done One')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: '다시 신청' }));
    expect(onReRequest).toHaveBeenCalledTimes(1);
    expect(onReRequest.mock.calls[0][0].requestId).toBe('c1');
  });

  it('re-request duplicate: same media already active → 이미 신청됨, no button', async () => {
    statusById = {
      a: st({ state: 'waiting', position: 1, aheadCount: 0 }),
      c1: st({ state: 'done', position: 0 }),
    };
    render(
      <MyRequestsDock
        slug="bty-home"
        requests={[mkReqV('a', 'Same Song', 'DUPVID'), mkReqV('c1', 'Same Song', 'DUPVID')]}
        onRemoved={onRemoved}
        onReRequest={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: '내 신청곡 1곡 열기' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByText(/오늘 부른 노래 1/));
    expect(within(dialog).getByText('이미 신청됨')).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: '다시 신청' })).toBeNull();
  });

  it('idle earliest-Ready copy does NOT claim a previous stage', async () => {
    display = { playing: null, next: { id: 'a' } }; // stage idle
    statusById = { a: st({ state: 'up_next', position: 1, aheadCount: 0, readyAt: '2026-01-01T00:00:00Z' }) };
    render(<MyRequestsDock slug="bty-home" requests={[mkReq('a', 'Song A')]} onRemoved={onRemoved} />);
    expect(await screen.findByText('첫 곡으로 시작할 준비가 됐어요')).toBeTruthy();
    expect(screen.queryByText(/앞의 무대가 끝나면/)).toBeNull();
  });
});

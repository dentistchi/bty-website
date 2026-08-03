// @vitest-environment jsdom
//
// BUILD 25 — Guest Web "신청 결과": the resolved section renders, explains truthfully, carries no
// active controls, and survives polling.
//
// These mount the REAL component against a mocked network, because the defect being fixed was
// never visible in a pure-function test: the domain published a terminal state and the UI threw
// it away. Only a render test can prove the card is actually on screen.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
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

const mkReq = (id: string, title: string, videoId = 'v1'): MyRequest =>
  ({ requestId: id, title, artist: '', videoId, cancelToken: `cap-${id}` }) as MyRequest;

const st = (over: Partial<Status>): Status => ({
  requestId: '', state: 'waiting', position: 1, aheadCount: 0,
  isUpNext: false, isNowPlaying: false, readyAt: null, ...over,
});

const resolvedRow = (requestId: string, code: string, over: Record<string, unknown> = {}) => ({
  requestId, videoId: 'v1', title: '테스트곡', channelTitle: null, thumbnailUrl: null,
  status: 'removed', resolutionCode: code, resolvedAt: '2026-08-08T10:00:00.000Z',
  eventId: 'evt-1', ...over,
});

let statusById: Record<string, Status>;
let resolvedPayload: { resolved: unknown[]; eventId: string | null };
let resolvedCalls: Array<{ items: Array<{ requestId: string; token: string }> }>;

const jsonRes = (obj: unknown, ok = true, status = 200) => ({
  ok, status, headers: { get: () => null }, json: async () => obj,
});

function installFetch() {
  resolvedCalls = [];
  global.fetch = vi.fn(async (url: unknown, opts?: { method?: string; body?: string }) => {
    const u = String(url);
    if (u.endsWith('/requests/resolved') && opts?.method === 'POST') {
      resolvedCalls.push(JSON.parse(opts.body ?? '{}'));
      return jsonRes(resolvedPayload);
    }
    if (u.endsWith('/display')) return jsonRes({ playing: null, next: null, event: null });
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

const mount = (requests: MyRequest[]) =>
  render(
    <MyRequestsDock slug="bty-home" requests={requests} eventId="evt-1" onRemoved={vi.fn()} />,
  );

/** Open the sheet — the resolved section lives inside it. */
async function openSheet() {
  const pill = await screen.findByRole('button', { name: /내 신청|신청/ });
  pill.click();
}

beforeEach(() => {
  statusById = {};
  resolvedPayload = { resolved: [], eventId: 'evt-1' };
  installFetch();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('BUILD 25 — the resolved section renders', () => {
  it('shows 신청 결과 with the truthful reason instead of the song vanishing', async () => {
    statusById.r1 = st({ state: 'removed' });
    resolvedPayload = { resolved: [resolvedRow('r1', 'host_removed')], eventId: 'evt-1' };
    mount([mkReq('r1', '테스트곡')]);
    await openSheet();
    await waitFor(() => expect(screen.getByText('신청 결과')).toBeTruthy());
    expect(screen.getByText('Host가 이 곡을 대기열에서 제거했어요.')).toBeTruthy();
  });

  it.each([
    ['guest_cancelled', '신청을 취소했어요.'],
    ['host_removed', 'Host가 이 곡을 대기열에서 제거했어요.'],
    ['host_skipped', 'Host가 이 곡의 재생을 종료했어요.'],
    ['event_ended', '노래방이 종료되어 이 신청곡의 진행이 끝났어요.'],
    ['unknown_resolution', '이 곡은 더 이상 대기열에 없어요.'],
  ])('maps %s to its approved sentence', async (code, copy) => {
    statusById.r1 = st({ state: 'removed' });
    resolvedPayload = { resolved: [resolvedRow('r1', code)], eventId: 'evt-1' };
    mount([mkReq('r1', '테스트곡')]);
    await openSheet();
    await waitFor(() => expect(screen.getByText(copy)).toBeTruthy());
  });

  it('carries a meaningful VoiceOver label naming the song and the outcome', async () => {
    statusById.r1 = st({ state: 'removed' });
    resolvedPayload = { resolved: [resolvedRow('r1', 'event_ended')], eventId: 'evt-1' };
    mount([mkReq('r1', '테스트곡')]);
    await openSheet();
    await waitFor(() =>
      expect(
        screen.getByLabelText('테스트곡. 노래방이 종료되어 이 신청곡의 진행이 끝났어요.'),
      ).toBeTruthy(),
    );
  });

  it('renders NO active control inside a resolved row', async () => {
    statusById.r1 = st({ state: 'removed' });
    resolvedPayload = { resolved: [resolvedRow('r1', 'host_removed')], eventId: 'evt-1' };
    mount([mkReq('r1', '테스트곡')]);
    await openSheet();
    const list = await screen.findByRole('list', { name: '신청 결과' });
    // No button of any kind: no Cancel, no Ready, no 다시 신청, no Host action.
    expect(within(list).queryAllByRole('button')).toHaveLength(0);
    // And no queue-position copy.
    expect(within(list).queryByText(/대기 순서/)).toBeNull();
  });

  it('sends the owner capability in the BODY, never the URL', async () => {
    statusById.r1 = st({ state: 'removed' });
    resolvedPayload = { resolved: [resolvedRow('r1', 'host_removed')], eventId: 'evt-1' };
    mount([mkReq('r1', '테스트곡')]);
    await waitFor(() => expect(resolvedCalls.length).toBeGreaterThan(0));
    expect(resolvedCalls[0].items[0]).toEqual({ requestId: 'r1', token: 'cap-r1' });
    const urls = vi.mocked(global.fetch).mock.calls.map((c) => String(c[0]));
    expect(urls.every((u) => !u.includes('cap-r1'))).toBe(true);
  });
});

describe('BUILD 25 — exclusivity and stability', () => {
  it('a resolved request does NOT also appear as active (stale poll cannot resurrect it)', async () => {
    // The status poll still calls r1 waiting — the resolution must win.
    statusById.r1 = st({ state: 'waiting', position: 1 });
    resolvedPayload = { resolved: [resolvedRow('r1', 'host_removed')], eventId: 'evt-1' };
    mount([mkReq('r1', '테스트곡')]);
    await openSheet();
    await waitFor(() => expect(screen.getByText('신청 결과')).toBeTruthy());
    // The active-row status line must not be present for this request.
    expect(screen.queryByText('현재 대기 순서 #1')).toBeNull();
  });

  it('survives repeated polls without duplicating the card', async () => {
    statusById.r1 = st({ state: 'removed' });
    resolvedPayload = { resolved: [resolvedRow('r1', 'host_removed')], eventId: 'evt-1' };
    mount([mkReq('r1', '테스트곡')]);
    await openSheet();
    await waitFor(() => expect(screen.getByText('신청 결과')).toBeTruthy());
    await waitFor(() => expect(resolvedCalls.length).toBeGreaterThan(0));
    const list = await screen.findByRole('list', { name: '신청 결과' });
    expect(within(list).queryAllByRole('listitem')).toHaveLength(1);
  });

  it('keeps the explanation when a later poll returns nothing (expired capability)', async () => {
    statusById.r1 = st({ state: 'removed' });
    resolvedPayload = { resolved: [resolvedRow('r1', 'host_removed')], eventId: 'evt-1' };
    mount([mkReq('r1', '테스트곡')]);
    await openSheet();
    await waitFor(() => expect(screen.getByText('신청 결과')).toBeTruthy());
    resolvedPayload = { resolved: [], eventId: 'evt-1' };
    // A blip or an expired capability must not erase what the Guest already read.
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByText('Host가 이 곡을 대기열에서 제거했어요.')).toBeTruthy();
  });

  it('SAME VIDEO re-request stays independently active while the old one stays resolved', async () => {
    statusById.A = st({ state: 'removed' });
    statusById.B = st({ state: 'waiting', position: 1 });
    resolvedPayload = { resolved: [resolvedRow('A', 'host_removed')], eventId: 'evt-1' };
    // A and B share videoId 'v1' — only requestId may distinguish them.
    mount([mkReq('A', '테스트곡', 'v1'), mkReq('B', '테스트곡', 'v1')]);
    await openSheet();
    await waitFor(() => expect(screen.getByText('신청 결과')).toBeTruthy());
    const list = await screen.findByRole('list', { name: '신청 결과' });
    expect(within(list).queryAllByRole('listitem')).toHaveLength(1); // only A
    expect(screen.getByText('현재 대기 순서 #1')).toBeTruthy(); // B is still active
  });

  it('does not render a resolution for a request this device does not hold', async () => {
    statusById.r1 = st({ state: 'waiting', position: 1 });
    // The server answered with a row for an id the client never asked about.
    resolvedPayload = { resolved: [resolvedRow('SOMEONE-ELSE', 'host_removed')], eventId: 'evt-1' };
    mount([mkReq('r1', '테스트곡')]);
    await openSheet();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText('신청 결과')).toBeNull();
  });

  it('renders no section at all when nothing is resolved', async () => {
    statusById.r1 = st({ state: 'waiting', position: 1 });
    mount([mkReq('r1', '테스트곡')]);
    await openSheet();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText('신청 결과')).toBeNull();
  });
});

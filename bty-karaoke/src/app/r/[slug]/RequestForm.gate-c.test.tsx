// @vitest-environment jsdom
//
// BUILD 18B — Gate C regression. Reproduces the EXACT failure: a guest submits one song,
// the server INSERTS it but the response is LOST (network drop), the guest retries — and
// the queue must end with EXACTLY ONE row. The defect was that a re-tap of the same song
// minted a NEW idempotency key (→ two rows). The fix: a durable per-logical-request key
// (sessionStorage) reused across the failure so the retry replays the same server row.
//
// Drives the REAL RequestForm via the 다시 신청 flow (which calls submit()), asserting both
// POSTs carry the SAME idempotencyKey and the server inserts exactly one distinct key.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import { renderGuest } from '@/components/guest/guest-test-render';
import RequestForm from './RequestForm';
import { myRequestsKey } from '@/domain/guest-requests';
import { guestNameKey } from '@/domain/guest-identity';

const SLUG = 'bty-home';
const EVENT = 'evt-1';

let postKeys: (string | undefined)[]; // idempotencyKey sent on each POST /requests
let insertedKeys: Set<string>; //       distinct keys the "server" committed (= row count)
let failNextPost: boolean; //           simulate insert-success + response-loss on the next POST

const jsonRes = (obj: unknown, ok = true, status = 200) => ({
  ok,
  status,
  headers: { get: () => null },
  json: async () => obj,
});

function installFetch() {
  postKeys = [];
  insertedKeys = new Set();
  failNextPost = false;
  global.fetch = vi.fn(async (url: unknown, opts?: { method?: string; body?: string }) => {
    const u = String(url);
    if (/\/requests$/.test(u) && opts?.method === 'POST') {
      const body = JSON.parse(opts?.body ?? '{}') as { idempotencyKey?: string };
      const key = body.idempotencyKey;
      postKeys.push(key);
      // The server commits FIRST (dedup by key), exactly like the real idempotent insert.
      const isNew = !!key && !insertedKeys.has(key);
      if (isNew) insertedKeys.add(key!);
      // …then the response is lost on the flagged attempt (row already exists server-side).
      if (failNextPost) {
        failNextPost = false;
        throw new TypeError('network connection lost');
      }
      const id = `req-${key ?? insertedKeys.size}`;
      return jsonRes(
        {
          ok: true,
          replayed: !isNew,
          request: { id, youtube_title: 'Old Song', youtube_video_id: 'VIDOLD', youtube_channel_title: '' },
          cancelToken: `cap-${id}`,
          status: { requestId: id, state: 'up_next', position: 1, aheadCount: 0, isUpNext: true, isNowPlaying: false, readyAt: null },
          activeCount: 1,
        },
        true,
        isNew ? 201 : 200,
      );
    }
    const gm = u.match(/\/requests\/([^/]+)$/);
    if (gm) {
      const id = decodeURIComponent(gm[1]);
      // old-1 is a COMPLETED song (so it shows under 오늘 부른 노래 with a 다시 신청 action, and
      // the active count starts at 0); freshly created rows read as up_next.
      const state = id === 'old-1' ? 'done' : 'up_next';
      return jsonRes({ status: { requestId: id, state, position: 1, isUpNext: state === 'up_next', isNowPlaying: false, readyAt: null, aheadCount: 0 } });
    }
    return jsonRes({});
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.localStorage.setItem(guestNameKey(SLUG), '한빛');
  window.localStorage.setItem(
    myRequestsKey(SLUG, EVENT),
    JSON.stringify([{ requestId: 'old-1', cancelToken: 'cap-old', title: 'Old Song', artist: '', videoId: 'VIDOLD', submittedAt: Date.now() }]),
  );
  installFetch();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function openReRequest() {
  fireEvent.click(await screen.findByRole('button', { name: /내 신청곡 0곡 열기/ }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByText(/오늘 부른 노래 1/));
  return dialog;
}

describe('Gate C — insert-success + response-loss + retry ⇒ exactly one row', () => {
  it('the retry REUSES the original idempotency key ⇒ one committed row', async () => {
    renderGuest(<RequestForm slug={SLUG} roomOpen eventId={EVENT} />);
    const dialog = await openReRequest();
    const btn = within(dialog).getByRole('button', { name: '다시 신청' });

    // Attempt 1: the server inserts, then the response is LOST.
    failNextPost = true;
    fireEvent.click(btn);
    await waitFor(() => expect(postKeys.length).toBe(1));
    // The durable key persisted through the failure (survives rerender/remount/reconnect).
    expect(window.sessionStorage.getItem(`bty:reqkey:${SLUG}:${EVENT}:re:old-1`)).toBe(postKeys[0]);

    // Attempt 2 (retry via the same 다시 신청 action): must reuse the SAME key.
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '다시 신청' }));
    await waitFor(() => expect(postKeys.length).toBe(2));

    // THE invariant: same key both times, and the server committed exactly ONE row.
    expect(postKeys[0]).toBeTruthy();
    expect(postKeys[1]).toBe(postKeys[0]);
    expect(insertedKeys.size).toBe(1);
  });

  it('after confirmed success the durable key is cleared (a later request is genuinely new)', async () => {
    renderGuest(<RequestForm slug={SLUG} roomOpen eventId={EVENT} />);
    const dialog = await openReRequest();
    fireEvent.click(within(dialog).getByRole('button', { name: '다시 신청' }));
    await waitFor(() => expect(postKeys.length).toBe(1));
    // Succeeded → the durable key for this logical request is removed.
    await waitFor(() =>
      expect(window.sessionStorage.getItem(`bty:reqkey:${SLUG}:${EVENT}:re:old-1`)).toBeNull(),
    );
    expect(insertedKeys.size).toBe(1);
  });

  it('rapid double-tap during submit fires ONE logical request (one key, one row)', async () => {
    renderGuest(<RequestForm slug={SLUG} roomOpen eventId={EVENT} />);
    const dialog = await openReRequest();
    const btn = within(dialog).getByRole('button', { name: '다시 신청' });
    fireEvent.click(btn);
    fireEvent.click(btn); // second synchronous tap is blocked by the in-flight guard
    await waitFor(() => expect(postKeys.length).toBeGreaterThan(0));
    expect(postKeys.length).toBe(1);
    expect(insertedKeys.size).toBe(1);
  });
});

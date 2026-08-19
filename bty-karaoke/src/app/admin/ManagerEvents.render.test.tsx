// @vitest-environment jsdom
//
// BUILD R4E-R1 — the Events screen an operator actually reads.
//
// The assertions that matter are the ones about what must NOT appear: the page must not promise
// "tonight" when it spans a month of history, and an event that ended weeks ago must never claim a
// DJ is connected. Both were true in production before this slice.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/brand', () => ({ PRODUCT_NAME: 'btyNorebang' }));

import ManagerConsole from './ManagerConsole';

const TOTALS = { active: 3, stale: 9, recent: 4, ended: 12, test: 3, deleted: 6, all: 37 };

const evt = (over: Record<string, unknown> = {}) => ({
  event: {
    id: 'e1', name: 'Joy', hostName: null, status: 'active', publicCode: 'ABC123',
    guestSlug: 'joy', startsAt: null, endedAt: null, createdAt: '2026-07-30T00:00:00Z',
    ...(over.event as object ?? {}),
  },
  stats: { uniqueGuests: 3, totalRequests: 16, completed: 10, skipped: 0, waiting: 6, playing: 0,
    ...(over.stats as object ?? {}) },
  dj: { connected: true, label: 'iPad', lastUsedAt: '2026-07-20T00:00:00Z' },
  djLive: false,
  eventClass: 'ACTIVE',
  lastActivityAt: new Date(Date.now() - 3600_000).toISOString(),
  ...over,
});

let lastUrl = '';
function mockFetch(events: unknown[]) {
  const spy = vi.fn(async (input: RequestInfo | URL) => {
    lastUrl = String(input);
    return { ok: true, status: 200, json: async () => ({ events, totals: TOTALS, window: { limit: 50, returned: 37 } }) } as Response;
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

beforeEach(() => { lastUrl = ''; vi.unstubAllGlobals(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('R4E-R1 — (1) the page title', () => {
  it('says Events, never "Tonight’s Events" — the query has no date predicate', async () => {
    mockFetch([evt()]);
    const view = render(<ManagerConsole />);
    await screen.findByText('Joy');
    // Scoped to the page heading: "Active Events" is a metric label, not the title.
    expect(view.container.querySelector('.display-sm')?.textContent).toBe('Events');
    expect(view.container.textContent).not.toMatch(/Tonight/i);
  });
});

describe('R4E-R1 — (2,16) default view and summary', () => {
  it('(2) requests the Active view on first load', async () => {
    mockFetch([evt()]);
    render(<ManagerConsole />);
    await screen.findByText('Joy');
    expect(lastUrl).toContain('view=active');
  });

  it('(16) renders the four operator metrics', async () => {
    mockFetch([evt()]);
    render(<ManagerConsole />);
    await screen.findByText('Joy');
    for (const [label, n] of [['Active Events', '3'], ['Recently Ended', '4'], ['Needs Attention', '9'], ['Deleted / Archived', '6']] as const) {
      const el = screen.getAllByText(label)[0];
      expect(within(el.parentElement as HTMLElement).getByText(n)).toBeTruthy();
    }
  });

  it('(N) states that this is the management window, not all history', async () => {
    mockFetch([evt()]);
    render(<ManagerConsole />);
    await screen.findByText('Joy');
    expect(screen.getByText(/current management window, not all history/)).toBeTruthy();
  });

  it('switching tab re-reads that view', async () => {
    mockFetch([evt()]);
    render(<ManagerConsole />);
    await screen.findByText('Joy');
    const group = screen.getByRole('group', { name: 'Event view filter' });
    await userEvent.click(within(group).getByText('Deleted / Archived'));
    await waitFor(() => expect(lastUrl).toContain('view=deleted'));
  });
});

describe('R4E-R1 — (22,23,24) cards', () => {
  it('(22) an active card shows name, guests, songs and Active', async () => {
    mockFetch([evt()]);
    render(<ManagerConsole />);
    const name = await screen.findByText('Joy');
    const card = name.closest('.event-row') as HTMLElement;
    expect(within(card).getByText(/3 guests · 16 songs/)).toBeTruthy();
    // Scoped to the card: "Active" is also a filter chip.
    expect(within(card).getByText('Active')).toBeTruthy();
  });

  it('(23) a historical card shows its ended date', async () => {
    mockFetch([evt({ eventClass: 'ENDED', event: { id: 'e2', name: 'Joy', status: 'ended', endedAt: '2026-08-08T00:00:00Z', publicCode: 'X', guestSlug: 'joy', hostName: null, startsAt: null, createdAt: '2026-07-26T00:00:00Z' },
      stats: { uniqueGuests: 18, totalRequests: 40, completed: 40, skipped: 0, waiting: 0, playing: 0 } })]);
    render(<ManagerConsole />);
    await screen.findByText('Joy');
    const card = screen.getByText('Joy').closest('.event-row') as HTMLElement;
    expect(within(card).getByText(/18 guests · 40 songs/)).toBeTruthy();
    // Split across text nodes, and rendered in the VIEWER's timezone (an ended date is local
    // wall-clock context, unlike a Google quota day) — so compute the expected label the same way.
    const expected = new Date('2026-08-08T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    expect(card.textContent).toContain(`Ended ${expected}`);
  });

  it('a stale card shows how long it has been inactive', async () => {
    const nineDaysAgo = new Date(Date.now() - 9 * 86400000).toISOString();
    mockFetch([evt({ eventClass: 'STALE', lastActivityAt: nineDaysAgo,
      event: { id: 'e3', name: 'Final', status: 'active', endedAt: null, publicCode: 'Y', guestSlug: 'f', hostName: null, startsAt: null, createdAt: nineDaysAgo },
      stats: { uniqueGuests: 1, totalRequests: 1, completed: 1, skipped: 0, waiting: 0, playing: 0 } })]);
    render(<ManagerConsole />);
    await screen.findByText('Final');
    expect(screen.getByText(/Needs Attention · inactive 9 days/)).toBeTruthy();
  });

  it('(24) a tombstone card uses neutral retained-history language, not a defect', async () => {
    mockFetch([evt({ eventClass: 'DELETED_ARCHIVED',
      event: { id: 'e4', name: '(삭제된 이벤트)', status: 'ended', endedAt: '2026-08-09T00:00:00Z', publicCode: 'Z', guestSlug: 'z', hostName: null, startsAt: null, createdAt: '2026-08-09T00:00:00Z' } })]);
    const view = render(<ManagerConsole />);
    await screen.findByText('(삭제된 이벤트)');
    expect(screen.getByText(/Deleted account · history retained/)).toBeTruthy();
    expect(screen.getByText('Archived')).toBeTruthy();
    expect(view.container.textContent).not.toMatch(/⚠|error|broken|invalid/i);
  });
});

describe('R4E-R1 — (19,20,21) the DJ badge in the list', () => {
  it('(19,20) an ended event with a room-level DJ device shows NO DJ badge', async () => {
    // `dj.connected` is true and stale — exactly the production case that misled the operator.
    mockFetch([evt({ eventClass: 'ENDED', djLive: false,
      event: { id: 'e5', name: 'btyNorebang', status: 'ended', endedAt: '2026-07-21T00:00:00Z', publicCode: 'Q', guestSlug: 'b', hostName: null, startsAt: null, createdAt: '2026-07-20T00:00:00Z' } })]);
    const view = render(<ManagerConsole />);
    await screen.findByText('btyNorebang');
    expect(view.container.textContent).not.toMatch(/DJ connected/);
  });

  it('(21) a live event with a recent device DOES show it', async () => {
    mockFetch([evt({ djLive: true })]);
    render(<ManagerConsole />);
    await screen.findByText('Joy');
    expect(screen.getByText(/DJ connected/)).toBeTruthy();
  });
});

describe('R4E-R1 — (25,26,27) auth and read-only', () => {
  it('(25) an unauthenticated manager sees the passcode form and no event data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }) as Response));
    const view = render(<ManagerConsole />);
    expect(await screen.findByLabelText('Manager passcode')).toBeTruthy();
    expect(view.container.textContent).not.toMatch(/Active Events|Joy|Needs Attention/);
  });

  it('(26,27) listing and filtering issue GET requests only — no write', async () => {
    const spy = mockFetch([evt()]);
    render(<ManagerConsole />);
    await screen.findByText('Joy');
    const group = screen.getByRole('group', { name: 'Event view filter' });
    await userEvent.click(within(group).getByText('All'));
    await waitFor(() => expect(lastUrl).toContain('view=all'));
    for (const call of spy.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit?]>) {
      expect(call[1]?.method ?? 'GET').toBe('GET');
    }
  });
});

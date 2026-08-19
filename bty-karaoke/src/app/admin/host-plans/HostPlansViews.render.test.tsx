// @vitest-environment jsdom
//
// BUILD R4-R1 — what the operator sees. The card assertions matter most: a deletion tombstone must
// not wear a warning badge, and "No Room yet" must not sit among anomaly pills — those two
// presentation choices are what made a clean system look broken.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/brand', () => ({ PRODUCT_NAME: 'btyNorebang' }));
vi.mock('./ProPilotRequestsSection', () => ({ default: () => null }));
vi.mock('./TimedAccessPassSection', () => ({ default: () => null }));

import HostPlansConsole from './HostPlansConsole';

const TOTALS = {
  accounts: 25, free: 25, pro: 0, anomalies: 13,
  activeHosts: 13, activeFree: 13, activePro: 0, needsAttention: 1, noRoom: 5, deleted: 12,
};

const host = (over: Record<string, unknown> = {}) => ({
  accountId: 'id-1', accountRef: 'aaaaaaaa…0001', label: 'Joy', labelKind: 'room_name',
  representativeRoomSlug: 'joy-0jyownt8', ownedRoomCount: 1, hasOwnedRoom: true,
  plan: { code: 'FREE', status: 'ACTIVE', source: 'SYSTEM_DEFAULT', startedAt: null, fallback: false },
  persistedActive: { present: true, count: 1 },
  providers: 'google', historyCount: 3, auditCount: 2,
  anomalies: [], accountStatus: 'active', actionable: [], needsAttention: false,
  ...over,
});

let lastUrl = '';
function mockFetch(hosts: unknown[]) {
  const spy = vi.fn(async (input: RequestInfo | URL) => {
    lastUrl = String(input);
    return { ok: true, status: 200, json: async () => ({ totals: TOTALS, page: { limit: 50, offset: 0, count: hosts.length, total: hosts.length }, hosts }) } as Response;
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

beforeEach(() => { lastUrl = ''; vi.unstubAllGlobals(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('R4-R1 — summary', () => {
  it('shows operator metrics, not tombstone counts', async () => {
    mockFetch([host()]);
    render(<HostPlansConsole />);
    const label = await screen.findByText('Active Hosts');
    // Scoped: 13 is legitimately both Active Hosts and Free.
    expect(label.parentElement?.textContent).toContain('13');
    expect(screen.getAllByText('Needs Attention').length).toBeGreaterThan(0);
    expect(screen.getByText(/No Room 5 · Deleted \/ Archived 12/)).toBeTruthy();
    expect(screen.queryByText('accounts')).toBeNull();
    expect(screen.queryByText('anomalies')).toBeNull();
  });
});

describe('R4-R1 — (1) default filter', () => {
  it('requests the Active view on first load', async () => {
    mockFetch([host()]);
    render(<HostPlansConsole />);
    await screen.findByText('Joy');
    expect(lastUrl).toContain('view=active');
  });

  it('switching to Deleted / Archived requests that view', async () => {
    mockFetch([host()]);
    render(<HostPlansConsole />);
    await screen.findByText('Joy');
    const group = screen.getByRole('group', { name: 'Host view filter' });
    await userEvent.click(within(group).getByText('Deleted / Archived'));
    await waitFor(() => expect(lastUrl).toContain('view=deleted'));
  });

  it('offers all five views', async () => {
    mockFetch([host()]);
    render(<HostPlansConsole />);
    await screen.findByText('Joy');
    for (const label of ['Active', 'Needs Attention', 'No Room', 'Deleted / Archived', 'All']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });
});

describe('R4-R1 — (12,13,14) the card', () => {
  it('(12) omits persisted-assignment / history / audit noise', async () => {
    const { container } = render(<HostPlansConsole />, { wrapper: undefined });
    cleanup();
    mockFetch([host({ persistedActive: { present: false, count: 0 }, historyCount: 7, auditCount: 4 })]);
    const view = render(<HostPlansConsole />);
    await screen.findByText('Joy');
    const text = view.container.textContent ?? '';
    expect(text).not.toMatch(/persisted assignment missing/i);
    expect(text).not.toMatch(/\d+ history/);
    expect(text).not.toMatch(/\d+ audit/);
    // …but the operator facts are all present.
    expect(text).toMatch(/Joy/);
    expect(text).toMatch(/1 room/);
    expect(text).toMatch(/Google/i);
    void container;
  });

  it('(14) a real Needs Attention row still shows its badge', async () => {
    mockFetch([host({ label: 'Host 8d8f0cf6…d061c', hasOwnedRoom: false, ownedRoomCount: 0,
      anomalies: ['no_active_assignment'], actionable: ['no_active_assignment'], needsAttention: true })]);
    render(<HostPlansConsole />);
    expect(await screen.findByText(/No persisted active assignment/)).toBeTruthy();
  });

  it('(13) "No Room yet" is neutral copy, not a warning badge', async () => {
    mockFetch([host({ label: 'Host aaaa…0002', hasOwnedRoom: false, ownedRoomCount: 0 })]);
    render(<HostPlansConsole />);
    const el = await screen.findByText('No Room yet');
    expect(el.className).toContain('d-meta');   // neutral meta line
    expect(el.className).not.toContain('pill'); // not a badge
    expect(el.textContent).not.toMatch(/⚠/);
  });

  it('a deletion tombstone is labelled as history and carries NO warning badge', async () => {
    mockFetch([host({ label: '(삭제된 방)', accountStatus: 'deleted',
      anomalies: ['no_active_assignment'], actionable: [], needsAttention: false, hasOwnedRoom: true })]);
    const view = render(<HostPlansConsole />);
    expect(await screen.findByText(/Deleted account · retained for history/)).toBeTruthy();
    expect(view.container.textContent).not.toMatch(/⚠/);
    expect(screen.queryByText(/No persisted active assignment/)).toBeNull();
  });

  it('(G) an active zero-room account keeps its existing safe fallback label', async () => {
    mockFetch([host({ label: 'Host aaaa…0002', labelKind: 'internal', hasOwnedRoom: false, ownedRoomCount: 0 })]);
    render(<HostPlansConsole />);
    // No identity is invented — the masked-id fallback is preserved verbatim.
    expect(await screen.findByText('Host aaaa…0002')).toBeTruthy();
  });

  it('survives a payload from an older build (no accountStatus / actionable fields)', async () => {
    mockFetch([{ ...host(), accountStatus: undefined, actionable: undefined, needsAttention: undefined,
      anomalies: ['no_active_assignment'] }]);
    render(<HostPlansConsole />);
    // Degrades to pre-R4-R1 behaviour rather than throwing and rendering nothing.
    expect(await screen.findByText(/No persisted active assignment/)).toBeTruthy();
  });
});

describe('R4-R1 — (15,16) auth and read-only', () => {
  it('(15) an unauthenticated manager still gets the passcode form and no data', async () => {
    const spy = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }) }) as Response);
    vi.stubGlobal('fetch', spy);
    const view = render(<HostPlansConsole />);
    expect(await screen.findByLabelText('Manager passcode')).toBeTruthy();
    expect(view.container.textContent).not.toMatch(/Active Hosts|Needs Attention|Joy/);
  });

  it('(16) rendering and filtering issue GET requests only', async () => {
    const spy = mockFetch([host()]);
    render(<HostPlansConsole />);
    await screen.findByText('Joy');
    const views = screen.getByRole('group', { name: 'Host view filter' });
    await userEvent.click(within(views).getByText('All'));
    await waitFor(() => expect(lastUrl).toContain('view=all'));
    for (const call of spy.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit?]>) {
      expect(call[1]?.method ?? 'GET').toBe('GET');
    }
  });
});

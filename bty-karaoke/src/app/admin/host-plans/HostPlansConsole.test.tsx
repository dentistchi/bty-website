// @vitest-environment jsdom
//
// Manager Host Plans console (read-only) UI, proved by rendering the real client
// component against a mocked Manager API:
//   - summary counts + FREE/PRO badges render
//   - a Host row opens the detail sheet with assignment + audit history
//   - NO plan-change / upgrade / downgrade / edit / delete / retry control exists

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const listBody = {
  ok: true,
  totals: { accounts: 3, free: 3, pro: 0, anomalies: 0 },
  page: { limit: 50, offset: 0, count: 3, total: 3 },
  hosts: [
    {
      accountId: 'aaaaaaaa-0000-4000-8000-000000000001',
      accountRef: 'aaaaaaaa…0001',
      label: 'btyNorebang',
      labelKind: 'room_name',
      representativeRoomSlug: 'bty-home',
      ownedRoomCount: 1,
      hasOwnedRoom: true,
      plan: { code: 'FREE', status: 'ACTIVE', source: 'MANUAL', startedAt: '2026-07-22T04:38:00Z', fallback: false },
      persistedActive: { present: true, count: 1 },
      providers: 'apple+google',
      historyCount: 3,
      auditCount: 2,
      anomalies: [],
    },
  ],
};
const detailBody = {
  ok: true,
  detail: {
    accountId: 'aaaaaaaa-0000-4000-8000-000000000001',
    accountRef: 'aaaaaaaa…0001',
    label: 'btyNorebang',
    labelKind: 'room_name',
    providers: 'apple+google',
    current: { code: 'FREE', status: 'ACTIVE', source: 'MANUAL', startedAt: '2026-07-22T04:38:00Z', fallback: false, capabilities: { canCreateRoom: true } },
    persistedIntegrity: { activeCount: 1, hasPersistedActive: true, duplicateActive: false, unknownPlanCodes: [], auditLinkIssues: 0 },
    rooms: [{ slug: 'bty-home', displayName: 'btyNorebang', brandingTheme: 'midnight_gold', eventCount: 8, hasActiveEvent: true }],
    assignments: [
      { planCode: 'FREE', status: 'ended', source: 'SYSTEM_DEFAULT', startedAt: '2026-07-22T04:00:00Z', endedAt: '2026-07-22T04:15:00Z', current: false },
      { planCode: 'PRO', status: 'ended', source: 'MANUAL', startedAt: '2026-07-22T04:15:00Z', endedAt: '2026-07-22T04:38:00Z', current: false },
      { planCode: 'FREE', status: 'active', source: 'MANUAL', startedAt: '2026-07-22T04:38:00Z', endedAt: null, current: true },
    ],
    audits: [
      { previousPlan: 'FREE', newPlan: 'PRO', source: 'MANUAL', reason: 'Commander Gate B pilot lifecycle verification', changedByRef: 'system', createdAt: '2026-07-22T04:15:00Z', linked: true, idempotencyKeyMasked: 'gate-b-2026-07…2360' },
      { previousPlan: 'PRO', newPlan: 'FREE', source: 'MANUAL', reason: 'Commander Gate E pilot downgrade verification', changedByRef: 'system', createdAt: '2026-07-22T04:38:00Z', linked: true, idempotencyKeyMasked: 'gate-e-2026-07…1883' },
    ],
    anomalies: [],
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

beforeEach(() => {
  cleanup();
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const u = String(input);
    if (/\/api\/manager\/host-plans\/[0-9a-f-]{36}/i.test(u)) return jsonResponse(detailBody);
    if (u.includes('/api/manager/host-plans')) return jsonResponse(listBody);
    if (u.includes('/api/manager/session')) return jsonResponse({ ok: true });
    return jsonResponse({}, 404);
  }) as unknown as typeof fetch;
});
afterEach(() => cleanup());

import HostPlansConsole from './HostPlansConsole';

describe('HostPlansConsole', () => {
  it('(28/29) renders summary counts and a FREE badge for the Host row', async () => {
    render(<HostPlansConsole />);
    expect(await screen.findByText('btyNorebang')).toBeTruthy();
    // summary metric labels
    expect(screen.getByText('accounts')).toBeTruthy();
    expect(screen.getByText('anomalies')).toBeTruthy();
    // FREE badge present (row + filter button both say "Free"; at least one)
    expect(screen.getAllByText('Free').length).toBeGreaterThan(0);
  });

  it('(31/32/33) opening a Host shows assignment + audit history with reasons', async () => {
    const { container } = render(<HostPlansConsole />);
    await screen.findByText('bty-home', { exact: false }); // list row loaded
    fireEvent.click(container.querySelector('.event-row')!);
    await waitFor(() => expect(screen.getByText(/Assignment history/)).toBeTruthy());
    expect(screen.getByText(/Audit history/)).toBeTruthy();
    expect(screen.getByText(/Commander Gate B pilot lifecycle verification/)).toBeTruthy();
    expect(screen.getByText(/Commander Gate E pilot downgrade verification/)).toBeTruthy();
    // idempotency key is masked (never the full value)
    expect(screen.getByText(/gate-b-2026-07…2360/)).toBeTruthy();
  });

  it('(34) has NO plan-change / upgrade / downgrade / edit / delete / retry control', async () => {
    const { container } = render(<HostPlansConsole />);
    await screen.findByText('bty-home', { exact: false });
    fireEvent.click(container.querySelector('.event-row')!);
    await waitFor(() => expect(screen.getByText(/Audit history/)).toBeTruthy());
    // Assert over INTERACTIVE CONTROLS only (buttons + links) — audit reason text may
    // legitimately contain the word "downgrade", which is data, not a control.
    const controls = [
      ...container.querySelectorAll('button'),
      ...container.querySelectorAll('a'),
    ].map((el) => el.textContent ?? '');
    expect(controls.some((t) => /upgrade|grant|downgrade|change plan|delete|edit audit|retry operation/i.test(t))).toBe(false);
    expect(screen.getAllByText(/Read-only/i).length).toBeGreaterThan(0);
  });
});

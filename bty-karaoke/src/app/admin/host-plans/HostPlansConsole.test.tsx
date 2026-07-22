// @vitest-environment jsdom
//
// Manager Host Plans console UI, proved by rendering the real client component against
// a mocked Manager API:
//   - summary counts + FREE/PRO badges render
//   - a Host row opens the detail sheet with assignment + audit history
//   - the confirm-gated plan-change action (detail sheet only) shows the correct
//     opposite-plan action, requires a reason, submits ONE idempotent request, treats
//     changed:false as a no-op, refetches canonical data, and keeps failures private

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

// A PRO account (same shape) so we can prove the opposite "Downgrade to FREE" action.
const proDetailBody = {
  ok: true,
  detail: {
    ...detailBody.detail,
    current: { ...detailBody.detail.current, code: 'PRO' },
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

// Configurable per-test API harness. `assign` records every POST body so idempotency
// and duplicate-submit safety are provable; `detail` / `assignResponse` / `listStatus`
// let a test flip the current plan, the change outcome, or force an unauthenticated list.
const api = {
  detail: detailBody as unknown,
  assignResponse: { status: 200, body: { ok: true, changed: true, previousPlan: 'FREE', currentPlan: 'PRO' } as unknown },
  listStatus: 200,
  assignCalls: [] as Array<Record<string, unknown>>,
  detailFetches: 0,
};

beforeEach(() => {
  cleanup();
  api.detail = detailBody;
  api.assignResponse = { status: 200, body: { ok: true, changed: true, previousPlan: 'FREE', currentPlan: 'PRO' } };
  api.listStatus = 200;
  api.assignCalls = [];
  api.detailFetches = 0;
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = String(input);
    if (u.includes('/api/manager/host-plans/assign')) {
      api.assignCalls.push(JSON.parse(String(init?.body ?? '{}')));
      return jsonResponse(api.assignResponse.body, api.assignResponse.status);
    }
    if (/\/api\/manager\/host-plans\/[0-9a-f-]{36}/i.test(u)) {
      api.detailFetches += 1;
      return jsonResponse(api.detail);
    }
    if (u.includes('/api/manager/host-plans')) {
      if (api.listStatus !== 200) return jsonResponse({ error: 'Unauthorized' }, api.listStatus);
      return jsonResponse(listBody);
    }
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

  // ---- Plan-change flow (detail sheet only) --------------------------------------

  async function openFirstDetail(container: HTMLElement) {
    await screen.findByText('bty-home', { exact: false });
    fireEvent.click(container.querySelector('.event-row')!);
    await waitFor(() => expect(screen.getByText(/Audit history/)).toBeTruthy());
  }

  it('a FREE account shows only the "Upgrade to PRO" action', async () => {
    const { container } = render(<HostPlansConsole />);
    await openFirstDetail(container);
    expect(screen.getByText(/Upgrade to PRO/)).toBeTruthy();
    expect(screen.queryByText(/Downgrade to FREE/)).toBeNull();
  });

  it('a PRO account shows only the "Downgrade to FREE" action', async () => {
    api.detail = proDetailBody;
    const { container } = render(<HostPlansConsole />);
    await openFirstDetail(container);
    expect(screen.getByText(/Downgrade to FREE/)).toBeTruthy();
    expect(screen.queryByText(/Upgrade to PRO/)).toBeNull();
  });

  it('cannot confirm without a reason; confirmation shows target/before/after', async () => {
    const { container } = render(<HostPlansConsole />);
    await openFirstDetail(container);
    fireEvent.click(screen.getByText(/Upgrade to PRO/));
    // Confirm surface content: current → target
    expect(screen.getByText(/Current plan:/)).toBeTruthy();
    const confirm = screen.getByLabelText('Confirm plan change') as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); // no reason yet
    fireEvent.change(screen.getByLabelText('Reason for change'), { target: { value: '   ' } });
    expect(confirm.disabled).toBe(true); // whitespace-only rejected
    fireEvent.change(screen.getByLabelText('Reason for change'), { target: { value: 'Pilot upgrade' } });
    expect(confirm.disabled).toBe(false);
    expect(api.assignCalls.length).toBe(0); // nothing submitted yet
  });

  it('cancel makes no mutation', async () => {
    const { container } = render(<HostPlansConsole />);
    await openFirstDetail(container);
    fireEvent.click(screen.getByText(/Upgrade to PRO/));
    fireEvent.click(screen.getByText(/Cancel/));
    expect(api.assignCalls.length).toBe(0);
    expect(screen.getByText(/Upgrade to PRO/)).toBeTruthy(); // back to the action button
  });

  it('a successful change submits ONE request and refetches canonical detail', async () => {
    const { container } = render(<HostPlansConsole />);
    await openFirstDetail(container);
    const detailFetchesBefore = api.detailFetches;
    fireEvent.click(screen.getByText(/Upgrade to PRO/));
    fireEvent.change(screen.getByLabelText('Reason for change'), { target: { value: 'Pilot upgrade' } });
    fireEvent.click(screen.getByLabelText('Confirm plan change'));
    await waitFor(() => expect(screen.getByText(/Plan changed successfully/)).toBeTruthy());
    expect(api.assignCalls.length).toBe(1);
    expect(api.assignCalls[0]).toMatchObject({ planCode: 'PRO', reason: 'Pilot upgrade' });
    expect(String(api.assignCalls[0].idempotencyKey).length).toBeGreaterThan(0);
    expect(api.detailFetches).toBeGreaterThan(detailFetchesBefore); // canonical refetch happened
  });

  it('duplicate confirm clicks send only one request (submit lock)', async () => {
    const { container } = render(<HostPlansConsole />);
    await openFirstDetail(container);
    fireEvent.click(screen.getByText(/Upgrade to PRO/));
    fireEvent.change(screen.getByLabelText('Reason for change'), { target: { value: 'Pilot upgrade' } });
    const confirm = screen.getByLabelText('Confirm plan change');
    fireEvent.click(confirm);
    fireEvent.click(confirm); // second click while busy / disabled
    await waitFor(() => expect(screen.getByText(/Plan changed successfully/)).toBeTruthy());
    expect(api.assignCalls.length).toBe(1);
  });

  it('changed:false is presented as a no-op, not a new assignment', async () => {
    api.assignResponse = { status: 200, body: { ok: true, changed: false, previousPlan: null, currentPlan: 'PRO' } };
    const { container } = render(<HostPlansConsole />);
    await openFirstDetail(container);
    fireEvent.click(screen.getByText(/Upgrade to PRO/));
    fireEvent.change(screen.getByLabelText('Reason for change'), { target: { value: 'Pilot upgrade' } });
    fireEvent.click(screen.getByLabelText('Confirm plan change'));
    await waitFor(() => expect(screen.getByText(/Already on PRO/)).toBeTruthy());
    expect(screen.getByText(/No change was needed/)).toBeTruthy();
    expect(screen.queryByText(/Plan changed successfully/)).toBeNull();
  });

  it('a failure is privacy-clean (no email / subject / token / SQL)', async () => {
    api.assignResponse = { status: 404, body: { ok: false, error: 'account_not_found' } };
    const { container } = render(<HostPlansConsole />);
    await openFirstDetail(container);
    fireEvent.click(screen.getByText(/Upgrade to PRO/));
    fireEvent.change(screen.getByLabelText('Reason for change'), { target: { value: 'Pilot upgrade' } });
    fireEvent.click(screen.getByLabelText('Confirm plan change'));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent ?? '').not.toMatch(/@|subject|token|account_not_found|select |insert |rpc/i);
    expect(screen.queryByText(/Plan changed successfully/)).toBeNull();
  });

  it('an expired Manager session drops to the login form with no change surface', async () => {
    api.assignResponse = { status: 401, body: { error: 'Unauthorized' } };
    const { container } = render(<HostPlansConsole />);
    await openFirstDetail(container);
    fireEvent.click(screen.getByText(/Upgrade to PRO/));
    fireEvent.change(screen.getByLabelText('Reason for change'), { target: { value: 'Pilot upgrade' } });
    fireEvent.click(screen.getByLabelText('Confirm plan change'));
    await waitFor(() => expect(screen.getByText(/Manager passcode/)).toBeTruthy());
    expect(screen.queryByLabelText('Confirm plan change')).toBeNull();
  });

  it('an unauthenticated Manager sees the login form and no plan action at all', async () => {
    api.listStatus = 401;
    render(<HostPlansConsole />);
    await waitFor(() => expect(screen.getByText(/Manager passcode/)).toBeTruthy());
    expect(screen.queryByText(/Upgrade to PRO/)).toBeNull();
    expect(screen.queryByText(/Downgrade to FREE/)).toBeNull();
  });
});

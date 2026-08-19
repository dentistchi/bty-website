// @vitest-environment jsdom
//
// BUILD R3 — what the Founder actually sees.
//
// The assertions that matter most are about CONFUSION, not layout: Google's 1,000-call allocation
// and our internal 850 outbound guard must never read as the same number; a blocked request must
// never appear as quota spent; and a failed load must never render as a quiet day. Each of those
// is a decision the Founder would make wrongly if the page were wrong.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import YoutubeUsageConsole from './YoutubeUsageConsole';

vi.mock('@/lib/brand', () => ({ PRODUCT_NAME: 'btyNorebang' }));

const usage = (over: Record<string, unknown> = {}) => ({
  bucket: 'search_queries',
  endpoint: 'search.list',
  timezone: 'America/Los_Angeles',
  generatedAt: new Date().toISOString(),
  today: {
    day: '2026-08-19', dayStart: '2026-08-19T07:00:00+00:00', dayEnd: '2026-08-20T07:00:00+00:00',
    calls: 42, limit: 1000, remaining: 958, usagePercent: 4.2, status: 'NORMAL',
    ok: 40, quotaExceeded: 0, http4xx: 1, http5xx: 1, networkError: 0,
    lastSuccessfulAt: new Date(Date.now() - 12 * 60000).toISOString(),
    ...(over.today as object ?? {}),
  },
  efficiency: {
    visibleSearches: 100, cacheHits: 58, upstream: 42, breakerOpen: 0, gated: 0,
    cacheHitRate: 0.58, callsPerVisibleSearch: 0.42,
    ...(over.efficiency as object ?? {}),
  },
  blocked: { rateLimited: 6, budgetGuarded: 3, ...(over.blocked as object ?? {}) },
  budget: { reserved: 42, softCeiling: 850, hardReserve: 150, reserveRemaining: 808, ...(over.budget as object ?? {}) },
  trend: {
    daily7: [
      { day: '2026-08-13', calls: 0, percent: 0 },
      { day: '2026-08-18', calls: 2, percent: 0.2 },
      { day: '2026-08-19', calls: 42, percent: 4.2 },
    ],
    daily30: [
      { day: '2026-07-21', calls: 7, percent: 0.7 },
      { day: '2026-08-19', calls: 42, percent: 4.2 },
    ],
    peakHour: { hourUtc: '2026-08-19T23:00:00+00:00', calls: 9, pacificLabel: 'Aug 19, 4 PM PT' },
    ...(over.trend as object ?? {}),
  },
});

function mockFetch(impl: (url: string) => { status: number; body?: unknown }) {
  const spy = vi.fn(async (input: RequestInfo | URL) => {
    const { status, body } = impl(String(input));
    return { ok: status >= 200 && status < 300, status, json: async () => body ?? {} } as Response;
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const ok = () => mockFetch(() => ({ status: 200, body: { ok: true, usage: usage() } }));

describe('R3 — summary', () => {
  it('(4,5,6) renders calls / 1000, remaining, and the percentage', async () => {
    ok();
    render(<YoutubeUsageConsole />);
    expect(await screen.findByText('42 / 1000')).toBeTruthy();
    expect(screen.getByText('958')).toBeTruthy();
    // Scoped to the summary card: 4.2% also appears legitimately in that day's trend row.
    const usageCard = screen.getByText('Usage of the 1,000-call allocation').parentElement as HTMLElement;
    expect(within(usageCard).getByText(/4\.2%/)).toBeTruthy();
  });

  it('(15) states the Pacific reset and the approved allocation in calls', async () => {
    ok();
    render(<YoutubeUsageConsole />);
    expect(await screen.findByText(/Google reset: midnight Pacific Time/)).toBeTruthy();
    expect(screen.getByText(/1,000 search\.list calls \/ day/)).toBeTruthy();
    expect(screen.getByText(/America\/Los_Angeles/)).toBeTruthy();
  });

  it('(8) shows Google’s 1,000 allocation and the internal 850 guard as DIFFERENT facts', async () => {
    ok();
    render(<YoutubeUsageConsole />);
    expect(await screen.findByText('42 / 850')).toBeTruthy();               // internal guard
    expect(screen.getByText('Outbound guard (internal, not Google)')).toBeTruthy();
    expect(screen.getByText('42 / 1000')).toBeTruthy();                      // Google allocation
    expect(screen.getByText(/is our own outbound ceiling and is not a Google limit/)).toBeTruthy();
    expect(screen.getByText(/150.*calls held back for safety|calls held back/)).toBeTruthy();
  });

  it('(14) never shows the retired 100-units-per-call model, and never mentions videos.list', async () => {
    ok();
    const { container } = render(<YoutubeUsageConsole />);
    await screen.findByText('42 / 1000');
    expect(container.textContent).not.toMatch(/videos\.list/);
    expect(container.textContent).not.toMatch(/100 units|units per call|quota units/i);
  });
});

describe('R3 — (7) status badge bands', () => {
  const cases: Array<[number, string]> = [
    [4.2, 'NORMAL'], [69, 'NORMAL'], [70, 'WATCH'], [84.9, 'WATCH'],
    [85, 'HIGH'], [94.9, 'HIGH'], [95, 'CRITICAL'], [100, 'CRITICAL'],
  ];
  for (const [pct, band] of cases) {
    it(`${pct}% renders ${band}`, async () => {
      // The band is computed upstream (domain → service), so the page renders what it is given.
      mockFetch(() => ({
        status: 200,
        body: { ok: true, usage: usage({ today: { usagePercent: pct, status: band } }) },
      }));
      render(<YoutubeUsageConsole />);
      expect(await screen.findByText(band)).toBeTruthy();
    });
  }
});

describe('R3 — efficiency and containment', () => {
  it('(9) renders the cache hit rate as a percentage', async () => {
    ok();
    render(<YoutubeUsageConsole />);
    expect(await screen.findByText('58%')).toBeTruthy();
    expect(screen.getByText('Cache hit rate')).toBeTruthy();
    expect(screen.getByText('0.42')).toBeTruthy();
  });

  it('(10,11) renders rate-limited and budget-guarded counts', async () => {
    ok();
    render(<YoutubeUsageConsole />);
    const rl = await screen.findByText('Rate limited');
    expect(within(rl.parentElement as HTMLElement).getByText('6')).toBeTruthy();
    const bg = screen.getByText('Budget guarded');
    expect(within(bg.parentElement as HTMLElement).getByText('3')).toBeTruthy();
  });

  it('(12) blocked counts do NOT change the Google quota used', async () => {
    ok();
    render(<YoutubeUsageConsole />);
    // 6 rate-limited + 3 budget-guarded happened, and used-today is still exactly the call count.
    expect(await screen.findByText('42 / 1000')).toBeTruthy();
    expect(screen.getByText('958')).toBeTruthy();
    expect(screen.getByText(/consume .*no.* Google quota|consume/i)).toBeTruthy();
  });

  it('(12b) visible searches excludes blocked serves, exactly as R2.5 defines it', async () => {
    ok();
    render(<YoutubeUsageConsole />);
    const vs = await screen.findByText('Visible searches');
    // 100 visible = 58 hits + 42 upstream. The 9 blocked serves are NOT added in by the UI.
    expect(within(vs.parentElement as HTMLElement).getByText('100')).toBeTruthy();
  });
});

describe('R3 — (13) health', () => {
  it('shows quotaExceeded independently of the budget guard, and keeps healthy zeroes visible', async () => {
    mockFetch(() => ({
      status: 200,
      body: { ok: true, usage: usage({ today: { quotaExceeded: 2 }, blocked: { rateLimited: 0, budgetGuarded: 7 } }) },
    }));
    render(<YoutubeUsageConsole />);
    const qe = await screen.findByText('Quota exceeded (Google)');
    expect(within(qe.parentElement as HTMLElement).getByText('2')).toBeTruthy();
    const bg = screen.getByText('Budget guarded');
    expect(within(bg.parentElement as HTMLElement).getByText('7')).toBeTruthy();
    const net = screen.getByText('Network failures');
    expect(within(net.parentElement as HTMLElement).getByText('0')).toBeTruthy(); // zero, not hidden
  });

  it('says "No recorded call yet" rather than a fake timestamp', async () => {
    mockFetch(() => ({
      status: 200,
      body: { ok: true, usage: usage({ today: { lastSuccessfulAt: null } }) },
    }));
    render(<YoutubeUsageConsole />);
    expect(await screen.findByText('No recorded call yet')).toBeTruthy();
  });
});

describe('R3 — (16,17,18) trend', () => {
  it('renders the 7-day trend, switches to 30 days, and shows the peak hour in Pacific', async () => {
    ok();
    render(<YoutubeUsageConsole />);
    expect(await screen.findByText('2026-08-13')).toBeTruthy();
    expect(screen.getByText(/Aug 19, 4 PM PT/)).toBeTruthy();
    expect(screen.getByText('Peak hour (Pacific Time)')).toBeTruthy();

    await userEvent.click(screen.getByText('Show 30 days'));
    await waitFor(() => expect(screen.getByText('2026-07-21')).toBeTruthy());
  });
});

describe('R3 — (19,20) zero versus unavailable', () => {
  it('(19) a genuinely quiet day renders as zero', async () => {
    mockFetch(() => ({
      status: 200,
      body: {
        ok: true,
        usage: usage({
          today: { calls: 0, remaining: 1000, usagePercent: 0, status: 'NORMAL', ok: 0, lastSuccessfulAt: null },
          efficiency: { visibleSearches: 0, cacheHits: 0, upstream: 0, breakerOpen: 0, gated: 0, cacheHitRate: null, callsPerVisibleSearch: null },
        }),
      },
    }));
    render(<YoutubeUsageConsole />);
    expect(await screen.findByText('0 / 1000')).toBeTruthy();
    expect(screen.getByText('1000')).toBeTruthy();
    expect(screen.queryByText(/Usage data is unavailable/)).toBeNull();
  });

  it('(20) a failed load renders UNAVAILABLE, never a zeroed dashboard', async () => {
    mockFetch(() => ({ status: 502, body: { error: 'Usage data is unavailable.' } }));
    render(<YoutubeUsageConsole />);
    expect(await screen.findByText(/Usage data is unavailable right now/)).toBeTruthy();
    expect(screen.getByText(/This is not a reading of zero/)).toBeTruthy();
    // The distinguishing assertion: no summary numbers are shown at all.
    expect(screen.queryByText(/\/ 1000/)).toBeNull();
    expect(screen.queryByText('Cache hit rate')).toBeNull();
  });

  it('(3) an unauthenticated visitor sees the passcode prompt and NO telemetry', async () => {
    mockFetch(() => ({ status: 401, body: { error: 'Unauthorized' } }));
    const { container } = render(<YoutubeUsageConsole />);
    expect(await screen.findByLabelText('Manager passcode')).toBeTruthy();
    expect(container.textContent).not.toMatch(/\/ 1000|Cache hit rate|Rate limited|Peak hour/);
  });
});

describe('R3 — (21) refresh', () => {
  it('re-reads the manager API exactly once per press, with no background polling', async () => {
    const spy = ok();
    render(<YoutubeUsageConsole />);
    await screen.findByText('42 / 1000');
    const initial = spy.mock.calls.length;

    await userEvent.click(screen.getByText('Refresh'));
    await waitFor(() => expect(spy.mock.calls.length).toBe(initial + 1));

    // Nothing polls in the background: after waiting, the count is unchanged.
    await new Promise((r) => setTimeout(r, 60));
    expect(spy.mock.calls.length).toBe(initial + 1);
    expect(spy.mock.calls.every((c) => String(c[0]).includes('/api/manager/youtube-usage'))).toBe(true);
  });
});

describe('R3 — operator note', () => {
  it('warns that early telemetry includes verification traffic', async () => {
    ok();
    render(<YoutubeUsageConsole />);
    expect(await screen.findByText(/Development and verification traffic may be included/)).toBeTruthy();
    expect(screen.getByText(/Use full production days for quota-extension evidence/)).toBeTruthy();
  });
});

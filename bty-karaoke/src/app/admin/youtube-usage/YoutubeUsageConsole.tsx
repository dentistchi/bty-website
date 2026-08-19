'use client';

import { useCallback, useEffect, useState } from 'react';
import { PRODUCT_NAME } from '@/lib/brand';
import type { UsageStatus } from '@/domain/youtube-usage';

// The Manager session is an HttpOnly cookie set by the server — never readable here, never stored
// in localStorage. Same-origin fetches carry it; a 401 means "not signed in" → passcode form.
//
// This console RENDERS ONLY. Every quota number arrives already computed by the aggregation RPC
// (via the manager API); nothing here recomputes a threshold, a percentage, or a day boundary. In
// particular the UI never decides what counts as a visible search — blocked serves are excluded
// upstream in R2.5, and re-deriving that here is exactly how two surfaces start disagreeing.

interface TrendDay { day: string; calls: number; percent: number }

interface Usage {
  bucket: string;
  endpoint: string;
  timezone: string;
  generatedAt: string | null;
  today: {
    day: string | null; dayStart: string | null; dayEnd: string | null;
    calls: number; limit: number; remaining: number; usagePercent: number; status: UsageStatus;
    ok: number; quotaExceeded: number; http4xx: number; http5xx: number; networkError: number;
    lastSuccessfulAt: string | null;
  };
  efficiency: {
    visibleSearches: number; cacheHits: number; upstream: number; breakerOpen: number; gated: number;
    cacheHitRate: number | null; callsPerVisibleSearch: number | null;
  };
  blocked: { rateLimited: number; budgetGuarded: number };
  budget: { reserved: number; softCeiling: number; hardReserve: number; reserveRemaining: number };
  trend: {
    daily7: TrendDay[]; daily30: TrendDay[];
    peakHour: { hourUtc: string; calls: number; pacificLabel: string | null } | null;
  };
}

type Phase = 'loading' | 'need-login' | 'ready' | 'error';

const STATUS_CLASS: Record<UsageStatus, string> = {
  NORMAL: 'pill ok',
  WATCH: 'pill cyan',
  HIGH: 'pill gold',
  CRITICAL: 'pill live',
};

/** Relative wall-clock age. Browser-local by design — only the QUOTA DAY is pinned to Pacific. */
function ago(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const mins = Math.max(Math.floor((Date.now() - ms) / 60000), 0);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function Stat({ n, k }: { n: React.ReactNode; k: string }) {
  return (
    <div className="event-stat">
      <div className="n">{n}</div>
      <div className="k">{k}</div>
    </div>
  );
}

/** Accessible CSS bar. No charting dependency is added for this page. */
function TrendRows({ rows }: { rows: TrendDay[] }) {
  const max = Math.max(1, ...rows.map((r) => r.calls));
  return (
    <div>
      {rows.map((r) => (
        <div
          key={r.day}
          className="event-line"
          style={{ display: 'grid', gridTemplateColumns: '92px 1fr 96px', gap: 10, alignItems: 'center' }}
        >
          <span className="muted" style={{ fontVariantNumeric: 'tabular-nums' }}>{r.day}</span>
          <span
            role="img"
            aria-label={`${r.calls} calls, ${r.percent}% of the daily allocation`}
            style={{
              display: 'block', height: 10, borderRadius: 999,
              background: 'rgba(255,255,255,0.06)', border: '1px solid var(--line)', overflow: 'hidden',
            }}
          >
            <span
              style={{
                display: 'block', height: '100%',
                width: `${Math.round((r.calls / max) * 100)}%`,
                background: 'linear-gradient(90deg, var(--gold), var(--gold-2))',
              }}
            />
          </span>
          <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {r.calls} <span className="muted">· {r.percent}%</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export default function YoutubeUsageConsole() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [data, setData] = useState<Usage | null>(null);
  const [passcode, setPasscode] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async (): Promise<'ok' | 'unauth' | 'err'> => {
    try {
      const res = await fetch('/api/manager/youtube-usage', { credentials: 'same-origin' });
      if (res.status === 401) return 'unauth';
      if (!res.ok) return 'err';
      const body = await res.json();
      if (!body?.usage) return 'err';
      setData(body.usage as Usage);
      return 'ok';
    } catch {
      return 'err';
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const r = await load();
      if (!alive) return;
      setPhase(r === 'ok' ? 'ready' : r === 'unauth' ? 'need-login' : 'error');
    })();
    return () => { alive = false; };
  }, [load]);

  async function refresh() {
    setBusy(true);
    // Exactly ONE read per press. No polling: a monitoring page that generated its own background
    // traffic would be adding load to the system it is meant to watch.
    const r = await load();
    setBusy(false);
    if (r === 'unauth') setPhase('need-login');
    else if (r === 'err') setPhase('error');
    else setPhase('ready');
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    const p = passcode.trim();
    if (!p) return;
    setBusy(true);
    try {
      const res = await fetch('/api/manager/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ passcode: p }),
      });
      await res.json().catch(() => ({}));
      if (!res.ok) { setLoginError('That passcode is not valid.'); return; }
      setPasscode('');
      const r = await load();
      setPhase(r === 'ok' ? 'ready' : 'error');
    } catch {
      setLoginError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const brandHead = (
    <div className="brand-head">
      <span className="brand">{PRODUCT_NAME}</span>
      <span className="brand-tag">YouTube API Usage</span>
    </div>
  );

  if (phase === 'loading') {
    return (<>{brandHead}<p className="lead">Loading YouTube quota usage…</p></>);
  }

  if (phase === 'need-login') {
    return (
      <>
        {brandHead}
        <div className="card hero glow">
          <div className="eyebrow">Manager</div>
          <div className="display-sm" style={{ marginTop: 6 }}>YouTube Search API Usage</div>
          <p className="lead">Enter the manager passcode to view quota usage.</p>
          <form onSubmit={login} style={{ marginTop: 12 }}>
            {loginError && <div className="banner error">{loginError}</div>}
            <label htmlFor="yu-passcode">Manager passcode</label>
            <input
              id="yu-passcode" type="password" autoComplete="off" value={passcode}
              onChange={(e) => setPasscode(e.target.value)} placeholder="Passcode"
            />
            <button type="submit" className="primary lg block" style={{ marginTop: 14 }} disabled={busy || !passcode.trim()}>
              {busy ? 'Checking…' : 'Continue'}
            </button>
          </form>
          <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
            <a className="linkish" href="/admin">← Events</a>
          </div>
        </div>
      </>
    );
  }

  if (phase === 'error' || !data) {
    // Deliberately NOT a zeroed dashboard: "we could not read the data" and "there was no usage"
    // are different facts, and only one of them is evidence.
    return (
      <>
        {brandHead}
        <div className="card hero">
          <div className="display-sm">YouTube Search API Usage</div>
          <p className="lead" style={{ marginTop: 8 }}>
            Usage data is unavailable right now. This is not a reading of zero — nothing was loaded.
          </p>
          <button className="primary" onClick={refresh} disabled={busy}>
            {busy ? 'Retrying…' : 'Retry'}
          </button>
          <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
            <a className="linkish" href="/admin">← Events</a>
          </div>
        </div>
      </>
    );
  }

  const t = data.today;
  const e = data.efficiency;
  const b = data.budget;
  const rows = showAll ? data.trend.daily30 : data.trend.daily7;

  return (
    <>
      {brandHead}

      <div className="row between" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div className="display-sm">YouTube Search API Usage</div>
        <a className="linkish" href="/admin">← Events</a>
      </div>
      <p className="muted" style={{ marginTop: -4 }}>
        Search Queries quota · Google reset: midnight Pacific Time
      </p>
      <p className="muted" style={{ fontSize: '0.82rem' }}>
        Approved allocation: <b>1,000 search.list calls / day</b> · quota day{' '}
        <b>{t.day ?? '—'}</b> (America/Los_Angeles)
      </p>

      {/* SUMMARY — Google's allocation and our internal guard are shown as separate facts. */}
      <div className="event-stat-grid">
        <Stat n={`${t.calls} / ${t.limit}`} k="Used today (search.list calls)" />
        <Stat n={t.remaining} k="Remaining today" />
        <Stat
          n={<>
            {t.usagePercent}% <span className={STATUS_CLASS[t.status]} style={{ marginLeft: 8, verticalAlign: 'middle' }}>{t.status}</span>
          </>}
          k="Usage of the 1,000-call allocation"
        />
        <Stat n={`${b.reserved} / ${b.softCeiling}`} k="Outbound guard (internal, not Google)" />
      </div>
      <p className="muted" style={{ fontSize: '0.82rem', marginTop: -6 }}>
        Guard reserve remaining: <b>{b.reserveRemaining}</b> · <b>{b.hardReserve}</b> calls held back
        for safety. The <b>1,000</b> figure is Google’s daily allocation; the <b>{b.softCeiling}</b>{' '}
        figure is our own outbound ceiling and is not a Google limit.
      </p>

      {/* EFFICIENCY */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="eyebrow">Efficiency</div>
        <div className="event-stat-grid">
          <Stat n={e.visibleSearches} k="Visible searches" />
          <Stat n={e.cacheHits} k="Cache hits" />
          <Stat n={e.upstream} k="Upstream searches" />
          <Stat n={e.cacheHitRate == null ? '—' : `${Math.round(e.cacheHitRate * 1000) / 10}%`} k="Cache hit rate" />
          <Stat n={e.callsPerVisibleSearch == null ? '—' : e.callsPerVisibleSearch} k="Calls per visible search" />
          <Stat n={e.gated} k="Gated (no API key)" />
        </div>
        <div className="eyebrow" style={{ marginTop: 10 }}>Containment</div>
        <div className="event-stat-grid">
          <Stat n={data.blocked.rateLimited} k="Rate limited" />
          <Stat n={data.blocked.budgetGuarded} k="Budget guarded" />
          <Stat n={e.breakerOpen} k="Breaker open" />
        </div>
        <p className="muted" style={{ fontSize: '0.82rem' }}>
          Rate-limited and budget-guarded requests are refused before any outbound call, so they
          consume <b>no</b> Google quota and are counted separately from visible searches.
        </p>
      </div>

      {/* HEALTH */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="eyebrow">Health</div>
        <div className="event-stat-grid">
          <Stat n={t.ok} k="Successful calls" />
          <Stat n={t.quotaExceeded} k="Quota exceeded (Google)" />
          <Stat n={t.http4xx} k="Other 4xx" />
          <Stat n={t.http5xx} k="5xx" />
          <Stat n={t.networkError} k="Network failures" />
          <Stat
            n={t.lastSuccessfulAt ? (ago(t.lastSuccessfulAt) ?? '—') : 'No recorded call yet'}
            k="Last successful call"
          />
        </div>
      </div>

      {/* TREND */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="eyebrow">Daily calls · {showAll ? 'last 30 days' : 'last 7 days'} (Pacific)</div>
          <button className="linkish" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Show 7 days' : 'Show 30 days'}
          </button>
        </div>
        <TrendRows rows={rows} />
        <div className="event-stat-grid" style={{ marginTop: 12 }}>
          <Stat n={data.trend.peakHour ? data.trend.peakHour.calls : 0} k="Peak hourly calls" />
          <Stat
            n={data.trend.peakHour?.pacificLabel ?? '—'}
            k="Peak hour (Pacific Time)"
          />
        </div>
      </div>

      <div className="banner info" style={{ marginTop: 16 }}>
        Development and verification traffic may be included in early telemetry. Use full production
        days for quota-extension evidence.
      </div>

      <div className="row" style={{ justifyContent: 'center', marginTop: 16, gap: 12 }}>
        <button className="primary" onClick={refresh} disabled={busy}>
          {busy ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      {data.generatedAt && (
        <p className="muted" style={{ textAlign: 'center', fontSize: '0.78rem', marginTop: 8 }}>
          Read {ago(data.generatedAt) ?? 'just now'} · quota days are Pacific Time regardless of your
          local timezone
        </p>
      )}
    </>
  );
}

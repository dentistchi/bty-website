'use client';

import { useCallback, useEffect, useState } from 'react';
import { PRODUCT_NAME } from '@/lib/brand';
import { ANOMALY_LABEL, type AnomalyFlag, type ProviderSummary } from '@/domain/host-plan-console';

// The Manager session is an HttpOnly cookie set by the server — never readable here,
// never stored in localStorage. Same-origin fetches carry it; a 401 means "not signed
// in" → show the passcode form.
//
// Plan-change action (confirm-gated, audited) lives ONLY inside the account detail
// sheet, which already presents the unambiguous target and full before-state. It calls
// the existing atomic endpoint POST /api/manager/host-plans/assign — never a client DB
// write, never an optimistic local plan mutation. After every response the canonical
// list + detail are refetched, so the screen only ever shows server truth.

interface PlanView {
  code: 'FREE' | 'PRO';
  status: 'ACTIVE';
  source: 'SYSTEM_DEFAULT' | 'MANUAL' | 'BILLING';
  startedAt: string | null;
  fallback: boolean;
}
interface Summary {
  accountId: string;
  accountRef: string;
  label: string;
  labelKind: 'room_name' | 'room_slug' | 'internal';
  representativeRoomSlug: string | null;
  ownedRoomCount: number;
  hasOwnedRoom: boolean;
  plan: PlanView;
  persistedActive: { present: boolean; count: number };
  providers: ProviderSummary;
  historyCount: number;
  auditCount: number;
  anomalies: AnomalyFlag[];
}
interface ListResult {
  totals: { accounts: number; free: number; pro: number; anomalies: number };
  page: { limit: number; offset: number; count: number; total: number };
  hosts: Summary[];
}
interface OwnedRoom {
  slug: string;
  displayName: string | null;
  brandingTheme: string | null;
  eventCount: number;
  hasActiveEvent: boolean;
}
interface AssignmentRow {
  planCode: string;
  status: string;
  source: string;
  startedAt: string;
  endedAt: string | null;
  current: boolean;
}
interface AuditRow {
  previousPlan: string | null;
  newPlan: string;
  source: string;
  reason: string;
  changedByRef: string;
  createdAt: string;
  linked: boolean;
  idempotencyKeyMasked: string;
}
interface Detail {
  accountId: string;
  accountRef: string;
  label: string;
  labelKind: string;
  providers: ProviderSummary;
  current: PlanView & { capabilities: Record<string, boolean> };
  persistedIntegrity: {
    activeCount: number;
    hasPersistedActive: boolean;
    duplicateActive: boolean;
    unknownPlanCodes: string[];
    auditLinkIssues: number;
  };
  rooms: OwnedRoom[];
  assignments: AssignmentRow[];
  audits: AuditRow[];
  anomalies: AnomalyFlag[];
}

type Phase = 'loading' | 'need-login' | 'ready' | 'error';
type PlanFilter = 'ALL' | 'FREE' | 'PRO';

const PROVIDER_LABEL: Record<ProviderSummary, string> = {
  apple: 'Apple',
  google: 'Google',
  'apple+google': 'Apple + Google',
  none: '—',
};
const SOURCE_LABEL: Record<string, string> = {
  SYSTEM_DEFAULT: 'System default',
  MANUAL: 'Manual',
  BILLING: 'Billing',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  // Deterministic, locale-agnostic short stamp (UTC date + HH:MM).
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

function planLabel(p: PlanView): string {
  const base = p.code === 'FREE' ? 'Free' : 'Pro';
  return `${base} · Active`;
}

export default function HostPlansConsole() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [passcode, setPasscode] = useState('');
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [data, setData] = useState<ListResult | null>(null);
  const [plan, setPlan] = useState<PlanFilter>('ALL');
  const [anomalyOnly, setAnomalyOnly] = useState(false);
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<Detail | null>(null);

  // Plan-change flow (detail sheet only). `changeOpen` shows the confirm panel;
  // `changeKey` is the ONE idempotency key for the current attempt — minted when the
  // panel opens, reused verbatim for duplicate clicks or network retries, replaced only
  // when a fresh attempt begins. `changeResult` is set from the server response (never
  // optimistically) after a canonical refetch.
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [changeKey, setChangeKey] = useState<string | null>(null);
  const [changeBusy, setChangeBusy] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeResult, setChangeResult] = useState<{
    changed: boolean;
    from: 'FREE' | 'PRO';
    to: 'FREE' | 'PRO';
    reason: string;
  } | null>(null);

  const loadList = useCallback(
    async (f: { plan: PlanFilter; anomalyOnly: boolean; q: string }): Promise<'ok' | 'unauth' | 'err'> => {
      try {
        const sp = new URLSearchParams();
        if (f.plan !== 'ALL') sp.set('plan', f.plan);
        if (f.anomalyOnly) sp.set('anomaly', '1');
        if (f.q.trim()) sp.set('q', f.q.trim());
        const res = await fetch(`/api/manager/host-plans?${sp.toString()}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (res.status === 401) return 'unauth';
        if (!res.ok) return 'err';
        setData((await res.json()) as ListResult);
        return 'ok';
      } catch {
        return 'err';
      }
    },
    [],
  );

  // Initial load.
  useEffect(() => {
    (async () => {
      const r = await loadList({ plan: 'ALL', anomalyOnly: false, q: '' });
      setPhase(r === 'ok' ? 'ready' : r === 'unauth' ? 'need-login' : 'error');
    })();
  }, [loadList]);

  // Re-query on filter/search change (debounced) once authenticated.
  useEffect(() => {
    if (phase !== 'ready') return;
    const t = setTimeout(() => {
      void loadList({ plan, anomalyOnly, q });
    }, 200);
    return () => clearTimeout(t);
  }, [plan, anomalyOnly, q, phase, loadList]);

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
      if (!res.ok) {
        setLoginError('That passcode is not valid.');
        return;
      }
      setPasscode('');
      const r = await loadList({ plan, anomalyOnly, q });
      setPhase(r === 'ok' ? 'ready' : 'error');
    } catch {
      setLoginError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const loadDetail = useCallback(async (accountId: string): Promise<'ok' | 'unauth' | 'err'> => {
    try {
      const res = await fetch(`/api/manager/host-plans/${encodeURIComponent(accountId)}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (res.status === 401) return 'unauth';
      if (!res.ok) return 'err';
      const body = await res.json();
      setDetail(body.detail as Detail);
      return 'ok';
    } catch {
      return 'err';
    }
  }, []);

  function resetChange() {
    setChangeOpen(false);
    setChangeReason('');
    setChangeKey(null);
    setChangeBusy(false);
    setChangeError(null);
    setChangeResult(null);
  }

  async function openDetail(accountId: string) {
    resetChange();
    const r = await loadDetail(accountId);
    if (r === 'unauth') setPhase('need-login');
  }

  function closeDetail() {
    resetChange();
    setDetail(null);
  }

  // Begin a change attempt: open the confirm panel and mint ONE idempotency key that is
  // reused for every retry until the panel is closed (cancel / success dismiss).
  function beginChange() {
    setChangeError(null);
    setChangeResult(null);
    setChangeReason('');
    setChangeKey(crypto.randomUUID());
    setChangeOpen(true);
  }

  async function confirmChange() {
    if (!detail || changeBusy) return; // duplicate-click guard
    const from = detail.current.code;
    const to: 'FREE' | 'PRO' = from === 'FREE' ? 'PRO' : 'FREE';
    const reason = changeReason.trim();
    if (!reason) {
      setChangeError('Please enter a reason for this change.');
      return;
    }
    // Reuse the attempt's key; only mint one if somehow absent.
    const idempotencyKey = changeKey ?? crypto.randomUUID();
    if (!changeKey) setChangeKey(idempotencyKey);

    setChangeBusy(true);
    setChangeError(null);
    try {
      const res = await fetch('/api/manager/host-plans/assign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ accountId: detail.accountId, planCode: to, reason, idempotencyKey }),
      });

      if (res.status === 401) {
        // Session expired — keep no partial UI state; send to the login surface.
        resetChange();
        setDetail(null);
        setPhase('need-login');
        return;
      }

      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        changed?: boolean;
        currentPlan?: 'FREE' | 'PRO';
      };

      if (!res.ok || body.ok !== true) {
        // Privacy-clean, cause-specific — never surface server/SQL/RPC detail.
        if (res.status === 404) {
          setChangeError('That account could not be found. Refreshing the list…');
          void loadList({ plan, anomalyOnly, q });
        } else if (res.status === 400) {
          setChangeError('That change was rejected. Check the reason and try again.');
        } else if (res.status === 503) {
          setChangeError('Plan changes are not available right now.');
        } else {
          setChangeError('The change could not be completed. Please try again.');
        }
        return; // key retained → a retry reuses the same idempotency key
      }

      // Success path — NEVER trust the local plan; refetch canonical list + detail so
      // the screen shows server truth (current plan + new history/audit rows).
      const changed = body.changed === true;
      await Promise.all([loadList({ plan, anomalyOnly, q }), loadDetail(detail.accountId)]);
      setChangeOpen(false);
      setChangeResult({ changed, from, to, reason });
    } catch {
      // Network failure — nothing was confirmed applied; retain the key for retry.
      setChangeError('Network error. The change was not applied. Try again.');
    } finally {
      setChangeBusy(false);
    }
  }

  const brandHead = (
    <div className="brand-head">
      <span className="brand">{PRODUCT_NAME}</span>
      <span className="brand-tag">Host Plans · Host 플랜</span>
    </div>
  );

  if (phase === 'loading') {
    return (
      <>
        {brandHead}
        <p className="lead">Loading Host plans…</p>
      </>
    );
  }

  if (phase === 'need-login') {
    return (
      <>
        {brandHead}
        <div className="card hero glow">
          <div className="eyebrow">Manager</div>
          <div className="display-sm" style={{ marginTop: 6 }}>
            Host Plans · Host 플랜
          </div>
          <p className="lead">Enter the manager passcode to view Host plans and audit history.</p>
          <form onSubmit={login} style={{ marginTop: 12 }}>
            {loginError && <div className="banner error">{loginError}</div>}
            <label htmlFor="hp-passcode">Manager passcode</label>
            <input
              id="hp-passcode"
              type="password"
              autoComplete="off"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Passcode"
            />
            <button type="submit" className="primary lg block" style={{ marginTop: 14 }} disabled={busy || !passcode.trim()}>
              {busy ? 'Checking…' : 'Continue'}
            </button>
          </form>
          <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
            <a className="linkish" href="/admin">
              ← Events
            </a>
          </div>
        </div>
      </>
    );
  }

  if (phase === 'error') {
    return (
      <>
        {brandHead}
        <div className="card hero">
          <p className="lead">Couldn’t load Host plans. Please try again.</p>
          <button className="primary" onClick={() => location.reload()}>
            Retry
          </button>
        </div>
      </>
    );
  }

  const totals = data?.totals ?? { accounts: 0, free: 0, pro: 0, anomalies: 0 };
  const hosts = data?.hosts ?? [];

  return (
    <>
      {brandHead}

      <div className="row between" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div className="display-sm">Host Plans · Host 플랜</div>
        <a className="linkish" href="/admin">
          ← Events
        </a>
      </div>

      {/* Summary counts */}
      <div className="metric-row" style={{ marginBottom: 12 }}>
        <div className="metric">
          <div className="n">{totals.accounts}</div>
          <div className="k">accounts</div>
        </div>
        <div className="metric">
          <div className="n">{totals.free}</div>
          <div className="k">free</div>
        </div>
        <div className="metric">
          <div className="n">{totals.pro}</div>
          <div className="k">pro</div>
        </div>
        <div className="metric">
          <div className="n">{totals.anomalies}</div>
          <div className="k">anomalies</div>
        </div>
      </div>

      {/* Filters */}
      <div className="stack" style={{ marginBottom: 12 }}>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Room name or slug"
          aria-label="Search Room name or slug"
        />
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {(['ALL', 'FREE', 'PRO'] as PlanFilter[]).map((p) => (
            <button
              key={p}
              className={plan === p ? 'primary' : 'ghost'}
              onClick={() => setPlan(p)}
              aria-pressed={plan === p}
            >
              {p === 'ALL' ? 'All' : p === 'FREE' ? 'Free' : 'Pro'}
            </button>
          ))}
          <button
            className={anomalyOnly ? 'primary' : 'ghost'}
            onClick={() => setAnomalyOnly((v) => !v)}
            aria-pressed={anomalyOnly}
          >
            Anomalies only
          </button>
        </div>
      </div>

      {hosts.length === 0 ? (
        <div className="card hero">
          <p className="lead">No Host accounts match this filter.</p>
        </div>
      ) : (
        <div className="stack">
          {hosts.map((h) => (
            <button key={h.accountId} className="event-row" onClick={() => openDetail(h.accountId)}>
              <div className="row between" style={{ gap: 8 }}>
                <strong className="d-name">{h.label}</strong>
                <span className={`pill ${h.plan.code === 'PRO' ? 'live' : ''}`}>{h.plan.code === 'FREE' ? 'Free' : 'Pro'}</span>
              </div>
              <div className="d-meta">
                {h.representativeRoomSlug ? `${h.representativeRoomSlug} · ` : ''}
                {h.ownedRoomCount} {h.ownedRoomCount === 1 ? 'room' : 'rooms'} · {PROVIDER_LABEL[h.providers]} ·{' '}
                {SOURCE_LABEL[h.plan.source] ?? h.plan.source}
              </div>
              <div className="d-meta">
                {h.persistedActive.present ? planLabel(h.plan) : 'Free · Fallback — persisted assignment missing'} ·{' '}
                {h.historyCount} history · {h.auditCount} audit
              </div>
              {(h.anomalies.length > 0 || !h.hasOwnedRoom) && (
                <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {h.anomalies.map((a) => (
                    <span key={a} className="pill" style={{ borderColor: 'rgba(255,92,124,0.5)', color: '#ff9db0' }}>
                      ⚠ {ANOMALY_LABEL[a]}
                    </span>
                  ))}
                  {!h.hasOwnedRoom && <span className="pill">No Room yet</span>}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="row" style={{ justifyContent: 'center', marginTop: 20 }}>
        <span className="muted">Open an account to view its history or change its plan.</span>
      </div>

      {/* Detail sheet */}
      {detail && (
        <div className="qr-overlay" role="dialog" aria-modal="true" aria-label="Host plan detail">
          <div style={{ width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="row between">
              <div className="eyebrow">Host · {detail.accountRef}</div>
              <button className="linkish" onClick={closeDetail}>
                Close
              </button>
            </div>
            <div className="display" style={{ margin: '4px 0 12px' }}>
              {detail.label}
            </div>

            {/* Current plan */}
            <div className="card glow">
              <div className="row between">
                <div className="d-name">{detail.current.code === 'FREE' ? 'Free' : 'Pro'} · Active</div>
                <span className={`pill ${detail.current.code === 'PRO' ? 'live' : ''}`}>
                  {SOURCE_LABEL[detail.current.source] ?? detail.current.source}
                </span>
              </div>
              <div className="d-meta">
                Provider: {PROVIDER_LABEL[detail.providers]} · Started {fmtDate(detail.current.startedAt)}
              </div>
              {detail.current.fallback && (
                <div className="banner error" style={{ marginTop: 8 }}>
                  Free · Fallback — no persisted active assignment (resolver default, not a persisted FREE).
                </div>
              )}
              {!detail.current.fallback && (
                <div className="d-meta" style={{ marginTop: 6 }}>
                  Persisted active assignments: {detail.persistedIntegrity.activeCount}
                </div>
              )}
            </div>

            {/* Plan change — confirm-gated, audited, no local optimistic mutation */}
            {(() => {
              const from = detail.current.code;
              const to: 'FREE' | 'PRO' = from === 'FREE' ? 'PRO' : 'FREE';
              const actionLabel = to === 'PRO' ? 'Upgrade to PRO' : 'Downgrade to FREE';
              const actionLabelKo = to === 'PRO' ? 'PRO로 변경' : 'FREE로 변경';

              return (
                <div className="card" style={{ marginTop: 10 }}>
                  <div className="d-name">Change plan · 플랜 변경</div>

                  {/* Success / no-op result — set only from a server response after refetch */}
                  {changeResult && (
                    <div className={`banner ${changeResult.changed ? 'success' : 'info'}`} style={{ marginTop: 8 }} role="status">
                      {changeResult.changed ? (
                        <>
                          <strong>Plan changed successfully</strong>
                          <div style={{ marginTop: 4 }}>
                            {changeResult.from} → {changeResult.to}
                          </div>
                        </>
                      ) : (
                        <>
                          <strong>Already on {changeResult.to}</strong>
                          <div style={{ marginTop: 4 }}>No change was needed — no new assignment or audit was created.</div>
                        </>
                      )}
                      <div className="d-meta" style={{ marginTop: 4 }}>
                        Reason: {changeResult.reason}
                      </div>
                    </div>
                  )}

                  {/* Confirm panel */}
                  {changeOpen ? (
                    <div style={{ marginTop: 10 }}>
                      <div className="d-meta">
                        Account: <strong>{detail.label}</strong> · {detail.accountRef}
                      </div>
                      <div className="d-meta" style={{ marginTop: 4 }}>
                        Current plan: <strong>{from}</strong> → Target plan: <strong>{to}</strong>
                      </div>

                      {changeError && (
                        <div className="banner error" style={{ marginTop: 8 }} role="alert">
                          {changeError}
                        </div>
                      )}

                      <label htmlFor="hp-change-reason" style={{ marginTop: 10, display: 'block' }}>
                        Reason for change · 변경 사유
                      </label>
                      <textarea
                        id="hp-change-reason"
                        value={changeReason}
                        onChange={(e) => setChangeReason(e.target.value)}
                        placeholder="Why is this plan changing?"
                        rows={3}
                        disabled={changeBusy}
                        aria-label="Reason for change"
                        maxLength={300}
                        style={{ width: '100%', resize: 'vertical' }}
                      />

                      <div className="d-meta" style={{ marginTop: 8 }}>
                        This changes the Host plan only. It will not create, end, or modify any Room or Event.
                        <br />이 작업은 Host 플랜만 변경합니다. Room 또는 Event를 생성하거나 종료하거나 변경하지 않습니다.
                      </div>

                      <div className="row" style={{ gap: 8, marginTop: 12 }}>
                        <button className="ghost" onClick={resetChange} disabled={changeBusy}>
                          Cancel · 취소
                        </button>
                        <button
                          className="primary"
                          onClick={confirmChange}
                          disabled={changeBusy || !changeReason.trim()}
                          aria-label="Confirm plan change"
                        >
                          {changeBusy ? 'Applying…' : 'Confirm plan change · 플랜 변경 확정'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 10 }}>
                      <button className="primary block" onClick={beginChange}>
                        {actionLabel} · {actionLabelKo}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Anomalies */}
            {detail.anomalies.length > 0 && (
              <div className="card" style={{ marginTop: 10, borderColor: 'rgba(255,92,124,0.45)' }}>
                <div className="d-name">Integrity anomalies</div>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {detail.anomalies.map((a) => (
                    <span key={a} className="pill" style={{ borderColor: 'rgba(255,92,124,0.5)', color: '#ff9db0' }}>
                      ⚠ {ANOMALY_LABEL[a]}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Owned rooms */}
            <div className="card" style={{ marginTop: 10 }}>
              <div className="d-name">Owned Rooms ({detail.rooms.length})</div>
              {detail.rooms.length === 0 ? (
                <p className="muted" style={{ marginTop: 6 }}>
                  No Room yet.
                </p>
              ) : (
                <div className="stack" style={{ marginTop: 8 }}>
                  {detail.rooms.map((r) => (
                    <div key={r.slug} className="d-meta">
                      <strong>{r.displayName ?? r.slug}</strong> · {r.slug} · {r.brandingTheme ?? 'default'} ·{' '}
                      {r.eventCount} {r.eventCount === 1 ? 'event' : 'events'}
                      {r.hasActiveEvent ? ' · active event' : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assignment history (started_at asc) */}
            <div className="card" style={{ marginTop: 10 }}>
              <div className="d-name">Assignment history</div>
              <div className="stack" style={{ marginTop: 8 }}>
                {detail.assignments.map((a, i) => (
                  <div key={i} className="d-meta">
                    <span className="pill" style={{ marginRight: 6 }}>
                      {a.planCode}
                    </span>
                    {a.status}
                    {a.current ? ' · current' : ''} · {SOURCE_LABEL[a.source] ?? a.source} · {fmtDate(a.startedAt)}
                    {a.endedAt ? ` → ${fmtDate(a.endedAt)}` : ''}
                  </div>
                ))}
              </div>
            </div>

            {/* Audit history (created_at asc) — read only */}
            <div className="card" style={{ marginTop: 10 }}>
              <div className="d-name">Audit history</div>
              {detail.audits.length === 0 ? (
                <p className="muted" style={{ marginTop: 6 }}>
                  No plan changes recorded.
                </p>
              ) : (
                <div className="stack" style={{ marginTop: 8 }}>
                  {detail.audits.map((a, i) => (
                    <div key={i} className="audit-row" style={{ paddingBottom: 8 }}>
                      <div className="d-meta">
                        <strong>
                          {a.previousPlan ?? '—'} → {a.newPlan}
                        </strong>{' '}
                        · {SOURCE_LABEL[a.source] ?? a.source} · {fmtDate(a.createdAt)}
                        {a.linked ? '' : ' · ⚠ unlinked'}
                      </div>
                      <div className="d-meta">Reason: {a.reason}</div>
                      <div className="muted" style={{ fontSize: '0.8rem' }}>
                        by {a.changedByRef} · op {a.idempotencyKeyMasked}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="row" style={{ justifyContent: 'center', margin: '14px 0 4px' }}>
              <span className="muted">Plan changes are audited. Room and Event data is never affected.</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

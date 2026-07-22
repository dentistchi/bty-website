// Host Plan screen (Host Plan Foundation V1) — GET /host/plan.
//
// Identity-first, account-derived, read-only: the Host session cookie resolves the
// canonical account; a signed-out visitor is sent to the root login. The plan comes
// ONLY from resolveNorebangHostEntitlements(account.id) — the single resolver — so
// this page never re-derives plan rules. Rendering creates ZERO Events and never
// provisions anything.
//
// V1 is pre-billing on purpose: the current plan (FREE) is shown as active with the
// Host features it unlocks, and PRO is shown honestly as "준비 중 / Coming later".
// There is deliberately NO upgrade button, price, checkout, trial, or purchase CTA.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authorizeHost } from '@/lib/host-auth.server';
import { HOST_COOKIE } from '@/lib/host-web-session.server';
import { resolveNorebangHostEntitlements } from '@/lib/host-plan.server';
import { PRODUCT_NAME, PRODUCT_TAGLINE_KO } from '@/lib/brand';
import LegalLinks from '@/components/legal/LegalLinks';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// The current Host features FREE unlocks — shown as a plain reassurance list, not a
// gate. Every item is available today (capabilities are all true in V1).
const FREE_FEATURES = [
  '노래방 Room 운영',
  'Room 설정',
  '프리셋 테마와 로고',
  '이벤트 및 대기열 운영',
  'Guest QR 및 신청',
];

export default async function HostPlanPage() {
  const token = (await cookies()).get(HOST_COOKIE)?.value ?? null;
  const account = await authorizeHost(token);
  if (!account) redirect('/'); // identity first — signed out never sees plan data

  const ent = await resolveNorebangHostEntitlements(account.id);
  const isFree = ent.planCode === 'FREE';

  return (
    <main className="host-shell">
      <div className="brand-head">
        <span className="brand">{PRODUCT_NAME}</span>
        <span className="brand-tag">{PRODUCT_TAGLINE_KO}</span>
      </div>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>플랜 · Plan</h1>
        <a className="host-btn host-btn-ghost" href="/">
          My Norebang
        </a>
      </div>

      {/* Current plan — active, with the features it unlocks. */}
      <div className="card hero" data-host-plan={ent.planCode}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>{isFree ? 'Free' : ent.planCode}</h2>
          <span className="host-badge host-badge-ok" data-plan-status={ent.planStatus}>
            Active · 사용 중
          </span>
        </div>
        <p className="muted">
          지금 {PRODUCT_NAME}의 기본 Host 기능을 모두 사용할 수 있어요.
        </p>
        <ul className="host-feature-list">
          {FREE_FEATURES.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>

      {/* PRO — defined but not purchasable. Honest, no CTA / price / checkout. */}
      <div className="card" data-host-plan-pro>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Pro</h2>
          <span className="host-badge host-badge-soon">준비 중 · Coming later</span>
        </div>
        <p className="muted">
          Pro는 아직 준비 중이에요. 지금은 구매할 수 없고, 결제나 신청 절차도 없어요.
          현재 모든 기능은 Free에서 그대로 사용할 수 있어요.
        </p>
      </div>

      <LegalLinks showContact />
    </main>
  );
}

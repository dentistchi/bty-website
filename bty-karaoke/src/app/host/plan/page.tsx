// Host Plan screen (Host Plan Foundation V1) — GET /host/plan.
//
// Identity-first, account-derived, read-only: the Host session cookie resolves the
// canonical account; a signed-out visitor is sent to the root login. The plan comes
// ONLY from resolveNorebangHostEntitlements(account.id) — the single resolver — so
// this page never re-derives plan rules. Rendering creates ZERO Events and never
// provisions anything.
//
// V1 is pre-billing on purpose. A FREE account sees Free as active with the Host
// features it unlocks, and PRO shown honestly as "준비 중 / Coming later". A PRO PILOT
// account sees Pro as "Active · Pilot" with an honest note that it is an internal
// pilot, that no billing is connected, and that no extra feature or limit applies
// yet — with Free shown as the base/previous plan. Either way there is deliberately
// NO upgrade button, price, checkout, trial, or purchase CTA.

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
  const isPro = ent.planCode === 'PRO';

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

      {isPro ? (
        <>
          {/* PRO pilot — active, but HONEST: internal pilot, no billing, no gated
              feature yet. Never a purchase surface. */}
          <div className="card hero" data-host-plan="PRO">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>Pro</h2>
              <span className="host-badge host-badge-ok" data-plan-status={ent.planStatus}>
                Active · Pilot
              </span>
            </div>
            <p className="muted">
              지금은 내부 파일럿(Pilot) 플랜이에요. 결제는 아직 연결되어 있지 않고,
              Pro라고 해서 추가 기능이나 별도 혜택, 사용 제한이 적용되지는 않아요.
              현재 모든 Host 기능은 Free와 동일하게 그대로 사용할 수 있어요.
            </p>
            <ul className="host-feature-list">
              {FREE_FEATURES.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>

          {/* Free shown as the base / previous plan — no CTA, no price. */}
          <div className="card" data-host-plan-free>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>Free</h2>
              <span className="host-badge host-badge-soon">기본 플랜</span>
            </div>
            <p className="muted">
              Free는 기본 플랜이에요. Pro 파일럿이 끝나면 다시 Free로 돌아갈 수 있고,
              그때도 지금과 동일한 기능을 사용할 수 있어요.
            </p>
          </div>
        </>
      ) : (
        <>
          {/* FREE — active, with the features it unlocks. */}
          <div className="card hero" data-host-plan="FREE">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>Free</h2>
              <span className="host-badge host-badge-ok" data-plan-status={ent.planStatus}>
                Active · 사용 중
              </span>
            </div>
            <p className="muted">지금 {PRODUCT_NAME}의 기본 Host 기능을 모두 사용할 수 있어요.</p>
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
        </>
      )}

      <LegalLinks showContact />
    </main>
  );
}

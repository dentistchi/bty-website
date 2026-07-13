import { getPublicRoomBySlug } from '@/lib/rooms.server';
import { PRODUCT_NAME } from '@/lib/brand';
import AdminSetupClient from './AdminSetupClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// One-time Admin enrollment screen. The setup nonce arrives in the URL FRAGMENT
// (never server-rendered); the client reads it, wipes it from the address bar,
// and POSTs it with the chosen PIN.
export default async function AdminSetupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const room = await getPublicRoomBySlug(slug);

  return (
    <main>
      <div className="brand-head">
        <span className="brand">{PRODUCT_NAME}</span>
        <span className="brand-tag">Admin 설정</span>
      </div>
      {room ? (
        <AdminSetupClient slug={room.slug} displayName={room.display_name} />
      ) : (
        <div className="card">
          <div className="display-sm">방을 찾을 수 없어요</div>
          <p className="lead">“{slug}” 방이 없습니다.</p>
        </div>
      )}
    </main>
  );
}

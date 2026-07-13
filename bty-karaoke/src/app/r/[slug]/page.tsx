import { getPublicRoomBySlug, listActiveRequests } from '@/lib/rooms.server';
import { requestDisplayTitle } from '@/domain/request-view';
import { PRODUCT_NAME, PRODUCT_TAGLINE_KO } from '@/lib/brand';
import RequestForm from './RequestForm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function RoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const room = await getPublicRoomBySlug(slug);

  if (!room) {
    return (
      <main>
        <h1>Room not found</h1>
        <p className="muted">No room exists for “{slug}”.</p>
      </main>
    );
  }

  const requests = await listActiveRequests(room.id);

  return (
    <main>
      <div className="brand-head">
        <span className="brand">{PRODUCT_NAME}</span>
        <span className="brand-tag">{PRODUCT_TAGLINE_KO}</span>
      </div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>{room.display_name}</h1>
        <span className="tag">{room.status === 'open' ? '열림' : '닫힘'}</span>
      </div>
      <p className="muted">노래를 검색하고 신청하면 대기열에서 순서를 확인할 수 있어요.</p>

      <RequestForm slug={room.slug} roomOpen={room.status === 'open'} />

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong>대기열</strong>
          <span className="muted">{requests.length}곡 대기 중</span>
        </div>
        {requests.length === 0 ? (
          <p className="muted">아직 신청된 곡이 없어요 — 첫 곡을 신청해 보세요.</p>
        ) : (
          requests.map((r, i) => (
            <div className="queue-item" key={r.id}>
              <div className={`pos${r.status === 'playing' ? ' playing' : ''}`}>
                {r.status === 'playing' ? '▶' : i + 1}
              </div>
              {r.youtube_thumbnail_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="thumb sm" src={r.youtube_thumbnail_url} alt="" loading="lazy" />
              )}
              <div className="grow">
                <div className="title">{requestDisplayTitle(r)}</div>
                <div className="muted">
                  {r.youtube_channel_title ? `${r.youtube_channel_title} · ` : ''}신청: {r.guest_name}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}

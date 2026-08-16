// @vitest-environment jsdom
// BUILD 26T-R1B-R6-R1B-R7 §E/§F — the DJ console consumes the unavailable state.
//
// §F is the point of this file. The queue-selection logic already passed at the domain layer, but
// a forgotten adapter between the database row and the renderer would reintroduce a dead Play
// button while every domain test stayed green. So these fixtures start from the RAW backend shape
// — the `youtube_metadata_unavailable_at` timestamp exactly as `select('*')` returns it — and
// never from a hand-built derived boolean.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import DjBoard from './DjBoard';
import { unavailableCopy } from '@/domain/youtube-unavailable';

afterEach(cleanup);

/** A request EXACTLY as the server returns it — raw column names, raw timestamp. */
function rawRequest(over: Record<string, unknown> = {}) {
  return {
    id: 'req-available',
    room_id: 'room-1',
    guest_name: '한빛',
    search_query: null,
    youtube_video_id: 'dQw4w9WgXcQ',
    youtube_title: 'Amazing Grace',
    youtube_channel_title: 'TJ노래방',
    youtube_thumbnail_url: null,
    youtube_metadata_unavailable_at: null, // RAW form — the renderer must read THIS
    position: 1,
    status: 'waiting',
    session_id: null,
    event_id: 'ev-1',
    created_at: '2026-08-01T00:00:00Z',
    started_at: null,
    completed_at: null,
    ready_at: '2026-08-01T00:00:00Z',
    youtube_queued_at: null,
    lyrics_text: null,
    ...over,
  };
}

/**
 * An unavailable row as the DATABASE can actually hold it. The coherence CHECK
 * (`karaoke_requests_unavailable_excludes_freshness`) makes any other combination unrepresentable:
 * a marker REQUIRES the id, title, channel and thumbnail to be null. So "no stale metadata" is a
 * structural guarantee here, not a renderer convention — and this fixture is the honest shape.
 */
function rawUnavailable(over: Record<string, unknown> = {}) {
  return rawRequest({
    id: 'req-gone',
    youtube_video_id: null,
    youtube_title: null,
    youtube_channel_title: null,
    youtube_thumbnail_url: null,
    youtube_metadata_unavailable_at: '2026-08-15T00:00:00Z',
    ...over,
  });
}

function payload(requests: unknown[]) {
  return {
    room: { display_name: 'BTY', status: 'open' as const },
    role: 'dj' as const,
    session: null,
    stats: { requests: requests.length, guests: 1 },
    requests,
    eventStatus: null,
  };
}

const noop = () => {};
/** onReorder / onAddSong are typed as async in DjBoard; these satisfy them without acting. */
const noopReorder = async () => 'ok' as const;
const noopAdd = async () => 'ok' as const;
function board(requests: unknown[]) {
  return render(
    <DjBoard
      slug="r1"
      displayName="BTY"
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      data={payload(requests) as any}
      newIds={[]}
      reconnecting={false}
      busy={false}
      error={null}
      dev={false}
      adminCred={null}
      onPlayNext={noop}
      onMoveNext={noop}
      onRemove={noop}
      onReorder={noopReorder}
      onAddSong={noopAdd}
      onRefresh={noop}
      onDisconnect={noop}
      onEndEvent={noopAdd}
      onStartNewEvent={noopAdd}
    />,
  );
}

describe('§E/§F the DJ queue row', () => {
  it('POSITIVE CONTROL: an ordinary row still renders its real title and stays actionable', () => {
    // Without this, every "absent" assertion below could pass because nothing rendered at all.
    board([rawRequest()]);
    expect(screen.getAllByText('Amazing Grace').length).toBeGreaterThan(0); // queue card + stage hero
    expect(screen.queryByText(unavailableCopy('ko').title)).toBeNull();
    expect(screen.getByRole('button', { name: /다음 곡 재생/ })).toBeTruthy();
  });

  it('M2/M3/U-M1: an unavailable row shows the approved copy, from the RAW timestamp', () => {
    board([rawUnavailable()]);
    expect(screen.getAllByText(unavailableCopy('ko').title).length).toBeGreaterThan(0);
    expect(screen.getAllByText(unavailableCopy('ko').body).length).toBeGreaterThan(0);
  });

  it('M4/M5/M6: no stale title, channel or thumbnail survives on an unavailable row', () => {
    board([rawUnavailable()]);
    expect(screen.queryByText('Amazing Grace')).toBeNull();
    expect(screen.queryByText('TJ노래방')).toBeNull();
    expect(document.querySelectorAll('img.stage-thumb').length).toBe(0);
  });

  it('M15/M16/U-M2: an unavailable READY row produces NO play CTA', () => {
    board([rawUnavailable()]);
    expect(screen.queryByRole('button', { name: /다음 곡 재생/ })).toBeNull();
  });

  it('M18/M30: with ONLY unavailable rows there is no dead playback CTA', () => {
    board([rawUnavailable({ id: 'a', position: 1 }), rawUnavailable({ id: 'b', position: 2 })]);
    expect(screen.queryByRole('button', { name: /다음 곡 재생/ })).toBeNull();
    // …and the BTY rows are still VISIBLE. They are explained, not hidden.
    expect(screen.getAllByText(unavailableCopy('ko').title).length).toBeGreaterThanOrEqual(2);
  });

  it('M17/U-M3: unavailable first + playable second — the CTA targets the SECOND', () => {
    const clicked: string[] = [];
    render(
      <DjBoard
        slug="r1"
        displayName="BTY"
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        data={payload([rawUnavailable({ position: 1 }), rawRequest({ id: 'req-good', position: 2 })]) as any}
        newIds={[]}
        reconnecting={false}
        busy={false}
        error={null}
        dev={false}
        adminCred={null}
        onPlayNext={(id: string) => { clicked.push(id); }}
        onMoveNext={noop}
        onRemove={noop}
        onReorder={noopReorder}
        onAddSong={noopAdd}
        onRefresh={noop}
        onDisconnect={noop}
        onEndEvent={noopAdd}
        onStartNewEvent={noopAdd}
      />,
    );
    const cta = screen.getByRole('button', { name: /다음 곡 재생/ });
    (cta as HTMLButtonElement).click();
    expect(clicked).toEqual(['req-good']);
    // The unavailable row is still on screen, in its place, explained.
    expect(screen.getByText(unavailableCopy('ko').title)).toBeTruthy();
  });

  it('M32/U-M6: a NULL video id WITHOUT the marker is NOT treated as unavailable', () => {
    // The distinction the whole design rests on: null also means legacy / incomplete. Only the
    // EXPLICIT marker means "we asked YouTube and it is gone".
    board([rawRequest({ youtube_video_id: null, youtube_title: 'Legacy row', youtube_metadata_unavailable_at: null })]);
    expect(screen.getAllByText('Legacy row').length).toBeGreaterThan(0);
    expect(screen.queryByText(unavailableCopy('ko').title)).toBeNull();
  });
});

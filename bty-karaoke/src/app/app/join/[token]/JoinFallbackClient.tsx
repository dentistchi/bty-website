'use client';

import { useEffect, useState } from 'react';

// Resolves the handoff via the server API (slug derived server-side, never from the URL) and
// renders the non-installed fallback. Guest-safe: only a room name + a link to the public
// Guest page for a valid token; a generic message (no slug) for expired/invalid/revoked.

interface Resolved {
  resolution: 'active' | 'event_ended' | 'expired' | 'revoked' | 'invalid';
  roomSlug?: string;
  roomDisplayName?: string;
}

export default function JoinFallbackClient({ token }: { token: string }) {
  const [state, setState] = useState<Resolved | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/guest-app-handoffs/${encodeURIComponent(token)}`, { cache: 'no-store' });
        const data = (await res.json().catch(() => ({}))) as Resolved;
        if (alive) setState(data?.resolution ? data : { resolution: 'invalid' });
      } catch {
        if (alive) setState({ resolution: 'invalid' });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  if (loading) {
    return (
      <main className="card">
        <p className="muted">불러오는 중…</p>
      </main>
    );
  }

  const valid = state?.resolution === 'active' || state?.resolution === 'event_ended';
  const roomUrl = valid && state?.roomSlug ? `/r/${encodeURIComponent(state.roomSlug)}` : null;

  return (
    <main className="card" style={{ textAlign: 'center', maxWidth: 520, margin: '48px auto' }}>
      {valid ? (
        <>
          <h1 style={{ marginBottom: 8 }}>BTY Norebang 앱 연결 준비 완료</h1>
          <p className="muted" style={{ whiteSpace: 'pre-line', marginBottom: 20 }}>
            {'앱이 설치되어 있다면 링크를 다시 눌러 주세요.\n웹 게스트 화면으로 돌아갈 수 있습니다.'}
          </p>
          {state?.roomDisplayName && (
            <p style={{ marginBottom: 16 }}>
              <b>{state.roomDisplayName}</b>
            </p>
          )}
          {roomUrl && (
            <a href={roomUrl} className="button" role="button">
              웹에서 계속하기
            </a>
          )}
        </>
      ) : state?.resolution === 'event_ended' ? (
        <>
          <h1 style={{ marginBottom: 8 }}>이 파티는 종료되었습니다</h1>
          {roomUrl && (
            <a href={roomUrl} className="button" role="button">
              웹에서 계속하기
            </a>
          )}
        </>
      ) : (
        <>
          <h1 style={{ marginBottom: 8 }}>이 앱 연결 링크를 열 수 없습니다</h1>
          <p className="muted">링크가 만료되었거나 올바르지 않아요. QR 코드를 다시 스캔해 주세요.</p>
        </>
      )}
    </main>
  );
}

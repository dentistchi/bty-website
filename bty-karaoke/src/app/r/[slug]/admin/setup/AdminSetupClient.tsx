'use client';

import { useEffect, useState } from 'react';

interface Props {
  slug: string;
  displayName: string;
}

const adminKey = (slug: string) => `bty-admin-cred:${slug}`;

// Reads the setup nonce from the URL fragment, immediately erases it from the
// address bar, and never sends it via navigation — only in the POST body.
export default function AdminSetupClient({ slug, displayName }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [phase, setPhase] = useState<'loading' | 'form' | 'no-token' | 'submitting'>('loading');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const m = /(?:^|[#&])token=([^&]+)/.exec(window.location.hash);
    const t = m ? decodeURIComponent(m[1]) : null;
    if (t) {
      // Wipe the token from the visible URL immediately.
      history.replaceState(null, '', window.location.pathname + window.location.search);
      setToken(t);
      setPhase('form');
    } else {
      setPhase('no-token');
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) return;
    if (pin !== pin2) {
      setError('두 PIN이 서로 달라요.');
      return;
    }
    setPhase('submitting');
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/admin/setup`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? '등록에 실패했어요.');
        setPhase('form');
        return;
      }
      window.localStorage.setItem(adminKey(slug), data.adminToken);
      window.location.replace(`/r/${encodeURIComponent(slug)}/admin`);
    } catch {
      setError('네트워크 오류 — 다시 시도해 주세요.');
      setPhase('form');
    }
  }

  if (phase === 'loading') return <p className="lead">불러오는 중…</p>;

  if (phase === 'no-token') {
    return (
      <div className="card hero glow">
        <div className="eyebrow">관리자 기기 등록</div>
        <div className="display-sm" style={{ marginTop: 6 }}>
          설정 QR을 다시 스캔해 주세요
        </div>
        <p className="lead">
          Mac에서 <code>npm run admin:setup -- {slug}</code>로 만든 QR을 이 iPhone으로 스캔하면 관리자
          PIN을 설정할 수 있어요.
        </p>
      </div>
    );
  }

  return (
    <div className="card hero glow fade-up">
      <div className="eyebrow">관리자 PIN 설정</div>
      <div className="display-sm" style={{ marginTop: 6 }}>
        이 iPhone을 {displayName} 관리자로 등록
      </div>
      <p className="lead">이후에는 이 PIN으로 다른 기기도 관리자로 등록할 수 있어요.</p>
      <form onSubmit={submit} style={{ marginTop: 12 }}>
        {error && <div className="banner error">{error}</div>}
        <label htmlFor="pin">관리자 PIN (숫자 6자리 이상, 또는 8자 이상 문구)</label>
        <input
          id="pin"
          type="password"
          inputMode="text"
          autoComplete="new-password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="관리자 PIN"
        />
        <label htmlFor="pin2">PIN 확인</label>
        <input
          id="pin2"
          type="password"
          autoComplete="new-password"
          value={pin2}
          onChange={(e) => setPin2(e.target.value)}
          placeholder="한 번 더 입력"
        />
        <button
          type="submit"
          className="primary lg block"
          style={{ marginTop: 14 }}
          disabled={phase === 'submitting' || !pin || !pin2}
        >
          {phase === 'submitting' ? '등록 중…' : '이 iPhone을 관리자로 등록'}
        </button>
      </form>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

export default function BtyAuthGuard({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      const r = await fetch(`/api/auth/session?_t=${Date.now()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const j = await r.json();

      // ✅ 세션 없으면 즉시 루트로 보내기
      if (!j?.ok || !j?.hasSession) {
        window.location.replace("/?need_login=1");
        return;
      }

      if (alive) setReady(true);
    })();

    return () => {
      alive = false;
    };
  }, []);

  // 세션 확인 전에는 아무것도 안 보여주기(깜빡임 방지)
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm opacity-70">세션 확인 중…</div>
      </div>
    );
  }

  return <>{children}</>;
}

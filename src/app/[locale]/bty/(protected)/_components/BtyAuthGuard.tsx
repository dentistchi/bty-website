"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchJson } from "@/lib/read-json";

type SessionResp = { ok?: boolean; user?: unknown };

export default function BtyAuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const locale = pathname.startsWith("/ko") ? "ko" : "en";
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      const r = await fetchJson<SessionResp>("/api/auth/session");

      if (!r.ok || !r.json?.ok || !r.json?.user) {
        const next = encodeURIComponent(pathname || `/${locale}/bty`);
        window.location.replace(`/${locale}/bty/login?next=${next}`);
        return;
      }

      if (alive) setReady(true);
    })();

    return () => {
      alive = false;
    };
  }, [pathname, locale]);

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

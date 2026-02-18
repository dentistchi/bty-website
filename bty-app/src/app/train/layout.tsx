"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

function DayLink({ day, active }: { day: number; active: boolean }) {
  const href = `/train/28days/day/${day}`;
  return (
    <a
      href={href}
      className={[
        "block rounded-lg px-3 py-2 border text-sm",
        active ? "bg-black text-white" : "bg-white hover:bg-gray-50",
      ].join(" ")}
    >
      Day {day}
    </a>
  );
}

export default function TrainLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();

  const [chatOpen, setChatOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=" + encodeURIComponent(pathname));
  }, [loading, user, router, pathname]);

  const is28Days = pathname.startsWith("/train/28days");
  const activeDay = (() => {
    const m = pathname.match(/\/train\/28days\/day\/(\d+)/);
    return m ? Number(m[1]) : null;
  })();

  const leftPanel = (
    <aside className="h-full border-r p-4 overflow-auto bg-white">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">28일 훈련</div>
        <a className="text-xs underline opacity-80" href="/train">
          전체 트랙
        </a>
      </div>

      <div className="mb-3 text-xs opacity-70">
        {is28Days ? "오늘도 한 칸 전진." : "왼쪽에서 Day를 선택해 시작해."}
      </div>

      {/* Day 1~28 하드코딩 */}
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
          <DayLink key={day} day={day} active={activeDay === day} />
        ))}
      </div>

      <div className="mt-6 pt-4 border-t text-xs opacity-70">
        user: {user?.email ?? "-"}
      </div>
    </aside>
  );

  const rightPanel = useMemo(() => {
    return (
      <aside className="h-full border-l p-4 overflow-auto bg-white">
        <div className="font-semibold mb-2">코치 챗</div>
        <div className="text-sm opacity-70 mb-3">
          (나중에 Day/레슨 컨텍스트 주입)
        </div>
        <div className="rounded-lg border p-3 text-sm">(여기에 챗 UI)</div>
      </aside>
    );
  }, []);

  if (loading) return <div className="p-6">loading...</div>;
  if (!user) return <div className="p-6">redirecting...</div>;

  // 데스크탑 3열
  if (!isMobile) {
    return (
      <div className="h-screen grid grid-cols-[320px_1fr_360px]">
        {leftPanel}
        <main className="h-full overflow-auto p-6">{children}</main>
        {rightPanel}
      </div>
    );
  }

  // 모바일 drawer
  return (
    <div className="h-screen flex flex-col">
      <header className="h-12 border-b px-3 flex items-center justify-between bg-white">
        <button className="text-sm underline" onClick={() => setTocOpen(true)}>
          목차
        </button>
        <div className="text-sm font-medium">트레이닝</div>
        <button className="text-sm underline" onClick={() => setChatOpen(true)}>
          챗
        </button>
      </header>

      <main className="flex-1 overflow-auto p-4">{children}</main>

      {tocOpen && (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setTocOpen(false)}>
          <div
            className="absolute left-0 top-0 h-full w-[85%] max-w-sm bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-12 border-b px-3 flex items-center justify-between">
              <div className="font-semibold">28일 훈련</div>
              <button className="text-sm underline" onClick={() => setTocOpen(false)}>
                닫기
              </button>
            </div>
            {leftPanel}
          </div>
        </div>
      )}

      {chatOpen && (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setChatOpen(false)}>
          <div
            className="absolute right-0 top-0 h-full w-[85%] max-w-sm bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-12 border-b px-3 flex items-center justify-between">
              <div className="font-semibold">코치 챗</div>
              <button className="text-sm underline" onClick={() => setChatOpen(false)}>
                닫기
              </button>
            </div>
            {rightPanel}
          </div>
        </div>
      )}
    </div>
  );
}

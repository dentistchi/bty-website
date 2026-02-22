"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function JournalPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=" + encodeURIComponent("/journal"));
  }, [loading, user, router]);

  if (loading) return <div className="p-6">loading...</div>;
  if (!user) return <div className="p-6">redirecting...</div>;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold">저널</h1>
        <p className="opacity-70 text-sm">
          오늘 마음을 내려놓는 연습을 함께 해보자.
        </p>

        <div className="rounded-lg border p-4 space-y-3">
          <div className="font-medium">오늘 누구에게도 말 못했던 마음은?</div>
          <textarea className="w-full border rounded p-2 min-h-[120px]" placeholder="여기에 적어줘." />
          <button className="px-3 py-2 border rounded">저장</button>
        </div>
      </div>

      {/* 챗 토글 버튼 */}
      <button
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full border shadow bg-white"
        onClick={() => setChatOpen((v) => !v)}
        aria-label="챗 열기"
      >
        챗
      </button>

      {chatOpen && (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setChatOpen(false)}>
          <div className="absolute right-0 bottom-0 top-0 w-[90%] max-w-md bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="h-12 border-b px-4 flex items-center justify-between">
              <div className="font-semibold">코치 챗</div>
              <button className="text-sm underline" onClick={() => setChatOpen(false)}>닫기</button>
            </div>
            <div className="p-4 text-sm">
              (저널용 챗 UI)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

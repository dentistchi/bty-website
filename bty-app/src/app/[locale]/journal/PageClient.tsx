"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import HubTopNav from "@/components/bty/HubTopNav";
import { PageLoadingFallback } from "@/components/bty-arena";

export default function JournalPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const loc = params?.locale === "ko" ? "ko" : "en";
  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=" + encodeURIComponent("/journal"));
  }, [loading, user, router]);

  if (loading) return <PageLoadingFallback />;
  if (!user) return <div className="p-6">redirecting...</div>;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-xl mx-auto p-6 space-y-4">
        <HubTopNav theme="dear" showLangSwitch />
        <h1 className="text-2xl font-semibold">저널</h1>
        <p className="opacity-70 text-sm">
          오늘 마음을 내려놓는 연습을 함께 해보자.
        </p>

        <div className="rounded-lg border p-4 space-y-3">
          <div className="font-medium">오늘 누구에게도 말 못했던 마음은?</div>
          <textarea className="w-full border rounded p-2 min-h-[120px]" placeholder="여기에 적어줘." />
          <button type="button" className="px-3 py-2 border rounded" aria-label="저장">저장</button>
        </div>
      </div>
      <p className="max-w-xl mx-auto px-6 pb-8 text-center text-sm text-gray-500">
        {loc === "ko"
          ? "Dr. Chi와 이야기하려면 오른쪽 아래 아바타 버튼을 눌러 주세요."
          : "Tap the Dr. Chi avatar button (bottom-right) to chat."}
      </p>
    </div>
  );
}

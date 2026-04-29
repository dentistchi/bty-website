"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoadingFallback } from "@/components/bty-arena";

export default function AppHome() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=" + encodeURIComponent("/app"));
  }, [loading, user, router]);

  if (loading) return <PageLoadingFallback />;
  if (!user) return <div className="p-6">redirecting...</div>;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-semibold">오늘의 훈련</h1>
        <p className="opacity-70 text-sm">user: {user.email}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button className="border rounded-lg p-4 text-left" onClick={() => router.push("/train/28days")}>
            <div className="font-semibold">28일 훈련</div>
            <div className="text-sm opacity-70">오늘의 Day로 바로 이동</div>
          </button>

          <button className="border rounded-lg p-4 text-left" onClick={() => router.push("/journal")}>
            <div className="font-semibold">저널</div>
            <div className="text-sm opacity-70">마음을 내려놓는 대화</div>
          </button>
        </div>
      </div>
    </div>
  );
}

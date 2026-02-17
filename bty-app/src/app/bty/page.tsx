"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function BtyPage() {
  const { user, loading, refreshSession } = useAuth();

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (!loading && !user) window.location.replace("/");
  }, [loading, user]);

  if (loading) return <div className="p-6">로딩 중…</div>;
  if (!user) return null;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 24, fontWeight: "bold", color: "red" }}>
        BTY_PAGE_RENDERED ✅
      </div>

      {/* ↓ 기존 내용이 있으면 여기 아래에 그대로 두면 됨 */}
      <div className="p-6">BTY ✅ {user.email ?? user.id}</div>
    </div>
  );
}

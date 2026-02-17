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

  return <div className="p-6">BTY ✅ {user.email ?? user.id}</div>;
}

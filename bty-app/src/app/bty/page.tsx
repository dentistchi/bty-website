"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function BtyPage() {
  const { user, loading, refreshSession } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      refreshSession();
    }
  }, [loading, user, refreshSession]);

  if (loading) return <div>loading...</div>;
  if (!user) return <div>로그인이 필요합니다.</div>;

  return <div>...진짜 BTY UI...</div>;
}

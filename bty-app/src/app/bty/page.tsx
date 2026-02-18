"use client";

import { useAuth } from "@/contexts/AuthContext";

export default function BtyPage() {
  const { user, loading } = useAuth();

  return (
    <div>
      {loading && <div>loading...</div>}
      {!loading && !user && <div>로그인이 필요합니다.</div>}
      {!loading && user && <div>BTY UI (user: {user.email})</div>}
    </div>
  );
}

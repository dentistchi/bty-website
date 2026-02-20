"use client";

import { useState } from "react";
import { fetchJson } from "@/lib/read-json";

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  const onLogout = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await fetchJson("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } finally {
      window.location.assign("/bty/login?next=%2Fbty");
    }
  };

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={loading}
      className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60"
    >
      {loading ? "로그아웃..." : "로그아웃"}
    </button>
  );
}

export default LogoutButton;

"use client";

import { useState } from "react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    console.log("login clicked");

    setBusy(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      console.log("login failed");
      setError(data?.error ?? "Login failed");
      setBusy(false);
      return;
    }

    console.log("login ok, redirecting...");

    window.location.replace("/bty");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-neutral-800 mb-4">Admin 로그인</h1>
        <form onSubmit={handleLogin} className="max-w-sm space-y-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email"
            type="email"
            required
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            type="password"
            required
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            disabled={busy}
            type="submit"
            className="w-full rounded bg-neutral-800 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Signing in..." : "Login"}
          </button>
          {error ? <div className="text-sm text-red-600">{error}</div> : null}
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { fetchJson } from "@/lib/read-json";
import { safeParse } from "@/lib/safeParse";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export default function AdminLoginPage() {
  const params = useParams();
  const locale = (typeof params?.locale === "string" ? params.locale : "en") as Locale;
  const t = getMessages(locale).adminLogin;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const r = await fetchJson<{ ok?: boolean; error?: string }>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!r.ok || !r.json?.ok) {
      if (!r.ok) {
        const errObj = safeParse<{ error?: string }>(r.raw);
        setError(errObj?.error ?? r.raw?.slice(0, 200) ?? t.loginFailed);
      } else {
        setError(r.json?.error ?? t.loginFailed);
      }
      setBusy(false);
      return;
    }

    window.location.replace(`/${locale}/bty`);
  }

  return (
    <main
      aria-label={t.mainRegionAria}
      className="flex min-h-screen items-center justify-center bg-neutral-50 p-4"
    >
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="mb-4 text-lg font-semibold text-neutral-800">{t.heading}</h1>
        <form onSubmit={handleLogin} className="max-w-sm space-y-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.emailPlaceholder}
            type="email"
            required
            autoComplete="email"
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.passwordPlaceholder}
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            disabled={busy}
            type="submit"
            className="w-full rounded bg-neutral-800 py-2 text-sm font-medium text-white disabled:opacity-50"
            aria-label={busy ? t.loginSubmitAriaBusy : t.loginSubmitAriaIdle}
          >
            {busy ? t.signingIn : t.loginSubmit}
          </button>
          {error ? <div className="text-sm text-red-600">{error}</div> : null}
        </form>
      </div>
    </main>
  );
}

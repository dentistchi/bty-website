"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { getMessages, type Locale } from "@/lib/i18n";

async function forceCookieCommit() {
  try {
    await fetch("/api/auth/whoami", { method: "GET", cache: "no-store" });
  } catch {
    // ignore
  }
}

function safeNext(nextPath: string, locale: "en" | "ko") {
  if (!nextPath || typeof nextPath !== "string") return `/${locale}/bty`;
  if (!nextPath.startsWith("/")) return `/${locale}/bty`;
  if (nextPath.startsWith("//")) return `/${locale}/bty`;
  return nextPath;
}

export default function LoginClient({ nextPath, locale }: { nextPath: string; locale: "en" | "ko" }) {
  const next = useMemo(() => safeNext(nextPath, locale), [nextPath, locale]);
  const t = getMessages(locale as Locale).login;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const canSubmit = email.trim().length > 3 && password.length > 3 && !isLoading;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsLoading(true);
    setError("");

    try {
      const loginUrl = next ? `/api/auth/login?next=${encodeURIComponent(next)}` : "/api/auth/login";
      const r = await fetch(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
        credentials: "include",
      });

      const data = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        next?: string;
        error?: string;
        detail?: string;
      };

      if (data.ok && typeof data.next === "string") {
        await forceCookieCommit();
        await new Promise((r) => setTimeout(r, 50));
        window.location.assign(data.next);
        return;
      }

      if (!r.ok) {
        const msg = data.detail ?? data.error ?? t.errorDefault;
        throw new Error(msg);
      }

      throw new Error(data.error ?? t.errorDefault);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errorDefault);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md border rounded-2xl p-6 bg-white">
        <h1 className="text-xl font-semibold mb-1">{t.title}</h1>
        <p className="text-sm text-gray-600 mb-4">
          {t.afterLoginGoTo} <span className="font-medium">{next}</span>
        </p>

        <form onSubmit={onSubmit}>
          <label className="block text-sm mb-1">{t.email}</label>
          <input
            className="w-full border rounded-lg px-3 py-2 mb-3"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="block text-sm mb-1">{t.password}</label>
          <input
            className="w-full border rounded-lg px-3 py-2 mb-3"
            placeholder="••••••••"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-sm text-gray-500">{null}</span>
            <Link
              href={`/${locale}/bty/forgot-password`}
              className="text-sm text-gray-600 underline hover:no-underline hover:text-black"
            >
              {t.forgotPassword}
            </Link>
          </div>

          {error ? <div className="text-sm text-red-600 mb-3">{error}</div> : null}

          <button
            className="w-full rounded-lg px-4 py-2 bg-black text-white disabled:opacity-60"
            disabled={!canSubmit}
            type="submit"
          >
            {isLoading ? t.submitting : t.submit}
          </button>

          <div className="text-xs text-gray-500 mt-3">{t.cookieNotice}</div>
        </form>
      </div>
    </div>
  );
}

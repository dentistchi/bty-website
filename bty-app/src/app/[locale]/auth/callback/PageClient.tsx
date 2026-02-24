"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

function parseHashParams(hash: string): Record<string, string> {
  const params: Record<string, string> = {};
  if (!hash || !hash.startsWith("#")) return params;
  const q = hash.slice(1).split("&");
  for (const pair of q) {
    const [k, v] = pair.split("=");
    if (k && v) params[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, " "));
  }
  return params;
}

function AuthCallbackForm() {
  const pathname = usePathname() ?? "";
  const locale: Locale = pathname.startsWith("/ko") ? "ko" : "en";
  const t = getMessages(locale).auth;

  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!supabase) {
      setStatus("error");
      setMessage(t.callbackError);
      return;
    }
    const client = supabase;
    let mounted = true;

    async function run(supabaseClient: NonNullable<typeof supabase>) {
      const code = searchParams.get("code");
      const type = searchParams.get("type");
      const next = searchParams.get("next");

      if (code) {
        const { error } = await supabaseClient.auth.exchangeCodeForSession(code);
        if (!mounted) return;
        if (error) {
          setStatus("error");
          setMessage(t.callbackError);
          return;
        }
        if (type === "recovery") {
          router.replace("/auth/reset-password");
          return;
        }
        router.replace(next || "/admin/debug");
        return;
      }

      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const hashParams = parseHashParams(hash);
      const accessToken = hashParams.access_token || searchParams.get("access_token");
      const refreshToken = hashParams.refresh_token || searchParams.get("refresh_token");
      const recoveryType = hashParams.type || type;

      if (accessToken && refreshToken) {
        const { error } = await supabaseClient.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!mounted) return;
        if (error) {
          setStatus("error");
          setMessage(t.callbackError);
          return;
        }
        if (recoveryType === "recovery") {
          router.replace("/auth/reset-password");
          return;
        }
        router.replace(next || "/admin/debug");
        return;
      }

      setStatus("error");
      setMessage(t.callbackError);
    }

    run(client);
    return () => {
      mounted = false;
    };
  }, [router, searchParams]);

  if (status === "loading") {
    return (
      <div className="min-h-[40vh] flex items-center justify-center px-4">
        <p className="text-neutral-600">{t.loading}</p>
      </div>
    );
  }

  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center px-4">
      <p className="text-red-600 text-center">{message}</p>
      <Link
        href={locale === "ko" ? "/ko/bty/login" : "/en/bty/login"}
        className="mt-4 text-sm text-neutral-600 hover:text-neutral-900 underline"
      >
        {t.backToLogin}
      </Link>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex items-center justify-center px-4">
          <p className="text-neutral-600">Verifying…</p>
        </div>
      }
    >
      <AuthCallbackForm />
    </Suspense>
  );
}

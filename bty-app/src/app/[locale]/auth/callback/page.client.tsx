"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { inferLocaleFromNextParam, sanitizeNextForRedirect } from "@/lib/auth/sanitize-next-for-redirect";
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
  const locale = pathname.startsWith("/ko") ? "ko" : "en";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!supabase) {
      setStatus("error");
      setMessage("Supabase 환경변수가 설정되지 않았습니다.");
      return;
    }
    const client = supabase;
    let mounted = true;

    async function run(supabaseClient: NonNullable<typeof supabase>) {
      const code = searchParams.get("code");
      const type = searchParams.get("type");
      const next = searchParams.get("next");

      function redirectAfterSession() {
        const locFromPath = pathname.startsWith("/ko") ? "ko" : "en";
        const loc =
          next != null && String(next).trim() !== "" ? inferLocaleFromNextParam(next) : locFromPath;
        const safe = sanitizeNextForRedirect(next, { locale: loc });
        /**
         * Full navigation (not `router.replace`) so the next request to `/bty-arena` includes auth cookies.
         * Client-side transitions can fire RSC requests before chunked session cookies are visible to middleware.
         */
        if (typeof window !== "undefined") {
          window.location.assign(safe);
        } else {
          router.replace(safe);
        }
      }

      if (code) {
        const { error } = await supabaseClient.auth.exchangeCodeForSession(code);
        if (!mounted) return;
        if (error) {
          const { data: recovered } = await supabaseClient.auth.getSession();
          if (recovered.session?.user) {
            redirectAfterSession();
            return;
          }
          setStatus("error");
          setMessage("인증 처리에 실패했습니다. 다시 시도해주세요.");
          return;
        }
        await supabaseClient.auth.getSession();
        if (type === "recovery") {
          if (typeof window !== "undefined") {
            window.location.assign(`/${locale}/reset-password`);
          } else {
            router.replace(`/${locale}/reset-password`);
          }
          return;
        }
        redirectAfterSession();
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
          const { data: recovered } = await supabaseClient.auth.getSession();
          if (recovered.session?.user) {
            redirectAfterSession();
            return;
          }
          setStatus("error");
          setMessage("인증 처리에 실패했습니다. 다시 시도해주세요.");
          return;
        }
        if (recoveryType === "recovery") {
          if (typeof window !== "undefined") {
            window.location.assign(`/${locale}/reset-password`);
          } else {
            router.replace(`/${locale}/reset-password`);
          }
          return;
        }
        await supabaseClient.auth.getSession();
        redirectAfterSession();
        return;
      }

      const { data: existing } = await supabaseClient.auth.getSession();
      if (!mounted) return;
      if (existing.session?.user) {
        redirectAfterSession();
        return;
      }

      setStatus("error");
      setMessage("인증 처리에 실패했습니다. 다시 시도해주세요.");
    }

    run(client);
    return () => {
      mounted = false;
    };
  }, [pathname, router, searchParams]);

  if (status === "loading") {
    return (
      <div className="min-h-[40vh] flex items-center justify-center px-4">
        <p className="text-neutral-600">인증 처리 중...</p>
      </div>
    );
  }

  const nextParam = searchParams.get("next");
  const target =
    nextParam != null && nextParam.trim() !== ""
      ? `/${locale}/bty/login?next=${encodeURIComponent(nextParam)}`
      : `/${locale}/bty/login`;

  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center px-4">
      <p className="text-red-600 text-center">{message}</p>
      <Link
        href={target}
        className="mt-4 text-sm text-neutral-600 hover:text-neutral-900 underline"
      >
        로그인으로 돌아가기
      </Link>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex items-center justify-center px-4">
          <p className="text-neutral-600">인증 처리 중...</p>
        </div>
      }
    >
      <AuthCallbackForm />
    </Suspense>
  );
}

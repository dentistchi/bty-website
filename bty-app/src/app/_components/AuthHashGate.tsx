"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Status = "idle" | "processing" | "error";

export default function AuthHashGate() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    let mounted = true;

    async function checkSessionAndRedirect() {
      if (!mounted) return;
      try {
        const res = await fetch("/api/auth/session", { credentials: "include" });
        const data = await res.json();
        if (data?.ok && data?.hasSession) {
          window.location.href = "/bty";
        }
      } catch (err) {
        // 세션 체크 실패는 무시 (로그인 안 된 상태로 간주)
      }
    }

    async function run() {
      // Hash 처리 (recovery 등)
      if (hash) {
        setStatus("processing");
        const query = hash.replace(/^#/, "");
        const params = new URLSearchParams(query);
        const type = params.get("type");
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        const clearHash = () => {
          if (typeof window !== "undefined") {
            history.replaceState(
              null,
              "",
              window.location.pathname + window.location.search
            );
          }
        };

        const client = supabase;
        if (type === "recovery" && accessToken && refreshToken && client) {
          const { error } = await client.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          clearHash();
          if (!mounted) return;
          if (error) {
            setStatus("error");
            setErrorMessage("인증 처리 실패. 비밀번호 재설정을 다시 요청하세요.");
            return;
          }
          router.replace("/auth/reset-password");
          return;
        }

        if (type !== "recovery" && accessToken && refreshToken && client) {
          const { error } = await client.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          clearHash();
          if (!mounted) return;
          if (!error) {
            router.replace("/admin/debug");
          } else {
            setStatus("error");
            setErrorMessage("인증 처리에 실패했습니다.");
          }
          return;
        }

        clearHash();
        if (mounted) setStatus("idle");
        // Hash 처리 완료 후 세션 체크
        await checkSessionAndRedirect();
      } else {
        // Hash 없을 때: 바로 세션 체크
        await checkSessionAndRedirect();
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [router]);

  if (status === "processing") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 px-4">
        <p className="text-neutral-600">인증 처리 중...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95 px-4">
        <p className="text-red-600 text-center">{errorMessage}</p>
        <a
          href="/admin/login"
          className="mt-4 text-sm text-neutral-600 hover:text-neutral-900 underline"
        >
          로그인으로 돌아가기
        </a>
      </div>
    );
  }

  return null;
}

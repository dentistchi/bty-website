"use client";

import { useState } from "react";
import Link from "next/link";
import { fetchJson } from "@/lib/read-json";

export default function DebugPage() {
  const [testEmail, setTestEmail] = useState("");
  const [testPassword, setTestPassword] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [sessionCheck, setSessionCheck] = useState<string | null>(null);

  const testLogin = async () => {
    if (!testEmail || !testPassword) {
      setTestResult("이메일과 비밀번호를 입력해주세요.");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetchJson<{ token?: string; error?: string }>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail, password: testPassword }),
      });
      if (r.ok) {
        const data = r.json;
        setTestResult(`✅ 성공: ${JSON.stringify(data, null, 2)}`);
        if (data?.token) {
          localStorage.setItem("bty_auth_token", data.token);
          setTimeout(() => checkSession(data.token), 500);
        }
      } else {
        setTestResult(`❌ 실패 (${r.status}): ${r.json?.error ?? r.raw ?? ""}`);
      }
    } catch (e) {
      setTestResult(`❌ 네트워크 오류: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTesting(false);
    }
  };

  const checkSession = async (token?: string) => {
    const storedToken = token ?? (typeof localStorage !== "undefined" ? localStorage.getItem("bty_auth_token") : null);
    if (!storedToken) {
      setSessionCheck("토큰이 없습니다.");
      return;
    }
    try {
      const r = await fetchJson<Record<string, unknown>>(`/api/auth/session?_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      const data = r.ok ? r.json : null;
      setSessionCheck(
        r.ok && data
          ? `✅ 세션 확인: ${JSON.stringify(data, null, 2)}`
          : `❌ 세션 확인 실패: ${data ? JSON.stringify(data) : r.raw ?? ""}`
      );
    } catch (e) {
      setSessionCheck(`❌ 네트워크 오류: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">로그인 디버깅</h1>
          <p className="mt-1 text-sm text-neutral-600">
            로그인 문제를 진단하고 테스트할 수 있습니다.
          </p>
        </div>
        <Link
          href="/admin/quality"
          className="text-sm text-neutral-600 hover:text-neutral-900 underline"
        >
          Quality Events로 돌아가기
        </Link>
      </div>

      <div className="space-y-6">
        <div className="rounded border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-neutral-900">로그인 테스트</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700">이메일</label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700">비밀번호</label>
              <input
                type="password"
                value={testPassword}
                onChange={(e) => setTestPassword(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                placeholder="비밀번호"
              />
            </div>
            <button
              type="button"
              onClick={testLogin}
              disabled={testing}
              className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {testing ? "테스트 중..." : "로그인 테스트"}
            </button>
            {testResult && (
              <div className="mt-3 rounded bg-neutral-50 p-3">
                <pre className="whitespace-pre-wrap text-xs text-neutral-800">{testResult}</pre>
              </div>
            )}
          </div>
        </div>

        <div className="rounded border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-neutral-900">세션 확인</h2>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => checkSession()}
              className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              현재 세션 확인
            </button>
            {sessionCheck && (
              <div className="mt-3 rounded bg-neutral-50 p-3">
                <pre className="whitespace-pre-wrap text-xs text-neutral-800">{sessionCheck}</pre>
              </div>
            )}
          </div>
        </div>

        <div className="rounded border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <p className="font-semibold mb-2">디버깅 팁:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>브라우저 개발자 도구의 Network 탭에서 API 요청/응답을 확인하세요.</li>
            <li>Console 탭에서 서버 로그를 확인하세요 (서버 터미널).</li>
            <li>localStorage에 저장된 토큰을 확인하려면: <code className="bg-yellow-100 px-1 rounded">{`localStorage.getItem('bty_auth_token')`}</code></li>
            <li>토큰을 삭제하려면: <code className="bg-yellow-100 px-1 rounded">{`localStorage.removeItem('bty_auth_token')`}</code></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

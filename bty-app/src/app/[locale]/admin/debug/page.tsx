"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { fetchJson } from "@/lib/read-json";
import { safeParse } from "@/lib/safeParse";

type DebugResp = { ok: boolean; error?: string; where?: string };

type Report = {
  id: string;
  title: string;
  description: string | null;
  context: Record<string, unknown>;
  route: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
};

export default function DebugPage() {
  const [testEmail, setTestEmail] = useState("");
  const [testPassword, setTestPassword] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [sessionCheck, setSessionCheck] = useState<string | null>(null);

  // MVP 에러 제보
  const [reportTitle, setReportTitle] = useState("");
  const [reportDesc, setReportDesc] = useState("");
  const [reportRoute, setReportRoute] = useState<"chat" | "mentor" | "arena" | "other">("other");
  const [reportContext, setReportContext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  // 제보 목록
  const [reports, setReports] = useState<Report[]>([]);
  const [reportFilter, setReportFilter] = useState<"" | "open" | "resolved">("");
  const [loadingReports, setLoadingReports] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState<Record<string, string>>({});

  // 패치 배포
  const [patchDeploying, setPatchDeploying] = useState(false);
  const [patchResult, setPatchResult] = useState<{ ok: boolean; steps?: { step: string; ok: boolean; detail?: string }[]; hint?: string } | null>(null);

  const loadReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const qs = reportFilter ? `?status=${reportFilter}` : "";
      const r = await fetch(`/api/admin/debug/reports${qs}`, { credentials: "include" });
      const data = await r.json().catch(() => ({}));
      if (r.ok && Array.isArray(data.reports)) setReports(data.reports);
      else setReports([]);
    } catch {
      setReports([]);
    } finally {
      setLoadingReports(false);
    }
  }, [reportFilter]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

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
        return;
      }
      const errObj = safeParse<{ error?: string }>(r.raw);
      const errMsg = errObj?.error ?? r.raw ?? "";
      setTestResult(`❌ 실패 (${r.status}): ${errMsg}`);
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
      const r = await fetchJson<DebugResp>("/api/auth/session", {
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      const data = r.ok ? r.json : null;
      setSessionCheck(
        r.ok && data
          ? `✅ 세션 확인: ${JSON.stringify(data, null, 2)}`
          : `❌ 세션 확인 실패 (${r.status}): ${data ? JSON.stringify(data) : r.raw ?? ""}`
      );
    } catch (e) {
      setSessionCheck(`❌ 네트워크 오류: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const submitReport = async () => {
    const title = reportTitle.trim();
    if (!title) {
      setSubmitMsg("제목을 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      let context: Record<string, unknown> = {};
      if (reportContext.trim()) {
        const parsed = safeParse<Record<string, unknown>>(reportContext.trim());
        if (parsed && typeof parsed === "object") context = parsed;
      }
      const r = await fetch("/api/admin/debug/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title,
          description: reportDesc.trim() || undefined,
          route: reportRoute,
          context: Object.keys(context).length ? context : undefined,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        setReportTitle("");
        setReportDesc("");
        setReportContext("");
        setSubmitMsg("✅ 제보가 등록되었습니다.");
        loadReports();
      } else {
        setSubmitMsg(`❌ ${data.error || r.status}`);
      }
    } catch (e) {
      setSubmitMsg(`❌ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const resolveReport = async (id: string) => {
    setResolvingId(id);
    try {
      const note = resolutionNote[id] ?? "";
      const r = await fetch(`/api/admin/debug/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "resolved", resolution_note: note || undefined }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        setResolutionNote((prev) => ({ ...prev, [id]: "" }));
        loadReports();
      } else {
        console.error("[debug] resolve error:", data.error);
      }
    } finally {
      setResolvingId(null);
    }
  };

  const runPatchDeploy = async () => {
    setPatchDeploying(true);
    setPatchResult(null);
    try {
      const r = await fetch("/api/admin/debug/patch-deploy", {
        method: "POST",
        credentials: "include",
      });
      const data = await r.json().catch(() => ({}));
      setPatchResult({
        ok: data.ok ?? false,
        steps: data.steps,
        hint: data.hint,
      });
    } catch (e) {
      setPatchResult({ ok: false, steps: [], hint: e instanceof Error ? e.message : String(e) });
    } finally {
      setPatchDeploying(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">디버깅</h1>
          <p className="mt-1 text-sm text-neutral-600">
            로그인 테스트, MVP 에러 제보, 교정·패치 배포를 한 곳에서 처리합니다.
          </p>
        </div>
        <Link
          href="/admin/quality"
          className="text-sm text-neutral-600 hover:text-neutral-900 underline"
        >
          Quality Events
        </Link>
      </div>

      <div className="space-y-6">
        {/* MVP 에러 제보 */}
        <div className="rounded border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-neutral-900">에러 제보 (MVP)</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700">제목 *</label>
              <input
                type="text"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                placeholder="예: 챗봇이 특정 질문에 부적절 응답"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700">설명</label>
              <textarea
                value={reportDesc}
                onChange={(e) => setReportDesc(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                placeholder="재현 방법, 기대 동작 등"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700">구역</label>
              <select
                value={reportRoute}
                onChange={(e) => setReportRoute(e.target.value as "chat" | "mentor" | "arena" | "other")}
                className="mt-1 rounded border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="chat">챗봇</option>
                <option value="mentor">멘토</option>
                <option value="arena">아레나</option>
                <option value="other">기타</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700">상세(JSON, 선택)</label>
              <textarea
                value={reportContext}
                onChange={(e) => setReportContext(e.target.value)}
                rows={2}
                className="mt-1 w-full font-mono text-xs rounded border border-neutral-300 px-3 py-2 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                placeholder='{"user_message":"...","assistant_message":"..."}'
              />
            </div>
            <button
              type="button"
              onClick={submitReport}
              disabled={submitting}
              className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {submitting ? "등록 중..." : "제보 올리기"}
            </button>
            {submitMsg && (
              <p className="text-sm text-neutral-600">{submitMsg}</p>
            )}
          </div>
        </div>

        {/* 제보 목록 + 교정 완료 */}
        <div className="rounded border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-neutral-900">제보 목록</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setReportFilter("")}
              className={`rounded px-3 py-1.5 text-sm ${reportFilter === "" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}
            >
              전체
            </button>
            <button
              type="button"
              onClick={() => setReportFilter("open")}
              className={`rounded px-3 py-1.5 text-sm ${reportFilter === "open" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}
            >
              미해결
            </button>
            <button
              type="button"
              onClick={() => setReportFilter("resolved")}
              className={`rounded px-3 py-1.5 text-sm ${reportFilter === "resolved" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}
            >
              해결됨
            </button>
          </div>
          {loadingReports ? (
            <p className="text-sm text-neutral-500">로딩 중...</p>
          ) : reports.length === 0 ? (
            <p className="text-sm text-neutral-500">제보가 없습니다.</p>
          ) : (
            <ul className="space-y-3">
              {reports.map((r) => (
                <li
                  key={r.id}
                  className={`rounded border p-4 ${r.status === "resolved" ? "border-neutral-100 bg-neutral-50" : "border-neutral-200 bg-white"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <span className="font-medium text-neutral-900">{r.title}</span>
                      {r.route && (
                        <span className="ml-2 rounded bg-neutral-200 px-1.5 py-0.5 text-xs text-neutral-600">
                          {r.route}
                        </span>
                      )}
                      {r.status === "resolved" && (
                        <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">
                          해결됨
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-neutral-500">
                      {new Date(r.created_at).toLocaleString("ko-KR")}
                    </span>
                  </div>
                  {r.description && (
                    <p className="mt-1 text-sm text-neutral-600">{r.description}</p>
                  )}
                  {r.status === "resolved" && r.resolution_note && (
                    <p className="mt-2 text-sm text-emerald-700">교정 메모: {r.resolution_note}</p>
                  )}
                  {r.status === "open" && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={resolutionNote[r.id] ?? ""}
                        onChange={(e) => setResolutionNote((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        placeholder="교정 메모 (선택)"
                        className="rounded border border-neutral-300 px-2 py-1 text-sm w-48"
                      />
                      <button
                        type="button"
                        onClick={() => resolveReport(r.id)}
                        disabled={resolvingId === r.id}
                        className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {resolvingId === r.id ? "처리 중..." : "교정 완료"}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 패치 배포 (클릭 하나로) */}
        <div className="rounded border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-neutral-900">패치 배포</h2>
          <p className="mb-3 text-sm text-neutral-600">
            패치 생성(bty-ai-core)과 배포 웹훅을 한 번에 실행합니다. DEPLOY_WEBHOOK_URL을 설정하면 실제 배포가 트리거됩니다.
          </p>
          <button
            type="button"
            onClick={runPatchDeploy}
            disabled={patchDeploying}
            className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {patchDeploying ? "실행 중..." : "패치 생성 및 배포"}
          </button>
          {patchResult && (
            <div className="mt-3 rounded bg-neutral-50 p-3 text-sm">
              <p className={patchResult.ok ? "text-emerald-700 font-medium" : "text-amber-700"}>
                {patchResult.ok ? "✅ 완료" : "⚠️ 일부 단계 실패"}
              </p>
              {patchResult.steps?.map((s, i) => (
                <p key={i} className="mt-1 text-neutral-600">
                  {s.step}: {s.ok ? "OK" : "FAIL"} {s.detail && `— ${s.detail}`}
                </p>
              ))}
              {patchResult.hint && (
                <p className="mt-2 text-xs text-neutral-500">{patchResult.hint}</p>
              )}
            </div>
          )}
        </div>

        {/* 로그인 테스트 */}
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

        <div className="rounded border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <p className="mb-2 font-semibold">디버깅 팁</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>에러 제보 후 제보 목록에서 「교정 완료」로 처리하고, 「패치 생성 및 배포」로 한 번에 반영할 수 있습니다.</li>
            <li>DEPLOY_WEBHOOK_URL: Cloudflare Pages Deploy Hook URL 또는 배포 트리거용 URL을 넣으면 클릭 시 배포가 실행됩니다.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

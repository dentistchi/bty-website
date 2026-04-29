"use client";

import { useState, useEffect, useCallback, Fragment } from "react";

import { useParams } from "next/navigation";
import { fetchJson } from "@/lib/read-json";
import { safeParse } from "@/lib/safeParse";
import { LoadingFallback, CardSkeleton } from "@/components/bty-arena";
import { getDebugCopy, type DebugLocale } from "./debugCopy";

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
  const params = useParams();
  const locale: DebugLocale =
    typeof params?.locale === "string" && params.locale === "ko" ? "ko" : "en";
  const t = getDebugCopy(locale);
  const dateLocale = locale === "ko" ? "ko-KR" : "en-US";

  const [testEmail, setTestEmail] = useState("");
  const [testPassword, setTestPassword] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [sessionCheck, setSessionCheck] = useState<string | null>(null);

  const [reportTitle, setReportTitle] = useState("");
  const [reportDesc, setReportDesc] = useState("");
  const [reportRoute, setReportRoute] = useState<"chat" | "mentor" | "arena" | "other">("other");
  const [reportContext, setReportContext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  const [reports, setReports] = useState<Report[]>([]);
  const [reportFilter, setReportFilter] = useState<"" | "open" | "resolved">("");
  const [loadingReports, setLoadingReports] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState<Record<string, string>>({});

  const [patchDeploying, setPatchDeploying] = useState(false);
  const [patchResult, setPatchResult] = useState<{
    ok: boolean;
    steps?: { step: string; ok: boolean; detail?: string }[];
    hint?: string;
  } | null>(null);

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
      setTestResult(t.needCredentials);
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
        setTestResult(`${t.loginOkPrefix}${JSON.stringify(data, null, 2)}`);
        if (data?.token) {
          localStorage.setItem("bty_auth_token", data.token);
          setTimeout(() => checkSession(data.token), 500);
        }
        return;
      }
      const errObj = safeParse<{ error?: string }>(r.raw);
      const errMsg = errObj?.error ?? r.raw ?? "";
      setTestResult(`${t.loginFailPrefix}${r.status}): ${errMsg}`);
    } catch (e) {
      setTestResult(`${t.networkErrorPrefix}${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTesting(false);
    }
  };

  const checkSession = async (token?: string) => {
    const storedToken = token ?? (typeof localStorage !== "undefined" ? localStorage.getItem("bty_auth_token") : null);
    if (!storedToken) {
      setSessionCheck(t.noToken);
      return;
    }
    try {
      const r = await fetchJson<DebugResp>("/api/auth/session", {
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      const data = r.ok ? r.json : null;
      setSessionCheck(
        r.ok && data
          ? `${t.sessionOkPrefix}${JSON.stringify(data, null, 2)}`
          : `${t.sessionFailPrefix}${r.status}): ${data ? JSON.stringify(data) : r.raw ?? ""}`
      );
    } catch (e) {
      setSessionCheck(`${t.networkErrorPrefix}${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const submitReport = async () => {
    const title = reportTitle.trim();
    if (!title) {
      setSubmitMsg(t.needTitle);
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
        setSubmitMsg(t.reportSubmitted);
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
    <main className="container mx-auto max-w-4xl px-4 py-8" aria-label={t.mainRegionAria}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{t.title}</h1>
          <p className="mt-1 text-sm text-neutral-600">{t.subtitle}</p>
        </div>

      </div>

      <div className="space-y-6">
        <section
          className="rounded border border-neutral-200 bg-white p-6 shadow-sm"
          role="region"
          aria-label={t.regionMvp}
        >
          <h2 className="mb-4 text-lg font-medium text-neutral-900">{t.mvpTitle}</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700">{t.titleLabel}</label>
              <input
                type="text"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                placeholder={t.titlePh}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700">{t.descLabel}</label>
              <textarea
                value={reportDesc}
                onChange={(e) => setReportDesc(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                placeholder={t.descPh}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700">{t.routeLabel}</label>
              <select
                value={reportRoute}
                onChange={(e) => setReportRoute(e.target.value as "chat" | "mentor" | "arena" | "other")}
                className="mt-1 rounded border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="chat">{t.routeChat}</option>
                <option value="mentor">{t.routeMentor}</option>
                <option value="arena">{t.routeArena}</option>
                <option value="other">{t.routeOther}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700">{t.contextLabel}</label>
              <textarea
                value={reportContext}
                onChange={(e) => setReportContext(e.target.value)}
                rows={2}
                className="mt-1 w-full font-mono text-xs rounded border border-neutral-300 px-3 py-2 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                placeholder={t.contextPh}
              />
            </div>
            <button
              type="button"
              onClick={submitReport}
              disabled={submitting}
              className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              aria-label={submitting ? t.submitReportAriaBusy : t.submitReportAriaIdle}
            >
              {submitting ? t.submittingReport : t.submitReport}
            </button>
            {submitting && (
              <div aria-busy="true" aria-label={t.submitBusyRegionAria}>
                <CardSkeleton showLabel={false} lines={1} style={{ padding: "12px 16px", marginTop: 12 }} />
              </div>
            )}
            {submitMsg && (
              <p className="text-sm text-neutral-600">{submitMsg}</p>
            )}
          </div>
        </section>

        <section
          className="rounded border border-neutral-200 bg-white p-6 shadow-sm"
          role="region"
          aria-label={t.regionList}
        >
          <h2 className="mb-4 text-lg font-medium text-neutral-900">{t.listTitle}</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setReportFilter("")}
              className={`rounded px-3 py-1.5 text-sm ${reportFilter === "" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}
              aria-label={t.filterAllAria}
            >
              {t.filterAll}
            </button>
            <button
              type="button"
              onClick={() => setReportFilter("open")}
              className={`rounded px-3 py-1.5 text-sm ${reportFilter === "open" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}
              aria-label={t.filterOpenAria}
            >
              {t.filterOpen}
            </button>
            <button
              type="button"
              onClick={() => setReportFilter("resolved")}
              className={`rounded px-3 py-1.5 text-sm ${reportFilter === "resolved" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}
              aria-label={t.filterResolvedAria}
            >
              {t.filterResolved}
            </button>
          </div>
          {loadingReports ? (
            <LoadingFallback
              icon="📋"
              message={t.loadingList}
              withSkeleton
              style={{ padding: "32px 20px" }}
            />
          ) : reports.length === 0 ? (
            <p className="text-sm text-neutral-500">{t.noReports}</p>
          ) : (
            <ul className="space-y-3">
              {reports.map((r) => (
                <Fragment key={r.id}>
                  <li
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
                            {t.resolvedBadge}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-neutral-500">
                        {new Date(r.created_at).toLocaleString(dateLocale)}
                      </span>
                    </div>
                    {r.description && (
                      <p className="mt-1 text-sm text-neutral-600">{r.description}</p>
                    )}
                    {r.status === "resolved" && r.resolution_note && (
                      <p className="mt-2 text-sm text-emerald-700">
                        {t.resolutionNotePrefix}
                        {r.resolution_note}
                      </p>
                    )}
                    {r.status === "open" && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={resolutionNote[r.id] ?? ""}
                          onChange={(e) => setResolutionNote((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          placeholder={t.resolutionNotePh}
                          className="rounded border border-neutral-300 px-2 py-1 text-sm w-48"
                        />
                        <button
                          type="button"
                          onClick={() => resolveReport(r.id)}
                          disabled={resolvingId === r.id}
                          className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                          aria-label={resolvingId === r.id ? t.resolveAriaBusy : t.resolveAriaIdle}
                        >
                          {resolvingId === r.id ? t.resolving : t.resolveDone}
                        </button>
                      </div>
                    )}
                  </li>
                  {resolvingId === r.id && (
                    <li aria-busy="true" aria-label={t.resolvingRegionAria}>
                      <CardSkeleton showLabel={false} lines={2} style={{ padding: "16px 20px" }} />
                    </li>
                  )}
                </Fragment>
              ))}
            </ul>
          )}
        </section>

        <section
          className="rounded border border-neutral-200 bg-white p-6 shadow-sm"
          role="region"
          aria-label={t.regionPatch}
        >
          <h2 className="mb-4 text-lg font-medium text-neutral-900">{t.patchTitle}</h2>
          <p className="mb-3 text-sm text-neutral-600">{t.patchDesc}</p>
          <button
            type="button"
            onClick={runPatchDeploy}
            disabled={patchDeploying}
            className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            aria-label={patchDeploying ? t.patchAriaBusy : t.patchAriaIdle}
          >
            {patchDeploying ? t.patchRunning : t.patchRun}
          </button>
          {patchDeploying && (
            <div className="mt-3" aria-busy="true" aria-label={t.patchBusyRegionAria}>
              <CardSkeleton showLabel={false} lines={2} style={{ padding: "16px 20px" }} />
            </div>
          )}
          {patchResult && (
            <div className="mt-3 rounded bg-neutral-50 p-3 text-sm">
              <p className={patchResult.ok ? "text-emerald-700 font-medium" : "text-amber-700"}>
                {patchResult.ok ? t.patchOk : t.patchWarn}
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
        </section>

        <section
          className="rounded border border-neutral-200 bg-white p-6 shadow-sm"
          role="region"
          aria-label={t.regionLogin}
        >
          <h2 className="mb-4 text-lg font-medium text-neutral-900">{t.loginTitle}</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700">{t.emailLabel}</label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700">{t.passwordLabel}</label>
              <input
                type="password"
                value={testPassword}
                onChange={(e) => setTestPassword(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                placeholder={t.passwordPh}
              />
            </div>
            <button
              type="button"
              onClick={testLogin}
              disabled={testing}
              className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              aria-label={testing ? t.loginTestAriaBusy : t.loginTestAriaIdle}
            >
              {testing ? t.loginTesting : t.loginTest}
            </button>
            {testing && (
              <div className="mt-3" aria-busy="true" aria-label={t.loginBusyRegionAria}>
                <CardSkeleton showLabel={false} lines={1} style={{ padding: "12px 16px" }} />
              </div>
            )}
            {testResult && (
              <div className="mt-3 rounded bg-neutral-50 p-3">
                <pre className="whitespace-pre-wrap text-xs text-neutral-800">{testResult}</pre>
              </div>
            )}
          </div>
        </section>

        <section
          className="rounded border border-neutral-200 bg-white p-6 shadow-sm"
          role="region"
          aria-label={t.regionSession}
        >
          <h2 className="mb-4 text-lg font-medium text-neutral-900">{t.sessionTitle}</h2>
          <button
            type="button"
            onClick={() => checkSession()}
            className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            aria-label={t.sessionCheckAria}
          >
            {t.sessionCheck}
          </button>
          {sessionCheck && (
            <div className="mt-3 rounded bg-neutral-50 p-3">
              <pre className="whitespace-pre-wrap text-xs text-neutral-800">{sessionCheck}</pre>
            </div>
          )}
        </section>

        <section
          className="rounded border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800"
          role="region"
          aria-label={t.regionTips}
        >
          <p className="mb-2 font-semibold">{t.tipsTitle}</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>{t.tips1}</li>
            <li>{t.tips2}</li>
          </ul>
        </section>
      </div>
    </main>
  );
}

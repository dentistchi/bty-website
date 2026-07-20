"use client";

import { useState, useEffect, useCallback, Fragment } from "react";

import { useParams } from "next/navigation";
import { EmptyState, LoadingFallback, CardSkeleton } from "@/components/bty-arena";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type RequestRow = {
  id: number;
  user_id: string;
  fullName?: string | null;
  job_function: string;
  joined_at: string;
  leader_started_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type ListResp = { requests: RequestRow[]; error?: string };

export default function AdminArenaMembershipPage() {
  const params = useParams();
  const locale = (typeof params?.locale === "string" ? params.locale : "en") as Locale;
  const messages = getMessages(locale);
  const t = messages.adminArenaMembership;
  const loadingMessage = messages.loading.message;
  const a = `/${locale}/admin`;
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  // Non-blocking result of the canonical membership write-through (Slice 3.1A-2).
  const [canonicalNotice, setCanonicalNotice] = useState<"ok" | "reconciliation_pending" | null>(null);
  const identityCopy =
    locale === "ko"
      ? {
          ok: "승인됨. 표준 회원 신원이 생성되었습니다.",
          pending: "승인됨. 회원 접근은 활성이지만 표준 신원에 정합 작업이 필요합니다.",
          link: "회원 신원",
        }
      : {
          ok: "Approved. Canonical member identity created.",
          pending: "Approved. Member access is active, but canonical identity needs reconciliation.",
          link: "Member Identity",
        };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/arena/membership-requests", { credentials: "include" });
      const data: ListResp = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError((data as { error?: string }).error ?? `HTTP ${r.status}`);
        setRequests([]);
        return;
      }
      setRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (id: number) => {
    setApprovingId(id);
    try {
      const r = await fetch(`/api/admin/arena/membership-requests/${id}/approve`, {
        method: "PATCH",
        credentials: "include",
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && (data as { ok?: boolean }).ok) {
        // Approval succeeded. Surface the canonical write-through result non-blockingly —
        // reconciliation_pending must NOT imply the approval failed (access is active).
        const canonical = (data as { canonicalMembership?: string }).canonicalMembership;
        setCanonicalNotice(canonical === "reconciliation_pending" ? "reconciliation_pending" : "ok");
        await load();
      } else {
        setError((data as { error?: string }).error ?? `Approve failed ${r.status}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8" aria-label={t.mainRegionAria}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{t.title}</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {t.description}
          </p>
        </div>

      </div>

      {canonicalNotice === "ok" && (
        <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" data-testid="canonical-notice-ok">
          {identityCopy.ok}
        </div>
      )}
      {canonicalNotice === "reconciliation_pending" && (
        <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" data-testid="canonical-notice-pending">
          {identityCopy.pending}{" "}
          <a href={`/${locale}/admin/arena-identity`} className="font-medium underline" data-testid="canonical-notice-link">
            {identityCopy.link}
          </a>
        </div>
      )}

      <div className="rounded border border-neutral-200 bg-white p-6 shadow-sm">
        {loading && (
          <LoadingFallback
            icon="📋"
            message={loadingMessage}
            withSkeleton
            style={{ padding: "32px 20px" }}
          />
        )}
        {error && (
          <p className="mb-4 text-sm text-red-600">{error}</p>
        )}
        {/* DESIGN_FIRST_IMPRESSION_BRIEF §2·PROJECT_BACKLOG §8: 데이터 없을 때 일러·아이콘 + 한 줄 문구 */}
        {!loading && requests.length === 0 && !error && (
          <EmptyState
            icon="📋"
            message={t.emptyNoPending}
            style={{ padding: "32px 20px" }}
          />
        )}
        {!loading && requests.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="pb-2 pr-4 font-medium">ID</th>
                  <th className="pb-2 pr-4 font-medium">user_id</th>
                  <th className="pb-2 pr-4 font-medium">{t.colJobFunction}</th>
                  <th className="pb-2 pr-4 font-medium">{t.colJoinedAt}</th>
                  <th className="pb-2 pr-4 font-medium">{t.colLeaderStartedAt}</th>
                  <th className="pb-2 pr-4 font-medium">{t.colRequestedAt}</th>
                  <th className="pb-2 font-medium">{t.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((row) => (
                  <Fragment key={row.id}>
                    <tr className="border-b border-neutral-100">
                      <td className="py-2 pr-4">{row.id}</td>
                      <td className={`py-2 pr-4 text-xs ${row.fullName ? "" : "font-mono"}`}>{row.fullName ?? row.user_id}</td>
                      <td className="py-2 pr-4">{row.job_function}</td>
                      <td className="py-2 pr-4">{row.joined_at}</td>
                      <td className="py-2 pr-4">{row.leader_started_at ?? "—"}</td>
                      <td className="py-2 pr-4">{row.created_at.slice(0, 10)}</td>
                      <td className="py-2">
                        <button
                          type="button"
                          disabled={approvingId === row.id}
                          onClick={() => approve(row.id)}
                          className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 hover:bg-neutral-700"
                          aria-label={approvingId === row.id ? t.approving : t.approveAria}
                        >
                          {approvingId === row.id ? t.approving : t.approve}
                        </button>
                      </td>
                    </tr>
                    {approvingId === row.id && (
                      <tr>
                        <td colSpan={7} className="py-2">
                          <CardSkeleton showLabel={false} lines={1} style={{ padding: "12px 16px", maxWidth: 320 }} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>


    </main>
  );
}

"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EmptyState, LoadingFallback, CardSkeleton } from "@/components/bty-arena";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type RequestRow = {
  id: number;
  user_id: string;
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
          <h1 className="text-2xl font-semibold text-neutral-900">Arena 멤버십 승인</h1>
          <p className="mt-1 text-sm text-neutral-600">
            pending 요청을 검토한 뒤 승인합니다. 승인 시 해당 유저의 tenure(입사일·리더시작일)가 반영됩니다.
          </p>
        </div>
        <Link href={`${a}/debug`} className="text-sm text-neutral-600 underline hover:text-neutral-900">
          디버깅
        </Link>
      </div>

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
            message="대기 중인 요청이 없습니다."
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
                  <th className="pb-2 pr-4 font-medium">직군</th>
                  <th className="pb-2 pr-4 font-medium">입사일</th>
                  <th className="pb-2 pr-4 font-medium">리더시작일</th>
                  <th className="pb-2 pr-4 font-medium">요청일</th>
                  <th className="pb-2 font-medium">동작</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((row) => (
                  <Fragment key={row.id}>
                    <tr className="border-b border-neutral-100">
                      <td className="py-2 pr-4">{row.id}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{row.user_id}</td>
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
                          aria-label={approvingId === row.id ? "처리 중…" : "멤버십 승인"}
                        >
                          {approvingId === row.id ? "처리 중…" : "승인"}
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

      <div className="mt-4 rounded border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
        <p>
          <Link href={`${a}/users`} className="hover:text-neutral-900 underline">
            사용자 관리
          </Link>
          {" · "}
          <Link href={`${a}/organizations`} className="hover:text-neutral-900 underline">
            조직
          </Link>
          {" · "}
          <Link href={`${a}/arena-membership`} className="hover:text-neutral-900 underline">
            Arena 멤버십 승인
          </Link>
          {" · "}
          <Link href={`${a}/sql-migrations`} className="hover:text-neutral-900 underline">
            SQL 복사
          </Link>
          {" · "}
          <Link href={`${a}/debug`} className="hover:text-neutral-900 underline">
            디버깅
          </Link>
          {" · "}
          <Link href={`${a}/quality`} className="hover:text-neutral-900 underline">
            Quality
          </Link>
        </p>
      </div>
    </main>
  );
}

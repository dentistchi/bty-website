"use client";

/**
 * Admin: 멘토 대화 신청 큐·승인 UI (PHASE_4_ELITE_5_PERCENT_SPEC §10 3차).
 * Render-only: queue·에러는 GET /api/arena/mentor-requests 응답만 표시. 승인/거절은 PATCH API 호출 후 refetch.
 */
import { useState, useEffect, useCallback, Fragment } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EmptyState, LoadingFallback, CardSkeleton } from "@/components/bty-arena";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type QueueItem = {
  id: string;
  userId: string;
  status: string;
  message?: string;
  mentorId: string;
  createdAt: string;
};

type ListResp = { queue: QueueItem[]; error?: string };

export default function AdminMentorRequestsPage() {
  const params = useParams();
  const locale = (typeof params?.locale === "string" ? params.locale : "en") as Locale;
  const t = getMessages(locale).mentorRequestAdmin;
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [actingStatus, setActingStatus] = useState<"approved" | "rejected" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/arena/mentor-requests", { credentials: "include" });
      const data: ListResp = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError((data as { error?: string }).error ?? t.error);
        setQueue([]);
        return;
      }
      setQueue(Array.isArray(data.queue) ? data.queue : []);
    } catch {
      setError(t.error);
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }, [t.error]);

  useEffect(() => {
    load();
  }, [load]);

  const respond = async (id: string, status: "approved" | "rejected") => {
    setActingId(id);
    setActingStatus(status);
    setError(null);
    try {
      const r = await fetch(`/api/arena/mentor-requests/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && (data as { ok?: boolean }).ok) {
        await load();
      } else {
        setError((data as { error?: string }).error ?? t.error);
      }
    } catch {
      setError(t.error);
    } finally {
      setActingId(null);
      setActingStatus(null);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{t.title}</h1>
          <p className="mt-1 text-sm text-neutral-600">{t.description}</p>
        </div>
        <Link
          href={`/${locale}/admin/debug`}
          className="text-sm text-neutral-600 underline hover:text-neutral-900"
        >
          {locale === "ko" ? "디버깅" : "Debug"}
        </Link>
      </div>

      <div className="rounded border border-neutral-200 bg-white p-6 shadow-sm">
        {loading && (
          <LoadingFallback
            icon="✉️"
            message={t.loading}
            withSkeleton
            style={{ padding: "32px 20px" }}
          />
        )}
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        {/* DESIGN_FIRST_IMPRESSION_BRIEF §2: 데이터 없을 때 일러·아이콘 + 한 줄 문구 */}
        {!loading && queue.length === 0 && !error && (
          <EmptyState icon="✉️" message={t.empty} style={{ padding: "32px 20px" }} />
        )}
        {!loading && queue.length > 0 && (
          <div className="overflow-x-auto" role="region" aria-label={t.title}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="pb-2 pr-4 font-medium">{t.userId}</th>
                  <th className="pb-2 pr-4 font-medium">{t.createdAt}</th>
                  <th className="pb-2 pr-4 font-medium">{t.message}</th>
                  <th className="pb-2 font-medium">{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((row) => (
                  <Fragment key={row.id}>
                    <tr className="border-b border-neutral-100">
                      <td className="py-2 pr-4 font-mono text-xs">{row.userId}</td>
                      <td className="py-2 pr-4">{row.createdAt.slice(0, 19).replace("T", " ")}</td>
                      <td className="py-2 pr-4 max-w-[200px] truncate">{row.message ?? "—"}</td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={actingId === row.id}
                            aria-label={actingId === row.id && actingStatus === "approved" ? t.approving : `${t.approve} ${row.id}`}
                            onClick={() => respond(row.id, "approved")}
                            className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 hover:bg-neutral-700"
                          >
                            {actingId === row.id && actingStatus === "approved" ? t.approving : t.approve}
                          </button>
                          <button
                            type="button"
                            disabled={actingId === row.id}
                            aria-label={actingId === row.id && actingStatus === "rejected" ? t.rejecting : `${t.reject} ${row.id}`}
                            onClick={() => respond(row.id, "rejected")}
                            className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 disabled:opacity-50 hover:bg-neutral-50"
                          >
                            {actingId === row.id && actingStatus === "rejected" ? t.rejecting : t.reject}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {actingId === row.id && (
                      <tr>
                        <td colSpan={4} className="py-2">
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
          <Link href={`/${locale}/admin/users`} className="underline hover:text-neutral-900">
            {locale === "ko" ? "사용자 관리" : "Users"}
          </Link>
          {" · "}
          <Link href={`/${locale}/admin/arena-membership`} className="underline hover:text-neutral-900">
            {locale === "ko" ? "Arena 멤버십 승인" : "Arena membership"}
          </Link>
          {" · "}
          <Link href={`/${locale}/admin/mentor-requests`} className="underline hover:text-neutral-900">
            {t.title}
          </Link>
          {" · "}
          <Link href={`/${locale}/admin/debug`} className="underline hover:text-neutral-900">
            {locale === "ko" ? "디버깅" : "Debug"}
          </Link>
        </p>
      </div>
    </div>
  );
}

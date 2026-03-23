"use client";

/**
 * Foundry Elite: Certified Leader (LE/LRI via GET /api/arena/leadership-engine/certified) +
 * Dr. Chi 1:1 mentor request queue (admin/mentor email via GET/PATCH /api/arena/mentor-requests).
 * Render-only for certified; queue list from API; approve/reject only when queue GET succeeds (403 otherwise).
 */

import React from "react";
import { useParams } from "next/navigation";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { arenaFetch } from "@/lib/http/arenaFetch";

export const MENTOR_REQUEST_RESOLVED_EVENT = "mentor_request_resolved" as const;

export type MentorRequestResolvedDetail = {
  id: string;
  status: "approved" | "rejected";
  userId: string;
  respondedAt?: string;
};

type CertifiedApi = {
  current: boolean;
  reasons_met?: string[];
  reasons_missing?: string[];
};

type QueueItem = {
  id: string;
  userId: string;
  status: string;
  message?: string;
  mentorId: string;
  createdAt: string;
  updatedAt?: string;
  respondedAt?: string;
};

type QueueListResp = { queue: QueueItem[] };

function dispatchMentorRequestResolved(detail: MentorRequestResolvedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(MENTOR_REQUEST_RESOLVED_EVENT, { detail }));
}

/** Best-effort: notify Dr. Chi pipeline after mentor approves (mentor session). */
async function pingDrChiOnApprove(locale: Locale, applicantUserId: string) {
  const isKo = locale === "ko";
  const message = isKo
    ? `[멘토 큐] Elite Dr. Chi 1:1 신청이 승인되었습니다. 신청자 user: ${applicantUserId}. 후속 1:1 안내를 준비해 주세요.`
    : `[Mentor queue] Elite Dr. Chi 1:1 request approved. Applicant user: ${applicantUserId}. Please prepare follow-up.`;
  try {
    await fetch("/api/mentor", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        messages: [] as { role: string; content: string }[],
        lang: isKo ? "ko" : "en",
      }),
    });
  } catch {
    /* non-blocking */
  }
}

export function EliteSpecWidget() {
  const params = useParams();
  const locale = (typeof params?.locale === "string" ? params.locale : "en") as Locale;
  const t = getMessages(locale).bty;
  const tAdmin = getMessages(locale).mentorRequestAdmin;

  const [certLoading, setCertLoading] = React.useState(true);
  const [certError, setCertError] = React.useState<string | null>(null);
  const [certified, setCertified] = React.useState<boolean | null>(null);

  const [queueLoading, setQueueLoading] = React.useState(true);
  const [queueError, setQueueError] = React.useState<string | null>(null);
  const [queueForbidden, setQueueForbidden] = React.useState(false);
  const [queue, setQueue] = React.useState<QueueItem[]>([]);
  const [actingId, setActingId] = React.useState<string | null>(null);
  const [actingKind, setActingKind] = React.useState<"approved" | "rejected" | null>(null);

  const canModerate = !queueForbidden && !queueError && !queueLoading;

  const loadQueue = React.useCallback(async () => {
    setQueueLoading(true);
    setQueueError(null);
    setQueueForbidden(false);
    try {
      const r = await fetch("/api/arena/mentor-requests?scope=all", { credentials: "include" });
      const data = (await r.json().catch(() => ({}))) as QueueListResp & { error?: string };
      if (r.status === 403) {
        setQueueForbidden(true);
        setQueue([]);
        return;
      }
      if (!r.ok) {
        setQueueError(data.error ?? t.eliteSpecWidgetError);
        setQueue([]);
        return;
      }
      setQueue(Array.isArray(data.queue) ? data.queue : []);
    } catch {
      setQueueError(t.eliteSpecWidgetError);
      setQueue([]);
    } finally {
      setQueueLoading(false);
    }
  }, [t.eliteSpecWidgetError]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      setCertLoading(true);
      setCertError(null);
      try {
        const data = await arenaFetch<CertifiedApi>("/api/arena/leadership-engine/certified");
        if (!alive) return;
        setCertified(Boolean(data?.current));
      } catch {
        if (alive) {
          setCertError(t.eliteSpecWidgetError);
          setCertified(null);
        }
      } finally {
        if (alive) setCertLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [t.eliteSpecWidgetError]);

  React.useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const statusLabel = (s: string) => {
    if (s === "pending") return t.eliteSpecWidgetStatusPending;
    if (s === "approved") return t.eliteSpecWidgetStatusApproved;
    if (s === "rejected") return t.eliteSpecWidgetStatusRejected;
    return s;
  };

  const respond = async (row: QueueItem, status: "approved" | "rejected") => {
    setActingId(row.id);
    setActingKind(status);
    setQueueError(null);
    try {
      const r = await fetch(`/api/arena/mentor-requests/${row.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        respondedAt?: string;
      };
      if (r.ok && data.ok) {
        if (status === "approved") {
          void pingDrChiOnApprove(locale, row.userId);
        }
        dispatchMentorRequestResolved({
          id: row.id,
          status,
          userId: row.userId,
          respondedAt: data.respondedAt,
        });
        await loadQueue();
      } else {
        setQueueError(data.error ?? tAdmin.errorPatch);
      }
    } catch {
      setQueueError(tAdmin.errorPatch);
    } finally {
      setActingId(null);
      setActingKind(null);
    }
  };

  const busy = certLoading || queueLoading;

  return (
    <section
      className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
      aria-label={t.eliteSpecWidgetRegionAria}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span
          className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-900"
          aria-label={t.eliteSpecWidgetCertifiedBadge}
        >
          {t.eliteSpecWidgetCertifiedBadge}
        </span>
        {certLoading && (
          <span className="text-sm text-neutral-500" aria-busy="true">
            {t.eliteSpecWidgetLoading}
          </span>
        )}
        {!certLoading && certError && (
          <span className="text-sm text-red-600" role="alert">
            {certError}
          </span>
        )}
        {!certLoading && !certError && (
          <span className="text-sm text-neutral-700">
            {certified ? t.eliteSpecWidgetCertifiedYes : t.eliteSpecWidgetCertifiedNo}
          </span>
        )}
      </div>
      <p className="mb-4 text-xs text-neutral-500">{t.eliteSpecWidgetLriHint}</p>

      <h2 className="mb-2 text-base font-semibold text-neutral-900">{t.eliteSpecWidgetQueueTitle}</h2>
      {queueLoading && (
        <p className="text-sm text-neutral-500" aria-busy="true">
          {t.eliteSpecWidgetLoading}
        </p>
      )}
      {queueError && (
        <p className="text-sm text-red-600" role="alert">
          {queueError}
        </p>
      )}
      {queueForbidden && !queueLoading && (
        <p className="text-sm text-neutral-600">{t.eliteSpecWidgetQueueForbidden}</p>
      )}
      {!queueLoading && !queueError && !queueForbidden && queue.length === 0 && (
        <p className="text-sm text-neutral-600">{tAdmin.empty}</p>
      )}
      {!queueLoading && !queueError && !queueForbidden && queue.length > 0 && (
        <div className="overflow-x-auto" role="region" aria-label={tAdmin.queueTableAria}>
          <table className="w-full text-left text-sm">
            <caption className="sr-only mb-2 text-left text-neutral-600">{tAdmin.tableCaption}</caption>
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="pb-2 pr-3 font-medium">{tAdmin.userId}</th>
                <th className="pb-2 pr-3 font-medium">{tAdmin.createdAt}</th>
                <th className="pb-2 pr-3 font-medium">{tAdmin.colStatus}</th>
                <th className="pb-2 pr-3 font-medium">{tAdmin.message}</th>
                <th className="pb-2 font-medium">{tAdmin.actions}</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((row) => (
                <tr key={row.id} className="border-b border-neutral-100">
                  <th
                    scope="row"
                    className="max-w-[140px] truncate py-2 pr-3 text-left font-mono text-xs font-normal"
                    title={row.userId}
                  >
                    {row.userId}
                  </th>
                  <td className="whitespace-nowrap py-2 pr-3 text-xs text-neutral-700">
                    {new Date(row.createdAt).toLocaleString(locale === "ko" ? "ko-KR" : "en-US")}
                  </td>
                  <td className="py-2 pr-3">{statusLabel(row.status)}</td>
                  <td className="max-w-[200px] truncate py-2 pr-3 text-xs" title={row.message}>
                    {row.message ?? "—"}
                  </td>
                  <td className="py-2">
                    {canModerate && row.status === "pending" ? (
                      <div
                        className="flex flex-wrap gap-2"
                        role="group"
                        aria-label={tAdmin.approveRejectGroupAria}
                      >
                        <button
                          type="button"
                          className="rounded border border-green-600 px-2 py-1 text-xs font-medium text-green-800 hover:bg-green-50 disabled:opacity-50"
                          disabled={busy || actingId === row.id}
                          onClick={() => void respond(row, "approved")}
                        >
                          {actingId === row.id && actingKind === "approved"
                            ? tAdmin.approving
                            : t.eliteSpecWidgetApprove}
                        </button>
                        <button
                          type="button"
                          className="rounded border border-red-600 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
                          disabled={busy || actingId === row.id}
                          onClick={() => void respond(row, "rejected")}
                        >
                          {actingId === row.id && actingKind === "rejected"
                            ? tAdmin.rejecting
                            : t.eliteSpecWidgetReject}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

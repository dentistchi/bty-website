"use client";

/**
 * Unread notifications: `GET /api/bty/notifications` ({@link getUnreadNotifications}),
 * `POST /api/bty/notifications/read` `{ notifId }`, `POST .../read-all`.
 * Realtime: `notifications_updated` broadcast + `user_notifications` INSERT/UPDATE.
 */

import { formatDistanceToNow } from "date-fns";
import { enUS, ko as koLocale } from "date-fns/locale";
import { useRouter } from "next/navigation";
import React from "react";
import type { Notification, NotificationType } from "@/engine/integration/notification-router.service";
import {
  NOTIFICATIONS_REALTIME_CHANNEL_PREFIX,
  NOTIFICATIONS_UPDATED_EVENT,
} from "@/lib/bty/notifications-realtime";
import { getSupabase } from "@/lib/supabase";
import type { Locale } from "@/lib/i18n";

const STYLE_ID = "notification-bell-animations";

/** 16px filled circle per type — teal / amber / red / purple / coral / gray */
const TYPE_DOT_BG: Record<NotificationType, string> = {
  avatar_tier_upgraded: "#0d9488",
  certified_leader_granted: "#d97706",
  arena_ejected: "#dc2626",
  elite_spec_nominated: "#7c3aed",
  resilience_milestone_reached: "#e9967a",
  weekly_report_ready: "#94a3b8",
};

function TypeDot({ type }: { type: NotificationType }) {
  const bg = TYPE_DOT_BG[type] ?? "#94a3b8";
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{ width: 16, height: 16, backgroundColor: bg }}
      aria-hidden
    />
  );
}

function routeForType(type: NotificationType, locale: string): string {
  switch (type) {
    case "arena_ejected":
    case "resilience_milestone_reached":
    case "weekly_report_ready":
      return `/${locale}/center`;
    case "avatar_tier_upgraded":
      return `/${locale}/bty/profile`;
    case "certified_leader_granted":
    case "elite_spec_nominated":
      return `/${locale}/bty/dashboard`;
    default:
      return `/${locale}/bty/dashboard`;
  }
}

export type NotificationBellProps = {
  userId: string;
  locale?: Locale | string;
  className?: string;
};

export function NotificationBell({ userId, locale = "en", className }: NotificationBellProps) {
  const loc = locale === "ko" ? "ko" : "en";
  const router = useRouter();
  const [items, setItems] = React.useState<Notification[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [markAllBusy, setMarkAllBusy] = React.useState(false);
  const [slideIds, setSlideIds] = React.useState<Set<string>>(new Set());
  const prevNotifIdsRef = React.useRef<Set<string>>(new Set());
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/bty/notifications", { credentials: "include" });
      const json = (await res.json()) as {
        ok?: boolean;
        notifications?: Notification[];
        count?: number;
        error?: string;
      };
      if (!res.ok || !json.ok || !Array.isArray(json.notifications)) {
        setItems([]);
        return;
      }
      setItems(json.notifications);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const ids = new Set(items.map((i) => i.id));
    if (prevNotifIdsRef.current.size === 0 && ids.size > 0) {
      prevNotifIdsRef.current = ids;
      return;
    }
    const added = [...ids].filter((id) => !prevNotifIdsRef.current.has(id));
    prevNotifIdsRef.current = ids;
    if (added.length === 0) return;
    setSlideIds((s) => {
      const n = new Set(s);
      added.forEach((id) => n.add(id));
      return n;
    });
    window.setTimeout(() => {
      setSlideIds((s) => {
        const n = new Set(s);
        added.forEach((id) => n.delete(id));
        return n;
      });
    }, 200);
  }, [items]);

  React.useEffect(() => {
    const uid = userId.trim();
    if (!uid) return;

    let client: ReturnType<typeof getSupabase> | null = null;
    try {
      client = getSupabase();
    } catch {
      return;
    }

    const channelName = `${NOTIFICATIONS_REALTIME_CHANNEL_PREFIX}${uid}`;
    const bc = client
      .channel(channelName)
      .on("broadcast", { event: NOTIFICATIONS_UPDATED_EVENT }, () => {
        void load();
      })
      .subscribe();

    const pg = client
      .channel(`user_notifications:${uid}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_notifications",
          filter: `user_id=eq.${uid}`,
        },
        () => {
          void load();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_notifications",
          filter: `user_id=eq.${uid}`,
        },
        (payload: { new?: Record<string, unknown> }) => {
          const row = payload.new as Notification | undefined;
          if (!row?.id) return;
          if (row.read_at) {
            setItems((prev) => prev.filter((x) => x.id !== row.id));
          }
        },
      )
      .subscribe();

    return () => {
      client?.removeChannel(bc);
      client?.removeChannel(pg);
    };
  }, [userId, load]);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const count = items.length;
  const pathLocale = String(locale).toLowerCase().startsWith("ko") ? "ko" : "en";

  const onTap = async (n: Notification) => {
    setBusyId(n.id);
    try {
      const res = await fetch("/api/bty/notifications/read", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifId: n.id }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((x) => x.id !== n.id));
        setOpen(false);
        router.push(routeForType(n.type, pathLocale));
      }
    } finally {
      setBusyId(null);
    }
  };

  const onMarkAll = async () => {
    setMarkAllBusy(true);
    try {
      const res = await fetch("/api/bty/notifications/read-all", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setItems([]);
        setOpen(false);
      }
    } finally {
      setMarkAllBusy(false);
    }
  };

  const dfLocale = loc === "ko" ? koLocale : enUS;

  return (
    <div className={`relative inline-block ${className ?? ""}`} ref={wrapRef}>
      <style id={STYLE_ID}>{`
        @keyframes notif-slide-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .notif-slide-in {
          animation: notif-slide-in 200ms ease-out;
        }
      `}</style>

      <button
        type="button"
        className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label={loc === "ko" ? "알림" : "Notifications"}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" />
        </svg>
        {count > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-slate-900"
            aria-label={loc === "ko" ? `읽지 않음 ${count}건` : `${count} unread`}
          >
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 z-[90] mt-2 flex w-[min(100vw-1rem,320px)] max-h-[320px] flex-col overflow-hidden bg-white shadow-xl dark:bg-slate-900"
          style={{
            borderRadius: 12,
            borderWidth: 0.5,
            borderStyle: "solid",
            borderColor: "var(--color-border-tertiary, #e2e8f0)",
          }}
          role="menu"
        >
          <div
            className="shrink-0 border-b px-3 py-2 dark:border-slate-800"
            style={{ borderColor: "var(--color-border-tertiary, #e2e8f0)", borderWidth: 0, borderBottomWidth: 0.5 }}
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {loc === "ko" ? "알림" : "Notifications"}
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">
                {loc === "ko" ? "새 알림이 없습니다." : "No unread notifications."}
              </p>
            ) : (
              <ul className="m-0 list-none p-0">
                {items.map((n) => {
                  const title = loc === "ko" ? n.title_ko : n.title_en;
                  const rel = formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: dfLocale });
                  const anim = slideIds.has(n.id);
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        className={`flex w-full items-start gap-3 border-b px-3 py-3 text-left last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/80 ${anim ? "notif-slide-in" : ""}`}
                        style={{
                          borderColor: "var(--color-border-tertiary, #f1f5f9)",
                          borderWidth: 0,
                          borderBottomWidth: 0.5,
                        }}
                        disabled={busyId === n.id}
                        onClick={() => void onTap(n)}
                      >
                        <span className="mt-0.5 shrink-0">
                          <TypeDot type={n.type} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{title}</span>
                          <span className="mt-0.5 block text-[11px] text-slate-500">{rel}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div
            className="shrink-0 px-3 py-2 dark:border-slate-800"
            style={{ borderColor: "var(--color-border-tertiary, #e2e8f0)", borderWidth: 0, borderTopWidth: 0.5 }}
          >
            <button
              type="button"
              className="w-full rounded-lg py-2 text-center text-xs font-semibold text-teal-600 hover:bg-slate-50 disabled:opacity-40 dark:text-teal-400 dark:hover:bg-slate-800/80"
              disabled={markAllBusy || count === 0}
              onClick={() => void onMarkAll()}
            >
              {markAllBusy ? (loc === "ko" ? "처리 중…" : "…") : "모두 읽음"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default NotificationBell;

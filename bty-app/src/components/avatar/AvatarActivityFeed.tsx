"use client";

/**
 * Vertical activity timeline from GET `/api/bty/avatar/animation-history` + Realtime `avatar_animation_log`.
 */

import React from "react";
import { getSupabase } from "@/lib/supabase";
import type { AvatarAnimationPreset } from "@/components/avatar/AvatarAnimationController";

const STYLE_ID = "avatar-activity-feed-slide";

type FeedRow = {
  id: string;
  preset: AvatarAnimationPreset;
  triggered_at: string;
};

const PRESET_LABEL_KO: Record<AvatarAnimationPreset, string> = {
  TIER_UP: "티어 업그레이드",
  OUTFIT_UNLOCK: "아이템 해제",
  INTEGRITY_SLIP: "무결성 슬립",
  CLEAN_STREAK: "클린 스트릭",
};

function formatRelativeKo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 10) return "방금 전";
  if (s < 60) return `${s}초 전`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

function PresetIcon({ preset }: { preset: AvatarAnimationPreset }) {
  const vb = "0 0 16 16";
  const common = { width: 16, height: 16, viewBox: vb, "aria-hidden": true as const };
  const stroke = "#0f172a";
  const fill = "#0f172a";

  switch (preset) {
    case "TIER_UP":
      return (
        <svg {...common}>
          <path
            fill={fill}
            d="M8 1.2l1.8 3.6 4 .6-2.9 2.8.7 4L8 12.1 4.4 12.2l.7-4L2.2 5.4l4-.6L8 1.2z"
          />
        </svg>
      );
    case "OUTFIT_UNLOCK":
      /* sparkle */
      return (
        <svg {...common}>
          <path
            fill="none"
            stroke={stroke}
            strokeWidth="1.25"
            strokeLinecap="round"
            d="M8 2.5v2.2M8 11.3V13.5M2.5 8h2.2M11.3 8h2.2M4.3 4.3l1.55 1.55M10.15 10.15l1.55 1.55M11.7 4.3l-1.55 1.55M4.3 11.7l1.55-1.55"
          />
          <circle cx="8" cy="8" r="1.35" fill={fill} />
        </svg>
      );
    case "INTEGRITY_SLIP":
      /* shake */
      return (
        <svg {...common}>
          <path
            fill="none"
            stroke={stroke}
            strokeWidth="1.35"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.5 8h2l1-2 1.5 4 1.5-4 1 2h3.5"
          />
        </svg>
      );
    case "CLEAN_STREAK":
    default:
      /* pulse */
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6" fill="none" stroke={stroke} strokeWidth="1" opacity="0.25" />
          <circle cx="8" cy="8" r="4" fill="none" stroke={stroke} strokeWidth="1.2" opacity="0.45" />
          <circle cx="8" cy="8" r="2" fill="none" stroke={stroke} strokeWidth="1.4" opacity="0.7" />
          <circle cx="8" cy="8" r="1" fill={fill} />
        </svg>
      );
  }
}

function parsePreset(p: string): AvatarAnimationPreset | null {
  if (p === "TIER_UP" || p === "OUTFIT_UNLOCK" || p === "INTEGRITY_SLIP" || p === "CLEAN_STREAK") {
    return p;
  }
  return null;
}

export type AvatarActivityFeedProps = {
  userId: string;
  /** When true, render timeline only (no outer `<details>`); parent supplies disclosure chrome. */
  embedded?: boolean;
  /** Fires when row list updates (initial load + Realtime). Used for unread badges in parent. */
  onRowsChange?: (rows: { id: string; triggered_at: string }[]) => void;
};

export function AvatarActivityFeed({
  userId,
  embedded = false,
  onRowsChange,
}: AvatarActivityFeedProps) {
  const [rows, setRows] = React.useState<FeedRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [slideId, setSlideId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const uid = userId.trim();
    if (!uid) {
      setRows([]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/bty/avatar/animation-history", { credentials: "include" });
      const json = (await res.json()) as {
        items?: { id: string; preset: string; triggered_at: string }[];
        error?: string;
      };
      if (!res.ok) {
        setRows([]);
        return;
      }
      const list = Array.isArray(json.items) ? json.items : [];
      const mapped: FeedRow[] = [];
      for (const r of list.slice(0, 10)) {
        const pr = parsePreset(r.preset);
        if (pr) mapped.push({ id: r.id, preset: pr, triggered_at: r.triggered_at });
      }
      setRows(mapped);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const uid = userId.trim();
    if (!uid) return;

    let client: ReturnType<typeof getSupabase> | null = null;
    try {
      client = getSupabase();
    } catch {
      return;
    }

    const channel = client
      .channel(`avatar_activity_feed:${uid}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "avatar_animation_log",
          filter: `user_id=eq.${uid}`,
        },
        (payload: { new?: Record<string, unknown> }) => {
          const n = payload.new;
          if (!n || typeof n.id !== "string") return;
          const pr = parsePreset(typeof n.preset === "string" ? n.preset : "");
          const triggered_at =
            typeof n.triggered_at === "string"
              ? n.triggered_at
              : new Date().toISOString();
          if (!pr) return;
          const row: FeedRow = { id: n.id, preset: pr, triggered_at };
          setRows((prev) => {
            const without = prev.filter((x) => x.id !== row.id);
            return [row, ...without].slice(0, 10);
          });
          setSlideId(row.id);
          window.setTimeout(() => setSlideId((id) => (id === row.id ? null : id)), 200);
        },
      )
      .subscribe();

    return () => {
      client?.removeChannel(channel);
    };
  }, [userId]);

  React.useEffect(() => {
    onRowsChange?.(rows.map((r) => ({ id: r.id, triggered_at: r.triggered_at })));
  }, [rows, onRowsChange]);

  const slideStyles = (
    <style id={STYLE_ID}>{`
        @keyframes avatarActivitySlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .avatar-activity-slide-in {
          animation: avatarActivitySlideIn 200ms ease-out;
        }
      `}</style>
  );

  const body = (
    <div className={embedded ? "px-3 pb-3 pt-1" : "border-t border-slate-100 px-3 pb-3 pt-1"}>
      {loading ? (
        <p className="text-xs text-slate-500" role="status">
          불러오는 중…
        </p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-slate-500">아직 기록이 없습니다</p>
      ) : (
        <ul className="relative m-0 list-none space-y-0 p-0 pl-1" role="list" aria-label="아바타 활동 기록">
          <li className="absolute bottom-0 left-[11px] top-1 w-px bg-slate-200" aria-hidden />
          {rows.map((r) => (
            <li
              key={r.id}
              className={`relative flex gap-2 py-1.5 pl-5 ${slideId === r.id ? "avatar-activity-slide-in" : ""}`}
            >
              <span className="absolute left-0 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
                <PresetIcon preset={r.preset} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-slate-800">{PRESET_LABEL_KO[r.preset]}</div>
                <div className="text-[10px] text-slate-500">{formatRelativeKo(r.triggered_at)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (embedded) {
    return (
      <>
        {slideStyles}
        {body}
      </>
    );
  }

  return (
    <details className="w-full max-w-3xl rounded-lg border border-slate-200 bg-white">
      {slideStyles}
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">
        활동 기록
      </summary>
      {body}
    </details>
  );
}

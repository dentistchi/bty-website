"use client";

/**
 * GET `/api/bty/avatar/outfit-progress` — 12-card outfit ladder, equip POST, Realtime unlock celebration.
 * Listens for `user_avatar_state` updates + `outfit_unlocked` broadcast; refreshes {@link AvatarComposite} via shared Realtime.
 */

import React from "react";
import { getSupabase } from "@/lib/supabase";
import {
  OUTFIT_UNLOCK_CARD_ORDER,
  OUTFIT_UNLOCKED_EVENT,
  type OutfitProgress,
} from "@/engine/avatar/avatar-outfit-unlock.service";

const STYLE_ID = "outfit-unlock-panel-anim";

type OutfitProgressApi = {
  items: OutfitProgress[];
  equipped_asset_ids: string[];
  unlocked_assets: string[];
};

function TypeIcon({ type }: { type: OutfitProgress["asset_type"] }) {
  const vb = "0 0 16 16";
  const common = { width: 16, height: 16, viewBox: vb, "aria-hidden": true as const };
  switch (type) {
    case "base":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "outfit":
      return (
        <svg {...common}>
          <path
            fill="currentColor"
            d="M8 2.5 12 5v2.5L10 14H6L4 7.5V5l4-2.5zm0 2.2L6.2 5.5h3.6L8 4.7z"
          />
        </svg>
      );
    case "accessory":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="2.5" fill="currentColor" />
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case "badge":
    default:
      return (
        <svg {...common}>
          <path
            fill="currentColor"
            d="M8 1.5 9.8 5.2 14 5.8 11 8.5 11.8 13 8 10.8 4.2 13 5 8.5 2 5.8 6.2 5.2z"
          />
        </svg>
      );
  }
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className="text-current">
      <path
        d="M7 11V8a5 5 0 0 1 10 0v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="16" r="1.2" fill="currentColor" />
    </svg>
  );
}

export type OutfitUnlockPanelProps = {
  userId: string;
};

export function OutfitUnlockPanel({ userId }: OutfitUnlockPanelProps) {
  const [data, setData] = React.useState<OutfitProgressApi | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [equipBusy, setEquipBusy] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState(false);
  const [celebrateId, setCelebrateId] = React.useState<string | null>(null);
  const prevUnlockedRef = React.useRef<Set<string>>(new Set());
  const seenInitialRealtimeRef = React.useRef(false);

  const load = React.useCallback(async () => {
    const uid = userId.trim();
    if (!uid) {
      setError("NO_USER");
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const res = await fetch(
        `/api/bty/avatar/outfit-progress?userId=${encodeURIComponent(uid)}`,
        { credentials: "include" },
      );
      const json = (await res.json()) as OutfitProgressApi & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "LOAD_FAILED");
      setData({
        items: json.items,
        equipped_asset_ids: json.equipped_asset_ids ?? [],
        unlocked_assets: json.unlocked_assets ?? [],
      });
      if (!seenInitialRealtimeRef.current) {
        prevUnlockedRef.current = new Set(json.unlocked_assets ?? []);
        seenInitialRealtimeRef.current = true;
      }
    } catch {
      setError("LOAD_FAILED");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const celebratedDedupeRef = React.useRef<Set<string>>(new Set());

  const triggerCelebrate = React.useCallback((assetId: string) => {
    if (!(OUTFIT_UNLOCK_CARD_ORDER as readonly string[]).includes(assetId)) return;
    if (celebratedDedupeRef.current.has(assetId)) return;
    celebratedDedupeRef.current.add(assetId);
    window.setTimeout(() => celebratedDedupeRef.current.delete(assetId), 2500);
    setCelebrateId(assetId);
    setToast(true);
    window.setTimeout(() => setCelebrateId(null), 320);
    window.setTimeout(() => setToast(false), 2400);
  }, []);

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
      .channel(`avatar:outfit_panel:${uid}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_avatar_state",
          filter: `user_id=eq.${uid}`,
        },
        (payload: { old?: Record<string, unknown>; new?: Record<string, unknown> }) => {
          const oldRaw = payload.old?.unlocked_assets;
          const newRaw = payload.new?.unlocked_assets;
          const prev =
            Array.isArray(oldRaw) ? new Set(oldRaw as string[]) : new Set(prevUnlockedRef.current);
          if (Array.isArray(newRaw)) {
            const nextSet = new Set(newRaw as string[]);
            prevUnlockedRef.current = nextSet;
            for (const id of nextSet) {
              if (!prev.has(id)) triggerCelebrate(id);
            }
          }
          void load();
        },
      )
      .on(
        "broadcast",
        { event: OUTFIT_UNLOCKED_EVENT },
        (payload: { payload?: Record<string, unknown> }) => {
          const aid =
            typeof payload.payload?.asset_id === "string" ? payload.payload.asset_id : undefined;
          if (aid) triggerCelebrate(aid);
          void load();
        },
      )
      .subscribe();

    return () => {
      client?.removeChannel(channel);
    };
  }, [userId, load, triggerCelebrate]);

  const onEquip = React.useCallback(
    async (assetId: string) => {
      setEquipBusy(assetId);
      try {
        const res = await fetch("/api/bty/avatar/equip", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId }),
        });
        if (!res.ok) {
          const j = (await res.json()) as { error?: string };
          throw new Error(j.error ?? "EQUIP_FAILED");
        }
        await load();
      } catch {
        setError("EQUIP_FAILED");
      } finally {
        setEquipBusy(null);
      }
    },
    [load],
  );

  if (loading && !data) {
    return (
      <div className="text-sm text-slate-500" role="status">
        불러오는 중…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="text-sm text-red-600" role="alert">
        아바타 장식 정보를 불러오지 못했습니다.
      </div>
    );
  }

  if (!data) return null;

  const equipped = new Set(data.equipped_asset_ids);

  return (
    <section className="relative w-full max-w-3xl" aria-label="아웃핏 해제 패널">
      <style id={STYLE_ID}>{`
        @keyframes outfitUnlockPulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .outfit-unlock-celebrate {
          animation: outfitUnlockPulse 300ms ease-in-out;
        }
      `}</style>

      {toast ? (
        <div
          className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-lg"
          role="status"
        >
          새 아이템 해제!
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-3">
        {data.items.map((row) => {
          const pct =
            row.condition_value <= 0 ? 1 : Math.min(1, row.current / row.condition_value);
          const isEquipped = equipped.has(row.asset_id);
          const locked = !row.unlocked;
          const celebrating = celebrateId === row.asset_id;

          return (
            <div
              key={row.asset_id}
              className={`relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${
                celebrating ? "outfit-unlock-celebrate" : ""
              }`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400">
                  <TypeIcon type={row.asset_type} />
                  <span className="truncate font-mono text-[10px] text-slate-500 dark:text-slate-400">
                    {row.asset_id}
                  </span>
                </div>
                {isEquipped ? (
                  <span className="shrink-0 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800 dark:bg-teal-900/50 dark:text-teal-200">
                    장착됨
                  </span>
                ) : null}
              </div>

              <p className="mb-2 min-h-[2.5rem] text-xs leading-snug text-slate-700 dark:text-slate-300">
                {row.condition_ko}
              </p>

              <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-teal-500 transition-[width] duration-300"
                  style={{ width: `${Math.round(pct * 100)}%` }}
                />
              </div>
              <div className="mb-2 text-[10px] text-slate-500 dark:text-slate-400">
                {row.current} / {row.condition_value}
              </div>

              {row.unlocked ? (
                <button
                  type="button"
                  disabled={equipBusy !== null || isEquipped}
                  className="mt-auto w-full rounded-xl bg-teal-600 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => void onEquip(row.asset_id)}
                >
                  {equipBusy === row.asset_id ? "…" : "장착"}
                </button>
              ) : null}

              {locked ? (
                <div
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 rounded-2xl bg-slate-950/40 dark:bg-black/50"
                  aria-hidden
                >
                  <div className="text-white drop-shadow-sm">
                    <LockIcon />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

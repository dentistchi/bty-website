"use client";

/**
 * 3-tab avatar customization: outfit progress + equipped state, 48px mini composites,
 * equip POST, optional 미리보기 → {@link AvatarComposite} via `previewEquippedSlots`, client `equipped_state_changed`.
 */

import React from "react";
import { getEquippedState } from "@/lib/bty/avatar/getEquippedState";
import { getOutfitUnlockProgress } from "@/lib/bty/avatar/getOutfitUnlockProgress";
import { invalidateSnapshot } from "@/lib/bty/avatar/avatarSnapshot";
import {
  getFullManifest,
  OUTFIT_TINT_SWATCHES,
  resolveCompositeAssets,
  type AvatarManifestTierId,
} from "@/engine/avatar/avatar-manifest.service";
import {
  EQUIPPED_STATE_CHANGED_EVENT,
  resolveEquipSlotIndexForAsset,
  type EquippedStateChangedPayload,
} from "@/engine/avatar/avatar-equipped-state.service";
import { computeTier } from "@/engine/avatar/avatar-state.service";
import {
  assetTypeForEquipConflict,
  type OutfitProgress,
} from "@/engine/avatar/avatar-outfit-unlock.service";
import {
  AWAKENING_MILESTONES,
  describeMilestoneCondition,
} from "@/engine/healing/awakening-phase.service";
import { HEALING_PHASE_ORDER } from "@/engine/healing/healing-phase.service";
import {
  ARC_WRAP_PX,
  CompositeLayerViews,
} from "@/components/avatar/AvatarComposite";
import { AvatarActivityFeed } from "@/components/avatar/AvatarActivityFeed";

const TABS = ["base", "outfit", "badge"] as const;
type CustomizerTab = (typeof TABS)[number];

function activityLastOpenedStorageKey(uid: string): string {
  return `bty_avatarCustomizer_activity_last_opened_at:${uid}`;
}

function clampManifestTier(n: number): AvatarManifestTierId {
  if (n <= 0) return 0;
  if (n >= 4) return 4;
  return n as AvatarManifestTierId;
}

function padSlots(raw: (string | null)[] | null | undefined): (string | null)[] {
  const out = Array.isArray(raw) ? [...raw] : Array.from({ length: 5 }, () => null);
  while (out.length < 5) out.push(null);
  return out.slice(0, 5).map((x) => (typeof x === "string" && x.trim() !== "" ? x.trim() : null));
}

function applyAssetToSlots(
  base: (string | null)[],
  assetId: string,
  tier: AvatarManifestTierId,
): (string | null)[] {
  const slots = padSlots(base);
  const idx = resolveEquipSlotIndexForAsset(assetId, tier);
  if (idx == null || idx < 0 || idx >= 5) return slots;
  const next = [...slots];
  next[idx] = assetId;
  return next;
}

function dispatchClientEquipped(payload: {
  userId: string;
  asset_id: string;
  slot_index: number;
}) {
  const full: EquippedStateChangedPayload = {
    type: EQUIPPED_STATE_CHANGED_EVENT,
    userId: payload.userId,
    slot_index: payload.slot_index,
    asset_id: payload.asset_id,
    at: new Date().toISOString(),
  };
  window.dispatchEvent(new CustomEvent(EQUIPPED_STATE_CHANGED_EVENT, { detail: full }));
}

function filterItems(tab: CustomizerTab, items: OutfitProgress[]): OutfitProgress[] {
  if (tab === "base") {
    return items.filter((i) => i.asset_type === "base" || i.asset_type === "accessory");
  }
  if (tab === "outfit") return items.filter((i) => i.asset_type === "outfit");
  return items.filter((i) => i.asset_type === "badge");
}

/** Maps each awakening milestone to a healing phase label (display order). */
const MILESTONE_PHASE_LABELS: readonly (typeof HEALING_PHASE_ORDER)[number][] = [
  "ACKNOWLEDGEMENT",
  "REFLECTION",
  "REINTEGRATION",
  "RENEWAL",
] as const;

type BadgeContextApi = {
  completedMilestoneIds: string[];
  certifiedLeaderActive: boolean;
};

function PhaseMarkSvg({
  variant,
  color,
}: {
  variant: 0 | 1 | 2 | 3;
  color: string;
}) {
  const vb = "0 0 40 40";
  const common = { width: 40, height: 40, viewBox: vb, "aria-hidden": true as const };
  switch (variant) {
    case 0:
      return (
        <svg {...common}>
          <circle cx="20" cy="20" r="14" fill="none" stroke={color} strokeWidth="2.2" />
          <circle cx="20" cy="20" r="4" fill={color} />
        </svg>
      );
    case 1:
      return (
        <svg {...common}>
          <path
            d="M20 6 L34 20 L20 34 L6 20 Z"
            fill="none"
            stroke={color}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 2:
      return (
        <svg {...common}>
          <rect
            x="8"
            y="8"
            width="24"
            height="24"
            rx="6"
            fill="none"
            stroke={color}
            strokeWidth="2.2"
          />
        </svg>
      );
    case 3:
    default:
      return (
        <svg {...common}>
          <path
            d="M20 4 L24 14 L35 14 L26 21 L29 32 L20 26 L11 32 L14 21 L5 14 L16 14 Z"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

function tabLabel(tab: CustomizerTab): string {
  switch (tab) {
    case "base":
      return "베이스";
    case "outfit":
      return "아웃핏";
    case "badge":
      return "배지";
    default:
      return tab;
  }
}

function MiniAssetPreview({
  assetId,
  tier,
  unlockedAssets,
  equippedSlots,
  outfitTintByAssetId,
  loc,
}: {
  assetId: string;
  tier: AvatarManifestTierId;
  unlockedAssets: string[];
  equippedSlots: (string | null)[];
  outfitTintByAssetId?: Record<string, string> | null;
  loc: "ko" | "en";
}) {
  const manifest = getFullManifest();
  const merged = [...unlockedAssets];
  if (!merged.includes(assetId)) merged.push(assetId);
  const slots = applyAssetToSlots(equippedSlots, assetId, tier);
  const layers = resolveCompositeAssets(
    tier,
    merged,
    undefined,
    slots,
    outfitTintByAssetId ?? null,
  );
  const activeManifest = manifest[tier];
  const cx = ARC_WRAP_PX / 2;
  const cy = ARC_WRAP_PX / 2;
  const scale = 48 / ARC_WRAP_PX;

  return (
    <div
      className="shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50"
      style={{ width: 48, height: 48 }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: ARC_WRAP_PX,
          height: ARC_WRAP_PX,
        }}
      >
        <div className="relative" style={{ width: ARC_WRAP_PX, height: ARC_WRAP_PX }}>
          <CompositeLayerViews
            layers={layers}
            activeManifest={activeManifest}
            bumpPulse={false}
            loc={loc}
            cx={cx}
            cy={cy}
          />
        </div>
      </div>
    </div>
  );
}

export type AvatarCustomizerPanelProps = {
  userId: string;
  /** When 미리보기 applies, parent should pass slots to {@link AvatarComposite} `previewEquippedSlots`. */
  onPreviewEquippedSlotsChange?: (slots: (string | null)[] | null) => void;
  /** Merge with server tints for {@link AvatarComposite} `previewOutfitTints` when previewing outfit colors. */
  onPreviewOutfitTintsChange?: (tints: Record<string, string> | null) => void;
  locale?: "ko" | "en";
};

export function AvatarCustomizerPanel({
  userId,
  onPreviewEquippedSlotsChange,
  onPreviewOutfitTintsChange,
  locale = "ko",
}: AvatarCustomizerPanelProps) {
  const loc = locale === "ko" ? "ko" : "en";
  const [tab, setTab] = React.useState<CustomizerTab>("base");
  const [items, setItems] = React.useState<OutfitProgress[]>([]);
  const [unlockedAssets, setUnlockedAssets] = React.useState<string[]>([]);
  const [equippedSlots, setEquippedSlots] = React.useState<(string | null)[]>(() =>
    Array.from({ length: 5 }, () => null),
  );
  const [currentTier, setCurrentTier] = React.useState<number | undefined>(undefined);
  const [coreXp, setCoreXp] = React.useState<number | undefined>(undefined);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [equipBusy, setEquipBusy] = React.useState<string | null>(null);
  const [previewOn, setPreviewOn] = React.useState(false);
  const [selectedAssetId, setSelectedAssetId] = React.useState<string | null>(null);
  const [assetTints, setAssetTints] = React.useState<Record<string, string>>({});
  /** Pending tint hex for preview (outfit tab + 미리보기). */
  const [pendingTintHex, setPendingTintHex] = React.useState<string | null>(null);
  const [badgeContext, setBadgeContext] = React.useState<BadgeContextApi | null>(null);
  const [activityOpen, setActivityOpen] = React.useState(false);
  const [activityUnread, setActivityUnread] = React.useState(0);
  const activityOpenRef = React.useRef(false);

  const onActivityRowsChange = React.useCallback(
    (rows: { id: string; triggered_at: string }[]) => {
      const uid = userId.trim();
      if (!uid) {
        setActivityUnread(0);
        return;
      }
      if (activityOpenRef.current) {
        setActivityUnread(0);
        return;
      }
      const raw = localStorage.getItem(activityLastOpenedStorageKey(uid));
      const t = raw ? Date.parse(raw) : NaN;
      const threshold = Number.isFinite(t) ? t : 0;
      let n = 0;
      for (const r of rows) {
        const u = Date.parse(r.triggered_at);
        if (Number.isFinite(u) && u > threshold) n += 1;
      }
      setActivityUnread(n);
    },
    [userId],
  );

  const toggleActivitySection = React.useCallback(() => {
    setActivityOpen((prev) => {
      const next = !prev;
      activityOpenRef.current = next;
      if (next) {
        const uid = userId.trim();
        if (uid) {
          localStorage.setItem(activityLastOpenedStorageKey(uid), new Date().toISOString());
        }
        setActivityUnread(0);
      }
      return next;
    });
  }, [userId]);

  const tierResolved = React.useMemo((): AvatarManifestTierId => {
    if (typeof coreXp === "number" && Number.isFinite(coreXp)) {
      return clampManifestTier(computeTier(Math.max(0, Math.floor(coreXp))));
    }
    if (typeof currentTier === "number") return clampManifestTier(currentTier);
    return 0;
  }, [coreXp, currentTier]);

  const load = React.useCallback(async () => {
    const uid = userId.trim();
    if (!uid) {
      setError("NO_USER");
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [op, eq, bcRes] = await Promise.all([
        getOutfitUnlockProgress(uid),
        getEquippedState(uid),
        fetch(`/api/bty/avatar/badge-context?userId=${encodeURIComponent(uid)}`, {
          credentials: "include",
        }).then(async (r) => {
          if (!r.ok) return null;
          return (await r.json()) as BadgeContextApi & { error?: string };
        }),
      ]);
      setItems(op.items);
      setUnlockedAssets(op.unlocked_assets);
      setAssetTints(op.asset_tints ?? {});
      setEquippedSlots(padSlots(eq.equipped_slots));
      setCurrentTier(op.current_tier);
      setCoreXp(op.core_xp_total);
      if (bcRes && !("error" in bcRes && bcRes.error)) {
        setBadgeContext({
          completedMilestoneIds: Array.isArray(bcRes.completedMilestoneIds)
            ? bcRes.completedMilestoneIds
            : [],
          certifiedLeaderActive: Boolean(bcRes.certifiedLeaderActive),
        });
      } else {
        setBadgeContext({ completedMilestoneIds: [], certifiedLeaderActive: false });
      }
    } catch {
      setError("LOAD_FAILED");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (tab !== "outfit") {
      setPendingTintHex(null);
    }
  }, [tab]);

  React.useEffect(() => {
    if (!previewOn || !selectedAssetId) {
      onPreviewEquippedSlotsChange?.(null);
      return;
    }
    const next = applyAssetToSlots(equippedSlots, selectedAssetId, tierResolved);
    onPreviewEquippedSlotsChange?.(next);
  }, [
    previewOn,
    selectedAssetId,
    equippedSlots,
    tierResolved,
    onPreviewEquippedSlotsChange,
  ]);

  const onPreviewToggle = React.useCallback(
    (next: boolean) => {
      setPreviewOn(next);
      if (!next) {
        setSelectedAssetId(null);
        setPendingTintHex(null);
        onPreviewEquippedSlotsChange?.(null);
        onPreviewOutfitTintsChange?.(null);
      }
    },
    [onPreviewEquippedSlotsChange, onPreviewOutfitTintsChange],
  );

  const mergedPreviewTints = React.useMemo((): Record<string, string> => {
    const base = { ...assetTints };
    if (pendingTintHex && selectedAssetId) {
      base[selectedAssetId] = pendingTintHex;
    }
    return base;
  }, [assetTints, pendingTintHex, selectedAssetId]);

  React.useEffect(() => {
    if (!previewOn || tab !== "outfit") {
      onPreviewOutfitTintsChange?.(null);
      return;
    }
    if (pendingTintHex && selectedAssetId) {
      onPreviewOutfitTintsChange?.({ [selectedAssetId]: pendingTintHex });
    } else {
      onPreviewOutfitTintsChange?.(null);
    }
  }, [previewOn, tab, pendingTintHex, selectedAssetId, onPreviewOutfitTintsChange]);

  const equipAsset = React.useCallback(
    async (assetId: string, opts?: { badgeSlot?: boolean }) => {
      const uid = userId.trim();
      if (!uid) return;
      setEquipBusy(assetId);
      try {
        const body =
          opts?.badgeSlot === true
            ? { assetId, slot: "badge" as const }
            : { assetId };
        const res = await fetch("/api/bty/avatar/equip", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          equipped_slots?: (string | null)[];
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? "EQUIP_FAILED");
        const slotIdx =
          opts?.badgeSlot === true
            ? 4
            : (resolveEquipSlotIndexForAsset(assetId, tierResolved) ?? 0);
        dispatchClientEquipped({
          userId: uid,
          asset_id: assetId,
          slot_index: slotIdx,
        });
        if (Array.isArray(json.equipped_slots)) {
          setEquippedSlots(padSlots(json.equipped_slots));
        } else {
          const refreshed = await getEquippedState(uid);
          setEquippedSlots(padSlots(refreshed.equipped_slots));
        }
        await load();
      } catch {
        setError("EQUIP_FAILED");
      } finally {
        setEquipBusy(null);
      }
    },
    [userId, tierResolved, load],
  );

  const postTint = React.useCallback(
    async (assetId: string, tintColor: string) => {
      const uid = userId.trim();
      if (!uid) return;
      const res = await fetch("/api/bty/avatar/tint", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, tintColor }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "TINT_FAILED");
      invalidateSnapshot(uid);
      await load();
    },
    [userId, load],
  );

  const onSwatchPick = React.useCallback(
    async (hex: string) => {
      const uid = userId.trim();
      if (!uid || tab !== "outfit") return;
      let targetId = selectedAssetId;
      if (!targetId) {
        const outfits = filterItems("outfit", items);
        const first = outfits.find((o) => o.unlocked) ?? outfits[0];
        targetId = first?.asset_id ?? null;
        if (targetId) setSelectedAssetId(targetId);
      }
      if (!targetId) return;
      if (previewOn) {
        setPendingTintHex(hex);
        return;
      }
      try {
        await postTint(targetId, hex);
        setError(null);
      } catch {
        setError("TINT_FAILED");
      }
    },
    [userId, tab, selectedAssetId, items, previewOn, postTint],
  );

  const onCardActivate = React.useCallback(
    async (row: OutfitProgress) => {
      if (row.asset_type === "outfit" || row.asset_type === "badge") {
        setSelectedAssetId(row.asset_id);
      }
      if (previewOn) {
        setSelectedAssetId(row.asset_id);
        return;
      }
      if (!row.unlocked) return;
      const badgeSlot = row.asset_type === "badge";
      await equipAsset(row.asset_id, badgeSlot ? { badgeSlot: true } : undefined);
    },
    [previewOn, equipAsset],
  );

  const onApplyPreview = React.useCallback(async () => {
    if (!selectedAssetId) return;
    if (tab === "outfit" && pendingTintHex) {
      try {
        await postTint(selectedAssetId, pendingTintHex);
      } catch {
        setError("TINT_FAILED");
        return;
      }
    }
    const badgeSlot = assetTypeForEquipConflict(selectedAssetId) === "badge";
    await equipAsset(selectedAssetId, badgeSlot ? { badgeSlot: true } : undefined);
    setPreviewOn(false);
    setSelectedAssetId(null);
    setPendingTintHex(null);
    onPreviewEquippedSlotsChange?.(null);
    onPreviewOutfitTintsChange?.(null);
  }, [
    selectedAssetId,
    tab,
    pendingTintHex,
    postTint,
    equipAsset,
    onPreviewEquippedSlotsChange,
    onPreviewOutfitTintsChange,
  ]);

  const filtered = React.useMemo(() => filterItems(tab, items), [tab, items]);

  if (loading && items.length === 0) {
    return (
      <div className="text-sm text-slate-500" role="status">
        불러오는 중…
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="text-sm text-red-600" role="alert">
        커스터마이저를 불러오지 못했습니다.
      </div>
    );
  }

  return (
    <>
    <section className="w-full max-w-3xl space-y-3" aria-label="아바타 커스터마이저">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                tab === t ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
              onClick={() => setTab(t)}
            >
              {tabLabel(t)}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={previewOn}
            onChange={(e) => onPreviewToggle(e.target.checked)}
          />
          미리보기
        </label>
        {previewOn && (
          <button
            type="button"
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            disabled={!selectedAssetId || equipBusy != null}
            onClick={() => void onApplyPreview()}
          >
            적용
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {tab === "badge" ? (
          <>
            {AWAKENING_MILESTONES.map((m, idx) => {
              const earned =
                badgeContext?.completedMilestoneIds.includes(m.id) ?? false;
              const phaseLabel = MILESTONE_PHASE_LABELS[idx] ?? `M${idx + 1}`;
              const conditionText = describeMilestoneCondition(m, loc);
              const markColor = earned ? "#1D9E75" : "#94a3b8";
              return (
                <div
                  key={m.id}
                  title={earned ? phaseLabel : `${phaseLabel}\n${conditionText}`}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-2 ${
                    earned
                      ? "border-slate-200 bg-white"
                      : "cursor-default border-slate-200 bg-slate-100 opacity-60"
                  }`}
                  style={{ width: 72 }}
                >
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50"
                    aria-hidden
                  >
                    <PhaseMarkSvg variant={idx as 0 | 1 | 2 | 3} color={markColor} />
                  </div>
                  <span className="max-w-[72px] text-center text-[9px] font-semibold leading-tight text-slate-700">
                    {phaseLabel}
                  </span>
                  {!earned ? (
                    <span className="line-clamp-3 max-w-[72px] text-center text-[8px] text-slate-500">
                      {conditionText}
                    </span>
                  ) : null}
                </div>
              );
            })}
            <p className="w-full text-[10px] text-slate-500">
              {loc === "ko"
                ? `Certified Leader: ${badgeContext?.certifiedLeaderActive ? "활성" : "비활성"}`
                : `Certified Leader: ${badgeContext?.certifiedLeaderActive ? "active" : "inactive"}`}
            </p>
            {filterItems("badge", items).map((row) => {
              const busy = equipBusy === row.asset_id;
              const isSel = selectedAssetId === row.asset_id;
              const locked = !row.unlocked;
              const tooltip = locked
                ? `${row.condition_ko}\n진행: ${row.current} / ${row.condition_value} (${Math.round(row.progress01 * 100)}%)`
                : row.asset_id;
              return (
                <button
                  key={row.asset_id}
                  type="button"
                  title={tooltip}
                  disabled={busy || (!previewOn && locked)}
                  onClick={() => void onCardActivate(row)}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-left transition ${
                    locked
                      ? `border-slate-200 bg-slate-100 opacity-60 ${previewOn ? "cursor-pointer hover:border-slate-400" : "cursor-default"}`
                      : "cursor-pointer border-slate-200 bg-white hover:border-slate-400"
                  } ${isSel && previewOn ? "ring-2 ring-emerald-500" : ""}`}
                >
                  <div className="relative">
                    <MiniAssetPreview
                      assetId={row.asset_id}
                      tier={tierResolved}
                      unlockedAssets={unlockedAssets}
                      equippedSlots={equippedSlots}
                      loc={loc}
                    />
                    {row.asset_id === "frame_legend" ? (
                      <span
                        className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-amber-400 text-[7px] text-white"
                        title="Certified Leader"
                        aria-hidden
                      >
                        ★
                      </span>
                    ) : null}
                  </div>
                  <span className="max-w-[72px] truncate text-center text-[10px] text-slate-600">
                    {row.asset_id}
                  </span>
                  {busy ? <span className="text-[10px] text-slate-400">…</span> : null}
                </button>
              );
            })}
          </>
        ) : (
          filtered.map((row) => {
            const busy = equipBusy === row.asset_id;
            const isSel = selectedAssetId === row.asset_id;
            const locked = !row.unlocked;
            const tooltip = locked
              ? `${row.condition_ko}\n진행: ${row.current} / ${row.condition_value} (${Math.round(row.progress01 * 100)}%)`
              : row.asset_id;
            const tintRing =
              tab === "outfit" && row.asset_type === "outfit"
                ? pendingTintHex && isSel && previewOn
                  ? pendingTintHex
                  : assetTints[row.asset_id]
                : undefined;

            return (
              <button
                key={row.asset_id}
                type="button"
                title={tooltip}
                disabled={busy || (!previewOn && locked)}
                onClick={() => void onCardActivate(row)}
                style={
                  tintRing
                    ? { boxShadow: `0 0 0 2px ${tintRing}, 0 0 0 4px rgba(255,255,255,0.9)` }
                    : undefined
                }
                className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-left transition ${
                  locked
                    ? `border-slate-200 bg-slate-100 opacity-60 ${previewOn ? "cursor-pointer hover:border-slate-400" : "cursor-default"}`
                    : "cursor-pointer border-slate-200 bg-white hover:border-slate-400"
                } ${isSel && previewOn && !tintRing ? "ring-2 ring-emerald-500" : ""}`}
              >
                <MiniAssetPreview
                  assetId={row.asset_id}
                  tier={tierResolved}
                  unlockedAssets={unlockedAssets}
                  equippedSlots={equippedSlots}
                  outfitTintByAssetId={tab === "outfit" ? mergedPreviewTints : undefined}
                  loc={loc}
                />
                <span className="max-w-[72px] truncate text-center text-[10px] text-slate-600">
                  {row.asset_id}
                </span>
                {busy ? <span className="text-[10px] text-slate-400">…</span> : null}
              </button>
            );
          })
        )}
      </div>

      {tab === "outfit" ? (
        <div role="group" aria-label="아웃핏 틴트" className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
          <span className="text-xs font-medium text-slate-600">틴트</span>
          <div className="flex flex-wrap gap-2">
            {OUTFIT_TINT_SWATCHES.map((s) => {
              const active =
                pendingTintHex?.toLowerCase() === s.hex.toLowerCase() ||
                (selectedAssetId &&
                  !pendingTintHex &&
                  assetTints[selectedAssetId]?.toLowerCase() === s.hex.toLowerCase());
              return (
                <button
                  key={s.hex}
                  type="button"
                  title={s.label_ko}
                  disabled={equipBusy != null}
                  onClick={() => void onSwatchPick(s.hex)}
                  className={`h-8 w-8 rounded-full border-2 transition ${
                    active ? "border-slate-900 ring-2 ring-offset-1 ring-slate-400" : "border-slate-300"
                  }`}
                  style={{ backgroundColor: s.hex }}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
    <div className="mt-2 w-full max-w-3xl rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
        aria-expanded={activityOpen}
        onClick={toggleActivitySection}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span>활동 기록</span>
          {activityUnread > 0 ? (
            <span
              className="inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[10px] font-semibold leading-none text-white"
              aria-label={`새 활동 ${activityUnread}건`}
            >
              {activityUnread > 99 ? "99+" : activityUnread}
            </span>
          ) : null}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${activityOpen ? "rotate-180" : ""}`}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      <div className={activityOpen ? "border-t border-slate-100" : "hidden"}>
        <AvatarActivityFeed
          userId={userId.trim()}
          embedded
          onRowsChange={onActivityRowsChange}
        />
      </div>
    </div>
    </>
  );
}

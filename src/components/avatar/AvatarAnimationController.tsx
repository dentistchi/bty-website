"use client";

/**
 * Four named @keyframes injected once on module load; {@link useAvatarAnimation} applies preset classes
 * to a root ref + Supabase Realtime → preset mapping. Does not alter avatar layer / snapshot logic.
 */

import React from "react";
import { getSupabase } from "@/lib/supabase";
import { OUTFIT_UNLOCKED_EVENT } from "@/engine/avatar/avatar-outfit-unlock.service";

const STYLE_TAG_ID = "bty-avatar-animation-keyframes";

export type AvatarAnimationPreset = "TIER_UP" | "OUTFIT_UNLOCK" | "INTEGRITY_SLIP" | "CLEAN_STREAK";

export type AvatarAnimationControllerHandle = {
  triggerAnimation: (preset: AvatarAnimationPreset, triggeredByEvent?: string) => void;
};

const PRESET_CLASS: Record<AvatarAnimationPreset, string> = {
  TIER_UP: "bty-anim-tier-up",
  OUTFIT_UNLOCK: "bty-anim-outfit-unlock",
  INTEGRITY_SLIP: "bty-anim-integrity-slip",
  CLEAN_STREAK: "bty-anim-clean-streak",
};

const ALL_CLASSES = Object.values(PRESET_CLASS);

const DURATION_MS: Record<AvatarAnimationPreset, number> = {
  TIER_UP: 300,
  OUTFIT_UNLOCK: 400,
  INTEGRITY_SLIP: 250,
  CLEAN_STREAK: 500,
};

const timers = new WeakMap<HTMLElement, number>();

function injectAvatarAnimationKeyframes(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_TAG_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_TAG_ID;
  el.textContent = `
.bty-avatar-anim-target {
  transform-origin: center center;
  transition: none;
  box-sizing: border-box;
}
.bty-anim-tier-up {
  animation: avatarTierUp 300ms ease;
}
@keyframes avatarTierUp {
  0% { transform: scale(1); }
  50% { transform: scale(1.4); }
  100% { transform: scale(1); }
}

.bty-anim-outfit-unlock {
  animation: avatarOutfitUnlock 400ms ease;
}
@keyframes avatarOutfitUnlock {
  0% { transform: translateY(0); opacity: 1; }
  50% { transform: translateY(-12px); opacity: 0.6; }
  100% { transform: translateY(0); opacity: 1; }
}

.bty-anim-integrity-slip {
  animation: avatarIntegritySlip 250ms ease-in-out;
}
@keyframes avatarIntegritySlip {
  0% { transform: translateX(-4px); }
  33% { transform: translateX(4px); }
  66% { transform: translateX(-4px); }
  100% { transform: translateX(0); }
}

.bty-anim-clean-streak {
  outline: 2px solid transparent;
  outline-offset: 2px;
  animation: avatarCleanStreak 500ms ease-in-out;
}
@keyframes avatarCleanStreak {
  0%, 100% { outline-color: transparent; }
  50% { outline-color: #1D9E75; }
}
`;
  document.head.appendChild(el);
}

if (typeof document !== "undefined") {
  injectAvatarAnimationKeyframes();
}

/** @deprecated Prefer module-load injection; kept for callers that need lazy init. */
export function injectKeyframesOnce(): void {
  injectAvatarAnimationKeyframes();
}

function reportAnimationToServer(preset: AvatarAnimationPreset, triggeredByEvent: string): void {
  if (typeof fetch === "undefined") return;
  void fetch("/api/bty/avatar/animation-log", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preset, triggered_by_event: triggeredByEvent }),
  }).catch(() => {});
}

export function triggerAnimationOnElement(
  element: HTMLElement,
  preset: AvatarAnimationPreset,
  triggeredByEvent?: string,
): void {
  injectAvatarAnimationKeyframes();
  const prev = timers.get(element);
  if (prev) {
    clearTimeout(prev);
    timers.delete(element);
  }
  element.classList.remove(...ALL_CLASSES);
  void element.offsetWidth;
  element.classList.add(PRESET_CLASS[preset]);
  reportAnimationToServer(preset, triggeredByEvent?.trim() || preset);
  const ms = DURATION_MS[preset] + 40;
  const id = window.setTimeout(() => {
    element.classList.remove(PRESET_CLASS[preset]);
    timers.delete(element);
  }, ms);
  timers.set(element, id);
}

function clampTier(n: number): number {
  if (n <= 0) return 0;
  if (n >= 4) return 4;
  return n;
}

/**
 * Applies preset animation classes to `rootRef.current` and subscribes to Realtime for auto triggers.
 */
export function useAvatarAnimation(
  rootRef: React.RefObject<HTMLDivElement | null>,
  userId: string,
): { triggerAnimation: (preset: AvatarAnimationPreset, triggeredByEvent?: string) => void } {
  const triggerAnimation = React.useCallback(
    (preset: AvatarAnimationPreset, triggeredByEvent?: string) => {
      const el = rootRef.current;
      if (!el) return;
      triggerAnimationOnElement(el, preset, triggeredByEvent);
    },
    [rootRef],
  );

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
      .channel(`avatar_anim_hook:${uid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_avatar_state",
          filter: `user_id=eq.${uid}`,
        },
        (payload: { old?: Record<string, unknown>; new?: Record<string, unknown> }) => {
          const prevRaw = payload.old?.current_tier;
          const nextRaw = payload.new?.current_tier;
          const prev = typeof prevRaw === "number" ? clampTier(prevRaw) : null;
          const next = typeof nextRaw === "number" ? clampTier(nextRaw) : null;
          if (next != null && prev != null && next > prev) {
            triggerAnimation(
              "TIER_UP",
              `user_avatar_state:current_tier:${prev}->${next}`,
            );
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "integrity_slip_log",
          filter: `user_id=eq.${uid}`,
        },
        (payload: { new?: Record<string, unknown> }) => {
          const id = payload.new?.id;
          triggerAnimation(
            "INTEGRITY_SLIP",
            typeof id === "string" && id.trim() !== ""
              ? `integrity_slip_log:${id}`
              : "integrity_slip_log",
          );
        },
      )
      .subscribe();

    const outfitChannel = client
      .channel(`avatar:outfit_unlock_hook:${uid}`)
      .on(
        "broadcast",
        { event: OUTFIT_UNLOCKED_EVENT },
        (payload: { payload?: Record<string, unknown> }) => {
          const assetId =
            typeof payload.payload?.asset_id === "string" ? payload.payload.asset_id.trim() : "";
          triggerAnimation(
            "OUTFIT_UNLOCK",
            assetId !== "" ? `outfit_unlocked:${assetId}` : "outfit_unlocked",
          );
        },
      )
      .subscribe();

    return () => {
      client?.removeChannel(channel);
      client?.removeChannel(outfitChannel);
    };
  }, [userId, triggerAnimation]);

  return { triggerAnimation };
}

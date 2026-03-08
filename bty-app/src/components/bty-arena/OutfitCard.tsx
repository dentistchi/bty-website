"use client";

import React from "react";
import { resolveAvatarUrls } from "@/lib/bty/arena/avatarAssets";
import { AvatarComposite } from "./AvatarComposite";
import { cn } from "@/lib/utils";

/**
 * AVATAR_LAYER_SPEC §5.3, §6·§7: allowed.outfits 카드. Render-only: characterKey/outfitKey/accessoryKeys → resolveAvatarUrls(domain) → AvatarComposite에 URL만 전달.
 */

export interface OutfitCardProps {
  characterKey: string;
  outfitKey: string;
  accessoryKeys: string[];
  name?: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function OutfitCard({
  characterKey,
  outfitKey,
  accessoryKeys,
  name,
  selected = false,
  onClick,
  className,
}: OutfitCardProps) {
  const urls = resolveAvatarUrls({
    characterKey,
    outfitKey,
    accessoryKeys,
    useThumb: true,
  });

  const label = name ?? outfitKey;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={selected ? `Selected outfit: ${label}` : `Select outfit: ${label}`}
      className={cn(
        "rounded-xl border p-3 text-left transition flex items-center gap-3 w-full",
        selected
          ? "border-foundry-purple bg-foundry-purple/10"
          : "border-gray-200 hover:border-gray-400",
        className
      )}
    >
      <AvatarComposite
        size={56}
        characterUrl={urls.characterUrl}
        outfitUrl={urls.outfitUrl}
        accessoryUrls={urls.accessoryUrls}
        alt={name ?? outfitKey}
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{name ?? outfitKey}</div>
        <div className="text-xs opacity-60">Preview</div>
      </div>
    </button>
  );
}

"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * AVATAR_LAYER_SPEC §5: CSS 레이어 합성 아바타.
 * base(character) → outfit → accessories, position absolute, objectFit contain, loading="lazy".
 */

export interface AvatarCompositeProps {
  size: number;
  characterUrl: string | null;
  outfitUrl?: string | null;
  accessoryUrls?: string[];
  alt?: string;
  className?: string;
}

export function AvatarComposite({
  size,
  characterUrl,
  outfitUrl,
  accessoryUrls = [],
  alt = "Avatar",
  className,
}: AvatarCompositeProps) {
  const containerStyle: React.CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    borderRadius: "50%",
    overflow: "hidden",
    position: "relative",
    flexShrink: 0,
  };
  const layerStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "contain",
  };

  if (!characterUrl) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full flex-shrink-0 bg-foundry-purple/15 text-foundry-purple",
          className
        )}
        style={{ ...containerStyle, fontSize: size * 0.4 }}
        role="img"
        aria-label={alt}
      >
        —
      </span>
    );
  }

  return (
    <span
      className={cn("inline-block rounded-full flex-shrink-0", className)}
      style={containerStyle}
      role="img"
      aria-label={alt}
    >
      <img
        src={characterUrl}
        alt=""
        style={{ ...layerStyle, zIndex: 1 }}
        loading="lazy"
      />
      {outfitUrl && (
        <img
          src={outfitUrl}
          alt=""
          style={{ ...layerStyle, zIndex: 2 }}
          loading="lazy"
        />
      )}
      {accessoryUrls.map((url, i) => (
        <img
          key={`${url}-${i}`}
          src={url}
          alt=""
          style={{ ...layerStyle, zIndex: 3 + i }}
          loading="lazy"
        />
      ))}
    </span>
  );
}

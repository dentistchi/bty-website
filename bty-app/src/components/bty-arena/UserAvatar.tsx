"use client";

import React from "react";

export interface UserAvatarProps {
  /** Avatar image URL (e.g. Ready Player Me 2D). When null, fallback is shown. Ignored when avatarLayers is provided. */
  avatarUrl: string | null | undefined;
  /** Layer composition (§3): character base + outfit overlay. When set, overrides avatarUrl and renders stacked images. */
  avatarLayers?: { characterImageUrl: string | null; outfitImageUrl: string | null } | null;
  /** Optional initials for fallback when no avatar (e.g. "DR" for Code Name). */
  initials?: string | null;
  alt?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: { class: "w-8 h-8", px: 32, fontSize: "12px" },
  md: { class: "w-10 h-10", px: 40, fontSize: "14px" },
  lg: { class: "w-14 h-14", px: 56, fontSize: "16px" },
};

/**
 * User avatar for dashboard, profile, leaderboard.
 * When avatarLayers is provided, renders character base + outfit overlay (stacked). Otherwise image from avatarUrl or fallback.
 */
export function UserAvatar({
  avatarUrl,
  avatarLayers,
  initials,
  alt = "Avatar",
  size = "md",
  className,
}: UserAvatarProps) {
  const { class: sizeClass, px } = sizeMap[size];
  const [imgFailed, setImgFailed] = React.useState(false);
  const [src, setSrc] = React.useState(() => avatarUrl?.trim() || "");
  const [layerCharFailed, setLayerCharFailed] = React.useState(false);
  const [layerOutfitFailed, setLayerOutfitFailed] = React.useState(false);

  const letter = initials && initials.length > 0 ? initials.slice(0, 2).toUpperCase() : null;
  const DEFAULT_AVATAR = "/avatars/default-avatar.svg";

  // When avatarUrl prop changes, reset to use it (and clear failed state)
  React.useEffect(() => {
    const next = avatarUrl?.trim() || "";
    setSrc(next);
    if (!next) setImgFailed(false);
  }, [avatarUrl]);

  const handleError = React.useCallback(() => {
    if (src && src !== DEFAULT_AVATAR) {
      setSrc(DEFAULT_AVATAR);
      setImgFailed(false);
    } else {
      setImgFailed(true);
    }
  }, [src]);

  // Layer mode: character + optional outfit stacked (§3 ARENA_CODENAME_AVATAR_PLAN)
  const useLayers =
    avatarLayers &&
    avatarLayers.characterImageUrl &&
    avatarLayers.characterImageUrl.trim() &&
    !layerCharFailed;
  const outfitUrl =
    useLayers && avatarLayers.outfitImageUrl && avatarLayers.outfitImageUrl.trim() && !layerOutfitFailed
      ? avatarLayers.outfitImageUrl
      : null;

  if (useLayers) {
    const containerStyle: React.CSSProperties = {
      width: px,
      height: px,
      minWidth: px,
      minHeight: px,
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
      objectFit: "cover",
      objectPosition: "center center",
    };
    return (
      <span
        className={`inline-block rounded-full flex-shrink-0 ${sizeClass} ${className ?? ""}`}
        style={containerStyle}
        role="img"
        aria-label={alt}
      >
        <img
          src={avatarLayers.characterImageUrl!}
          alt=""
          style={{ ...layerStyle, zIndex: 0 }}
          onError={() => setLayerCharFailed(true)}
        />
        {outfitUrl && (
          <img
            src={outfitUrl}
            alt=""
            style={{ ...layerStyle, zIndex: 1 }}
            onError={() => setLayerOutfitFailed(true)}
          />
        )}
      </span>
    );
  }

  if (src && !imgFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        width={px}
        height={px}
        className={`rounded-full object-cover flex-shrink-0 ${sizeClass} ${className ?? ""}`}
        style={{ objectPosition: "center center", width: px, height: px, borderRadius: "50%" }}
        onError={handleError}
      />
    );
  }

  const fallbackStyle: React.CSSProperties = {
    width: px,
    height: px,
    minWidth: px,
    minHeight: px,
    borderRadius: "50%",
    backgroundColor: "rgba(91, 75, 138, 0.15)",
    color: "#5B4B8A",
    fontSize: sizeMap[size].fontSize,
    fontWeight: 600,
  };
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full flex-shrink-0 bg-foundry-purple/15 text-foundry-purple font-semibold ${sizeClass} ${className ?? ""}`}
      style={fallbackStyle}
      aria-hidden
    >
      {letter ? (
        <span className={size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm"}>
          {letter}
        </span>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={size === "sm" ? "w-4 h-4" : size === "lg" ? "w-7 h-7" : "w-5 h-5"}
        >
          <circle cx="12" cy="8" r="2.5" />
          <path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" />
        </svg>
      )}
    </span>
  );
}

"use client";

import React from "react";

export interface UserAvatarProps {
  /** Avatar image URL (e.g. Ready Player Me 2D). When null, fallback is shown. */
  avatarUrl: string | null | undefined;
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
 * Renders image from URL or fallback (initials or icon). No business logic.
 */
export function UserAvatar({
  avatarUrl,
  initials,
  alt = "Avatar",
  size = "md",
  className,
}: UserAvatarProps) {
  const { class: sizeClass, px } = sizeMap[size];
  const [imgFailed, setImgFailed] = React.useState(false);
  const [src, setSrc] = React.useState(() => avatarUrl?.trim() || "");

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
      className={`inline-flex items-center justify-center rounded-full flex-shrink-0 bg-dojo-purple/15 text-dojo-purple font-semibold ${sizeClass} ${className ?? ""}`}
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

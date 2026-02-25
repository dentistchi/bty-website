"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

/** Dr. Chi 가이드 캐릭터 이미지 — 상황별 3종 (public/images) */
export const GUIDE_AVATAR_VARIANTS = {
  /** 기본: 차분한 미소 */
  default: "/images/guide-character-default.png",
  /** 환영/격려: 윙크·손짓 등 밝은 인사 */
  welcome: "/images/guide-character-welcome.png",
  /** 따뜻함: 넓은 미소, Dear Me·멘토 등 */
  warm: "/images/guide-character-warm.png",
} as const;

export type GuideAvatarVariant = keyof typeof GUIDE_AVATAR_VARIANTS;

const FALLBACK_AVATAR = "/images/guide-character.png";

/** 가이드 캐릭터(Dr. Chi) 아바타 — 챗봇·멘토 공통. variant로 상황별 이미지 선택 가능. */
export function GuideCharacterAvatar({
  src,
  variant = "default",
  alt = "Dr. Chi",
  size = "md",
  className,
}: {
  src?: string | null;
  /** 상황별 이미지. src가 있으면 src 우선. */
  variant?: GuideAvatarVariant;
  alt?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const resolvedSrc = src ?? GUIDE_AVATAR_VARIANTS[variant] ?? FALLBACK_AVATAR;
  const sizeClass = size === "sm" ? "w-8 h-8" : size === "lg" ? "w-14 h-14" : "w-10 h-10";
  const px = size === "sm" ? 32 : size === "lg" ? 56 : 40;

  if (resolvedSrc) {
    return (
      <Image
        src={resolvedSrc}
        alt={alt}
        width={px}
        height={px}
        className={cn("rounded-full object-cover flex-shrink-0", sizeClass, className)}
        style={{ objectPosition: "55% 50%" }}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full flex-shrink-0 bg-dojo-purple/15 text-dojo-purple",
        sizeClass,
        className
      )}
      aria-hidden
    >
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
    </span>
  );
}

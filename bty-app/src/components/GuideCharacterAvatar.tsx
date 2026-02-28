"use client";

import { useState, useEffect } from "react";
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

/** Phase 4: Code별 스킨 경로. 없으면 variant 사용. */
export function getGuideAvatarUrlForCode(codeName: string | null | undefined): string | null {
  if (!codeName || typeof codeName !== "string" || !codeName.trim()) return null;
  const slug = codeName.trim().toLowerCase().replace(/\s+/g, "-");
  return `/images/guide-character/code-${slug}.png`;
}

/** 가이드 캐릭터(Dr. Chi) 아바타 — 챗봇·멘토 공통. codeName 있으면 Code별 스킨 시도 후 variant 폴백. */
export function GuideCharacterAvatar({
  src,
  codeName,
  variant = "default",
  alt = "Dr. Chi",
  size = "md",
  className,
}: {
  src?: string | null;
  /** 사용자 Code(FORGE, PULSE 등). 있으면 code-{slug}.png 시도, 실패 시 variant 사용. */
  codeName?: string | null;
  /** 상황별 이미지. src/code 스킨이 없거나 로드 실패 시 사용. */
  variant?: GuideAvatarVariant;
  alt?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const codeSkinUrl = getGuideAvatarUrlForCode(codeName);
  const [codeSkinFailed, setCodeSkinFailed] = useState(false);
  useEffect(() => {
    setCodeSkinFailed(false);
  }, [codeName]);

  const tryCodeSkin = codeSkinUrl && !codeSkinFailed;
  const resolvedSrc =
    src ?? (tryCodeSkin ? codeSkinUrl : null) ?? GUIDE_AVATAR_VARIANTS[variant] ?? FALLBACK_AVATAR;
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
        onError={tryCodeSkin ? () => setCodeSkinFailed(true) : undefined}
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

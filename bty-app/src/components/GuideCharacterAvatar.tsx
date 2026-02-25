"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

/** Dr. Chi 가이드 캐릭터 기본 이미지 (public/images) */
const DEFAULT_GUIDE_AVATAR = "/images/guide-character.png";

/** 가이드 캐릭터(Dr. Chi) 아바타 — 챗봇·멘토 공통. src 없으면 기본 이미지 사용. */
export function GuideCharacterAvatar({
  src = DEFAULT_GUIDE_AVATAR,
  alt = "Dr. Chi",
  size = "md",
  className,
}: {
  src?: string | null;
  alt?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClass = size === "sm" ? "w-8 h-8" : size === "lg" ? "w-14 h-14" : "w-10 h-10";
  const px = size === "sm" ? 32 : size === "lg" ? 56 : 40;

  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        width={px}
        height={px}
        className={cn("rounded-full object-cover flex-shrink-0", sizeClass, className)}
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

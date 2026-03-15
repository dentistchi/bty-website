"use client";

import React, { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

/**
 * AVATAR_LAYER_SPEC §5, §6·§7: 레이어 합성 아바타 (옷 입힌 캐릭터).
 * Render-only: API/도메인에서 계산된 URL만 표시. characterUrl, outfitUrl, accessoryUrls는 모두 API 또는 resolveAvatarUrls(키) 결과로 전달.
 * 레이어 순서: base(character) zIndex 1 → outfit 2 → accessories 3,4,… position absolute, objectFit contain, loading="lazy".
 * §1: outfit/accessory 로드 실패 시 해당 레이어만 숨김(404 등으로 이미지 없을 때 깨진 아이콘 방지).
 * Preview/썸네일: characterUrl + outfitUrl + accessoryUrls 전달 시 옷 레이어가 합성·표시됨(zIndex 2).
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
  const [outfitFailed, setOutfitFailed] = useState(false);
  const [failedAccessories, setFailedAccessories] = useState<Set<number>>(new Set());
  const onOutfitError = useCallback(() => setOutfitFailed(true), []);
  const onAccessoryError = useCallback((i: number) => {
    setFailedAccessories((prev) => new Set(prev).add(i));
  }, []);

  useEffect(() => {
    setOutfitFailed(false);
  }, [outfitUrl]);
  useEffect(() => {
    setFailedAccessories(new Set());
  }, [accessoryUrls?.length, accessoryUrls?.join(",")]);

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
      {outfitUrl && !outfitFailed && (
        <img
          src={outfitUrl}
          alt=""
          style={{ ...layerStyle, zIndex: 2 }}
          loading="lazy"
          onError={onOutfitError}
        />
      )}
      {accessoryUrls.map((url, i) =>
        failedAccessories.has(i) ? null : (
          <img
            key={`${url}-${i}`}
            src={url}
            alt=""
            style={{ ...layerStyle, zIndex: 3 + i }}
            loading="lazy"
            onError={() => onAccessoryError(i)}
          />
        )
      )}
    </span>
  );
}

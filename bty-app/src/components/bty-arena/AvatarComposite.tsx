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

/** 0–3: 같은 옷 이미지에 CSS hue-rotate로 4가지 톤 적용. 에셋 추가 없이 다양성 확보용. */
export type OutfitColorVariant = 0 | 1 | 2 | 3;

/** UI 라벨: 0=default, 1=navy, 2=burgundy, 3=teal */
export const OUTFIT_COLOR_VARIANT_LABELS: Record<OutfitColorVariant, string> = {
  0: "Default",
  1: "Navy",
  2: "Burgundy",
  3: "Teal",
};

const HUEROTATE_DEG: Record<OutfitColorVariant, number> = {
  0: 0,
  1: 90,
  2: 180,
  3: 270,
};

export interface AvatarCompositeProps {
  size: number;
  characterUrl: string | null;
  outfitUrl?: string | null;
  /** 옷 레이어에만 적용. 4가지 톤(에셋 추가 없음). */
  outfitColorVariant?: OutfitColorVariant;
  accessoryUrls?: string[];
  alt?: string;
  className?: string;
}

export function AvatarComposite({
  size,
  characterUrl,
  outfitUrl,
  outfitColorVariant = 0,
  accessoryUrls = [],
  alt = "Avatar",
  className,
}: AvatarCompositeProps) {
  const [characterFailed, setCharacterFailed] = useState(false);
  const [outfitFailed, setOutfitFailed] = useState(false);
  const [failedAccessories, setFailedAccessories] = useState<Set<number>>(new Set());
  const onCharacterError = useCallback(() => setCharacterFailed(true), []);
  const onOutfitError = useCallback(() => setOutfitFailed(true), []);
  const onAccessoryError = useCallback((i: number) => {
    setFailedAccessories((prev) => new Set(prev).add(i));
  }, []);

  useEffect(() => {
    setCharacterFailed(false);
  }, [characterUrl]);
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
      {!characterFailed && (
        <img
          src={characterUrl}
          alt=""
          style={{ ...layerStyle, zIndex: 1 }}
          loading="lazy"
          onError={onCharacterError}
        />
      )}
      {outfitUrl && !outfitFailed && (
        <img
          src={outfitUrl}
          alt=""
          style={{
            ...layerStyle,
            zIndex: 2,
            filter:
              outfitColorVariant !== 0
                ? `hue-rotate(${HUEROTATE_DEG[outfitColorVariant]}deg)`
                : undefined,
          }}
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

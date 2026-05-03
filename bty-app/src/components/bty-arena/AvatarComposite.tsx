"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { BodyType } from "@/lib/bty/arena/avatarCharacters";
import { getAvatarCharacter } from "@/lib/bty/arena/avatarCharacters";
import { getOutfitImageUrlForBodyType, parseCompositeOutfitKey } from "@/lib/bty/arena/avatarOutfits";
/** Tier slot cap only — import tier module so this client bundle does not pull `resolveCompositeAssets`. */
import { getManifestForTier, type AvatarManifestTierId } from "@/engine/avatar/avatar-manifest-tier";

/**
 * AVATAR_LAYER_SPEC §5, §6·§7: 레이어 합성 아바타 (옷 입힌 캐릭터).
 * characterUrl은 베이스(전달 또는 resolveAvatarUrls). outfit은 base 위 오버레이(zIndex 2).
 * `outfitUrl`을 주면 그대로 사용; 생략 시 `characterKey`의 bodyType + `outfitId`/`outfitKey`로 `getOutfitImageUrlForBodyType` 해석.
 * 레이어 순서: base(character) zIndex 1 → outfit 2 → accessories 3,4,… — **hue-rotate는 outfit 레이어만**.
 * §1: outfit/accessory 로드 실패 시 해당 레이어만 숨김(404 등).
 * `avatarTier`가 있으면 악세서리 URL은 `avatar-manifest.service`의 `asset_slots`만큼만 렌더(티어 표시 규칙과 동일).
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
  /** 명시 시 그대로 사용(우선). 생략 시 outfitId/outfitKey + 체형으로 계산. */
  outfitUrl?: string | null;
  /** outfitUrl 없을 때: 매니페스트 옷 id (예: scrub_basic). */
  outfitId?: string | null;
  /** outfitUrl 없을 때: `outfit_{id}` 등 — parse 후 outfitId + 체형으로 URL 생성. */
  outfitKey?: string | null;
  /** outfitUrl 없을 때: `getAvatarCharacter(characterKey).bodyType`으로 옷 PNG 접미사(_A…_D) 선택. */
  characterKey?: string | null;
  /** characterKey보다 우선하는 체형(테스트/오버라이드). */
  bodyType?: BodyType | null;
  /** 옷 레이어에만 적용. 4가지 톤(에셋 추가 없음). */
  outfitColorVariant?: OutfitColorVariant;
  accessoryUrls?: string[];
  /** 설정 시 악세서리 레이어 수를 티어 `asset_slots`로 제한. */
  avatarTier?: AvatarManifestTierId;
  alt?: string;
  className?: string;
}

export function AvatarComposite({
  size,
  characterUrl,
  outfitUrl,
  outfitId,
  outfitKey,
  characterKey,
  bodyType,
  outfitColorVariant = 0,
  accessoryUrls = [],
  avatarTier,
  alt = "Avatar",
  className,
}: AvatarCompositeProps) {
  const resolvedOutfitUrl = useMemo(() => {
    const direct = outfitUrl?.trim();
    if (direct) return direct;
    const oid =
      outfitId?.trim() ||
      (outfitKey ? parseCompositeOutfitKey(outfitKey)?.outfitId : null) ||
      null;
    if (!oid) return null;
    const bt =
      bodyType ??
      (characterKey ? getAvatarCharacter(characterKey)?.bodyType : undefined) ??
      null;
    return getOutfitImageUrlForBodyType(oid, bt);
  }, [outfitUrl, outfitId, outfitKey, characterKey, bodyType]);

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
  }, [resolvedOutfitUrl]);
  const accessoryUrlsClamped = useMemo(() => {
    if (avatarTier == null) return accessoryUrls;
    const max = getManifestForTier(avatarTier).asset_slots;
    return accessoryUrls.slice(0, max);
  }, [accessoryUrls, avatarTier]);

  useEffect(() => {
    setFailedAccessories(new Set());
  }, [accessoryUrlsClamped.length, accessoryUrlsClamped.join(","), avatarTier]);

  const containerStyle: React.CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    borderRadius: "50%",
    overflow: "hidden",
    position: "relative",
    flexShrink: 0,
    backgroundColor: "#f5f5f5",
  };
  const layerStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transformOrigin: "50% 25%",
    transform: "scale(2.4)",
  };

  if (!characterUrl?.trim() || characterFailed) {
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
        onError={onCharacterError}
      />
      {resolvedOutfitUrl && !outfitFailed && (
        <img
          src={resolvedOutfitUrl}
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
      {accessoryUrlsClamped.map((url, i) =>
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

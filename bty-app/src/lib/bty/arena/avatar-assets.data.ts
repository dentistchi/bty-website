/**
 * avatar-assets.json 연동 (§1, AVATAR_ALIGNMENT_AND_OUTFIT_SPEC).
 * 단일 소스: public/avatars/avatar-assets.json과 동기화. 도메인/리브는 이 모듈만 참조.
 *
 * 기획 인벤토리: 옷 **20종** · 악세사리 **24종** 목표. 폴더 스캔으로 갱신: `npm run generate:avatar-manifest`.
 * (커밋된 JSON은 레벨 맵·UI와 맞춘 수동/이전 스냅샷일 수 있음.)
 */

import data from "./data/avatar-assets.json";

export type AvatarAssetsData = typeof data;

export const ACCESSORIES_DENTAL: readonly string[] = data.accessories.dental;
export const ACCESSORIES_GAME: readonly string[] = data.accessories.game;
/** 치과 41 + 게임 33. 악세사리 전체 ID 목록. */
export const ACCESSORY_IDS_ALL: readonly string[] = [
  ...data.accessories.dental,
  ...data.accessories.game,
];

export const OUTFITS_PROFESSIONAL: readonly string[] = data.outfits.professional;
export const OUTFITS_FANTASY: readonly string[] = data.outfits.fantasy;

/** 게임 악세사리 ID 집합 (확장자 .png, 나머지 .svg). */
export const GAME_ACCESSORY_IDS = new Set(ACCESSORIES_GAME);

/**
 * avatar-assets.json 연동 (§1, AVATAR_ALIGNMENT_AND_OUTFIT_SPEC).
 * 단일 소스: public/avatars/avatar-assets.json과 동기화. 도메인/리브는 이 모듈만 참조.
 *
 * 기획 인벤토리: 옷 **20종** · 악세사리 목표는 `avatar-manifest-constants.ts` 참고.
 * 폴더 스캔으로 갱신: `npm run generate:avatar-manifest`.
 */

import data from "./data/avatar-assets.json";

export type AvatarAssetsData = typeof data;

export const ACCESSORIES_DENTAL: readonly string[] = data.accessories.dental;
export const ACCESSORIES_GAME: readonly string[] = data.accessories.game;
/** 치과 + 게임. 악세사리 전체 ID 목록. */
export const ACCESSORY_IDS_ALL: readonly string[] = [
  ...data.accessories.dental,
  ...data.accessories.game,
];

/** 매니페스트 옷 id 20개 (professional/fantasy 구분 없음). */
export const OUTFIT_IDS: readonly string[] = data.outfits;

/** 게임 악세사리 ID 집합 (확장자 .png, 나머지 .svg). */
export const GAME_ACCESSORY_IDS = new Set(ACCESSORIES_GAME);

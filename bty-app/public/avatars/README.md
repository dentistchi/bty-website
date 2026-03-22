# Avatar assets

배포 시 넣을 파일·404 확인 절차: [`docs/AVATAR_DEPLOY_VERIFY.md`](../docs/AVATAR_DEPLOY_VERIFY.md) **「배포 시 할 일」**.

**기획 인벤토리(에셋 목표):** 캐릭터 **13**(12 + 히든 1) · 옷 **20** · 악세사리 **24**. 상세·진행 해금: repo `docs/spec/AVATAR_ALIGNMENT_AND_OUTFIT_SPEC.md`.

**매니페스트 자동 생성:** `public/avatars/outfits/`에 `outfit_{id}.png` **20개**(체형 접미사 `_*_[ABCD].png` 제외), `public/avatars/accessories/catalog/`에 규칙에 맞는 파일 **24개**를 둔 뒤:

```bash
cd bty-app && npm run generate:avatar-manifest
# 옷·악세 파일명이 공백 등 비표준이면 한 번 정규화 후 다시 생성 (경로는 저장소의 bty-app 폴더):
npm run generate:avatar-manifest -- --rename-loose
npm run generate:avatar-manifest
```

- `src/lib/bty/arena/data/avatar-assets.json` 과 `public/avatars/avatar-assets.json` 에 동일 내용으로 기록됩니다.
- Professional / Fantasy 분할: `outfits/manifest-split.json` (예시: `manifest-split.example.json`) 또는 파일명 정렬 후 반반 자동.
- 악세: 스캔 후 `accessories/catalog/*` → `accessories/*` 로 복사(런타임 URL 경로 맞춤).

- **캐릭터 (12 + Legend)**: `default/characters/{characterId}.png` — `avatarCharacters.ts`에서 13종 참조.  
  - 12명: `hero_01.png` … `character_12.png`  
  - 1명 히든: `legend_13.png` — **CODELESS ZONE(Stage 7)** 맥락의 Legend; 해금은 **진행 레벨 700**(tier 699). Core XP 700이 아님. (`ARENA_PROGRESSION_AND_LEGEND_SPEC.md`)  
  - 정렬 스크립트 출력을 `default/characters/` 에 복사해 사용.
- **옷(outfits)**: `outfits/outfit_{outfitId}.png` — 기획 **20종**에 맞춰 `avatar-assets.json`·`avatarOutfits` id를 정리. `/avatars/outfits/outfit_scrub_general.png` 등. **색상 다양화**: CSS hue-rotate 4톤만 사용. `outfits/README.md` 참고.
- **악세서리(accessories)**: `accessories/{id}.svg`(또는 game은 `.png`) — 기획 **24종**에 맞춰 `avatar-assets.json` id·파일 1:1 정리.
- **매니페스트**: `avatar-assets.json` — id 목록 정의.

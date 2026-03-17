# Avatar assets

- **캐릭터 (12 + Legend)**: `characters/{id}.png` — `avatarCharacters.ts`에서 13종 참조.  
  - 12명: `hero_01.png` … `character_12.png`  
  - 1명 숨김: `legend.png` (진행 레벨 700 = tier 699 달성 시 해금. Core XP 700이 아님.)  
  - 정렬 스크립트 출력을 `characters/` 에 복사해 사용.
- **옷(outfits)**: `outfits/outfit_{outfitId}.png` — Professional 7종 + Fantasy·캐릭터용. `/avatars/outfits/outfit_scrub_general.png` 등. 정렬 스크립트로 동일 캔버스/앵커 맞춘 뒤 배치. (설계: `docs/spec/AVATAR_ALIGNMENT_AND_OUTFIT_SPEC.md`.) **색상 다양화**: CSS hue-rotate 4톤만 사용. `outfits/README.md` §옷 색상 다양화 참고.
- **악세서리(accessories)**: `accessories/{id}.svg` — **치과 41개** + 게임 33개. `/avatars/accessories/{id}.svg`. 매니페스트: `avatar-assets.json` (accessories.dental 1:1 반영).
- **매니페스트**: `avatar-assets.json` — id 목록 정의.

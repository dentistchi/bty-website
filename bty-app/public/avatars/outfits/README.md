# Outfit images (§1·§3)

옷 이미지는 이 폴더에 `outfit_{outfitId}.png` 형식으로 두면 됩니다.

- **URL 규칙**: `/avatars/outfits/outfit_{outfitId}.png`
- **데이터 출처**: `src/lib/bty/arena/avatarOutfits.ts` (PROFESSIONAL_LEVEL_MAP, FANTASY_LEVEL_MAP)
- **Preview/썸네일**: `avatarAssets.outfitAssetMap` → `resolveAvatarUrls({ outfitKey })` → `OutfitCard` / `AvatarComposite`에 `outfitUrl` 전달

**현재**: PNG 파일 없음. 아래 목록대로 자산 추가 필요 (C5/디자인).  
체형 타입(3종) 도입 시: `outfit_{id}_A.png` / `_B.png` / `_C.png` 또는 서브폴더 `typeA/` 등으로 타입별 파일 둘 수 있음. 설계는 `docs/BTY_ARENA_FEEDBACK_2026-03.md` §1 참고.

## Professional (치과) — 추가 필요

- `outfit_scrub_general.png`
- `outfit_figs_scrub.png`
- `outfit_doctor_gown.png`
- `outfit_surgery_coat_suit.png`
- `outfit_brand_suit.png`
- `outfit_figs_scrub_short.png`
- `outfit_shorts_tee.png`

## Fantasy — 추가 필요

- `outfit_apprentice.png`, `outfit_adventurer.png`, `outfit_journeyer.png`
- `outfit_warrior_mage_mid.png`, `outfit_senior.png`, `outfit_senior_plus.png`, `outfit_master.png`

## 캐릭터별 게임 스타일 (fantasy 테마 시)

- `outfit_hero_armor.png`, `outfit_mage_robe.png`, `outfit_scout_cloak.png`, `outfit_guardian_armor.png`, `outfit_pilot_jacket.png`, `outfit_healer_robe.png`

파일을 추가한 뒤 해당 id로 위 이름의 PNG를 넣으면 대시보드·프로필 Preview와 리더보드 썸네일에 반영됩니다.

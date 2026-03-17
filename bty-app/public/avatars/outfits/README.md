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

---

## 옷 색상 다양화 — CSS hue-rotate (현재 방식)

- **방식**: 옷 색 변화는 **CSS `filter: hue-rotate()`** 로만 처리. 에셋 추가 없음.
- **변형 라벨**: `0 = Default`, `1 = Navy`, `2 = Burgundy`, `3 = Teal`. UI용 상수는 `AvatarComposite`에서 `OUTFIT_COLOR_VARIANT_LABELS` export.
- **구현**: `AvatarComposite`에 `outfitColorVariant={0|1|2|3}` 전달 시, **옷 레이어 `<img>`에만** hue-rotate 적용 (0=원본, 1=90°, 2=180°, 3=270°). 같은 PNG 한 장으로 4가지 톤.
- **연동**: 프로필/대시보드에서 옷 선택 시 "색 변형 0–3"을 함께 저장·전달하면 됨. DB 컬럼(`avatar_outfit_color_variant` 등)은 필요 시 추후 추가.
- **참고**: 나중에 정확한 팔레트(네이비/버건디 등)가 필요하면 옷당 4색 PNG 에셋(`outfit_{id}_navy.png` 등) 생성 후 URL 규칙으로 전환 가능.

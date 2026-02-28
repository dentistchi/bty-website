# 아바타 악세서리·도구 태스크 (다른 Cursor 전용)

**목적**: 같은 프로젝트에서 **악세서리·도구** 에셋과 참조만 담당. 옷(outfits)·캐릭터·core-xp 로직은 이미 반영되어 있으므로 수정하지 않는다.

---

## 범위

- **할 일**: `public/avatars/accessories/` 아래 **치과 관련 악세서리** 및 **게임용 아이템** 플레이스홀더 SVG 유지·추가·정리.
- **참조**: 앱에서는 `/avatars/accessories/{id}.svg` 로 참조. `avatarOutfits.ts`의 `getAccessoryImageUrl(id)` 및 `ACCESSORY_CATALOG`, `avatar-assets.json`의 `accessories.dental` / `accessories.game` id 목록과 일치시키면 됨.

---

## 매니페스트 및 id

- **매니페스트**: `bty-app/public/avatars/avatar-assets.json`
  - `accessories.dental`: 치과 40개 id (mask, goggles, handpiece, dental_mirror, explorer, loupes, apron, surgical_gloves, xray_portable 등)
  - `accessories.game`: 게임 33개 id (sword, shield, crown, hat, weapon, glasses, accessory 등)
- **파일명**: 각 id에 대해 `{id}.svg` → `public/avatars/accessories/{id}.svg`

---

## 치과 악세서리 (40개) — id 예시

mask, goggles, goggles_premium, scrub_cap, headlight, dental_mirror, dental_mirror_premium, explorer, loupes, face_shield, handpiece, apron, surgical_gloves, xray_portable, suction_tip, curing_light, scaler, retractor, saliva_ejector, syringe, impression_tray, probe, excavator, burnisher, carver, matrix_band, hve_tip, n95, name_badge, sleeve, stethoscope, bite_block, cotton_holder, polisher, finisher, air_water_syringe, wedge, bib, safety_glasses, articulating_paper, magnifier (및 필요 시 curing_light_gun, light_handle, lab_coat_pin 등 매니페스트와 동일하게).

---

## 게임용 아이템 (33개) — id 예시

sword, shield, crown, ring, cloak, wings, halo, bow, staff, potion, gem, coin, key, pet_cat, pet_dragon, pet_dog, map, compass, lantern, book, scroll, amulet, bracelet, boots, helmet, gauntlet, dagger, wand, rune, weapon, hat, glasses, accessory, quiver, belt.

---

## 완료 조건

- `public/avatars/accessories/` 아래에 위 id와 동일한 이름의 `{id}.svg` 파일이 있음 (플레이스홀더 단색 SVG라도 가능).
- `avatar-assets.json`의 `accessories.dental` / `accessories.game` 배열과 실제 존재하는 SVG 파일 id가 일치 (누락·오타 없음).
- 옷·캐릭터·core-xp·unlocked-scenarios 등 **다른 영역은 수정하지 않음**.

---

## Cursor 지시 예시

"`docs/CURSOR_AVATAR_ACCESSORIES_TASK.md` 보고 **악세서리·도구만** 해줘. `public/avatars/accessories/` 에 매니페스트 id별 SVG 플레이스홀더 있고, `avatar-assets.json`이랑 id 맞춰줘."

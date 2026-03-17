# Avatar Alignment & Outfit Fitting — Spec

캐릭터·옷·장비 이미지를 동일 캔버스/앵커로 맞춰서 합성하는 파이프라인과, 옷을 캐릭터 몸형에 맞추는 전략.

---

## 1. 목표

- **캐릭터 12명 + Legend(숨김)** — Legend 해금은 **진행 레벨 700** (tier 699). Core XP 700이 아님. (코드: `avatarCharacters.ts` `unlockAtTier: 699`, 대시보드 `getVisibleAvatarCharacters(coreXpTotal)`.)
- **악세서리** 목록은 `public/avatars/avatar-assets.json` + `avatarOutfits.ts` `ACCESSORY_CATALOG` + `avatarAssets` `accessoryAssetMap` 에서 읽어 사용.
- **옷** 을 캐릭터 이미지에 맞추기: 정렬 스크립트로 동일 좌표계 보장 후, 한 가지 몸형 템플릿 또는 3종 체형 타입별 옷으로 합성.

---

## 2. 파일 위치 요약

| 구분 | 경로 | 비고 |
|------|------|------|
| **캐릭터 이미지** | `bty-app/public/avatars/characters/` | `hero_01.png` … `character_12.png`, `legend.png` (13개). 정렬 스크립트 출력을 여기로 복사. |
| **옷 이미지** | `bty-app/public/avatars/outfits/` | `outfit_{outfitId}.png`. 정렬 스크립트로 동일 캔버스/앵커 맞춘 뒤 배치. **색상**: CSS hue-rotate 4톤만 사용 (`AvatarComposite` `outfitColorVariant` 0–3). `public/avatars/outfits/README.md` §옷 색상 다양화. |
| **악세서리** | `bty-app/public/avatars/accessories/` | `{id}.svg` (치과 41종). `avatar-assets.json` 의 `accessories.dental` 과 1:1. |
| **정렬 스크립트** | (프로젝트 외부 또는 `scripts/` 등) | Python PIL 기반. 입력: raw 이미지 → 출력: 1024×1024, 앵커·bbox 메타. |

---

## 3. 정렬 스크립트 (제공 코드) 요약

제공해 주신 Python 코드는 다음을 수행합니다.

- **캔버스**: 1024×1024, 투명 배경.
- **모드**: `character` | `clothing` | `equipment` — 각각 다른 `target_height_ratio`, `padding`, `feet_y_ratio` 등.
- **공통 처리**:
  - 흰색 배경 제거 (threshold 245),
  - 콘텐츠 bbox 로 크롑,
  - **높이만 맞춰** 비율 유지 리사이즈 (`resize_keep_ratio(target_h)`),
  - 캔버스 중앙·발 기준으로 배치 (`paste_centered(center_x, bottom_y)`),
  - 앵커 계산: eyes, neck, waist, hand_left, hand_right, feet (비율 기반).
- **결과**: 정렬된 PNG + (선택) `_preview.png` (앵커 시각화) + 메타 JSON (`placed_bbox`, `anchors`).

**의미**: 모든 캐릭터·옷을 **같은 캔버스 크기와 같은 앵커 비율** 로 맞추면, 옷 레이어를 **같은 좌표에 덮어씌우는 것만으로** 합성이 가능해짐.  
단, **캐릭터마다 몸 폭이 다르면** 한 장의 옷 이미지로는 모두에 맞지 않음 → 아래 “옷 맞춤 전략” 참고.

---

## 4. 옷 맞춤 전략 — 어떻게 구현할 수 있는지

### 4.1 제약

- 캐릭터마다 **자세·몸형이 다름**.
- 옷 1장을 “늘리기/줄이기”만 하면 **비율이 깨지거나** 몸형과 어긋남.
- AI로 “캐릭터에 맞는 옷”을 생성하면 **모양이 들쭉날쭉** 하기 쉽고, 품질을 일정하게 유지하기 어렵다.

### 4.2 추천 방향: 정렬 스크립트 + 1가지 또는 3가지 “몸형 템플릿”

**1) 모든 캐릭터를 한 “실루엣”으로 통일 (가장 단순)**

- 정렬 스크립트로 **캐릭터만** 1024×1024, 동일 `target_height_ratio`·`center_x`·`feet_y` 로 맞춤.
- **몸 폭이 달라지지 않도록**: 리사이즈 시 **높이만 맞추고 가로는 비율 유지** 하면, 원본 비율에 따라 폭이 제각각일 수 있음.  
  → **옵션 A**: 캐릭터 원본을 그릴 때부터 “표준 실루엣”(가슴/허리/발 너비 비율) 하나로 통일해서 제작.  
  → **옵션 B**: 정렬 스크립트를 확장해 “표준 폭”을 두고, 비율이 맞지 않는 캐릭터는 **가로도 스케일** 해서 표준 폭에 맞춤 (세로는 발 위치 고정). 그러면 모든 캐릭터가 같은 “슬롯”을 쓰고, **옷 1벌**만 그 슬롯에 맞춰 그리면 됨.
- 결과: **옷 1종당 1장** (또는 테마별 1장). 합성 시 캐릭터 레이어 위에 옷 레이어만 덮어씌우면 됨.

**2) 체형 4종 (A/B/C/D) + 타입별 옷**

- 캐릭터를 **몸형 4종** 으로 구분. 옷도 4종 몸형에 맞게 제작 중 (완전 준비는 아니나 구현 가능 수준).
- 정렬 스크립트 출력 기준으로 A/B/C/D별 가로 비율 구분 → 옷 4벌 (같은 디자인, 다른 폭/비율).
- 코드: `AvatarCharacter` 에 `bodyType: "A"|"B"|"C"|"D"` 추가, 옷 URL 해석 시 `outfit_{id}_A.png` … `_D.png` 또는 `outfits/typeA/` 등 규칙 사용.

**3) 정렬 스크립트를 “옷 맞춤”에 쓰는 방법**

- **캐릭터**: `mode: character` 로 1024×1024, 앵커 고정.
- **옷**: `mode: clothing` 으로 **같은** `center_x_ratio`, `feet_y_ratio`, `neck_y_ratio`, `waist_y_ratio` 사용.  
  - 옷 이미지가 “캐릭터와 같은 포즈”로 그려져 있다면, **같은 비율로 리사이즈·배치** 하면 목·어깨·허리 위치가 맞음.
- **폭**이 캐릭터와 다르면:
  - **옵션 A**: 옷 원본을 “표준 캐릭터 실루엣”에 맞춰서 그리기 (권장).
  - **옵션 B**: 스크립트에 “가로 스케일”을 넣어서, 캐릭터의 `placed_bbox` 폭에 맞춰 옷을 늘리거나 줄이기. (세로는 앵커 유지.) 이렇게 하면 **자동으로 캐릭터별 옷 폭 보정** 은 가능하지만, 스트레치로 인한 왜곡은 감수.

### 4.3 이미지 생성/편집에 대한 한계

- **여기서 할 수 있는 것**: 코드·데이터·문서 정리, 정렬 스크립트 입력/출력 규칙 정의, bodyType·옷 URL 규칙 설계.
- **여기서 할 수 없는 것**: PNG/SVG **이미지 직접 생성·리사이즈·워프**.  
  → “캐릭터 몸형에 맞춰 옷을 다시 생성하거나 늘리기/줄이기” 하는 작업은 **로컬에서** 정렬 스크립트 확장(PIL 등)이나 이미지 에디터/Gemini 등으로 수행해야 함.

---

## 5. 배치 작업 플로우 제안

1. **캐릭터 12+Legend**:  
   - raw → 정렬 스크립트 `mode: character` → `assets/aligned/characters/` 출력.  
   - 출력물을 `bty-app/public/avatars/characters/` 로 복사.  
   - 파일명: `hero_01.png` … `character_12.png`, `legend.png`.
2. **옷**:  
   - (1안) 표준 실루엣 1종으로 옷 디자인 후, 정렬 스크립트 `mode: clothing` (같은 앵커 비율)로 1024×1024 출력 → `public/avatars/outfits/outfit_{id}.png`.  
   - (2안) 체형 A/B/C 3종이면, 타입별로 옷 3벌 제작 후 `outfit_{id}_A.png` 등 규칙으로 저장하고, 코드에서 `bodyType` → URL 매핑.
3. **악세서리**:  
   - 기존대로 `avatar-assets.json` + `accessories/{id}.svg` 유지. 추가 시 JSON·코드에 id 반영.

---

## 6. JSON 배치 설정 예 (제공 config 활용)

제공해 주신 config 예시처럼, 정렬 스크립트 입력은 다음 형태로 두고:

- `canvas`: 1024×1024.
- `jobs`:  
  - `mode: character`, input: raw 캐릭터, output: `assets/aligned/characters/{id}.png`.  
  - `mode: clothing`, input: raw 옷, output: `assets/aligned/clothing/{outfitId}.png`.  
  - 필요 시 `align` / `anchor_overrides` 로 캐릭터별·옷별 미세 조정.

출력 메타(`_result.json`)의 `placed_bbox`, `anchors` 를 저장해 두면, 나중에 프론트에서 “앵커 기반 합성”을 하거나, 서버에서 합성 이미지를 만들 때 참고할 수 있음.

---

## 7. 코드 반영 요약

- **캐릭터 12명 + Legend**: `avatarCharacters.ts` — 13명, `legend_13` 에 `unlockAtTier: 699` (진행 레벨 700).  
  `getVisibleAvatarCharacters(coreXpTotal)` 는 tier >= 699일 때만 Legend 노출. (참고: `docs/spec/ARENA_PROGRESSION_AND_LEGEND_SPEC.md`.)
- **대시보드**: 캐릭터 선택 그리드에 `getVisibleAvatarCharacters(core?.coreXpTotal ?? 0)` 사용.
- **악세서리**: 기존 `avatar-assets.json` + `avatarOutfits` / `avatarAssets` 그대로 사용. 새 악세서리는 두 곳에 id 추가.
- **옷**: 기존 `avatarOutfits` / `avatarAssets` 유지. 체형 타입 도입 시 `bodyType` 필드와 `outfit_{id}_{bodyType}.png` 규칙만 추가하면 됨.

이 문서는 “옷을 캐릭터에 맞추는 것”을 **어떤 전략으로 구현할지**와 **파일을 어디에 두고 스크립트를 어떻게 쓰면 되는지**를 정리한 설계 문서다.

# 옷 선택 모델 정의 — 스펙 초안 (1페이지)

**단계**: ARENA_CODENAME_AVATAR_PLAN §3.4 단계 3  
**목적**: 캐릭터 고정 위에 “현재 선택한 옷”을 저장·조회·표시하는 모델과 API를 한 페이지로 정의.

---

## 1. 테마·레벨별 옷 목록

- **테마**: `professional` | `fantasy` (기존 `avatar_outfit_theme`과 동일).
- **레벨**: `LevelId` = S1, S2, S3, L1, L2, L3, L4 (tenure 기반, `avatarOutfits.ts` + `tenure.ts`).
- **소스**: `src/lib/bty/arena/avatarOutfits.ts`
  - **Professional**: `PROFESSIONAL_LEVEL_MAP` — scrub_general, figs_scrub, doctor_gown, surgery_coat_suit, brand_suit, figs_scrub_short, shorts_tee (7종).
  - **Fantasy**: `FANTASY_LEVEL_MAP` — apprentice, adventurer, journeyer, warrior_mage_mid, senior, senior_plus, master (7종).
- **선택 옵션 노출**: `OUTFIT_OPTIONS_BY_THEME[theme]` → `{ outfitId, outfitLabel }[]`. 대시보드 드롭다운 등에서 사용.
- **유효성**: 선택한 옷 ID는 **해당 테마 내**에만 허용. `getOutfitById(theme, outfitId)`로 검증 (없으면 null → 400).

| 구분 | 내용 |
|------|------|
| 레벨 제한 | 현재는 **선택 가능한 옷을 레벨로 제한하지 않음**. 테마 내 모든 outfit id 허용. (향후 “해금된 레벨 이하만 선택” 정책 시 스펙 보강.) |
| 이미지 | `/avatars/outfits/outfit_{outfitId}.png` (PUBLIC). 악세사리는 `ACCESSORY_CATALOG` + `/avatars/accessories/{id}.png|svg`. |

---

## 2. 현재 선택 옷 저장 필드

| 필드 | 타입 | 테이블 | 비고 |
|------|------|--------|------|
| `avatar_selected_outfit_id` | text, nullable | `arena_profiles` | **이미 존재** (마이그레이션 `20260311000000`). 테마 내 유효한 outfit id 또는 null. |

- **null**: “선택 안 함” → 표시 시 **레벨 기본 옷** 사용 (`getOutfitForLevel(theme, levelId)`).
- **값 있음**: 해당 테마에서 유효하면 **선택 옷**으로 표시; 무효(테마 변경 등)면 폴백으로 레벨 기본 옷.

---

## 3. API 요약

### GET — 프로필·아바타 정보 (선택 옷 포함)

| 엔드포인트 | 용도 | 선택 옷 관련 응답 |
|------------|------|-------------------|
| `GET /api/arena/profile` | 로그인 유저 프로필 | `avatarOutfitTheme`, `avatarSelectedOutfitId` (필드 있으면 포함). |
| `GET /api/arena/core-xp` | Core XP + 아바타 해석 | `avatarOutfitTheme`, `avatarSelectedOutfitId`, **currentOutfit** (`outfitId`, `outfitLabel`, `accessoryIds`, `imageUrl`). currentOutfit = 선택 옷 유효 시 해당 결과, 아니면 레벨 기본 옷. |

- **currentOutfit 계산**: `avatarSelectedOutfitId` 유효 시 `getOutfitById(theme, avatarSelectedOutfitId)` 우선, 없으면 `getOutfitForLevel(theme, levelId)`.

### PATCH — 선택 옷 저장

| 엔드포인트 | 용도 | body | 검증 |
|------------|------|------|------|
| `PATCH /api/arena/profile` | 프로필 일부 갱신 | `avatarSelectedOutfitId?: string \| null` | `getOutfitById(avatarOutfitTheme, outfitId)`로 테마 내 유효성 검사. 무효 시 400. null 허용(선택 해제). |

- 저장 후 core-xp 재조회 시 `currentOutfit`에 반영.

---

## 4. 요약

- **테마·레벨별 옷 목록**: `avatarOutfits.ts`의 `PROFESSIONAL_LEVEL_MAP` / `FANTASY_LEVEL_MAP` 및 `OUTFIT_OPTIONS_BY_THEME`.
- **저장 필드**: `arena_profiles.avatar_selected_outfit_id` (이미 있음).
- **GET**: profile → 테마·선택 id; core-xp → currentOutfit(선택 우선, 없으면 레벨 기본).
- **PATCH**: profile에 `avatarSelectedOutfitId` 전송, 테마 내 id 또는 null만 허용.

*상세 구현: `docs/ARENA_CODENAME_AVATAR_PLAN.md` §3.3·§3.4, `src/lib/bty/arena/avatarOutfits.ts`, `src/app/api/arena/profile/route.ts`, `src/app/api/arena/core-xp/route.ts`.*

# Arena 아바타 두 트랙 — Cursor C / Cursor D 명령서

**목적**: Cursor 창 2개로 아바타 캐릭터 선택 + 옷(테마·레벨) 시스템을 병렬 진행.  
**전제**: `docs/ARENA_MEMBERSHIP_LEVELS_AVATAR_PROPOSAL.md` §4·§4.4 참고. 캐릭터는 **게임 느낌** 모습, 옷은 **직업군(professional)** 과 **롤플레잉(fantasy)** 두 테마 지원.

---

## ✅ 완료 (Track C + D 반영됨)

- **Track C**: `avatar_character_id` 마이그레이션(`20260306000000`), `avatarCharacters.ts`, PATCH/GET profile·core-xp 반영, 대시보드 캐릭터 선택 UI.
- **Track D**: `avatar_outfit_theme` 마이그레이션(`20260307000000`), `avatarOutfits.ts`(professional/fantasy·레벨→옷), 최종 avatarUrl 계산(core-xp), 대시보드 테마 선택 UI.

---

## 공통 규칙

- BTY Arena 규칙 준수. UI는 API/도메인에서 내려준 값만 렌더.
- 기존 `avatar_url`(업로드·URL 직접 입력)이 있으면 **그대로 우선** 표시. 캐릭터/옷 시스템은 `avatar_url`이 없을 때만 적용되거나, "캐릭터+테마+레벨"로 계산한 URL을 `avatar_url`과 동일한 필드로 내려줘도 됨(프로필에 저장하지 않고 응답만 계산).

---

## Track C: 캐릭터 선택 (게임 느낌) — Cursor 1

**담당**: 게임 느낌의 2D 캐릭터 N종 정의, 선택 UI, `avatar_character_id` 저장, 프로필/API 확장.  
**Track D가 담당하는 옷 매핑·테마 선택 UI·레벨별 URL 계산은 건드리지 않는다.**

### C1. DB

- **파일**: `bty-app/supabase/migrations/` 새 마이그레이션.
- **내용**: `arena_profiles`에 `avatar_character_id` (text null) 추가. 주석: "선택한 캐릭터 id (게임 스타일). null이면 캐릭터 미선택."

### C2. 캐릭터 정의 (설정/상수)

- **파일**: `bty-app/src/lib/bty/arena/avatarCharacters.ts` (또는 `config/avatar-characters.json` + 타입).
- **내용**: 게임 느낌의 캐릭터 목록. 각 항목: `id`, `label`(표시명), `imageUrl`(기본 2D 이미지 URL, placeholder 가능). 예: `{ id: "hero_01", label: "Hero", imageUrl: "/avatars/hero_01.png" }` 등 3~5종. 실제 이미지가 없으면 placeholder 또는 이니셜 배경 같은 fallback 사용.

### C3. API

- **PATCH /api/arena/profile**: body에 `avatarCharacterId?: string | null` 추가. 유효한 id 또는 null만 허용, `arena_profiles.avatar_character_id` 업데이트.
- **GET /api/arena/profile**, **GET /api/arena/core-xp**: 응답에 `avatarCharacterId` 포함 (profile은 이미 전체 반환 시 포함, core-xp는 필요 시 select에 추가).

### C4. 대시보드 — 캐릭터 선택 UI

- **위치**: 기존 Avatar 카드 안 또는 바로 아래. "캐릭터 선택" 섹션 추가.
- **동작**: 위 캐릭터 목록을 카드/버튼으로 표시, 선택 시 PATCH로 `avatarCharacterId` 저장 후 프로필/아바타 갱신.
- **표시**: 선택된 캐릭터는 강조. `avatar_url`이 있으면 "직접 올린 이미지 사용 중" 문구 + 캐릭터 선택은 부가 옵션으로 두어도 됨.

**Track C 완료 조건**: 마이그레이션 적용, 캐릭터 목록 상수/설정 존재, PATCH/GET에 character id 반영, 대시보드에서 캐릭터 선택 가능.

---

## Track D: 옷 테마 + 레벨별 스킨 — Cursor 2

**담당**: 옷 테마(직업군 / 롤플레잉) 정의, 사용자 테마 선택 저장, 레벨→옷 매핑, 최종 아바타 URL 계산·노출.  
**Track C가 담당하는 캐릭터 목록·선택 UI는 수정하지 않는다.**

### D1. 테마·레벨 매핑 정의

- **파일**: `bty-app/src/lib/bty/arena/avatarOutfits.ts` (또는 JSON + 타입).
- **내용**:
  - **테마**: `professional`(직업군), `fantasy`(롤플레잉). 각 테마별로 **레벨 id → 옷 id 또는 이미지 URL** 매핑.
  - **Professional 예**: S1→scrub, S2→formal, L1→coat, L2→executive, L3→board, L4→partner. (실제 에셋 없으면 id만 정의, URL은 placeholder.)
  - **Fantasy 예**: S1→apprentice, S2→adventurer, L1→warrior_mage_merchant 중급, L4→master.
  - 함수: `getOutfitForLevel(theme, levelId): { outfitId, imageUrl? }`. URL이 없으면 null 또는 placeholder 반환.

### D2. DB

- **파일**: Track C와 동일 마이그레이션 또는 별도. `arena_profiles`에 `avatar_outfit_theme` (text null) 추가. 값: `professional` | `fantasy` | null. null이면 기본값(예: professional) 적용.

### D3. API

- **PATCH /api/arena/profile**: body에 `avatarOutfitTheme?: 'professional' | 'fantasy' | null` 추가. `arena_profiles.avatar_outfit_theme` 업데이트.
- **아바타 URL 계산**: GET /api/arena/core-xp(또는 profile)에서 **최종 표시용 avatarUrl** 결정 로직 추가:
  - `avatar_url`이 있으면 그대로 반환(커스텀 우선).
  - 없으면 `avatar_character_id` + `avatar_outfit_theme` + `maxUnlockedLevel`(또는 tier)로 `getOutfitForLevel` + 캐릭터 기본 이미지 조합해 URL 반환. URL이 없으면 null(이니셜 폴백).

### D4. 대시보드 — 테마 선택 UI

- **위치**: Avatar 카드 안. "옷 테마" 선택: 직업군 / 롤플레잉 라디오 또는 버튼. 선택 시 PATCH로 `avatarOutfitTheme` 저장.
- **표시**: "레벨이 올라가면 선택한 테마의 옷이 바뀝니다" 안내 문구.

### D5. UserAvatar 연동

- **UserAvatar**는 기존대로 `avatarUrl`을 받아 표시. core-xp(또는 profile)가 **계산된 최종 avatarUrl**을 내려주면, 대시보드·리더보드에서 레벨별 옷이 반영된 아바타가 보이면 됨.

**Track D 완료 조건**: 테마 2종 정의, 레벨→옷 매핑 함수 존재, DB·PATCH/GET에 theme 반영, 최종 avatarUrl 계산 로직 동작, 대시보드에서 테마 선택 가능.

---

## 공유·충돌 회피

| 파일/영역 | 담당 | 비고 |
|-----------|------|------|
| `arena_profiles` 마이그레이션 | C1·D2에서 **같은 마이그레이션**에 `avatar_character_id`와 `avatar_outfit_theme` 둘 다 추가 가능. 한 쪽이 먼저 만들면 다른 쪽은 같은 파일에 컬럼만 추가. | |
| `PATCH /api/arena/profile` | Track C: `avatarCharacterId` 처리. Track D: `avatarOutfitTheme` 처리. body 확장만 하고 서로 덮어쓰지 않게. | |
| `GET /api/arena/core-xp` | Track C: select에 `avatar_character_id` 추가. Track D: 최종 `avatarUrl` 계산 로직 추가(character + theme + level → URL). | |
| 대시보드 Avatar 카드 | Track C: 캐릭터 선택 UI. Track D: 테마 선택 UI. 같은 카드 안에 두 블록 나란히 추가하면 됨. | |

---

## Cursor 사용 방법

- **Cursor 1**: "`CURSOR_TWO_TRACKS_AVATAR.md` 보고 **Track C만** 수행해줘. C1~C4 구현해줘."
- **Cursor 2**: "`CURSOR_TWO_TRACKS_AVATAR.md` 보고 **Track D만** 수행해줘. D1~D5 구현해줘."

참고: `docs/ARENA_MEMBERSHIP_LEVELS_AVATAR_PROPOSAL.md` §4.4(옷의 두 방향), §4.1~4.3.

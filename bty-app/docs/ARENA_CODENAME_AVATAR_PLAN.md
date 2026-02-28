# Arena 코드네임 · 아바타 시스템 계획

**작성일:** 2026-02-28  
**목적:** 코드네임 규칙 정리, 리더보드 아바타 반대로 보이는 이슈 대응, “캐릭터 고정 + 옷만 선택” 시스템 계획 문서화.

---

## 0. 완료·진행 (Cursor 4 전용)

- **리더보드 아바타 역전 대응**
  - sub-name API를 `requireUser(req)` + `copyCookiesAndDebug`로 통일해 profile/core-xp와 동일한 요청 쿠키 사용. (저장 시 로그인 계정과 프로필 일치 보장)
  - 리더보드: 행별로 `profileMap.get(r.user_id)`만 사용한다는 주석 추가, 프로필 없을 때 기본 아바타만 사용하도록 유지.
- **코드네임 “코드별 1회”**
  - 마이그레이션 `20260310000000_arena_profiles_sub_name_renamed_at_code_index.sql`: `sub_name_renamed_at_code_index` 추가, 기존 리네임 유저 백필.
  - sub-name POST: `sub_name_renamed_at_code_index` 기준으로 “현재 코드에서 이미 변경했는지” 판단, 코드가 올라가면 새 코드에서 1회 더 허용.
  - core-xp: `subNameRenameAvailable`를 “코드별 1회” 규칙에 맞게 계산 (해당 컬럼 선택 및 조건 반영).
- **캐릭터 고정 + 옷 선택 1단계**
  - 마이그레이션 `20260311000000_arena_profiles_avatar_selected_outfit_id.sql`: `avatar_selected_outfit_id` 추가.
  - `avatarOutfits.ts`: `getOutfitById(theme, outfitId)` 추가, 테마 내 outfit id 검증.
  - profile PATCH: `avatarSelectedOutfitId` 수신·검증·저장.
  - core-xp: `avatar_selected_outfit_id` 선택, `currentOutfit` 계산 시 선택 옷 우선, 없으면 레벨 기본값.

**필수 마이그레이션:** `20260309000000`(avatar_character_locked), `20260310000000`(sub_name_renamed_at_code_index), `20260311000000`(avatar_selected_outfit_id) — ✅ **적용 완료** (`bty-app/scripts/apply-arena-avatar-migrations.sql` 순서대로 실행).

**역할·다음 과정**

| 담당 | 내용 |
|------|------|
| **Cursor 4** | 마이그레이션 3개 적용 완료. (선택) **Cursor 2**에 「아바타·코드네임 계획 검증해줘」 지시하면 됨. |

---

## 1. 현재 이슈 정리

### 1.1 리더보드 아바타 “반대로 적용” (ikendo1@ = FORGE · Inferno)

- **증상:** 로그인 계정이 FORGE · Inferno(ikendo1@gmail.com)인데, 리더보드에서 **Inferno 행에는 기본 플레이스홀더**, **FORGE · Spark(admin) 행에는 선택한 캐릭터(Mage)** 가 보임.
- **의도:** Inferno가 캐릭터를 선택했으면 Inferno 행에 Mage가 보여야 하고, Spark는 Spark 본인 설정 또는 기본 아바타만 보여야 함.
- **가능 원인 후보**
  1. **프로필 저장 계정 불일치**  
     캐릭터 저장 시 다른 계정(예: Spark/admin)으로 로그인된 세션에서 저장되어, Spark 프로필에만 `avatar_character_id`가 들어간 경우.
  2. **리더보드 프로필 조회**  
     `SUPABASE_SERVICE_ROLE_KEY` 미설정 시 anon 클라이언트로만 조회하면 RLS로 인해 본인 프로필만 내려옴. 이때 행별로 `profileMap.get(r.user_id)`가 비어 있으면 기본 아바타를 쓰도록 이미 수정했으나, **어떤 계정이 “본인”인지**에 따라 보이는 결과가 달라짐.
  3. **DB 데이터**  
     Inferno의 `arena_profiles`에 `avatar_character_id`가 없고, Spark에만 있는 상태일 수 있음.

**확인·조치**

- [ ] 로그인 계정 확인: ikendo1@gmail.com 로그인 시 대시보드/헤더에 표시되는 코드네임이 “FORGE · Inferno”인지 확인.
- [ ] DB 확인: `arena_profiles`에서 Inferno(ikendo1)의 `user_id` 행에 `avatar_character_id`, `avatar_outfit_theme` 값이 기대대로 있는지 확인. Spark(admin) 행과 비교.
- [ ] 캐릭터 저장 시: 대시보드 Avatar에서 캐릭터 선택 후 저장할 때 **반드시 Inferno로 로그인된 상태**에서 저장하고, 저장 직후 리더보드에서 Inferno 행에만 선택한 캐릭터가 보이는지 확인.
- [ ] 배포 환경에서 `SUPABASE_SERVICE_ROLE_KEY` 설정 여부 확인 (리더보드에서 타 유저 프로필을 올바르게 불러오기 위해 필요).

---

## 2. 코드네임(서브네임) 규칙 정의

### 2.1 규칙 문구 (요구사항)

> **코드네임은 코드가 바뀌고 25 tier가 되면, 그 코스상에서 한 번만 만들 수 있는 이름이다.**

- **코드:** FORGE(0) → PULSE(1) → … → ARCHITECT(5) → CODELESS ZONE(6).  
  `code_index = floor(tier / 100)`, 코드가 “바뀌었다” = `code_index`가 이전보다 커짐.
- **25 tier:** 해당 코드 내에서 `tier >= 25` (Core XP 기준).
- **그 코스상에서 한 번만:**  
  **코드별 1회** 서브네임 변경 가능.  
  즉, FORGE에서 25 tier 되었을 때 한 번, PULSE로 넘어가서 25 tier 되었을 때 다시 한 번, … 식으로 **코드가 올라갈 때마다 1회** 부여.

### 2.2 현재 구현과의 차이

- **현재:**  
  `sub_name_renamed_in_code`(boolean)로 “이미 리네임 했는지”만 저장 → **전체 1회**만 변경 가능한 구조에 가깝다.  
  (실제로는 tier≥25 + 상위 5% 등 추가 조건이 있음.)
- **목표:**  
  **코드가 바뀌고**, 그 **새 코드에서 tier 25**가 되면, **그 코드에 한해 1회** 서브네임 설정 가능.

### 2.3 제안 데이터·로직 변경

- **옵션 A (권장):**  
  `arena_profiles`에 `sub_name_renamed_at_code_index (smallint | null)` 추가.  
  - 의미: “이 코드 인덱스에서 이미 서브네임을 한 번 변경했다.”  
  - **변경 허용 조건:**  
    `tier >= 25`  
    그리고 `code_index > sub_name_renamed_at_code_index` (또는 `sub_name_renamed_at_code_index IS NULL`).  
  - 변경 시: `sub_name`, `sub_name_renamed_at_code_index = code_index` 업데이트.
- **옵션 B:**  
  기존 `sub_name_renamed_in_code`를 “현재 코드에서 이미 변경했는지”로 해석하고, **코드가 올라갈 때(예: applyCoreXp 또는 시즌/코드 전환 시점) `sub_name_renamed_in_code`를 false로 리셋**하는 정책을 도입.  
  - 코드 전환 시점을 어디서 보장할지(트리거, 배치, API) 명확히 해야 함.

문서화 단계에서는 **옵션 A** 기준으로 계획하고, 구현 시 마이그레이션·기존 5% 조건 등과 함께 조정.

---

## 3. 아바타: “캐릭터 얼굴·몸 고정 + 옷만 선택” 시스템

### 3.1 목표

- **캐릭터(얼굴·몸):** 한 번 선택·저장하면 다음 “Code 진화” 전까지 **고정** (이미 구현된 `avatar_character_locked` 정책 유지).
- **옷:**  
  캐릭터는 그대로 두고 **옷(테마·레벨·선택 옷)만** 바꿀 수 있게 한다.  
  나중에 리더보드·대시보드 등에서 “캐릭터 + 선택한 옷”이 함께 보이도록 한다.

### 3.2 현재 구조 요약

- **캐릭터:**  
  `avatar_character_id` (고정), `avatar_character_locked` (한 번 저장 후 잠금).  
  캐릭터 베이스 이미지: `/avatars/{Character}.png` 등.
- **테마:**  
  `avatar_outfit_theme`: `professional` | `fantasy`.  
  레벨(또는 tier)에 따라 `getOutfitForLevel(theme, levelId)`로 outfit + 악세사리 목록 결정.
- **표시:**  
  현재는 “캐릭터 이미지” 또는 “캐릭터+테마 옷 이미지(fantasy 시)” 중 하나를 **단일 URL**로 사용.  
  “캐릭터 레이어 + 옷 레이어”를 **분리해서** 합성하는 구조는 아직 없음.

### 3.3 목표 아키텍처 (캐릭터 고정 + 옷 선택)

1. **레이어 구분**
   - **레이어 1 (항상):** 캐릭터 베이스 (얼굴·몸) — `avatar_character_id`로 결정, 변경 불가(잠금 후).
   - **레이어 2:** 옷(의상) — 테마 + 레벨 + (향후) 유저가 고른 “옷” ID.
   - **레이어 3 (선택):** 악세사리 — 25 tier마다 선택 + 랜덤 보너스(기획 반영 후).

2. **데이터**
   - **유지:**  
     `avatar_character_id`, `avatar_character_locked`, `avatar_outfit_theme`.
   - **추가 검토:**  
     - “현재 선택한 옷” ID (테마 내 옷 목록 중 하나).  
     - “선택 가능한 옷”은 레벨/테마에 따라 제한할지 여부.
   - **악세사리:**  
     Tier 25, 50, 75… 마다 “선택 슬롯” + 랜덤 보너스.  
     저장 필드: 예) `arena_profiles.avatar_accessory_ids` (배열) 또는 별도 테이블.

3. **표시 방식 (선택지)**
   - **A. 서버/API에서 합성 이미지 URL 1개 반환**  
     캐릭터 + 선택 옷(+ 악세사리)을 서버에서 합성해 단일 URL로 제공.  
     (이미지 생성/캐시 인프라 필요.)
   - **B. 프론트에서 레이어 합성**  
     캐릭터 이미지 + 옷 이미지 + 악세사리 이미지를 CSS/Canvas로 겹쳐서 표시.  
     리더보드 등에서는 “캐릭터 URL + 옷 URL + 악세사리 ID 목록”을 내려주고, 클라이언트에서 조합.
   - **C. 미리 렌더된 스프라이트/이미지 세트**  
     “캐릭터 A + 옷 1”, “캐릭터 A + 옷 2” 등 조합별로 미리 만들어 두고, 조합 키에 맞는 URL만 반환.

구현 난이도·리소스를 고려해 A/B/C 중 하나를 선택하고, 그에 맞춰 API·스키마를 설계하는 단계가 필요함.

### 3.4 단계별 계획 (안)

| 단계 | 내용 | 산출물 |
|------|------|--------|
| **1** | 코드네임 규칙 반영 | “코드가 바뀌고 25 tier 되면 그 코드에서 1회” 규칙 명세 확정, 필요 시 `sub_name_renamed_at_code_index` 스키마·API 변경 |
| **2** | 리더보드 아바타 역전 버그 수렴 | 위 §1 확인 항목 수행 후, 계정/DB/환경 변수 중 원인 문서화 및 수정 |
| **3** | 옷 “선택” 모델 정의 | 테마·레벨별 옷 목록, “현재 선택 옷” 저장 필드, API (GET/PATCH) 설계 |
| **4** | 악세사리 25 tier 규칙 구현 | 25 tier마다 선택 슬롯 + 랜덤 보너스 저장 구조 및 API |
| **5** | 표시 방식 결정 및 적용 | A/B/C 중 선택 후, 대시보드·리더보드에 “캐릭터 + 선택 옷(+ 악세사리)” 반영 |

---

## 4. 체크리스트 (즉시 확인 권장)

- [ ] ikendo1@gmail.com 로그인 시 화면에 “FORGE · Inferno”로 표시되는지.
- [ ] 동일 세션에서 대시보드 Avatar에서 캐릭터 저장 후, 리더보드 1위 행에 해당 캐릭터가 보이는지.
- [ ] `arena_profiles`에서 Inferno(ikendo1) `user_id`의 `avatar_character_id` 값 확인.
- [ ] 배포 환경 `SUPABASE_SERVICE_ROLE_KEY` 설정 여부 확인.
- [ ] 코드네임 규칙: “코드가 바뀌고 25 tier → 그 코드에서 1회” 로 제품/도메인 규칙 문서 업데이트 및 팀 공유.

---

## 5. 참고 파일

- 리더보드 프로필·아바타: `bty-app/src/app/api/arena/leaderboard/route.ts`
- 프로필 PATCH(캐릭터/테마): `bty-app/src/app/api/arena/profile/route.ts`
- core-xp(아바타 해석): `bty-app/src/app/api/arena/core-xp/route.ts`
- 서브네임 변경: `bty-app/src/app/api/arena/sub-name/route.ts`
- 코드/서브네임 상수: `bty-app/src/lib/bty/arena/codes.ts`
- 아바타·옷·악세사리: `bty-app/src/lib/bty/arena/avatarOutfits.ts`, `avatarCharacters.ts`

---

## 6. 구현 현황 (Cursor 4)

| 항목 | 상태 |
|------|------|
| 리더보드 아바타 역전 | sub-name/profile 인증을 `requireUser(req)`로 통일, 리더보드 행별 `profileMap.get(r.user_id)` 주석·로직 유지 |
| 코드네임 코드별 1회 | 마이그레이션 `sub_name_renamed_at_code_index`, sub-name POST·core-xp `subNameRenameAvailable` 반영 |
| 캐릭터+옷 1단계 | `avatar_selected_outfit_id` 마이그레이션, profile PATCH, core-xp `currentOutfit`·`avatarSelectedOutfitId`, 대시보드 “선택한 옷” 드롭다운 |

**배포 전 필요**: ✅ 마이그레이션 3개 적용 완료 (`scripts/apply-arena-avatar-migrations.sql` 사용). (선택) Cursor 2에 「아바타·코드네임 계획 검증해줘」 로 검증 요청.
**상세 흐름**: **`docs/NEXT_STEPS_RUNBOOK.md`** § "Cursor 4 구현 범위 및 배포 전 필요".

---

## 7. 검증 결과 (Cursor 2)

| 항목 | 내용 |
|------|------|
| 검증 일시 | 2026-02-28 |
| 결과 | **PASS** |
| 이슈 목록 | 없음. §0(리더보드 아바타 역전·코드별 1회·캐릭터+옷 1단계) 구현이 스펙 및 AGENTS_SHARED_README·bty-*.mdc 규칙을 만족함. |

### 7-1. 재검증 (2026-02-28)

| 항목 | 내용 |
|------|------|
| 검증 일시 | 2026-02-28 재검증 |
| 결과 | **PASS** |
| 이슈 목록 | 없음. §0 구현이 `docs/ARENA_CODENAME_AVATAR_PLAN.md` 스펙 및 AGENTS_SHARED_README·bty-*.mdc 규칙을 만족함. |

**점검 항목별 요약**

| # | 항목 | 판정 | 근거 |
|---|------|------|------|
| 1 | 리더보드 아바타 역전 대응 | PASS | leaderboard/route.ts — getSupabaseAdmin()으로 전체 프로필 조회(RLS 우회), 행별 profileMap.get(r.user_id)로만 매핑하여 타 유저 아바타 혼입 방지. 주석·가드 건재. |
| 2 | sub-name 인증 통일 | PASS | sub-name/route.ts — requireUser(req) + copyCookiesAndDebug 사용. profile·core-xp와 동일한 인증 경로. |
| 3 | 코드네임 "코드별 1회" 규칙 | PASS | sub_name_renamed_at_code_index(smallint, nullable) 마이그레이션 + 백필 쿼리 존재. sub-name POST에서 codeIndex ≤ lastRenamedAtCode 시 거부, 기존 sub_name_renamed_in_code fallback 보존. 저장 시 sub_name_renamed_at_code_index = codeIndex 업데이트. |
| 4 | core-xp subNameRenameAvailable 계산 | PASS | tier ≥ 25, codeIndex < 6, isTop5Percent, 그리고 lastAt == null ? !sub_name_renamed_in_code : codeIndex > lastAt 로 코드별 1회 규칙 반영. |
| 5 | 캐릭터+옷 1단계 — 마이그레이션 | PASS | 20260309000000 (avatar_character_locked), 20260311000000 (avatar_selected_outfit_id) 모두 ADD COLUMN IF NOT EXISTS + 코멘트 포함. |
| 6 | profile PATCH — 옷 선택 검증 | PASS | avatarSelectedOutfitId 수신 → getOutfitById(theme, outfitId)로 유효성 검증 → 무효 시 400 반환, 유효 시 avatar_selected_outfit_id 저장. |
| 7 | core-xp — currentOutfit 계산 | PASS | avatar_selected_outfit_id select, getOutfitById로 선택 옷 우선 적용, 없으면 outfitByLevel 폴백. |
| 8 | BTY 규칙 준수 | PASS | 도메인 로직은 API 레이어에서 처리, UI는 결과만 렌더. XP/Season/Leaderboard 비즈니스 규칙 분리 유지. |


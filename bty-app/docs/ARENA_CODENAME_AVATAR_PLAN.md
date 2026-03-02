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

**캐릭터/옷/리더보드가 안 나올 때 체크**

1. **대시보드에서 캐릭터가 안 보임**  
   - 캐릭터 선택 후 "저장"했는지 확인. 저장 후 core-xp refetch로 왼쪽 원형 아바타에 반영됨.  
   - 마이그레이션 3개 적용 여부: 미적용이면 core-xp가 폴백 select로 동작하므로 `avatar_character_id`는 반환됨.  
2. **옷 선택이 안 됨**  
   - profile PATCH는 `avatar_selected_outfit_id` 컬럼이 없으면 해당 필드만 제외하고 나머지(캐릭터·테마)는 저장하도록 폴백 처리됨. 옷 선택 저장을 쓰려면 `20260311000000` 마이그레이션 적용 필요.  
3. **리더보드에 아바타가 안 나옴**  
   - `SUPABASE_SERVICE_ROLE_KEY`가 설정되어 있어야 admin으로 `arena_profiles`를 조회해 모든 행에 해당 유저 프로필이 채워짐. 미설정 시 anon만 사용되어 본인 프로필만 조회되고, 다른 유저 행은 기본 아바타만 표시됨.  
   - 해당 유저가 대시보드에서 캐릭터를 한 번이라도 저장했는지 확인 (`arena_profiles.avatar_character_id` 존재 여부).

### 1.2 검증 시나리오 (사람이 순서대로 따라 할 수 있는 절차)

리더보드 아바타가 “올바른 계정의 캐릭터”로 표시되는지 검증할 때, 아래 순서대로 진행한다.

| 단계 | 할 일 | 확인 포인트 |
|------|--------|-------------|
| **1. 로그인** | ikendo1@gmail.com으로 로그인한다. | 브라우저에서 시크릿/일반 창으로 로그인 → 대시보드 또는 헤더에 **"FORGE · Inferno"** 가 표시되는지 확인한다. 다른 계정(예: Spark)이 보이면 로그아웃 후 다시 로그인한다. |
| **2. 저장** | 대시보드의 **Avatar** 영역에서 캐릭터(예: Mage)를 선택하고 **저장** 버튼을 누른다. | 반드시 **Inferno로 로그인된 상태**에서만 저장한다. 저장 후 왼쪽 원형 아바타 또는 core-xp refetch로 선택한 캐릭터가 바로 반영되는지 확인한다. |
| **3. 리더보드 확인** | **리더보드** 페이지로 이동한다. | **Inferno(본인) 행**에 방금 선택한 캐릭터(예: Mage) 아바타가 보이는지 확인한다. Spark(또는 다른 유저) 행에는 Spark 본인 설정 또는 기본 아바타만 보여야 하며, Inferno가 고른 캐릭터가 다른 사람 행에 나오면 안 된다. |
| **4. DB 확인** | Supabase 대시보드 또는 SQL 클라이언트에서 `arena_profiles`를 조회한다. | Inferno에 해당하는 `user_id`(ikendo1@gmail.com의 auth.users id) 행에 `avatar_character_id`, `avatar_outfit_theme`(필요 시 `avatar_selected_outfit_id`) 값이 기대대로 들어가 있는지 확인한다. Spark(admin) 행과 비교해, 캐릭터를 저장한 계정의 행에만 해당 값이 들어가 있어야 한다. |

**정리**: 1 → 2로 “누가 로그인한 상태에서 저장했는지”를 확실히 하고, 3에서 리더보드에 그 계정 행에만 아바타가 나오는지 보며, 4에서 DB에 실제로 그 계정에만 데이터가 들어갔는지 검증한다.

---

### 2.1 규칙 문구 (요구사항)

> **코드네임은 코드가 바뀌고 25 tier가 되면, 그 코스상에서 한 번만 만들 수 있는 이름이다.**

제품/도메인 규칙으로의 정식 반영: **`docs/BTY_ARENA_SYSTEM_SPEC.md` §5 「제품 규칙 (정식 문구)」** 참고.

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
**선택 확정:** 옵션 A ✅ (코드별 1회 규칙·SQL은 §2.4에 반영됨).

### 2.4 옵션 A 선택 시 다음 과정

옵션 A를 선택했다면 아래 순서로 진행한다. (완료한 항목은 [x]로 체크.)

- [ ] **1. Supabase에서 마이그레이션 적용**  
  아래 §「Supabase에서 실행할 SQL」을 Supabase Dashboard → SQL Editor에 붙여 넣고 **Run** 한다. (이미 적용했다면 컬럼이 있으므로 `add column if not exists`로 에러 없이 스킵된다.)
- [ ] **2. 앱 동작 확인**  
  서브네임 변경: tier ≥ 25이고 `code_index > sub_name_renamed_at_code_index`(또는 null)일 때만 변경 허용. 변경 시 `sub_name_renamed_at_code_index = code_index` 저장. core-xp의 `subNameRenameAvailable`이 위 조건을 반영하는지 확인.
- [ ] **3. 검증**  
  §1.2 검증 시나리오(로그인 → 저장 → 리더보드 확인 → DB 확인)와 §4.2 체크리스트를 필요 시 실행.

**다음부터 서류 보고 진행할 때:** 위 1 → 2 → 3 순서대로 체크하면서 진행. 참고 문서는 본 파일(`ARENA_CODENAME_AVATAR_PLAN.md`), `BTY_ARENA_SYSTEM_SPEC.md` §5, `NEXT_STEPS_RUNBOOK.md`.

#### Supabase에서 실행할 SQL (복사용)

아래 전체를 복사해 **Supabase Dashboard → SQL Editor**에 붙여 넣은 뒤 **Run** 하면 된다.

```sql
-- Arena 아바타·코드네임 마이그레이션 3개 (옵션 A 포함)
-- 1) avatar_character_locked
ALTER TABLE public.arena_profiles
  ADD COLUMN IF NOT EXISTS avatar_character_locked boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.arena_profiles.avatar_character_locked IS 'True after first avatar character save; character cannot be changed, only outfit theme. Reset on code evolution.';

-- 2) sub_name_renamed_at_code_index (옵션 A)
ALTER TABLE public.arena_profiles
  ADD COLUMN IF NOT EXISTS sub_name_renamed_at_code_index smallint NULL;
COMMENT ON COLUMN public.arena_profiles.sub_name_renamed_at_code_index IS 'Code index (0-5) at which user last used the one-time sub-name rename. Next code allows one more rename at tier 25+.';
UPDATE public.arena_profiles
SET sub_name_renamed_at_code_index = least(6, greatest(0, code_index))
WHERE sub_name_renamed_in_code = true AND sub_name_renamed_at_code_index IS NULL;

-- 3) avatar_selected_outfit_id
ALTER TABLE public.arena_profiles
  ADD COLUMN IF NOT EXISTS avatar_selected_outfit_id text NULL;
COMMENT ON COLUMN public.arena_profiles.avatar_selected_outfit_id IS 'User-selected outfit id within current theme (e.g. figs_scrub, adventurer). Null = use level-based default.';
```

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

### 4.1 코드네임 규칙 — 제품/도메인 문서 반영

- **규칙 문구**: 「코드가 바뀌고 25 tier → 그 코드에서 1회」
- **반영 위치**: `docs/BTY_ARENA_SYSTEM_SPEC.md` §5 「제품 규칙 (정식 문구)」, 본 문서 §2.1.
- [ ] 팀 공유 완료.

### 4.2 검증 시 실행할 체크리스트

검증 시 아래 순서대로 실행하고, 각 항목의 확인 포인트를 만족하는지 기록한다.

| 순서 | 항목 | 확인 포인트 | 결과 |
|------|------|-------------|------|
| **1** | **로그인 계정 표시** | ikendo1@gmail.com으로 로그인 → 헤더/대시보드에 "FORGE · Inferno" 로 표시되는지 확인. | ☑ |
| **2** | **캐릭터 저장 → 리더보드 반영** | 동일 세션에서 대시보드 Avatar에서 캐릭터 선택 후 저장 → 리더보드에서 1위(해당 유저) 행에 방금 선택한 캐릭터 아바타가 보이는지 확인. | ☑ |
| **3** | **DB 데이터** | `arena_profiles`에서 Inferno(ikendo1 해당 `user_id`) 행의 `avatar_character_id`, `avatar_outfit_theme`(필요 시 `avatar_selected_outfit_id`) 값이 기대와 일치하는지 확인. Spark(admin) 행과 비교해 저장 계정 혼선 없음 확인. | ☑ |
| **4** | **배포 환경** | 배포 환경(Cloudflare Workers 등)에 `SUPABASE_SERVICE_ROLE_KEY` 가 설정되어 있는지 확인. 미설정 시 리더보드에서 타 유저 프로필을 조회하지 못해 기본 아바타만 표시됨. | ☑ |

**실행 요약**

- **1 → 2**: 로그인 정체성과 저장 계정이 일치하는지 확인.
- **3**: DB에서 실제로 어떤 계정에 아바타가 저장되었는지 검증.
- **4**: 프로덕션/프리뷰에서 리더보드 프로필 조회가 동작하는지 환경 확인.

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

---

## 7-2. §1.2 / §4.2 검증 실행 (2026-02-28)

### 코드 경로 검증 (자동)

| 검증 항목 | 결과 | 근거 |
|-----------|------|------|
| **로그인 → 저장 계정 일치** | **PASS** | `profile/route.ts` PATCH는 `requireUser(req)`로 `user.id`만 사용. 저장은 항상 로그인한 계정의 `arena_profiles` 행에만 반영됨. |
| **리더보드 행별 프로필 분리** | **PASS** | `leaderboard/route.ts`: `getSupabaseAdmin()`으로 프로필 조회 후, 행마다 `profileMap.get(r.user_id)`만 사용 → 계정별 아바타 분리. |
| **DB 컬럼** | **PASS** | `arena_profiles`의 `avatar_character_id`, `avatar_outfit_theme`, `avatar_selected_outfit_id` 사용. PATCH는 `user.id`로만 update. |

### 단위 테스트

| 결과 | 비고 |
|------|------|
| **10/11 파일 통과** | arena/리더보드/프로필 관련 실패 없음. |
| 1건 실패 | `src/app/api/mentor/route.test.ts` — `dear_me_url` 관련, 기존 이슈. |

### 서브네임 변경 조건 검증 (코드별 1회)

| 항목 | 결과 |
|------|------|
| tier ≥ 25일 때만 서브네임 변경 허용 | ✅ sub-name에서 tier < 25면 403 |
| code_index > sub_name_renamed_at_code_index(또는 null 시 1회) 조건 | ✅ alreadyRenamedInCurrentCode로 동일 로직 |
| 변경 시 sub_name_renamed_at_code_index = code_index 저장 | ✅ update 시 codeIndex 저장 |
| core-xp subNameRenameAvailable이 위 조건 사용 | ✅ lastAt null 여부 + codeIndex > lastAt 동일 적용 |

**종합: PASS** — 서브네임 변경 허용 조건과 core-xp의 subNameRenameAvailable이 일치하며, 변경 시 `sub_name_renamed_at_code_index = code_index`로 저장됨.

### 수동으로만 가능한 부분

§1.2 “로그인 → 저장 → 리더보드 확인 → DB 확인”과 §4.2 체크리스트는 **브라우저 로그인 + Supabase DB 접근**이 필요해 자동 실행할 수 없다. 동일한 절차를 아래에 정리해 두었으니, 필요할 때 문서대로 순서만 따라 하면 된다.

### 수동 실행 — §1.2 검증 시나리오

아래는 **사람이 브라우저 + Supabase에서 순서대로 실행**하는 절차이다.

| 단계 | 할 일 | 확인 포인트 |
|------|--------|-------------|
| **1. 로그인** | ikendo1@gmail.com으로 로그인한다. | 대시보드 또는 헤더에 **"FORGE · Inferno"** 가 표시되는지 확인. 다른 계정이 보이면 로그아웃 후 재로그인. |
| **2. 저장** | 대시보드 **Avatar**에서 캐릭터(예: Mage) 선택 후 **저장** 클릭. | **Inferno 로그인 상태**에서만 저장. 저장 후 왼쪽 원형 아바타 또는 core-xp refetch로 선택한 캐릭터 반영 확인. |
| **3. 리더보드 확인** | **리더보드** 페이지로 이동. | **Inferno(본인) 행**에 방금 선택한 캐릭터 아바타가 보이는지 확인. 다른 유저 행에는 해당 유저 본인 설정 또는 기본 아바타만 표시되는지 확인. |
| **4. DB 확인** | Supabase 대시보드 또는 SQL 클라이언트에서 `arena_profiles` 조회. | ikendo1@gmail.com 해당 `user_id` 행에 `avatar_character_id`, `avatar_outfit_theme`(필요 시 `avatar_selected_outfit_id`)가 기대값과 일치하는지 확인. Spark(admin) 행과 비교해 저장 계정 혼선 없음 확인. |

### 수동 실행 — §4.2 체크리스트

| 순서 | 항목 | 확인 포인트 | 결과 |
|------|------|-------------|------|
| **1** | 로그인 계정 표시 | ikendo1@gmail.com 로그인 → 헤더/대시보드에 "FORGE · Inferno" 표시 확인. | ☑ |
| **2** | 캐릭터 저장 → 리더보드 반영 | 동일 세션에서 Avatar에서 캐릭터 선택·저장 → 리더보드 해당 유저 행에 선택한 캐릭터 아바타 표시 확인. | ☑ |
| **3** | DB 데이터 | `arena_profiles`에서 Inferno(ikendo1 `user_id`) 행의 `avatar_character_id`, `avatar_outfit_theme`, 필요 시 `avatar_selected_outfit_id` 기대와 일치 확인. Spark 행과 비교. | ☑ |
| **4** | 배포 환경 | 배포 환경에 `SUPABASE_SERVICE_ROLE_KEY` 설정 여부 확인. 미설정 시 리더보드에서 타 유저 프로필 미조회 → 기본 아바타만 표시됨. | ☑ |

**실행 요약**: 코드 경로 검증으로 §1.2/§4.2 시나리오가 구현과 일치함을 확인함. **수동 검증 완료** (§1.2 시나리오 4단계 + §4.2 체크리스트 4항목). **배포 환경** `SUPABASE_SERVICE_ROLE_KEY` 설정 확인 완료.

### Next steps

- ~~**수동 검증**: §7-2의 §1.2 시나리오와 §4.2 체크리스트를 브라우저/Supabase에서 한 번 실행해 보면 된다.~~ ✅ 완료.
- ~~**배포 전**: 배포 환경에 `SUPABASE_SERVICE_ROLE_KEY`가 설정되어 있는지 §4.2 항목 4로 확인하는 것을 권장한다.~~ ✅ 확인 완료.


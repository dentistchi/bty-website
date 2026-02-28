# 다른 PC에서 레벨·아바타·언제부터 일했는지가 안 보일 때

Phase 3 마무리 후 **이전 컴퓨터에서 정해 둔** “언제부터 일했는지”, “레벨”, “아바타”가 **이 PC에서는 안 보이는** 경우의 원인과 확인 방법입니다.

---

## 1. 데이터가 어디에 저장되는지

| 보이는 것 | 저장 위치 | 비고 |
|-----------|-----------|------|
| **언제부터 일했는지** (joinedAt) | Supabase `memberships` 테이블의 `created_at` | 없으면 `auth.users.created_at` 사용 |
| **레벨** (S1/S2/S3, L1~L4) | DB에 “레벨 값”만 따로 저장되는 건 아님. `memberships`(role, job_function) + joinedAt으로 **계산** | `GET /api/arena/unlocked-scenarios` 가 memberships 조회 후 track·maxUnlockedLevel 반환 |
| **아바타** | Supabase `arena_profiles.avatar_url` | PATCH `/api/arena/profile` 로 저장 |

→ **전부 같은 Supabase 프로젝트**의 데이터입니다. 이 PC에서 **어느 Supabase를 쓰는지**가 중요합니다.

---

## 2. 안 보이는 흔한 원인

### (1) 이 PC의 환경 변수가 이전 PC과 다름 (가장 흔함)

- **이전 PC**: `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 등으로 **A 프로젝트** 연결
- **이 PC**: `.env.local` 이 없거나, **B 프로젝트** URL/키로 되어 있음  
→ 이 PC 앱은 **B**의 DB만 보므로, A에 저장해 둔 레벨·아바타·memberships 가 안 보입니다.

**확인 방법**

- 이 PC의 `bty-app/.env.local` 에서 `NEXT_PUBLIC_SUPABASE_URL` 확인.
- 이전 PC에서 쓰던 Supabase 대시보드 URL과 **완전히 같은지** 비교.

**해결**

- 이전 PC에서 쓰던 `.env.local` 내용을 그대로 이 PC에 복사해 넣기.  
  (또는 이전 PC과 **같은** Supabase 프로젝트의 URL/키만 이 PC `.env.local`에 넣기.)

---

### (2) 로그인 계정이 다름

- **이전 PC**: user@company.com 로 로그인해서 레벨·아바타 설정
- **이 PC**: 다른 이메일로 로그인  
→ `user_id` 가 달라서, 이전에 저장한 `arena_profiles`, `memberships` 를 이 PC에서는 조회하지 않습니다.

**확인**

- 지금 앱에서 로그인한 이메일이, 이전 PC에서 설정할 때 쓰던 계정과 같은지 확인.

---

### (3) 이전 PC에서 실제로 DB까지 저장이 안 됨

- 레벨: “레벨” 값 자체는 DB에 안 들어가고, **memberships(role, job_function) + created_at** 으로 계산됩니다.  
  이전 PC에서 **memberships** 에 한 번도 insert/update가 안 됐으면, 여기선 기본(가입일·기본 트랙)만 나옵니다.
- 아바타: Ready Player Me 등에서 만든 뒤 **“저장”** 버튼을 눌러서 `PATCH /api/arena/profile` 이 호출되어야 `arena_profiles.avatar_url` 에 들어갑니다.  
  저장을 안 눌렀거나, 네트워크 오류로 실패했으면 이 PC에서도 안 보입니다.

---

## 3. 이 PC에서 할 확인 순서

1. **같은 Supabase 쓰는지**
   - `bty-app/.env.local` 의 `NEXT_PUBLIC_SUPABASE_URL` 이 이전 PC에서 쓰던 프로젝트와 동일한지 확인.
2. **같은 계정으로 로그인했는지**
   - 현재 로그인 이메일 = 이전에 레벨·아바타 정할 때 쓰던 계정인지 확인.
3. **Supabase에 데이터가 있는지**
   - Supabase 대시보드 → Table Editor:
     - `memberships` : 본인 `user_id` 로 행이 있는지, `created_at`, `role`, `job_function` 이 예전에 넣어 둔 값인지.
     - `arena_profiles` : 본인 `user_id` 로 행이 있는지, `avatar_url` 이 비어 있지 않은지.

---

## 4. 여전히 내용이 다른 이유 — 체크리스트

같은 `.env.local`, 같은 계정인데도 **레벨·아바타·언제부터**가 이전 PC와 다르게 보이면 아래를 순서대로 확인하세요.

| # | 가능한 원인 | 확인 방법 | 대응 |
|---|-------------|-----------|------|
| 1 | **로그인한 사용자(user_id)가 다름** | 앱에서 표시되는 이메일 = 이전 PC에서 설정할 때 쓰던 계정과 **완전히 동일**한지 확인 (대소문자·공백 포함). | 동일한 계정으로 다시 로그인. |
| 2 | **memberships 행이 없음** | Supabase Table Editor → `memberships` → `user_id`가 현재 로그인 사용자 id와 같은 행이 있는지 확인. | “Arena 가입” 폼을 **이 PC에서** 다시 제출하거나, Admin이 해당 user_id로 memberships 행을 넣어 줌. |
| 3 | **memberships.status 가 'inactive'** | `memberships` 테이블에서 해당 행의 `status` 컬럼 값 확인. | `status = 'active'` 로 수정하거나, Admin이 활성 멤버십으로 갱신. |
| 4 | **arena_profiles 행이 없음** | Table Editor → `arena_profiles` → 본인 `user_id` 행 존재 여부. | 아바타 페이지에서 URL 입력 후 **Save URL** 한 번 누르면 `ensure_arena_profile` 호출로 행 생성됨. |
| 5 | **브라우저 캐시** | 시크릿/프라이빗 창에서 같은 URL로 접속해 보기. | 캐시 비우기 또는 시크릿 창에서 확인. |
| 6 | **이 앱에서 memberships를 넣지 않음** | bty-app 코드에는 **memberships에 insert하는 API가 없음**. 레벨용 데이터는 **다른 앱(Admin·가입 전용 페이지 등)** 또는 수동 SQL로 넣는 구조. | 이전 PC에서 “Arena 가입”을 **어느 앱/URL에서** 제출했는지 확인. 같은 앱에서 이 PC로 와서 같은 계정으로 제출하면, 같은 Supabase를 바라볼 때 동일하게 보임. |

| 7 | **같은 user_id로 memberships 행이 2개 이상** | Table Editor → `memberships`에서 같은 `user_id`로 **active** 행이 여러 개인지 확인. | 앱은 이제 **가장 최근 1건(created_at 내림차순)** 만 사용합니다. 원하는 레벨/역할이 다른 행이면, 사용하지 않을 행은 `status = 'inactive'`로 바꾸거나, 한 건만 남기고 정리하는 것을 권장합니다. |

---

## 5. 같은 user_id에 memberships 행이 2개일 때

- **원인**: Arena 가입을 두 번 제출했거나, Admin/다른 앱에서 같은 사용자로 행을 두 번 넣은 경우 등.
- **동작**: 앱(unlocked-scenarios, reflect)은 **created_at이 가장 늦은 1건**만 사용합니다. 예전에 넣은 행과 나중에 넣은 행의 role/job_function이 다르면 **최근 행** 기준으로 레벨이 결정됩니다.
- **원하는 쪽만 쓰고 싶을 때**: Supabase Table Editor에서 사용하지 않을 행의 **status**를 `inactive`로 바꾸면, 그 행은 조회되지 않습니다. 또는 사용할 행 1개만 남기고 나머지는 삭제해도 됩니다.

---

## 6. 아이디 통일·정리 후에도 화면이 다를 때

memberships·계정을 정리했는데도 **이전 작업 화면과 다르다**면 아래를 순서대로 확인하세요.

| # | 가능한 원인 | 확인 방법 | 대응 |
|---|-------------|-----------|------|
| 1 | **브라우저 캐시·로컬 저장** | 시크릿/프라이빗 창에서 같은 URL로 접속하거나, 개발자도구 → Application → Local Storage / Session Storage에서 해당 사이트 저장 데이터 삭제 후 새로고침. | 캐시 비우기, **시크릿 창**에서 로그인 후 다시 확인. 또는 Local Storage 항목(bty-arena 저장 상태 등) 삭제 후 새로고침. |
| 2 | **arena_profiles가 통일한 user_id 기준이 아님** | 통일한 **한 user_id**로 로그인한 뒤, Supabase Table Editor → `arena_profiles`에서 **그 user_id** 행의 `avatar_url`, `core_xp_total`, `l4_access` 등을 확인. | 이전에 보이던 아바타·XP는 **예전 user_id**의 arena_profiles에 있었을 수 있음. 지금 쓰는 user_id 행에 값을 다시 넣거나, 아바타는 Save URL, 레벨은 memberships만으로 계산되는지 확인. |
| 3 | **weekly_xp는 user_id별** | 시즌 XP·리더보드는 `weekly_xp` 테이블의 **user_id** 기준. 통일 전에 쌓은 XP는 **예전 user_id** 행에 있음. | 지금 로그인한 user_id의 `weekly_xp` 행을 Table Editor에서 확인. 0이면 정상(이 계정으로 쌓은 이벨이 없음). 예전 계정 데이터를 옮기려면 수동 이관 또는 다시 플레이. |
| 4 | **코드/빌드가 다름** | 이 PC에서 `git status`, `git log -1`로 이전 PC와 같은 커밋인지 확인. 로컬이면 `npm run dev` 재시작. | 같은 브랜치·같은 커밋으로 맞춘 뒤 `npm run dev` 다시 실행하고, **하드 새로고침**(Ctrl+Shift+R / Cmd+Shift+R). |
| 5 | **배포 vs 로컬** | 이전 PC에서는 **배포 URL**을 보고, 지금은 **localhost**를 보고 있을 수 있음(또는 반대). | 비교할 때 **같은 환경**(둘 다 로컬, 또는 둘 다 배포 URL)에서 같은 계정으로 확인. |

**요약**: 아이디를 **한 user_id로 통일**했으면, **그 user_id**의 memberships·arena_profiles·weekly_xp만 화면에 반영됩니다. 예전에 보이던 내용이 **다른 user_id**의 데이터였다면, 통일 후에는 그 데이터가 안 나오는 것이 맞고, 필요하면 **지금 user_id**로 다시 설정(아바타 Save URL, Arena 플레이로 XP 적립 등)하거나, DB에서 예전 user_id 데이터를 이 user_id로 이관해야 합니다.

---

## 7. 정리

- **레벨·아바타·언제부터 일했는지** 는 전부 **Supabase(같은 프로젝트) + 로그인한 user_id** 기준입니다.
- 이전 PC에서 쓰던 **Supabase URL/키**를 이 PC `.env.local` 에 넣고, **같은 계정**으로 로그인하면, 그때 저장해 둔 내용이 있으면 다시 보여야 합니다.
- 이 PC가 **다른 Supabase 프로젝트**를 바라보고 있으면, 그쪽 DB에는 이전 PC에서 넣은 데이터가 없기 때문에 **전부 안 보이는 것이 정상**입니다.  
  → 이전 PC에서 쓰던 `.env.local`(또는 Supabase URL/키)을 이 PC에 맞춰 넣은 뒤 다시 확인해 보시면 됩니다.

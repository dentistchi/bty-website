# Arena 두 트랙 병렬 작업 — Cursor A / Cursor B 명령서

**목적**: Cursor 창 2개로 동시 진행. 각 창은 아래 **자기 트랙만** 수행한다.  
**규칙**: 상대 트랙의 파일은 수정하지 않는다. 공유 파일은 아래 “공유 파일” 절에만 명시된 범위로만 건드린다.

---

## ✅ 완료 (Track A + B 반영됨)

- **Track A**: `arena_membership_requests` 마이그레이션, 제출/승인 API, 이메일(notifyMembershipRequest), Admin 승인 페이지(`/admin/arena-membership`), `unlocked-scenarios` 승인·tenure·아랫단계 오픈 반영.
- **Track B**: 대시보드 "ARENA LEVELS" 카드, `ArenaLevelsCard`(Bar+Steps, 현재 위치 강조/깜빡임), `unlocked-scenarios` 호출 연동.

---

## 공통 규칙 (두 트랙 모두)

- BTY Arena 규칙 준수: `.cursor/rules/bty-arena-global.mdc`, `bty-auth-deploy-safety.mdc`.
- XP/리더보드/시즌 로직은 domain/engine만; UI는 API 응답만 렌더.
- 작업 전 `docs/ARENA_MEMBERSHIP_LEVELS_AVATAR_PROPOSAL.md` 참고.

---

## Track A: 멤버십 · 승인 플로우 (Cursor 1)

**담당**: Arena 멤버십 요청 테이블, 제출/승인 API, 이메일 발송, Admin 승인 UI, `unlocked-scenarios`가 승인·입사일/리더시작일·“아랫단계 오픈”을 반영하도록 수정.

**수정/생성 가능한 경로**  
`bty-app/supabase/migrations/`, `bty-app/src/app/api/arena/`, `bty-app/src/app/api/admin/`, `bty-app/src/lib/bty/arena/` (program.ts, unlock.ts, tenure 관련), `bty-app/src/app/[locale]/bty/(protected)/` 중 **멤버십 가입/수정 폼이 들어갈 페이지**, Admin 관련 페이지.  
**Track B가 담당하는 대시보드 카드/레벨 UI 컴포넌트는 건드리지 않는다.**

### A1. DB 마이그레이션

- **파일**: `bty-app/supabase/migrations/` 아래 새 마이그레이션 하나 생성.
- **내용**:
  - 테이블 `arena_membership_requests` (또는 제안서대로 이름 확정).
  - 컬럼: `id`, `user_id` (auth.users 참조), `job_function` (text 또는 enum), `joined_at` (date 또는 timestamptz), `leader_started_at` (nullable, date 또는 timestamptz), `status` (`pending` | `approved`), `approved_at` (timestamptz null), `approved_by` (text null, admin 이메일 또는 user_id), `created_at`, `updated_at`.
  - RLS: 본인은 자신의 row만 select; insert는 authenticated; update는 본인 row만 pending→approved 전환 불가, admin만 approved로 변경 가능하도록 정책 또는 API에서만 승인 처리.
  - (승인은 API에서만 하고, RLS는 “본인 select/insert”만 해도 됨.)

### A2. API

- **제출 API** (예: `POST /api/arena/membership-request` 또는 `PUT /api/arena/membership-request`):
  - 인증 필수.
  - Body: `job_function`, `joined_at`, `leader_started_at` (optional).
  - `arena_membership_requests`에 `status=pending`으로 insert 또는 기존 pending 있으면 update.
  - 성공 시 **이메일 발송** (아래 A3).
- **Admin 승인 API** (예: `PATCH /api/admin/arena/membership-request` 또는 `/api/admin/arena/membership-requests/[id]/approve`):
  - BTY_ADMIN_EMAILS 등으로 admin만 호출 가능.
  - Body에 `request_id` 또는 path param. 해당 row의 `status`를 `approved`로, `approved_at=now()`, `approved_by=admin 이메일` 등 설정.
- **내 요청 조회** (예: `GET /api/arena/membership-request`):
  - 인증 필수. 현재 user_id의 최신 `arena_membership_requests` 1건 반환 (pending/approved 구분용).

### A3. 이메일

- 제출(pending 저장) 시 **ddshanbit@gmail.com**으로 이메일 발송.
  - 내용: “승인 대기: {유저 이메일}, 직군, 입사일, 리더시작일” + Admin 대시보드 링크(또는 승인 API 설명).
  - Resend/SendGrid/노드 메일러 등 프로젝트에 이미 있는 방식 사용. 없으면 `console.log` 또는 placeholder 함수로 “이메일 발송 예정” 로그만 남기고, 실제 발송은 나중에 연동.

### A4. Admin 승인 UI

- 기존 Admin 영역(예: `/bty/admin` 또는 기존 admin 라우트)에 **“Arena 멤버십 승인”** 섹션 추가.
  - `GET /api/admin/arena/membership-requests` (pending만 반환) 구현 후, 목록 표시.
  - 각 행에 [승인] 버튼 → 위 Admin 승인 API 호출 → 성공 시 목록에서 제거 또는 상태 갱신.

### A5. unlocked-scenarios 연동

- **파일**: `bty-app/src/app/api/arena/unlocked-scenarios/route.ts` 및 관련 `program.ts` / `unlock.ts` / tenure 로직.
- **할 일**:
  - `arena_membership_requests`에서 현재 유저의 **approved** row가 있으면 그 row의 `joined_at`, `leader_started_at`를 tenure 계산에 사용.
  - **pending만 있거나 없으면**: “승인 대기 중” 의미의 플래그 또는 메시지 반환; 레벨 목록은 빈 배열 또는 비오픈 처리.
  - **“아랫단계 오픈”**: leader 트랙이고 `maxUnlockedLevel`이 L1 이상이면, staff 레벨 S1, S2, S3 시나리오도 응답에 포함(기존 staff 트랙용 levels 구조와 동일하게). 응답 shape는 기존 `levels` 배열에 staff 레벨을 추가하거나, `staffLevelsOpenForLeader: true` + 기존 `levels`에 S1–S3 추가 등으로 기존 클라이언트와 호환되게.

### A6. 가입/수정 폼 (유저 측)

- Arena 멤버십을 “가입”하는 진입점 1곳 구현 (예: 대시보드 상단 카드 또는 “Arena 가입” 전용 작은 페이지).
  - 입력: 직군(select), 입사일(date), 리더시작일(date, optional).
  - 제출 시 위 제출 API 호출 → “승인 대기 중” 토스트/메시지.
  - `GET /api/arena/membership-request`로 pending/approved 상태 표시.

**Track A 완료 조건**  
- 마이그레이션 적용 시 `arena_membership_requests` 생성됨.  
- 제출 → pending 저장 → (가능하면) 이메일 발송.  
- Admin에서 pending 목록 확인 후 승인 가능.  
- 승인 후 `unlocked-scenarios`에서 approved 멤버십의 입사일/리더시작일로 tenure 반영되고, L1 이상이면 S1–S3 포함.

---

## Track B: ARENA LEVELS 카드 + 레벨 시각화 (Cursor 2)

**담당**: 대시보드에 “ARENA LEVELS” 카드 추가, Bar+Steps 형태 레벨 표시, 현재 위치 깜빡임.  
**Track A가 건드리는 API·DB·Admin·멤버십 폼은 수정하지 않는다.**

**수정/생성 가능한 경로**  
`bty-app/src/app/[locale]/bty/(protected)/dashboard/` (기존 대시보드 페이지에 카드 추가), `bty-app/src/components/bty-arena/` (레벨 표시용 컴포넌트 신규 또는 기존 ProgressCard 활용).

### B1. ARENA LEVELS 카드

- **파일**: `bty-app/src/app/[locale]/bty/(protected)/dashboard/page.client.tsx` (또는 해당 대시보드 클라이언트 컴포넌트).
- **할 일**:
  - `GET /api/arena/unlocked-scenarios` 호출 (기존 API 그대로 사용).
  - 응답에 `track`, `maxUnlockedLevel`, `levels`(레벨별 라벨·시나리오 개수)가 있으면 **“ARENA LEVELS”** 라벨의 ProgressCard(또는 동일 스타일 카드)를 추가해 다음을 표시:
    - Track: staff / leader.
    - Unlocked up to: 예) S2, L1.
    - 레벨별: S1(20개), S2(15개) … 또는 L1(15개), L2(…) 형태. `levels[]`와 기존 `arena_program.json` 구조 참고.
  - `l4_access`가 있으면 L4 (Partner) — admin-granted 문구 표시 (기존 스펙). 필요하면 `unlocked-scenarios`가 이미 L4를 반영하고 있을 수 있으므로, 응답의 `maxUnlockedLevel` 또는 별도 플래그로 처리.
  - **승인 대기 시**: API에서 “승인 대기” 플래그/메시지를 주면 “멤버십 승인 대기 중입니다. 승인 후 레벨이 표시됩니다.” 표시. (Track A가 해당 필드를 추가할 때까지는, 에러 또는 빈 levels일 때 같은 문구를 띄우면 됨.)

### B2. Bar + Steps 레벨 시각화

- **파일**: `bty-app/src/components/bty-arena/` 아래 신규 컴포넌트 (예: `ArenaLevelsCard.tsx` 또는 `LevelProgressBar.tsx`).
- **할 일**:
  - 가로 **진행 바** 위에 레벨을 **단계(점 또는 구간)** 로 표시 (S1, S2, S3 또는 L1–L4).
  - `maxUnlockedLevel`에 해당하는 단계를 **강조**(색상·두께 또는 **깜빡임**).
  - 잠긴 레벨은 흐리게 또는 자물쇠 아이콘.
- 이 컴포넌트를 위 ARENA LEVELS 카드 안에서 사용.

### B3. 대시보드 배치

- ARENA LEVELS 카드를 기존 대시보드 카드들(Season Progress, Lifetime Progress, Avatar 등)과 같은 그리드/순서에 맞춰 추가.  
- 위치: Avatar 카드 위쪽 또는 아래쪽 등 일관된 자리.

**Track B 완료 조건**  
- 대시보드에 ARENA LEVELS 카드가 보임.  
- `unlocked-scenarios` 응답으로 Track, Unlocked up to, 레벨별 시나리오 수 표시.  
- Bar+Steps에서 현재 Unlocked up to 단계가 시각적으로 강조(깜빡임 포함)됨.  
- 승인 대기 상태일 때 안내 문구 표시.

---

## 공유 파일 및 충돌 회피

- **`bty-app/src/app/api/arena/unlocked-scenarios/route.ts`**  
  - **Track A만** 수정 (승인·tenure·아랫단계 오픈 반영).  
  - Track B는 이 API를 **호출만** 하고, 응답 shape가 확장되어도 기존 필드(`track`, `maxUnlockedLevel`, `levels`)를 사용하면 됨.
- **`bty-app/src/app/[locale]/bty/(protected)/dashboard/page.client.tsx`**  
  - **Track B만** 수정 (ARENA LEVELS 카드 추가).  
  - Track A는 멤버십 **폼**을 별도 라우트나 모달로 두거나, 같은 페이지에 넣을 경우 **카드 내용/레벨 UI는 건드리지 않고** “Arena 가입” 카드나 링크만 추가.

---

## Cursor 사용 방법

- **Cursor 1**: 이 문서를 열고 “Track A만 수행해줘” 또는 “A1부터 A6까지 구현해줘”라고 지시. 이 파일과 `ARENA_MEMBERSHIP_LEVELS_AVATAR_PROPOSAL.md`를 컨텍스트로 참조.
- **Cursor 2**: 이 문서를 열고 “Track B만 수행해줘” 또는 “B1부터 B3까지 구현해줘”라고 지시. 동일 참조.

두 트랙이 동시에 진행되어도, 위 경로 분리와 공유 파일 규칙만 지키면 병합 충돌을 최소화할 수 있다.

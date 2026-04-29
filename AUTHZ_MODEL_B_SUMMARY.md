# 권한 모델 B 구현 요약

## 1) DB 마이그레이션 SQL

**파일:** `supabase/migrations/005_sso_level_office_assignments.sql`

**내용:**
- `enum public.sso_level` ('staff', 'manager') 생성
- `workforce_profiles.sso_level` 컬럼 추가 (team='sso'이고 null이면 'staff'로 기본값)
- `enum public.job_function` ('other', 'dentist', 'hygienist', 'assistant', 'receptionist', 'manager')
- `enum public.membership_status` ('active', 'invited', 'disabled')
- `public.office_assignments` 테이블 생성:
  - `id`, `user_id` (FK → auth.users), `office_id` (FK → offices)
  - `job_function`, `is_lead`, `status`, `is_primary`
  - `created_at`, `updated_at` (트리거로 자동 갱신)
  - unique(user_id, office_id), indexes

**실행:** Supabase SQL Editor에서 한 번에 실행 가능.

---

## 2) 코드 변경 파일 목록

### 2-1. `src/lib/authz.ts` (수정)

**변경:**
- `SSOLevel` 타입 추가
- `requireRegionAccess`에 SSO 지원:
  - memberships 없으면 `workforce_profiles`에서 `team='sso'` 확인
  - `sso_level='manager'` → `effectiveRole: "office_manager"`
  - `sso_level='staff'` → `effectiveRole: "staff"`
  - 성공 시 `{ ok: true, user, membership: null, sso: { level, effectiveRole }, scope }` 반환
- 기존 memberships 기반 로직 유지

### 2-2. `src/lib/authz-utils.ts` (신규)

**내용:**
- `assertRegionAccess(userId, orgId, regionId, minRole)`: 권한 확인, 실패 시 Error throw
- `listAccessibleOffices(userId, orgId, regionId)`: 접근 가능한 office 목록 반환
  - `office_manager`: `is_lead=true`인 office만
  - `regional_manager`, `staff`, `doctor`: region 전체 office

### 2-3. `src/lib/require-admin.ts` (유지)

- `@/lib/authz`에서 re-export만 하므로 변경 없음.

---

## 3) 테스트 시나리오 (브라우저 네트워크 확인)

### 3-1. 기본 인증 (쿠키 세션)

**요청:**
```
GET /api/admin/members?orgId=<uuid>&regionId=<uuid>
```

**기대:**
- Request Headers에 **Authorization 없음** ✅
- 쿠키만 있음 (`sb-...auth-token`)
- 로그인 안 됨 → **401 Unauthorized**
- 로그인 됨 + memberships 없음 → **403 Forbidden**

### 3-2. Role 기반 접근

**요청:**
```
GET /api/admin/members?orgId=<uuid>&regionId=<uuid>
```

**기대:**
- `memberships.role = "staff"` → **403** (minRole: office_manager 필요)
- `memberships.role = "office_manager"` → **200** + `{ ok: true, rows: [...] }`
- `memberships.role = "regional_manager"` → **200**

### 3-3. SSO 사용자

**요청:**
```
GET /api/admin/members?orgId=<uuid>&regionId=<uuid>
```

**기대:**
- `workforce_profiles.team = 'sso'`, `sso_level = 'staff'` → **403** (minRole: office_manager 필요)
- `workforce_profiles.team = 'sso'`, `sso_level = 'manager'` → **200** (effectiveRole: office_manager)

### 3-4. GET /api/me/region

**요청:**
```
GET /api/me/region?orgId=<uuid>&regionId=<uuid>
```

**기대:**
- 로그인 + memberships 있음 → **200** + `{ ok: true, user, membership, scope }`
- 로그인 + SSO → **200** + `{ ok: true, user, membership: null, sso: { level, effectiveRole }, scope }`

### 3-5. GET /api/admin/organizations

**요청:**
```
GET /api/admin/organizations?orgId=<uuid>&regionId=<uuid>
```

**기대:**
- `memberships.role >= "office_manager"` → **200** + `{ ok: true, organization: {...} }`
- `memberships.role = "staff"` → **403**

---

## 4) 개발 단계 가드

- **RLS 미적용:** DB는 open 상태 가정, API 레벨 권한체크만 수행.
- **권한 체크:** 모든 `/api/admin/*`는 `requireAdmin` 또는 `requireRegionAccess`로 게이트.
- **SSO:** `workforce_profiles.team='sso'` + `sso_level`로 권한 분기 (region override 훅 포인트 준비).

---

## 5) 실행 순서

1. **DB 마이그레이션:**
   ```sql
   -- Supabase SQL Editor에서 실행
   -- supabase/migrations/005_sso_level_office_assignments.sql 내용 복사
   ```

2. **코드 변경 확인:**
   - `src/lib/authz.ts` (SSO 지원)
   - `src/lib/authz-utils.ts` (신규)
   - 기존 admin 라우트는 `requireAdmin` 사용 중이므로 자동 적용

3. **테스트:**
   - 브라우저에서 `/admin/login` 로그인
   - Network 탭에서 `/api/admin/members?orgId=...&regionId=...` 호출
   - Response 200/401/403 확인

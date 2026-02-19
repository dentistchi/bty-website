# 005 마이그레이션 가이드: SSO level + office_assignments

## 실행 순서

### 1단계: 상태 검사 (선택)

**파일:** `005_check_status.sql`

현재 DB 상태 확인:
- `office_assignments` 테이블 존재 여부
- `status` 컬럼 존재 여부
- enum 타입 존재 여부
- constraints, indexes, triggers 상태

**실행:**
```sql
-- Supabase SQL Editor에서 실행
-- 005_check_status.sql 내용 복사
```

---

### 2단계: 마이그레이션 실행 (필수)

**파일:** `005_sso_level_office_assignments.sql`

**안전 보장:**
- 모든 `create type`은 `do $$ begin ... exception when duplicate_object then null; end $$;` 패턴
- `add column if not exists` 사용
- `create table if not exists` 사용
- unique constraint는 `if not exists` 체크 후 추가
- indexes는 `if not exists` 사용
- trigger는 `drop trigger if exists` 후 재생성

**실행:**
```sql
-- Supabase SQL Editor에서 한 번에 실행
-- 005_sso_level_office_assignments.sql 내용 복사
```

**예상 결과:**
- enum 타입 3개 생성 (sso_level, job_function, membership_status)
- workforce_profiles.sso_level 컬럼 추가
- office_assignments 테이블 생성 또는 컬럼 보강
- constraints, indexes, trigger 설정

---

### 3단계: 검증 (선택)

**파일:** `005_verify_final.sql`

마이그레이션 후 최종 상태 확인:
- enum 값 확인
- 테이블 구조 확인
- constraints, indexes, triggers 확인
- FK 관계 확인
- RLS 상태 확인 (현재는 disabled)

**실행:**
```sql
-- Supabase SQL Editor에서 실행
-- 005_verify_final.sql 내용 복사
```

---

## 주요 변경 사항

| 항목 | 내용 |
|------|------|
| **enum sso_level** | ('staff', 'manager') |
| **enum job_function** | ('other', 'dentist', 'hygienist', 'assistant', 'receptionist', 'manager') |
| **enum membership_status** | ('active', 'invited', 'disabled') |
| **workforce_profiles.sso_level** | 컬럼 추가, team='sso'이고 null이면 'staff'로 기본값 |
| **office_assignments** | 테이블 생성 또는 컬럼 보강 (id, user_id, office_id, job_function, is_lead, status, is_primary, timestamps) |
| **constraints** | unique(user_id, office_id) |
| **indexes** | user_id, office_id, status |
| **trigger** | updated_at 자동 갱신 |

---

## 에러 해결

**"column status does not exist" 에러:**
- 원인: `office_assignments` 테이블이 이미 존재하지만 `status` 컬럼이 없음
- 해결: `005_sso_level_office_assignments.sql`의 `add column if not exists status` 부분이 자동으로 컬럼 추가

**"type already exists" 에러:**
- 원인: enum이 이미 존재
- 해결: `do $$ begin ... exception when duplicate_object then null; end $$;` 패턴으로 안전하게 처리됨

---

## 다음 단계

1. ✅ 마이그레이션 실행
2. ✅ 검증 SQL로 상태 확인
3. ⏭️ 테스트 시드 데이터 투입 (다음 작업)
4. ⏭️ API 연결 (이미 구현됨)
5. ⏭️ RLS 적용 (마지막 단계)

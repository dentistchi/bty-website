# L1 — DB Migration Plan

**Status:** Locked v1.3 — Commander approved (v1.1 5 fixes + v1.2 3 hardenings + v1.3 4 STEP 0 patches applied, 2026-05-27). **Full STEP 0 inventory (§0.3.5 6 queries) 결과 수신 후 STEP 1 진입.**
**Lane:** L1 (DB schema migration)
**Authored:** 2026-05-27 by C3 (Claude), non-mutating dispatch author
**Executor:** Claude Code (VSCode), single mutation runner
**Spec authority:** `bty-app/docs/QR_VERIFICATION_ARCHITECTURE_V1.md` §6 (Locked v1)
**Plan authority:** `bty-app/docs/UNIVERSAL_QR_ARCHITECTURE_RECOVERY_PLAN.md` §4.3 L1
**Pre-flight memory invariants:** #24 (single Supabase project, production-effective), #22 (Phase 5 schema drift), #19 (bty_action_contracts canonical, arena_action_contracts absent)

**v1.1 fixes applied (Commander required):**
1. File 4 CHECK constraints — 모든 6개 idempotent `DO $$ ... IF NOT EXISTS ... $$` wrapper로 교체 (§5.1)
2. `verification_type_check` rollback — STEP 0 캡처 file 직접 주입 절차 명시, TODO 제거 (§0.1 / §5.3 / §6)
3. Test 5 negative test — INSERT 대신 UPDATE 기존 row 방식으로 전환 (NOT NULL collision 회피, §7.5 5a/5b/5c)
4. `contract_id` FK — 2-step (ADD COLUMN nullable → FK NOT VALID → 별도 VALIDATE step) 구조로 lock 시간 최소화 (§3.1 + 신규 §3.4)
5. `verification_status` DB default 미사용 — L2 책임 명시 (§10 L2 contract block + File 1 comment)

**v1.2 hardening applied (Commander recommended, non-blocking):**
- **A.** File 3 legacy stamp WHERE clause 강화 — `verification_tier IS NULL AND verification_confidence IS NULL` (partially-applied migration replay 안전성, §4.1) + §4.2 drift_partial_rows diagnostic 추가
- **B.** FK validate precheck — orphan sample 10개 출력 (운영 디버깅 속도, §3.4)
- **C.** Test 3 — strict equality 대신 contains check (`expected_constraints` 6개 모두 존재 검증, missing_constraints array로 누락 시 명확 보고, §7.3)

**v1.3 patches applied (STEP 0 partial inventory findings 반영):**
- **P1.** §0.1 `AS table` → `AS source_name` (PostgreSQL reserved keyword 회피)
- **P2.** §10 L2 contract block에 `verification_type` stamp 책임 추가 — STEP 0에서 NOT NULL + no DB default 확인. L2 must explicitly stamp verification_type.
- **P3.** File 4 expanded set에서 `'self_report'` 제거 — STEP 0에서 기존 CHECK에 부재 확인. Production truth alignment.
- **P4.** §7 Test 9 추가 — D-7 hole audit-only count (`status='approved' AND verified_at IS NULL AND validation_approved_at IS NOT NULL`). L1 audit, L8 disposition.
- **P5.** §0.3.5 신규 — Full STEP 0 inventory 6 queries (row counts / rehearsal accounts / verification_type distribution / D-7 hole baseline / drift_partial_rows). v1.3 lock 전 결과 수신 필수.
- **P6.** §0.4 report format에 v1.3 inventory 결과 필드 추가 (verification_type distribution / D-7 hole count / drift_partial_rows count).

---

## 0. Pre-flight Checklist (STEP 0 inventory-first)

L1 dispatch 발행 **전** Claude Code가 STEP 0로 수행할 read-only inventory. 결과 보고 후 Commander 승인 시 STEP 1 (migration apply) 진입.

### 0.1 Schema baseline 캡처

```sql
-- Capture current bty_action_contracts schema
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'bty_action_contracts'
ORDER BY ordinal_position;

-- Capture current le_verification_log schema
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'le_verification_log'
ORDER BY ordinal_position;

-- Existing CHECK constraints on bty_action_contracts
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.bty_action_contracts'::regclass
  AND contype = 'c';

-- ★ CRITICAL: capture original verification_type_check for rollback injection ★
-- 결과를 별도 file로 저장 (예: tmp/L1_STEP0_original_verification_type_check.sql)
-- File 4 rollback 시 이 정의를 그대로 ADD CONSTRAINT 절에 주입.
SELECT
  'ALTER TABLE public.bty_action_contracts ADD CONSTRAINT verification_type_check '
  || pg_get_constraintdef(oid) || ';' AS rollback_restore_sql
FROM pg_constraint
WHERE conname = 'verification_type_check'
  AND conrelid = 'public.bty_action_contracts'::regclass;

-- 만약 결과가 0 row면: 기존에 verification_type_check 자체가 없는 상태.
-- 이 경우 rollback 시 별도 ADD CONSTRAINT 절 불필요 (DROP만 수행).
-- STEP 0 report에 "original_verification_type_check_present: yes/no" 필드 명시.

-- Row counts
-- v1.3: 'table'은 PostgreSQL reserved keyword. AS source_name으로 alias.
SELECT 'bty_action_contracts' AS source_name, COUNT(*) AS total,
       COUNT(*) FILTER (WHERE verified_at IS NOT NULL) AS verified_rows
FROM bty_action_contracts
UNION ALL
SELECT 'le_verification_log', COUNT(*), NULL FROM le_verification_log;
```

**기대 결과 (memory #18 baseline 기준):**
- `bty_action_contracts` row count ~3358
- `verification_type` 컬럼 존재 (legacy 다중 값)
- `verified_at` 컬럼 존재 (nullable)
- `verification_tier`, `verification_status`, `verification_confidence`, `self_scan_suspected`, `actor_device_fingerprint_hash` 컬럼 **부재** (L1이 추가)
- `le_verification_log`에 `verifier_id`, `verifier_role`, `method` 컬럼 존재 (memory #이미 확인됨, ENGINE_ARCHITECTURE_DIRECTIVE_PLAN §AIR 이벤트 로깅)
- `contract_id`, `verifier_fingerprint_hash`, `verification_tier`, `verification_confidence`, `self_scan_suspected`, `evaluation_score`, `evaluation_comment` 컬럼 **부재** (L1이 추가)

### 0.2 8 hotfix contract IDs 재확인

```sql
-- D-7 (2026-05-26) hotfix contracts — verify they still exist + verified_at set
SELECT id, user_id, verified_at, validation_approved_at, status,
       details->>'legacy_disposition' AS disposition
FROM bty_action_contracts
WHERE id IN (
  -- full UUIDs to be filled from D-7 transcript / archived dispatch trail
  -- Plan §4.10 L8a lists 8 contracts; STEP 0 must produce full UUID list before L8
  'fe71287c-XXXX-XXXX-XXXX-XXXXXXXXXXXX',  -- chihanbit7
  'b76b1da3-XXXX-XXXX-XXXX-XXXXXXXXXXXX',  -- hanbitchi
  'e4632681-XXXX-XXXX-XXXX-XXXXXXXXXXXX',  -- STAB-08 smoke seed
  '1ba8b194-XXXX-XXXX-XXXX-XXXXXXXXXXXX',  -- ikendo1
  'c52628f0-XXXX-XXXX-XXXX-XXXXXXXXXXXX',  -- hanbitchi
  '9df071f9-XXXX-XXXX-XXXX-XXXXXXXXXXXX',  -- ywamer2022
  '38d9e485-XXXX-XXXX-XXXX-XXXXXXXXXXXX',  -- ikendo1
  'aaa3a010-XXXX-XXXX-XXXX-XXXXXXXXXXXX'   -- chihanbit7
);
```

**NOTE:** Full UUID list는 L8 (legacy disposition) lane 진입 시 inventory-first로 확정. L1 단계에서는 모든 legacy contract에 일괄적으로 `verification_tier='legacy_self_attest'` stamp되므로 8 hotfix 개별 식별이 L1 자체에는 불필요. 단 `details.legacy_disposition` mark는 L8에서 별도 추가.

### 0.3 Rehearsal account preservation check (memory #22)

```sql
-- Confirm rehearsal accounts unaffected — DELETE 없음, UPDATE만 (verification_tier set)
SELECT id, email FROM auth.users
WHERE id IN (
  '52e543cc-XXXX-XXXX-XXXX-XXXXXXXXXXXX',  -- hanbitchi
  '9587a44e-XXXX-XXXX-XXXX-XXXXXXXXXXXX'   -- chihanbit7
);
```

L1 migration은 DELETE 작업이 없으므로 FK CASCADE 위험 없음. 다만 확인 차원에서 STEP 0 inventory에 포함.

### 0.3.5 Full inventory queries (v1.3 added — lock-blocking)

STEP 0 1차 부분 inventory 후 발견된 5개 미완료 항목을 cover. Commander가 v1.3 lock 전 full inventory 받기 요구.

```sql
-- A. bty_action_contracts row count (v1.3 fixed: AS source_name not AS table)
SELECT 'bty_action_contracts' AS source_name, COUNT(*) AS total,
       COUNT(*) FILTER (WHERE verified_at IS NOT NULL) AS verified_rows
FROM bty_action_contracts;

-- B. le_verification_log row count
SELECT 'le_verification_log' AS source_name, COUNT(*) AS total
FROM le_verification_log;

-- C. Rehearsal accounts existence check
-- 정확한 UUID는 memory #22에 의해 hanbitchi=52e543cc, chihanbit7=9587a44e
SELECT id, email,
       CASE
         WHEN id::text LIKE '52e543cc%' THEN 'hanbitchi'
         WHEN id::text LIKE '9587a44e%' THEN 'chihanbit7'
         ELSE 'other'
       END AS rehearsal_label
FROM auth.users
WHERE id::text LIKE '52e543cc%'
   OR id::text LIKE '9587a44e%';

-- D. verification_type value distribution (production truth snapshot)
SELECT verification_type, COUNT(*) AS row_count
FROM bty_action_contracts
GROUP BY verification_type
ORDER BY row_count DESC;

-- E. D-7 hole audit baseline (pre-migration count)
SELECT
  COUNT(*) AS approved_without_verified_at_pre_migration
FROM bty_action_contracts
WHERE status = 'approved'
  AND verified_at IS NULL
  AND validation_approved_at IS NOT NULL;

-- F. drift_partial_rows diagnostic (§4.2 — partial migration evidence)
SELECT
  COUNT(*) AS drift_partial_rows
FROM bty_action_contracts
WHERE verification_tier IS NULL
  AND verification_confidence IS NOT NULL;
-- Fresh DB에서는 0 예상. > 0이면 이전 migration 흔적 또는 manual drift.
```

**6개 query 모두 read-only.** 결과는 §0.4 STEP 0 report에 명시 기록.

### 0.4 STEP 0 결과 보고 포맷

Claude Code는 STEP 0 종료 후 다음 형식으로 보고:

```
STEP 0 INVENTORY REPORT — L1 DB Migration
- Baseline timestamp: <UTC>
- bty_action_contracts total: <N>
  - rows with verified_at NOT NULL: <M>
  - existing verification_type CHECK constraint present: <yes/no>
  - ★ captured rollback_restore_sql: <SQL string OR "none — no existing constraint">
  - ★ saved to file: <path, e.g. tmp/L1_STEP0_original_verification_type_check.sql>
- le_verification_log total: <K>
- Columns to ADD on bty_action_contracts: <list>
- Columns to ADD on le_verification_log: <list>
- Rehearsal account presence: <hanbitchi yes/no>, <chihanbit7 yes/no>

### v1.3 added: full inventory items (lock-blocking)

- verification_type value distribution (현재 production 분포):
  ```
  | verification_type | count |
  |---|---|
  | self_attest | <count> |
  | qr          | <count> |
  | hybrid      | <count> |
  | <others>    | <count> |
  ```
- D-7 hole pre-migration count (audit baseline):
  ```
  status='approved' AND verified_at IS NULL AND validation_approved_at IS NOT NULL
  → count = <H>
  ```
- drift_partial_rows count (§4.2 diagnostic — pre-existing partial migration evidence):
  ```
  verification_tier IS NULL AND verification_confidence IS NOT NULL
  → count = <D>  (정상: 0)
  ```
- Migration risk flags: <any unexpected schema state>
- READY TO PROCEED: yes/no
```

Commander 승인 후 STEP 1 진입.

**Rollback prerequisite (lock-blocking):** STEP 0의 `rollback_restore_sql` 캡처 결과를 반드시 file에 저장. File 4 rollback 절차는 이 file을 직접 참조한다 (§5.3 + §6 참조). 캡처 실패 또는 file 누락 시 L1 dispatch 진행 금지.

---

## 1. Migration Files (4-file structure)

L1은 단일 거대 migration이 아니라 **순서 의존 4-file** 구조. 각 파일은 idempotent (`IF NOT EXISTS` / `IF EXISTS` 패턴).

| 순서 | 파일명 | 의미 |
|---|---|---|
| 1 | `20260527010000_qr_verification_v1_columns.sql` | `bty_action_contracts` 새 컬럼 5+1 추가 |
| 2 | `20260527010100_qr_verification_v1_log_extension.sql` | `le_verification_log` 컬럼 7개 추가 |
| 3 | `20260527010200_qr_verification_v1_legacy_stamp.sql` | 기존 row에 legacy_self_attest tier UPDATE |
| 4 | `20260527010300_qr_verification_v1_check_constraints.sql` | CHECK constraint 추가 (column + value validation) |

**왜 4-file 분리?**
- Migration이 실패하면 어느 파일에서 멈췄는지 정확히 식별 가능
- Rollback 시 역순으로 적용 (4 → 3 → 2 → 1)
- DDL과 DML (legacy stamp) 분리 — DDL 실패와 DML 실패는 복구 절차가 다름

---

## 2. File 1 — `20260527010000_qr_verification_v1_columns.sql`

### 2.1 SQL

```sql
-- L1 file 1/4: bty_action_contracts new columns
-- Spec: QR_VERIFICATION_ARCHITECTURE_V1.md §6.1
-- Authored: 2026-05-27

BEGIN;

-- 1. verification_tier — 검증 강도 분류 (mvp_open / member_only / manager_only / legacy_self_attest)
ALTER TABLE public.bty_action_contracts
  ADD COLUMN IF NOT EXISTS verification_tier text;

-- 2. verification_status — 현재 검증 상태 (pending / verified / rejected)
-- NOTE: contract lifecycle의 status 컬럼과 별도 (후자는 'draft'/'approved'/'submitted'/'escalated' 등)
-- v1.1: DB default 의도적으로 두지 않음. L2에서 contract creation 시 반드시 명시 stamp.
--   이유: lifecycle status와 verification status를 혼동하지 않기 위해, contract 생성 시점에
--   verification 상태가 'pending'임을 명시적으로 표현.
ALTER TABLE public.bty_action_contracts
  ADD COLUMN IF NOT EXISTS verification_status text;

-- 3. verification_confidence — 신뢰도 band (low / medium / high / legacy)
ALTER TABLE public.bty_action_contracts
  ADD COLUMN IF NOT EXISTS verification_confidence text;

-- 4. self_scan_suspected — mvp_open에서 scanner==actor fingerprint match
ALTER TABLE public.bty_action_contracts
  ADD COLUMN IF NOT EXISTS self_scan_suspected boolean DEFAULT false;

-- 5. actor_device_fingerprint_hash — contract 생성 시점 actor fingerprint
ALTER TABLE public.bty_action_contracts
  ADD COLUMN IF NOT EXISTS actor_device_fingerprint_hash text;

-- NOTE: verified_at 컬럼은 이미 존재 (확인됨). 추가 안 함.
-- NOTE: verified_by_user_id, verified_by_fingerprint_hash 명시적 미추가 (Commander D1 — le_verification_log가 source of truth)

-- Index for tier-aware queries
CREATE INDEX IF NOT EXISTS idx_bty_action_contracts_verification_tier
  ON public.bty_action_contracts (verification_tier)
  WHERE verification_tier IS NOT NULL;

-- Index for verification status filtering (admin dashboard, AIR computation)
CREATE INDEX IF NOT EXISTS idx_bty_action_contracts_verification_status
  ON public.bty_action_contracts (verification_status)
  WHERE verification_status IS NOT NULL;

COMMIT;
```

### 2.2 Idempotency

- 모든 `ADD COLUMN`이 `IF NOT EXISTS`
- 모든 `CREATE INDEX`가 `IF NOT EXISTS`
- 재실행 시 no-op + 0 row affected

### 2.3 Rollback (file 1)

```sql
BEGIN;
DROP INDEX IF EXISTS idx_bty_action_contracts_verification_status;
DROP INDEX IF EXISTS idx_bty_action_contracts_verification_tier;
ALTER TABLE public.bty_action_contracts DROP COLUMN IF EXISTS actor_device_fingerprint_hash;
ALTER TABLE public.bty_action_contracts DROP COLUMN IF EXISTS self_scan_suspected;
ALTER TABLE public.bty_action_contracts DROP COLUMN IF EXISTS verification_confidence;
ALTER TABLE public.bty_action_contracts DROP COLUMN IF EXISTS verification_status;
ALTER TABLE public.bty_action_contracts DROP COLUMN IF EXISTS verification_tier;
COMMIT;
```

**Rollback warning:** File 3 (legacy stamp) 이후 rollback 시 legacy_self_attest stamp data는 컬럼 자체와 함께 영구 손실. Data 손실 허용 가능한지 commander 확인 필요.

---

## 3. File 2 — `20260527010100_qr_verification_v1_log_extension.sql`

### 3.1 SQL

```sql
-- L1 file 2/4: le_verification_log extension
-- Spec: QR_VERIFICATION_ARCHITECTURE_V1.md §6.2
-- Authored: 2026-05-27

BEGIN;

-- 1. contract_id — bty_action_contracts와 직접 join 위한 FK (기존엔 activation_id만)
-- v1.1 변경: 대형 테이블 FK 추가 시 ACCESS EXCLUSIVE lock 회피.
--   (a) nullable column 먼저 추가 (DDL fast)
--   (b) FK는 NOT VALID로 추가 — 기존 row 검증 skip, 새 row만 enforce
--   (c) VALIDATE CONSTRAINT는 별도 step에서 (lock 약함, SHARE UPDATE EXCLUSIVE)
ALTER TABLE public.le_verification_log
  ADD COLUMN IF NOT EXISTS contract_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'le_verification_log_contract_id_fkey'
      AND conrelid = 'public.le_verification_log'::regclass
  ) THEN
    ALTER TABLE public.le_verification_log
      ADD CONSTRAINT le_verification_log_contract_id_fkey
      FOREIGN KEY (contract_id)
      REFERENCES public.bty_action_contracts(id)
      NOT VALID;
  END IF;
END $$;

-- VALIDATE는 별도 step (§3.4 참조). L1 file 2 자체에서는 NOT VALID 상태로 두고,
-- 모든 4-file 완료 + Test 통과 후 §3.4의 validate step 실행.

-- 2. verifier_fingerprint_hash — mvp_open에서 anon scanner fingerprint
ALTER TABLE public.le_verification_log
  ADD COLUMN IF NOT EXISTS verifier_fingerprint_hash text;

-- 3. verification_tier — log row가 발생한 tier 정책
ALTER TABLE public.le_verification_log
  ADD COLUMN IF NOT EXISTS verification_tier text;

-- 4. verification_confidence — record-level confidence band
ALTER TABLE public.le_verification_log
  ADD COLUMN IF NOT EXISTS verification_confidence text;

-- 5. self_scan_suspected — mvp_open record에서 self-scan 의심 flag
ALTER TABLE public.le_verification_log
  ADD COLUMN IF NOT EXISTS self_scan_suspected boolean DEFAULT false;

-- 6. evaluation_score — manager_only tier formal evaluation
ALTER TABLE public.le_verification_log
  ADD COLUMN IF NOT EXISTS evaluation_score int;

-- 7. evaluation_comment — manager_only tier formal evaluation
ALTER TABLE public.le_verification_log
  ADD COLUMN IF NOT EXISTS evaluation_comment text;

-- Index for contract-based lookup (L4 validate route + UI)
CREATE INDEX IF NOT EXISTS idx_le_verification_log_contract_id
  ON public.le_verification_log (contract_id)
  WHERE contract_id IS NOT NULL;

-- Index for tier-aware audit queries
CREATE INDEX IF NOT EXISTS idx_le_verification_log_verification_tier
  ON public.le_verification_log (verification_tier)
  WHERE verification_tier IS NOT NULL;

COMMIT;
```

### 3.2 RLS preservation

기존 `le_verification_log` RLS 정책 (`auth.uid() = user_id` 본인만 select/insert) 그대로 유지. 새 컬럼은 동일 RLS 적용.

### 3.3 Rollback (file 2)

```sql
BEGIN;
DROP INDEX IF EXISTS idx_le_verification_log_verification_tier;
DROP INDEX IF EXISTS idx_le_verification_log_contract_id;
-- v1.1: FK constraint를 먼저 DROP (NOT VALID 이거나 VALIDATE된 상태 모두 처리)
ALTER TABLE public.le_verification_log DROP CONSTRAINT IF EXISTS le_verification_log_contract_id_fkey;
ALTER TABLE public.le_verification_log DROP COLUMN IF EXISTS evaluation_comment;
ALTER TABLE public.le_verification_log DROP COLUMN IF EXISTS evaluation_score;
ALTER TABLE public.le_verification_log DROP COLUMN IF EXISTS self_scan_suspected;
ALTER TABLE public.le_verification_log DROP COLUMN IF EXISTS verification_confidence;
ALTER TABLE public.le_verification_log DROP COLUMN IF EXISTS verification_tier;
ALTER TABLE public.le_verification_log DROP COLUMN IF EXISTS verifier_fingerprint_hash;
ALTER TABLE public.le_verification_log DROP COLUMN IF EXISTS contract_id;
COMMIT;
```

### 3.4 FK VALIDATE step (post-migration, separate)

L1 4-file 전체 적용 + Test 통과 후 별도 step으로 실행. NOT VALID 상태의 FK를 VALIDATE하여 enforcement 활성화. Lock 영향이 낮음 (SHARE UPDATE EXCLUSIVE, table read 가능).

```sql
-- v1.1 added: FK validation step (run after L1 file 1-4 + Test pass)
-- Authority: L1_MIGRATION_PLAN.md §3.4
-- Lock level: SHARE UPDATE EXCLUSIVE (reads continue, writes blocked briefly)

BEGIN;

-- Pre-check: existing contract_id values are all NULL or reference real contracts
-- (L1 시점에는 contract_id가 모두 NULL — L4 validate route deploy 이후부터 채워짐)
-- v1.2: orphan 발생 시 sample 10개 출력 — 운영 디버깅 속도 개선
DO $$
DECLARE
  orphan_count int;
  orphan_samples text;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM public.le_verification_log lvl
  WHERE lvl.contract_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.bty_action_contracts bac
      WHERE bac.id = lvl.contract_id
    );

  IF orphan_count > 0 THEN
    -- v1.2: 최대 10개 orphan row id + contract_id 캡처 → exception message에 포함
    SELECT string_agg(
      format('log_id=%s contract_id=%s', sample.id, sample.contract_id),
      E'\n  '
    ) INTO orphan_samples
    FROM (
      SELECT lvl.id, lvl.contract_id
      FROM public.le_verification_log lvl
      WHERE lvl.contract_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.bty_action_contracts bac
          WHERE bac.id = lvl.contract_id
        )
      LIMIT 10
    ) sample;

    RAISE EXCEPTION E'FK VALIDATE FAILED: % orphan contract_id rows. Investigate before validating.\nSample (first 10):\n  %',
      orphan_count, orphan_samples;
  END IF;
END $$;

-- VALIDATE existing rows (lock-friendly)
ALTER TABLE public.le_verification_log
  VALIDATE CONSTRAINT le_verification_log_contract_id_fkey;

COMMIT;
```

**실행 시점 결정:**
- **Option A (권장):** L1 4-file + Test 모두 통과 후 즉시 실행. L1 시점엔 `contract_id`가 모두 NULL이므로 orphan 검사 자명하게 통과.
- **Option B:** L4 validate route deploy 후 일정 기간 (1-2주) 데이터 누적 후 실행. 운영 데이터로 enforcement 사전 검증.

Commander 결정. Default = Option A.

**Verify gate:**
```sql
SELECT conname, convalidated
FROM pg_constraint
WHERE conname = 'le_verification_log_contract_id_fkey';
-- Expected: convalidated = true
```

---

## 4. File 3 — `20260527010200_qr_verification_v1_legacy_stamp.sql`

### 4.1 SQL

```sql
-- L1 file 3/4: legacy contract stamp
-- Spec: QR_VERIFICATION_ARCHITECTURE_V1.md §8.1
-- Commander D2: XP/AIR preserved, no rollback
-- Authored: 2026-05-27

BEGIN;

-- Mark all pre-cutover contracts as legacy
UPDATE public.bty_action_contracts
SET
  verification_tier = 'legacy_self_attest',
  verification_status = CASE
    WHEN verified_at IS NOT NULL THEN 'verified'
    ELSE 'pending'
  END,
  verification_confidence = 'legacy'
-- v1.2: partially-applied migration replay 안전성 강화.
-- verification_tier만 NULL인데 confidence가 이미 채워진 drift row를 덮어쓰지 않음.
WHERE verification_tier IS NULL
  AND verification_confidence IS NULL;

-- Audit: count of stamped rows
DO $$
DECLARE
  legacy_count int;
BEGIN
  SELECT COUNT(*) INTO legacy_count
  FROM public.bty_action_contracts
  WHERE verification_tier = 'legacy_self_attest';

  RAISE NOTICE 'L1 file 3: stamped % rows as legacy_self_attest', legacy_count;
END $$;

COMMIT;
```

### 4.2 Pre-execution count snapshot

File 3 적용 직전·직후에 다음 쿼리로 row 변화 확인 (rollback 판단 근거):

```sql
-- Before file 3
SELECT COUNT(*) AS pre_stamp_total FROM bty_action_contracts;
-- v1.2: WHERE 조건을 File 3 UPDATE와 동일하게 맞춤
SELECT COUNT(*) AS pre_stamp_eligible
FROM bty_action_contracts
WHERE verification_tier IS NULL
  AND verification_confidence IS NULL;
-- Diagnostic: drift detection — tier만 NULL이고 confidence가 이미 채워진 row가 있는지
SELECT COUNT(*) AS drift_partial_rows
FROM bty_action_contracts
WHERE verification_tier IS NULL
  AND verification_confidence IS NOT NULL;
-- drift_partial_rows > 0이면 STEP 0에서 추가 inventory 필요 (이전 partial migration 흔적)

-- After file 3
SELECT COUNT(*) AS post_stamp_legacy FROM bty_action_contracts WHERE verification_tier = 'legacy_self_attest';
SELECT verification_confidence, verification_status, COUNT(*)
FROM bty_action_contracts
WHERE verification_tier = 'legacy_self_attest'
GROUP BY verification_confidence, verification_status;
```

**기대:** `pre_stamp_eligible == post_stamp_legacy - (previous legacy_self_attest count, normally 0)`. Fresh migration이면 `drift_partial_rows = 0` 예상.

**기대:** pre_stamp_null_tier == post_stamp_legacy (baseline ~3358).

### 4.3 Rollback (file 3)

```sql
BEGIN;
-- Restore tier=NULL for legacy rows
UPDATE public.bty_action_contracts
SET
  verification_tier = NULL,
  verification_status = NULL,
  verification_confidence = NULL
WHERE verification_tier = 'legacy_self_attest';
COMMIT;
```

**Rollback safety:** File 3 적용 직후 file 4 (CHECK constraints) 미적용 상태라면 rollback은 단순 UPDATE. File 4 적용 이후엔 CHECK constraint를 먼저 DROP한 뒤 rollback해야 함 (File 4 rollback 절차로 자동 처리).

---

## 5. File 4 — `20260527010300_qr_verification_v1_check_constraints.sql`

### 5.1 SQL (idempotent wrappers — production-ready)

PostgreSQL은 `ADD CONSTRAINT ... IF NOT EXISTS`를 지원하지 않으므로 모든 constraint를 `DO $$ ... IF NOT EXISTS ... $$` 블록으로 감싼다. 재실행 시 no-op 보장.

```sql
-- L1 file 4/4: CHECK constraints (idempotent)
-- Spec: QR_VERIFICATION_ARCHITECTURE_V1.md §6.3
-- Authored: 2026-05-27
-- Production-ready: re-runnable safely

BEGIN;

-- ====================================================================
-- 1. verification_tier value validation
-- ====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'verification_tier_check'
      AND conrelid = 'public.bty_action_contracts'::regclass
  ) THEN
    ALTER TABLE public.bty_action_contracts
      ADD CONSTRAINT verification_tier_check
      CHECK (verification_tier IS NULL OR verification_tier IN (
        'mvp_open', 'member_only', 'manager_only', 'legacy_self_attest'
      ));
  END IF;
END $$;

-- ====================================================================
-- 2. verification_status value validation
-- ====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'verification_status_check'
      AND conrelid = 'public.bty_action_contracts'::regclass
  ) THEN
    ALTER TABLE public.bty_action_contracts
      ADD CONSTRAINT verification_status_check
      CHECK (verification_status IS NULL OR verification_status IN (
        'pending', 'verified', 'rejected'
      ));
  END IF;
END $$;

-- ====================================================================
-- 3. verification_confidence value validation
-- ====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'verification_confidence_check'
      AND conrelid = 'public.bty_action_contracts'::regclass
  ) THEN
    ALTER TABLE public.bty_action_contracts
      ADD CONSTRAINT verification_confidence_check
      CHECK (verification_confidence IS NULL OR verification_confidence IN (
        'low', 'medium', 'high', 'legacy'
      ));
  END IF;
END $$;

-- ====================================================================
-- 4. verification_type expansion (legacy + new canonical)
--    NOTE: DROP CONSTRAINT IF EXISTS는 idempotent (재실행 안전).
--    원본 정의는 STEP 0 inventory에서 캡처되어 rollback에 사용 가능.
-- ====================================================================
ALTER TABLE public.bty_action_contracts
  DROP CONSTRAINT IF EXISTS verification_type_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'verification_type_check'
      AND conrelid = 'public.bty_action_contracts'::regclass
  ) THEN
    ALTER TABLE public.bty_action_contracts
      ADD CONSTRAINT verification_type_check
      CHECK (verification_type IN (
        -- New canonical (post-cutover)
        'action_completed', 'non_event_confirmed', 'manager_reviewed',
        -- Legacy (preserved during cutover, deprecated post-launch)
        -- v1.3: 'self_report' 제거. STEP 0 inventory에서 기존 CHECK에 부재 확인.
        -- production truth alignment 우선 (future-proofing보다).
        'self_attest', 'qr', 'link', 'hybrid',
        'qr_peer', 'qr_system', 'qr_location', 'none'
      ));
  END IF;
END $$;

-- ====================================================================
-- 5. le_verification_log tier validation
-- ====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'le_verification_log_tier_check'
      AND conrelid = 'public.le_verification_log'::regclass
  ) THEN
    ALTER TABLE public.le_verification_log
      ADD CONSTRAINT le_verification_log_tier_check
      CHECK (verification_tier IS NULL OR verification_tier IN (
        'mvp_open', 'member_only', 'manager_only', 'legacy_self_attest'
      ));
  END IF;
END $$;

-- ====================================================================
-- 6. le_verification_log confidence validation
-- ====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'le_verification_log_confidence_check'
      AND conrelid = 'public.le_verification_log'::regclass
  ) THEN
    ALTER TABLE public.le_verification_log
      ADD CONSTRAINT le_verification_log_confidence_check
      CHECK (verification_confidence IS NULL OR verification_confidence IN (
        'low', 'medium', 'high', 'legacy'
      ));
  END IF;
END $$;

-- ====================================================================
-- NOTE: INVARIANT I1 (member/manager tier requires verifier_id != contract.user_id)
-- 은 cross-row CHECK가 필요하므로 DB level이 아닌 application layer (L4)에서 enforce.
-- DB trigger로 강제할 수도 있으나 debugging 복잡도로 인해 application enforcement 선택.
-- ====================================================================

COMMIT;
```

### 5.2 Idempotency design notes

위 SQL은 **모든 6 constraint에 idempotent wrapper 적용 완료** (v1.1 기준). 재실행 시 no-op + 0 row affected 보장.

**구조 설명:**
- `DO $$ BEGIN ... END $$` PL/pgSQL anonymous block 사용
- `pg_constraint`에서 `conname` + `conrelid`로 정확한 constraint 식별 (스키마 충돌 방지)
- `verification_type_check`는 기존 constraint를 DROP 후 expanded 정의로 재추가 — `DROP CONSTRAINT IF EXISTS` 자체가 idempotent이므로 안전
- 트랜잭션 단위: BEGIN/COMMIT 한 블록 안에서 6 constraint 일괄 적용 — 일부 실패 시 전체 ROLLBACK

**주의:** PL/pgSQL `DO` 블록은 Supabase migration runner에서 정상 지원됨 (확인된 패턴).

### 5.3 Rollback (file 4)

**전제:** STEP 0에서 캡처한 `rollback_restore_sql`이 file (예: `tmp/L1_STEP0_original_verification_type_check.sql`)에 저장되어 있어야 함.

**Rollback 실행 절차:**

1. **STEP 0 캡처 file 로드** — `tmp/L1_STEP0_original_verification_type_check.sql` 내용 확인.
2. **아래 rollback SQL 실행** — `<STEP_0_RESTORE_SQL_INJECTED_HERE>` 위치에 캡처 file 내용 그대로 삽입.
3. **삽입 결과가 "none — no existing constraint"인 경우** — File 4 rollback 시 verification_type_check 별도 ADD CONSTRAINT 불필요. DROP만 수행.

```sql
BEGIN;

ALTER TABLE public.le_verification_log DROP CONSTRAINT IF EXISTS le_verification_log_confidence_check;
ALTER TABLE public.le_verification_log DROP CONSTRAINT IF EXISTS le_verification_log_tier_check;
ALTER TABLE public.bty_action_contracts DROP CONSTRAINT IF EXISTS verification_type_check;

-- ★ STEP 0 캡처 file 내용을 아래에 그대로 주입 ★
-- 예시 (캡처 결과가 존재할 경우):
-- ALTER TABLE public.bty_action_contracts ADD CONSTRAINT verification_type_check
--   CHECK (verification_type = ANY (ARRAY['self_attest'::text, 'qr'::text, ...]));
<STEP_0_RESTORE_SQL_INJECTED_HERE>

ALTER TABLE public.bty_action_contracts DROP CONSTRAINT IF EXISTS verification_confidence_check;
ALTER TABLE public.bty_action_contracts DROP CONSTRAINT IF EXISTS verification_status_check;
ALTER TABLE public.bty_action_contracts DROP CONSTRAINT IF EXISTS verification_tier_check;

COMMIT;
```

**Lock-blocking invariant:** STEP 0 캡처 file이 존재하지 않거나 캡처 결과가 누락된 상태에서는 File 4 rollback 절대 실행 금지. CHECK constraint 부재 상태로 production이 노출되면 invalid value insert 위험.

**Verification post-rollback:** rollback 실행 후 다음 쿼리로 원본 constraint 복원 확인:

```sql
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'verification_type_check'
  AND conrelid = 'public.bty_action_contracts'::regclass;
-- 결과는 STEP 0 캡처 시점 정의와 일치해야 함 (캡처가 "none"이면 0 row OK)
```

---

## 6. Full Rollback Script

전체 L1을 한 번에 되돌릴 때 (역순):

```sql
-- L1 full rollback — execute only after Commander approval
-- Order: 4 → 3 → 2 → 1

BEGIN;

-- ==== Reverse File 4: CHECK constraints ====
-- Pre-req: STEP 0 캡처 file (tmp/L1_STEP0_original_verification_type_check.sql)
-- 의 내용을 <STEP_0_RESTORE_SQL_INJECTED_HERE> 위치에 그대로 주입.
-- 캡처 결과가 "none"이면 ADD CONSTRAINT 절 생략 (DROP만 수행).
ALTER TABLE public.le_verification_log DROP CONSTRAINT IF EXISTS le_verification_log_confidence_check;
ALTER TABLE public.le_verification_log DROP CONSTRAINT IF EXISTS le_verification_log_tier_check;
ALTER TABLE public.bty_action_contracts DROP CONSTRAINT IF EXISTS verification_type_check;

-- ★ INJECTION POINT ★
<STEP_0_RESTORE_SQL_INJECTED_HERE>

ALTER TABLE public.bty_action_contracts DROP CONSTRAINT IF EXISTS verification_confidence_check;
ALTER TABLE public.bty_action_contracts DROP CONSTRAINT IF EXISTS verification_status_check;
ALTER TABLE public.bty_action_contracts DROP CONSTRAINT IF EXISTS verification_tier_check;

-- ==== Reverse File 3: legacy stamp ====
UPDATE public.bty_action_contracts
SET verification_tier = NULL,
    verification_status = NULL,
    verification_confidence = NULL
WHERE verification_tier = 'legacy_self_attest';

-- ==== Reverse File 2: le_verification_log columns ====
DROP INDEX IF EXISTS idx_le_verification_log_verification_tier;
DROP INDEX IF EXISTS idx_le_verification_log_contract_id;
-- v1.1: FK constraint를 먼저 DROP
ALTER TABLE public.le_verification_log DROP CONSTRAINT IF EXISTS le_verification_log_contract_id_fkey;
ALTER TABLE public.le_verification_log DROP COLUMN IF EXISTS evaluation_comment;
ALTER TABLE public.le_verification_log DROP COLUMN IF EXISTS evaluation_score;
ALTER TABLE public.le_verification_log DROP COLUMN IF EXISTS self_scan_suspected;
ALTER TABLE public.le_verification_log DROP COLUMN IF EXISTS verification_confidence;
ALTER TABLE public.le_verification_log DROP COLUMN IF EXISTS verification_tier;
ALTER TABLE public.le_verification_log DROP COLUMN IF EXISTS verifier_fingerprint_hash;
ALTER TABLE public.le_verification_log DROP COLUMN IF EXISTS contract_id;

-- ==== Reverse File 1: bty_action_contracts columns ====
DROP INDEX IF EXISTS idx_bty_action_contracts_verification_status;
DROP INDEX IF EXISTS idx_bty_action_contracts_verification_tier;
ALTER TABLE public.bty_action_contracts DROP COLUMN IF EXISTS actor_device_fingerprint_hash;
ALTER TABLE public.bty_action_contracts DROP COLUMN IF EXISTS self_scan_suspected;
ALTER TABLE public.bty_action_contracts DROP COLUMN IF EXISTS verification_confidence;
ALTER TABLE public.bty_action_contracts DROP COLUMN IF EXISTS verification_status;
ALTER TABLE public.bty_action_contracts DROP COLUMN IF EXISTS verification_tier;

COMMIT;
```

**Rollback 사용 시점:**
- File 1 또는 2 적용 실패 (DDL 에러) → 해당 파일 rollback만 수행
- File 3 (legacy stamp) 결과가 예상 row count와 다름 (예: 갯수 mismatch >5%) → File 3 rollback + investigation
- File 4 적용 후 production 트래픽에서 CHECK violation 다수 발생 → File 4 rollback + investigation
- 전체 rollback (위 스크립트) = 최후의 수단, Commander 명시 승인 필요

---

## 7. Verification Test Fixtures

L1 migration 완료 후 STEP 2 verification에서 실행할 test fixture. 모두 read-only / 비파괴적.

### 7.1 Test 1 — Schema verification

```sql
-- Confirm all 6 new columns on bty_action_contracts
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'bty_action_contracts'
  AND column_name IN (
    'verification_tier', 'verification_status', 'verification_confidence',
    'self_scan_suspected', 'actor_device_fingerprint_hash'
  )
ORDER BY column_name;

-- Expected: 5 rows (verified_at 이미 존재해 제외)
```

### 7.2 Test 2 — le_verification_log extension

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'le_verification_log'
  AND column_name IN (
    'contract_id', 'verifier_fingerprint_hash', 'verification_tier',
    'verification_confidence', 'self_scan_suspected',
    'evaluation_score', 'evaluation_comment'
  )
ORDER BY column_name;

-- Expected: 7 rows
```

### 7.3 Test 3 — CHECK constraints active

```sql
-- Diagnostic view: list all verification-related CHECK constraints present
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid IN ('public.bty_action_contracts'::regclass, 'public.le_verification_log'::regclass)
  AND contype = 'c'
  AND conname LIKE '%verification%';

-- v1.2: contains-check 방식. strict equality (== 6) 는 환경에 따라
-- 사전에 존재하던 verification 관련 constraint가 더 잡힐 수 있어 위험.
-- 6개 expected constraint가 "모두 포함되는지"만 검증.
DO $$
DECLARE
  missing_constraints text[];
  expected_constraints text[] := ARRAY[
    'verification_tier_check',
    'verification_status_check',
    'verification_confidence_check',
    'verification_type_check',
    'le_verification_log_tier_check',
    'le_verification_log_confidence_check'
  ];
  c text;
BEGIN
  missing_constraints := ARRAY[]::text[];
  FOREACH c IN ARRAY expected_constraints LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = c
        AND conrelid IN (
          'public.bty_action_contracts'::regclass,
          'public.le_verification_log'::regclass
        )
    ) THEN
      missing_constraints := array_append(missing_constraints, c);
    END IF;
  END LOOP;

  IF array_length(missing_constraints, 1) > 0 THEN
    RAISE EXCEPTION 'TEST 3 FAILED: missing expected constraints: %', missing_constraints;
  ELSE
    RAISE NOTICE 'TEST 3 PASSED: all 6 expected constraints present (additional verification-related constraints OK)';
  END IF;
END $$;
```

**Expected:** 6 expected constraints 모두 존재. 추가 verification-related constraints가 있어도 PASS.
- `bty_action_contracts`: `verification_tier_check`, `verification_status_check`, `verification_confidence_check`, `verification_type_check`
- `le_verification_log`: `le_verification_log_tier_check`, `le_verification_log_confidence_check`

### 7.4 Test 4 — Legacy stamp completeness

```sql
SELECT
  COUNT(*) FILTER (WHERE verification_tier IS NULL) AS unstamped,
  COUNT(*) FILTER (WHERE verification_tier = 'legacy_self_attest') AS legacy,
  COUNT(*) FILTER (WHERE verification_confidence = 'legacy') AS legacy_confidence,
  COUNT(*) AS total
FROM public.bty_action_contracts;

-- Expected: unstamped = 0, legacy = total, legacy_confidence = total
```

### 7.5 Test 5 — CHECK constraint enforcement (negative test)

**v1.1 변경:** INSERT 방식은 `bty_action_contracts`의 다른 NOT NULL 컬럼(action_id / action_type 등)에 의해 CHECK 도달 전 다른 constraint로 실패할 수 있다. 따라서 **기존 row 1개를 UPDATE**하는 방식으로 전환. UPDATE는 새 row 생성이 없으므로 NOT NULL collision 없음. 모든 시나리오는 BEGIN/ROLLBACK으로 wrap하여 data 변경 없음.

```sql
-- Test 5a — invalid verification_tier rejected by CHECK
BEGIN;
DO $$
DECLARE
  sample_id uuid;
BEGIN
  -- Pick any existing row (legacy_self_attest stamped post-File 3)
  SELECT id INTO sample_id
  FROM public.bty_action_contracts
  WHERE verification_tier = 'legacy_self_attest'
  LIMIT 1;

  IF sample_id IS NULL THEN
    RAISE EXCEPTION 'TEST 5a SKIPPED: no rows available — File 3 legacy stamp may have failed';
  END IF;

  BEGIN
    UPDATE public.bty_action_contracts
    SET verification_tier = 'invalid_tier_xyz'
    WHERE id = sample_id;
    RAISE EXCEPTION 'TEST 5a FAILED: invalid tier accepted on UPDATE';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE 'TEST 5a PASSED: invalid verification_tier rejected by CHECK';
  END;
END $$;
ROLLBACK;

-- Test 5b — invalid verification_status rejected by CHECK
BEGIN;
DO $$
DECLARE
  sample_id uuid;
BEGIN
  SELECT id INTO sample_id
  FROM public.bty_action_contracts
  WHERE verification_tier = 'legacy_self_attest'
  LIMIT 1;

  IF sample_id IS NULL THEN
    RAISE EXCEPTION 'TEST 5b SKIPPED: no rows available';
  END IF;

  BEGIN
    UPDATE public.bty_action_contracts
    SET verification_status = 'bogus_status'
    WHERE id = sample_id;
    RAISE EXCEPTION 'TEST 5b FAILED: invalid status accepted';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE 'TEST 5b PASSED: invalid verification_status rejected by CHECK';
  END;
END $$;
ROLLBACK;

-- Test 5c — invalid verification_confidence rejected by CHECK
BEGIN;
DO $$
DECLARE
  sample_id uuid;
BEGIN
  SELECT id INTO sample_id
  FROM public.bty_action_contracts
  WHERE verification_tier = 'legacy_self_attest'
  LIMIT 1;

  IF sample_id IS NULL THEN
    RAISE EXCEPTION 'TEST 5c SKIPPED: no rows available';
  END IF;

  BEGIN
    UPDATE public.bty_action_contracts
    SET verification_confidence = 'super_duper'
    WHERE id = sample_id;
    RAISE EXCEPTION 'TEST 5c FAILED: invalid confidence accepted';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE 'TEST 5c PASSED: invalid verification_confidence rejected by CHECK';
  END;
END $$;
ROLLBACK;
```

**Test 5 expected:** 5a / 5b / 5c 전부 PASS NOTICE 출력. ROLLBACK으로 인해 production data 0 row 변경.

### 7.6 Test 6 — Index existence

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('bty_action_contracts', 'le_verification_log')
  AND indexname LIKE '%verification%';

-- Expected: 4 indexes
-- idx_bty_action_contracts_verification_tier
-- idx_bty_action_contracts_verification_status
-- idx_le_verification_log_contract_id
-- idx_le_verification_log_verification_tier
```

### 7.7 Test 7 — RLS preserved on le_verification_log

```sql
SELECT polname, polcmd, pg_get_expr(polqual, polrelid)
FROM pg_policy
WHERE polrelid = 'public.le_verification_log'::regclass;

-- Expected: existing policies preserved (auth.uid() = user_id 본인만)
```

### 7.8 Test 8 — Read-only smoke (no contract data corruption)

```sql
-- Sample 5 random pre-migration verified contracts and confirm verified_at preserved
SELECT id, verified_at, validation_approved_at, verification_tier, verification_status
FROM public.bty_action_contracts
WHERE verified_at IS NOT NULL
ORDER BY random()
LIMIT 5;

-- Expected: all 5 rows have verification_tier='legacy_self_attest',
--           verification_status='verified', verified_at preserved (matches pre-migration)
```

### 7.9 Test 9 — D-7 hole audit (v1.3 added)

**Purpose:** D-7 hotfix 사건의 production hole 잔여 row 카운트 측정. **Audit-only — L1에서는 카운트만 기록, repair 안 함.** Disposition은 L8 (legacy disposition) lane 책임.

**근거:** STEP 0 Finding 3 — `bty_action_contracts_approved_requires_validation_or_verify` constraint는 `validation_approved_at` 단독으로도 `status='approved'` 허용. 즉 production에 `status='approved' AND verified_at IS NULL AND validation_approved_at IS NOT NULL`인 row가 존재 가능 (D-7 hole의 잔여).

```sql
-- v1.3: D-7 hole detection — audit-only
-- 결과를 STEP 2 report에 명시 기록. L8 disposition에서 이 카운트 기준으로 처리.
SELECT
  COUNT(*) AS approved_without_verified_at,
  COUNT(*) FILTER (WHERE verification_tier = 'legacy_self_attest') AS hole_in_legacy_tier,
  -- L1 시점에 legacy stamp 후엔 모든 row가 legacy_self_attest이므로 둘이 같아야 함
  COUNT(*) FILTER (WHERE verification_tier IS NULL) AS hole_unstamped_drift
FROM public.bty_action_contracts
WHERE status = 'approved'
  AND verified_at IS NULL
  AND validation_approved_at IS NOT NULL;
```

**Sample row 캡처 (L8 disposition 준비용):**
```sql
SELECT id, user_id, validation_approved_at, status, verification_tier, verification_confidence
FROM public.bty_action_contracts
WHERE status = 'approved'
  AND verified_at IS NULL
  AND validation_approved_at IS NOT NULL
ORDER BY validation_approved_at DESC
LIMIT 20;
```

**Expected:**
- `approved_without_verified_at`: ≥ 0 (D-7 8 hotfix + 잔여 가능). 정확한 수치는 production audit 결과로 결정.
- `hole_in_legacy_tier == approved_without_verified_at` (File 3 legacy stamp 후 drift 0이어야 함).
- `hole_unstamped_drift == 0`. 만약 > 0이면 File 3 legacy stamp가 일부 누락되었다는 신호 — investigate.

**L1 PASS criterion:** 카운트 기록 + sample 20개 캡처가 완료되면 PASS. 잔여 row 수치 자체는 PASS/FAIL 기준 아님 (audit-only). L8 disposition에서 처리.

---

## 8. Application & Rollout Plan

### 8.1 Apply order (Claude Code execution)

```
STEP 0  → inventory + capture original verification_type_check definition (saved to file)
[Commander review STEP 0 report]
STEP 1A → apply File 1 (bty_action_contracts columns)
STEP 1B → apply File 2 (le_verification_log extension, FK NOT VALID)
STEP 1C → apply File 3 (legacy stamp) — DML, capture before/after counts
STEP 1D → apply File 4 (CHECK constraints, idempotent DO $$ wrappers)
STEP 2  → run Test fixtures 1-9 (including Test 5 UPDATE variant + Test 9 D-7 audit), report PASS/FAIL per test
[Commander review STEP 2 report]
STEP 1E → apply §3.4 FK VALIDATE step (default Option A — immediately after Test pass)
STEP 3  → ledger update (docs/CURSOR_TASK_BOARD.md + docs/CURRENT_TASK.md L1 closure entry)
```

### 8.2 Failure handling

| 단계 | 실패 시 | 조치 |
|---|---|---|
| STEP 0 | inventory mismatch | HALT, report to Commander, do not proceed |
| STEP 1A | DDL fail (column exists with wrong type 등) | abort migration, ROLLBACK transaction (BEGIN/COMMIT 내), report |
| STEP 1B | 동일 | 동일 + File 1 적용된 컬럼은 그대로 둠 (다음 시도에서 IF NOT EXISTS로 skip) |
| STEP 1C | UPDATE row count mismatch >5% | HALT + File 3 rollback + investigate |
| STEP 1D | CHECK constraint 추가 실패 (기존 row가 새 CHECK 위반) | HALT + File 3 검증 (legacy stamp가 누락된 row 있는지) |
| STEP 2 | Test fixture 1-8 중 FAIL | 해당 test 원인 분석, 필요시 partial rollback, Commander 보고 |

### 8.3 Production-effective awareness (memory #24)

- **단일 Supabase project이므로 staging worker 환경에서 적용해도 production-effective.**
- L1 apply 전 worker traffic은 staging에 한정되지만 DB는 공유. **모든 worker가 새 컬럼을 즉시 보게 됨.**
- 새 컬럼이 nullable + default 적절히 설정되어 있으므로 기존 worker code는 호환 (새 컬럼 무시).
- L2 (contract creation) 적용 전까지 새 컬럼은 모두 NULL 또는 legacy_self_attest stamp. Production runtime 동작 영향 없음.

### 8.4 Cutover scheduling

L1은 product-functional change가 아닌 **schema preparation**. 따라서:
- No worker version coordination required (memory #4 wrangler 이슈와 무관)
- L2 (contract creation rewrite + worker deploy) 이전에 L1만 단독 적용 가능 + 권장
- L1 apply 후 L2 deploy 사이 임의의 시간차 허용 (며칠도 OK)

---

## 9. Ledger Closure (STEP 3)

L1 완료 후 다음 file에 closure entry 추가 (outer-only single commit, memory #15):

### 9.1 `docs/CURSOR_TASK_BOARD.md`

```
**STEP 1 closure (2026-05-XX · L1 DB Migration):**
- 4 migration files applied (columns + log extension + legacy stamp + CHECK constraints)
- bty_action_contracts: +5 columns (verification_tier/status/confidence/self_scan_suspected/actor_device_fingerprint_hash) + 2 indexes
- le_verification_log: +7 columns (contract_id/verifier_fingerprint_hash/verification_tier/verification_confidence/self_scan_suspected/evaluation_score/evaluation_comment) + 2 indexes
- Legacy stamp: N rows → 'legacy_self_attest' tier (Commander D2: no rollback)
- 6 CHECK constraints active (4 on bty_action_contracts + 2 on le_verification_log)
- 8 verification tests PASS
- Spec authority: docs/QR_VERIFICATION_ARCHITECTURE_V1.md (Locked v1)
- Next: L2 (contract creation rewrite)
```

### 9.2 `docs/CURRENT_TASK.md`

L0–L9 checklist에서 L1 항목 표시:
```
- [x] L0 spec lock (QR_VERIFICATION_ARCHITECTURE_V1.md, 726L, Locked v1, 2026-05-27)
- [x] L1 DB migration (4-file sequence, N legacy rows stamped, 2026-05-XX)
- [ ] L2 contract creation rewrite
- [ ] L3 token payload extension
- [ ] L4 validate route tier-aware enforcement ★ critical
- [ ] L5 Layer 2 verification_type-aware
- [ ] L6 STAB-01 4-AND gate removal
- [ ] L7 AD2 non_event_confirmed path
- [ ] L8 legacy contract disposition (8 hotfix + 41 pattern_family)
- [ ] L9 UI tier-aware messaging
```

---

## 10. Open Items / Out of Scope for L1

L1에서 **다루지 않는** 작업 (L2 이후 lane 또는 별도 backlog):

- ❌ Application layer INVARIANT I1 enforcement (L4 validate route 책임)
- ❌ Layer 2 evaluator 변경 (L5 책임)
- ❌ Token payload `verification_tier` 추가 (L3 책임)
- ❌ `bty_action_contracts.relational_verified` view 생성 (L9 또는 별도 view migration)
- ❌ Foreign key from `bty_action_contracts.event_id` to `events` table (Tier 3 manager_only 활성화 시점에서 결정 — Open Q §10-4)
- ❌ `le_verification_log` 적합 trigger (예: `bty_action_contracts.verified_at` mirror update) — application layer (L4) 책임
- ❌ Drift mitigation: legacy `verification_type` 값을 새 canonical 3종으로 migrate하는 작업 (post-launch backlog)

### L2 contract (v1.1 + v1.3 명시)

L1은 `verification_status`에 DB default를 두지 않는다. **그리고 STEP 0 inventory에서 `verification_type` 컬럼이 NOT NULL + DB default 없음이 확인됨.** 다음 책임은 L2 작업 범위로 이관:

- ★ **L2 책임 (lock-blocking for L2 entry):** Contract creation WRITE 4 sites (route.ts:64 / ensureActionContract:280 / eliteBindingActionCommitment:201 / actionContractLifecycle:294)는 신규 row 생성 시 다음 두 컬럼을 반드시 명시적으로 stamp해야 한다:
  - `verification_status='pending'`
  - `verification_type` — 새 canonical 3종 (`action_completed` / `non_event_confirmed` / `manager_reviewed`) 중 하나
- **이유 (verification_type):** STEP 0 inventory 결과 `verification_type`은 NOT NULL이며 DB default가 없다. Stamp 누락 시 즉시 NOT NULL violation으로 INSERT 실패. **L2 must explicitly stamp verification_type. Because verification_type is NOT NULL with no DB default.**
- **이유 (verification_status):** lifecycle status (`'draft'`/`'approved'` 등)와 verification status (`'pending'`/`'verified'`)를 명확히 분리. NULL은 "verification 상태 미상"이라는 의미적 모호함을 만들기 때문에 DB level에서는 허용하되 application level에서는 차단.
- L2 verify gate에 다음 두 test 추가 필요:
  - "신규 contract row의 verification_status가 NULL이 아님"
  - "신규 contract row의 verification_type이 새 canonical 3종 중 하나"

---

## 11. Cross-References

| 문서 | 용도 |
|---|---|
| `bty-app/docs/QR_VERIFICATION_ARCHITECTURE_V1.md` | Spec source of truth — Locked v1 |
| `bty-app/docs/UNIVERSAL_QR_ARCHITECTURE_RECOVERY_PLAN.md` | L0–L9 lane roadmap |
| `bty-app/docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` | `le_verification_log` original schema (P2 infrastructure) |
| `supabase/migrations/20260313000000_leadership_engine_activation_logs.sql` | `le_verification_log` 기존 정의 |
| `docs/CURSOR_TASK_BOARD.md` | Closure entry target |
| `docs/CURRENT_TASK.md` | L0–L9 checklist |

**Memory cross-references:**
- #24 — single Supabase project, production-effective
- #22 — Phase 5 schema drift (status not state, etc.), rehearsal account preservation
- #19 — bty_action_contracts canonical, arena_action_contracts absent
- #15 — ledger co-track topology (outer-only commit for closure)
- #26 — bty_qr_arch_v1_LOCKED (this plan implements §6 of locked spec)

---

## 12. Dispatch to Claude Code

본 plan이 Commander lock되면 Claude Code에 다음 형식으로 dispatch:

```
=== L1 DB MIGRATION DISPATCH ===

Authority: docs/L1_MIGRATION_PLAN.md (Locked vX, 2026-05-XX)
Spec authority: docs/QR_VERIFICATION_ARCHITECTURE_V1.md (Locked v1)

Mode: BTY Infra Mode — DB schema migration permitted

STEP 0: read-only inventory per L1 plan §0
  - capture bty_action_contracts schema baseline
  - capture le_verification_log schema baseline
  - capture original verification_type_check definition
  - confirm rehearsal accounts present
  - report per §0.4 format
  - HALT for Commander approval

STEP 1A-D: apply migration files 1-4 per §2-§5
  - each file in its own BEGIN/COMMIT
  - capture row counts before/after File 3
  - abort and rollback on any failure
  - report final state

STEP 2: run 8 verification tests per §7
  - report PASS/FAIL per test
  - HALT for Commander approval

STEP 3: ledger closure per §9
  - outer-only commit
  - CURSOR_TASK_BOARD.md + CURRENT_TASK.md update

Do not proceed past STEP 0 → STEP 2 boundaries without Commander approval.
Out of scope: code changes, worker deploy, application-layer logic.
```

---

## 13. Version History

| 일자 | 변경 | 작성 |
|---|---|---|
| 2026-05-27 | L1 plan v1 draft | C3 (Claude) |
| 2026-05-27 | **Locked v1.1** — Commander approved with 5 required fixes applied (idempotent CHECK / rollback injection / Test 5 UPDATE variant / FK NOT VALID 2-step / verification_status no DB default + L2 contract) | C3 + Commander |
| 2026-05-27 | **Locked v1.2** — Commander approved with 3 minor hardenings applied (File 3 WHERE replay safety + drift diagnostic / FK precheck orphan sample / Test 3 contains-check) | C3 + Commander |
| 2026-05-27 | **Locked v1.3** — Commander approved after STEP 0 partial inventory. 4 critical patches applied (AS table reserved keyword fix / L2 verification_type stamp obligation / self_report removed / Test 9 D-7 hole audit). §0.3.5 full inventory queries added — STEP 0 재실행 결과 수신 후 STEP 1 진입. | C3 + Commander |

---

*End of L1 plan.*

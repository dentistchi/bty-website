# Patch 목록 표시 문제 디버깅 가이드

## 문제: "Generate Patch Suggestions" 버튼 클릭 후 목록에 표시되지 않음

### 확인 사항

#### 1. Patch가 실제로 생성되었는지 확인

**bty-ai-core 터미널에서 확인:**
```
[patch] /generate called with window: 7d
[patchGenerator] Starting patch generation...
[patchGenerator] Patch suggestion saved: { id: 'xxx', created_at: '...' }
[patch] /generate success: { id: 'xxx', ... }
```

**브라우저 개발자 도구 콘솔에서 확인:**
```
[Admin] Generate patch response: { created: true, id: "...", summary: "..." }
[Admin] Patch created successfully, refreshing list...
[Admin] Fetched patches: 1
```

#### 2. 데이터베이스에서 직접 확인

Supabase SQL Editor에서:
```sql
-- 최근 생성된 patch 확인
SELECT id, window, status, created_at 
FROM bty_patch_suggestions 
ORDER BY created_at DESC 
LIMIT 5;
```

#### 3. API 엔드포인트 테스트

터미널에서:
```bash
# Patch 생성
curl -X POST \
  -H "x-admin-api-key: dev-quality-secret-2024" \
  "http://localhost:4000/api/patch/generate?window=7d"

# Patch 목록 조회
curl -H "x-admin-api-key: dev-quality-secret-2024" \
  "http://localhost:4000/api/patch/recent?limit=3"
```

### 가능한 원인 및 해결 방법

#### 1. Quality Events가 없는 경우
**증상:** `{ created: false, message: "No quality events in window" }`

**해결:**
- Emulator에서 더 많은 메시지를 보내서 quality events 생성
- `window=30d`로 변경하여 더 긴 기간의 데이터 사용

#### 2. 데이터베이스 테이블이 없는 경우
**증상:** `relation "bty_patch_suggestions" does not exist`

**해결:**
- Supabase SQL Editor에서 `017_bty_patch_suggestions.sql` 마이그레이션 실행

#### 3. Patch는 생성되었지만 목록이 갱신되지 않는 경우
**증상:** API는 성공했지만 UI에 표시되지 않음

**확인:**
- 브라우저 개발자 도구 > Network 탭에서 `/api/admin/patch/recent` 요청 확인
- 콘솔에서 `[Admin] Fetched patches:` 로그 확인
- `fetchPatches()` 함수가 제대로 호출되는지 확인

**해결:**
- 페이지를 수동으로 새로고침 (F5)
- 브라우저 개발자 도구 콘솔에서 에러 확인

#### 4. 데이터 형식 불일치
**증상:** API는 데이터를 반환하지만 UI에 표시되지 않음

**확인:**
- `PatchReport` 타입과 실제 반환 데이터 구조 비교
- `window_days` 필드가 올바르게 계산되는지 확인

### 디버깅 단계

1. **버튼 클릭 후 bty-ai-core 터미널 확인**
   - Patch 생성 로그가 나타나는지 확인
   - 에러가 있는지 확인

2. **브라우저 개발자 도구 확인**
   - Network 탭: `/api/admin/patch/generate` 요청 확인
   - Console 탭: `[Admin]` 로그 확인

3. **데이터베이스 직접 확인**
   - Supabase에서 `bty_patch_suggestions` 테이블 확인
   - 최근 생성된 레코드가 있는지 확인

4. **API 직접 테스트**
   - curl로 `/api/patch/recent` 엔드포인트 테스트
   - 반환되는 데이터 구조 확인

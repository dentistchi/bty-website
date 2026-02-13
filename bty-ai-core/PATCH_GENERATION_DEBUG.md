# Patch Suggestions 생성 디버깅 가이드

## "Generate Patch Suggestions" 버튼 작동 확인 방법

### 1. bty-ai-core 터미널에서 로그 확인

버튼을 클릭하면 다음 순서로 로그가 나타납니다:

#### Step 1: API 엔드포인트 호출
```
[patch] /generate called with window: 7d
```

#### Step 2: Patch 생성 시작
```
[patchGenerator] Starting patch generation for window: 7d (7 days)
```

#### Step 3: 통계 데이터 수집
```
[patchGenerator] Fetching aggregated stats for 7 days...
[patchGenerator] Fetched stats: {
  topPatterns: 10,
  issueFreq: 5,
  breakdown: 10,
  trends: 5
}
```

#### Step 4: 통계 요약
```
[patchGenerator] Aggregated stats: {
  top10_signatures: 10,
  top10_single_issues: 5,
  breakdown_entries: 3
}
```

#### Step 5: GPT-4o 호출
```
[patchGenerator] Calling GPT-4o to generate patch suggestions...
[patchGenerator] GPT response received, parsing JSON...
[patchGenerator] Parsed suggestion: {
  top_targets: 3,
  rule_patches: 2
}
```

#### Step 6: 데이터베이스 저장
```
[patchGenerator] Saving patch suggestion to database...
[patchGenerator] Patch suggestion saved: {
  id: 'xxx-xxx-xxx',
  created_at: '2026-02-13T...'
}
```

#### Step 7: 성공 응답
```
[patch] /generate success: {
  id: 'xxx-xxx-xxx',
  window: '7d',
  status: 'draft',
  top_targets_count: 3,
  rule_patches_count: 2
}
```

### 2. 에러가 발생하는 경우

#### Quality Events가 없는 경우:
```
[patchGenerator] No quality events found in window, returning null
[patch] /generate: No quality events in window
```

#### GPT 호출 실패:
```
[patchGenerator] GPT failed: <에러 메시지>
[patch] /generate error: {
  message: ...,
  stack: ...,
  code: ...
}
```

#### 데이터베이스 저장 실패:
```
[patchGenerator] Saving patch suggestion to database...
[patch] /generate error: {
  message: 'relation "bty_patch_suggestions" does not exist',
  ...
}
```

### 3. Admin 페이지에서 확인

버튼을 클릭한 후:

1. **버튼 상태**: "Generating…"로 변경되었다가 다시 "Generate Patch Suggestions (manual)"로 돌아옴
2. **Latest Patch Reports 섹션**: 새로 생성된 patch가 목록 상단에 나타남
3. **브라우저 콘솔**: Network 탭에서 `/api/admin/patch/generate` 요청 확인
   - 성공: `{ created: true, id: "...", summary: "..." }`
   - 실패: `{ error: "..." }` 또는 `{ created: false, message: "..." }`

### 4. 수동으로 API 테스트

터미널에서 직접 테스트:
```bash
curl -X POST \
  -H "x-admin-api-key: dev-quality-secret-2024" \
  "http://localhost:4000/api/patch/generate?window=7d"
```

성공 응답 예시:
```json
{
  "created": true,
  "id": "xxx-xxx-xxx",
  "summary": "rule patch 1; rule patch 2"
}
```

### 5. 데이터베이스에서 확인

Supabase SQL Editor에서:
```sql
-- 최근 생성된 patch suggestions 확인
SELECT id, window, status, created_at 
FROM bty_patch_suggestions 
ORDER BY created_at DESC 
LIMIT 5;

-- 특정 patch의 상세 내용 확인
SELECT 
  id,
  window,
  status,
  input_summary->'top10_signatures' as top_signatures,
  suggestions->'rule_patches' as rule_patches
FROM bty_patch_suggestions
WHERE id = 'your-patch-id';
```

## 문제 해결

### "No quality events in window" 에러
- Quality events가 충분히 기록되지 않았을 수 있습니다
- Emulator에서 더 많은 메시지를 보내서 quality events를 생성하세요
- `window=30d`로 변경해서 더 긴 기간의 데이터를 사용해보세요

### "relation bty_patch_suggestions does not exist" 에러
- `017_bty_patch_suggestions.sql` 마이그레이션을 실행해야 합니다
- Supabase SQL Editor에서 마이그레이션 파일을 실행하세요

### GPT 호출 실패
- OpenAI API 키가 올바르게 설정되어 있는지 확인
- 네트워크 연결 확인
- API 사용량 제한 확인

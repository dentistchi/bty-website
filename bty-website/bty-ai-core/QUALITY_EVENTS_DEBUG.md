# Quality Events 디버깅 가이드

## Quality Event 기록 로그 확인 방법

### 1. bty-ai-core 터미널에서 로그 확인

`bty-ai-core` 서버를 실행한 터미널에서 다음 로그들을 확인하세요:

#### Quality Event 기록 시도 로그:
```
[qualityEvents] Recording event: {
  issues: [...],
  css_score: ...,
  severity: ...,
  route: ...,
  intent: ...
}
```

#### 성공적으로 기록된 경우:
```
Quality event inserted: <uuid>
```

#### 실패한 경우:
```
[qualityEvents] Insert failed: {
  error: ...,
  issues: ...,
  severity: ...,
  route: ...,
  intent: ...
}
[qualityEvents] Stack: ...
```

### 2. API 에러 로그 확인

`/api/quality/summary` 엔드포인트에서 에러가 발생하면:
```
[quality] /summary error: {
  message: ...,
  stack: ...,
  code: ...,
  detail: ...,
  hint: ...
}
```

### 3. 데이터베이스에서 직접 확인

Supabase SQL Editor에서 실행:

```sql
-- 최근 quality events 확인
SELECT * FROM bty_quality_events 
ORDER BY timestamp DESC 
LIMIT 10;

-- 함수가 제대로 작동하는지 확인
SELECT * FROM bty_quality_summary_stats(7);
SELECT * FROM bty_top_issue_patterns(7);
SELECT * FROM bty_quality_breakdown(7);
```

### 4. Health Check로 데이터 확인

```bash
curl http://localhost:4000/api/quality/health
```

응답 예시:
```json
{
  "db_ok": true,
  "total_events_30d": 38,
  "latest_event_at": "2026-02-13 11:21:59.806842+00"
}
```

## 문제 해결

### "Failed to fetch summary" 에러가 발생하는 경우:

1. **서버 재시작**: 코드 변경 후 `bty-ai-core` 서버를 재시작하세요
   ```bash
   # 터미널에서 Ctrl+C로 종료 후
   cd bty-website/bty-ai-core
   npm run dev
   ```

2. **데이터베이스 함수 확인**: Supabase SQL Editor에서 다음 함수들이 존재하는지 확인:
   - `bty_quality_summary_stats`
   - `bty_top_issue_patterns`
   - `bty_quality_breakdown`
   - `bty_issue_code_frequency_with_severity`

3. **에러 로그 확인**: 터미널에서 `[quality] /summary error:` 로그를 확인하여 구체적인 에러 메시지를 확인하세요.

### Quality Event가 기록되지 않는 경우:

1. **CSS 점수 확인**: `chat.ts`에서 CSS 점수가 3 이하일 때만 기록됩니다
2. **로그 확인**: `[qualityEvents] Recording event:` 로그가 나타나는지 확인
3. **데이터베이스 연결 확인**: `.env` 파일의 `DATABASE_URL`이 올바른지 확인

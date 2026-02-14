# Supabase DATABASE_URL 설정 (필수)

## ⚠️ Direct 연결은 사용 금지

| 형식 | 결과 |
|------|------|
| `db.xxx.supabase.co` (Direct) | ❌ ENOTFOUND |
| `aws-0-xxx.pooler.supabase.com` (Session/Transaction) | ✅ 사용 |

**반드시 Session 또는 Transaction 모드 URI를 사용하세요. Direct 연결은 선택하지 마세요.**

## 단계

1. [Supabase Dashboard](https://supabase.com/dashboard) → 프로젝트 선택
2. **Project Settings** (톱니바퀴) → **Database**
3. 아래로 스크롤하여 **Connection string** 섹션 찾기
4. **"Use connection pooling"** 섹션에서:
   - **Session** 탭 선택 → **URI** 복사  
   - 또는 **Transaction** 탭 선택 → **URI** 복사
5. `bty-ai-core/.env` 의 `DATABASE_URL=` 뒤에 붙여넣기 (Direct URI가 아님을 확인)
6. bty-ai-core 재시작: `npm run dev`

## 올바른 URI 형식 예시

```
postgres://postgres.mveycersmqfiuddslnrj:[PASSWORD]@aws-0-[리전].pooler.supabase.com:5432/postgres
```

- `postgres.프로젝트ref` (Session) 또는 `postgres` (Transaction)
- `aws-0-리전.pooler.supabase.com` ← **pooler** 가 반드시 포함되어야 함

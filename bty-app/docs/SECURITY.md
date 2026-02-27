# 보안 정리 (bty-app)

## 적용된 보안 조치

### 1. Admin 접근 제한 (BTY_ADMIN_EMAILS)

- **환경 변수**: `BTY_ADMIN_EMAILS` (쉼표 구분 이메일 목록)
- **동작**:
  - `BTY_ADMIN_EMAILS`가 **설정된 경우**: 해당 이메일로 로그인한 사용자만 Admin 페이지 및 Admin API 접근 가능.
  - **비어 있는 경우**: 로그인만 되어 있으면 접근 가능 (개발/테스트 편의).
- **적용 위치**:
  - `src/app/[locale]/admin/layout.tsx` — Admin 페이지 진입 시 이메일 검사, 미허용 시 로그인으로 리다이렉트.
  - `src/app/api/admin/debug/reports/route.ts` — GET/POST `requireAdminEmail`.
  - `src/app/api/admin/debug/reports/[id]/route.ts` — PATCH `requireAdminEmail`.
  - `src/app/api/admin/debug/patch-deploy/route.ts` — POST `requireAdminEmail`.
- **운영 권장**: 프로덕션에서는 반드시 `BTY_ADMIN_EMAILS`를 설정할 것.

### 2. Debug Reports 입력 검증

- **제보 (POST)**  
  - `title`: 필수, 최대 500자.  
  - `description`: 선택, 최대 2000자.  
  - `context`: 객체, 최대 20개 키, JSON 직렬화 최대 5000바이트.
- **교정 (PATCH)**  
  - `resolution_note`: 최대 2000자.
- 초과 시 `400` + 에러 메시지 반환.

### 3. 보안 헤더 (next.config.js)

- `X-Frame-Options: DENY` — 클릭재킹 방지.
- `X-Content-Type-Options: nosniff` — MIME 스니핑 방지.
- `Referrer-Policy: strict-origin-when-cross-origin` — 리퍼러 제한.
- `Permissions-Policy` — 카메라/마이크/위치 비허용.

### 4. 기존 보안 요소

- **인증**: Supabase Auth, 쿠키 기반 세션. 미인증 시 로그인 리다이렉트 (middleware).
- **API**: 민감 API는 `requireUser` / `requireAdmin` / `requireAdminEmail` 등으로 인증·권한 검사.
- **쿠키**: auth 쿠키 `httpOnly`, `secure`, `sameSite: lax` (middleware에서 설정).

---

## 운영 시 권장 사항

1. **BTY_ADMIN_EMAILS**  
   프로덕션 `.env`에 관리자 이메일을 반드시 설정.

2. **비밀/키 관리**  
   `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_API_KEY`, `DEPLOY_WEBHOOK_URL` 등은 서버 전용 환경 변수로만 두고, 클라이언트 번들/로그에 노출되지 않도록 유지.

3. **배포 웹훅**  
   `DEPLOY_WEBHOOK_URL`은 예측하기 어려운 값(예: 긴 랜덤 쿼리)을 사용하거나, 배포 제공처에서 IP/시크릿 제한을 두는 것을 권장.

4. **추가 고려 (선택)**  
   - 채팅/멘토 API에 rate limiting (IP 또는 사용자별).  
   - CSP(Content-Security-Policy) 도입 시 스크립트/스타일 소스 화이트리스트 검토.

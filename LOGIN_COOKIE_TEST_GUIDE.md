# 로그인 쿠키 및 세션 확인 테스트 가이드

## 배포 URL
`https://bty-website.ywamer2022.workers.dev`

## 테스트 시나리오

### 1. 브라우저 개발자 도구 준비
1. Chrome/Edge에서 `F12` 또는 `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
2. **Network** 탭 열기
3. **Preserve log** 체크 (페이지 이동 시 로그 유지)
4. **Disable cache** 체크 (캐시 비활성화)

### 2. 로그인 실행
1. `https://bty-website.ywamer2022.workers.dev` 접속
2. 로그인 폼에 유효한 이메일/비밀번호 입력
3. 로그인 버튼 클릭

### 3. `/api/auth/login` 응답 확인
**Network 탭에서 `/api/auth/login` 요청 선택:**

#### ✅ 확인 항목:
- **Status Code**: `200 OK` (성공 시)
- **Response Headers** → **Set-Cookie** 헤더 존재 여부
- **Set-Cookie 헤더의 속성:**
  ```
  sb-<project-ref>-auth-token=<value>; Path=/; HttpOnly; Secure; SameSite=Lax
  sb-<project-ref>-auth-token-code-verifier=<value>; Path=/; HttpOnly; Secure; SameSite=Lax
  ```
  
  **예상 쿠키 속성:**
  - `Path=/` - 루트 경로에서 쿠키 사용 가능
  - `HttpOnly` - JavaScript에서 접근 불가 (보안)
  - `Secure` - HTTPS에서만 전송
  - `SameSite=Lax` 또는 `Strict` - CSRF 방지
  - `Domain` - 설정 안 함 (현재 도메인만)

### 4. 로그인 직후 `/api/auth/session` GET 확인
**로그인 성공 후 자동으로 호출되는 `/api/auth/session` GET 요청 확인:**

#### ✅ 확인 항목:
- **Status Code**: `200 OK`
- **Response Body**: `{"ok":true,"user":{"id":"...","email":"..."}}`
- **Request Headers** → **Cookie** 헤더에 위에서 받은 쿠키가 포함되어 있는지 확인

### 5. 수동 세션 확인 (선택)
**Console 탭에서 실행:**
```javascript
fetch('/api/auth/session')
  .then(r => r.json())
  .then(console.log)
```

**예상 결과:**
```json
{"ok":true,"user":{"id":"...","email":"..."}}
```

---

## 문제 진단: "로그인 성공했는데도 /api/auth/session GET이 계속 401"

### 원인 분석 3가지

#### 1. 쿠키가 생성되지 않음 (서버 측 문제)
**증상:**
- `/api/auth/login` 응답에 `Set-Cookie` 헤더가 없음
- Network 탭에서 응답 헤더 확인 시 `Set-Cookie` 누락

**원인 후보:**
- `copySetCookies()` 함수가 제대로 동작하지 않음
- `cookieRes`에 쿠키가 설정되지 않음
- Supabase `signInWithPassword` 후 쿠키 설정 실패

**확인 방법:**
```bash
# 서버 로그 확인 (Cloudflare Workers 로그)
# 또는 코드에서 디버깅:
console.log('cookieRes headers:', cookieRes.headers.getSetCookie?.());
console.log('successRes headers:', successRes.headers.getSetCookie?.());
```

**해결 방법:**
- `copySetCookies()` 함수가 모든 쿠키를 복사하는지 확인
- `cookieRes`가 제대로 생성되는지 확인
- Supabase SSR 버전 확인 및 업데이트

#### 2. 브라우저가 쿠키 저장을 거부함 (클라이언트 측 문제)
**증상:**
- `/api/auth/login` 응답에 `Set-Cookie` 헤더가 있음
- 하지만 브라우저의 **Application** 탭 → **Cookies**에서 쿠키가 없음
- 또는 쿠키가 있지만 `HttpOnly` 속성이 없어서 JavaScript로 접근 가능

**원인 후보:**
- 브라우저 쿠키 설정이 차단됨 (Third-party cookies 차단)
- `SameSite` 속성이 `Strict`인데 다른 도메인에서 접근
- `Secure` 속성이 있는데 HTTP로 접근 (HTTPS 필수)
- 브라우저 확장 프로그램이 쿠키 차단

**확인 방법:**
1. **Application** 탭 → **Cookies** → `https://bty-website.ywamer2022.workers.dev` 확인
2. 브라우저 콘솔에서 쿠키 확인:
   ```javascript
   document.cookie // HttpOnly 쿠키는 여기서 보이지 않음 (정상)
   ```
3. 브라우저 설정에서 쿠키 차단 여부 확인

**해결 방법:**
- 브라우저 쿠키 설정 확인
- Third-party cookies 허용
- 브라우저 확장 프로그램 비활성화 후 재시도
- `SameSite=None; Secure`로 변경 (크로스 도메인 필요 시)

#### 3. 쿠키는 저장되었지만 요청 시 전송되지 않음 (전송 누락)
**증상:**
- **Application** 탭 → **Cookies**에서 쿠키가 존재함
- 하지만 `/api/auth/session` GET 요청의 **Request Headers** → **Cookie** 헤더에 쿠키가 없음

**원인 후보:**
- `Path` 속성이 잘못 설정됨 (예: `/api`만 허용)
- `Domain` 속성이 잘못 설정됨
- `SameSite` 속성이 `Strict`인데 다른 컨텍스트에서 요청
- `fetch()` 호출 시 `credentials: 'include'` 옵션 누락

**확인 방법:**
1. **Network** 탭 → `/api/auth/session` 요청 선택
2. **Request Headers** → **Cookie** 헤더 확인
3. 쿠키의 `Path` 속성 확인:
   - 쿠키 `Path=/` → `/api/auth/session` 요청에 포함되어야 함
   - 쿠키 `Path=/api` → `/api/auth/session` 요청에 포함되어야 함

**해결 방법:**
- `fetchJson()` 함수에서 `credentials: 'include'` 옵션 확인
- 쿠키의 `Path` 속성을 `/`로 설정
- `SameSite` 속성을 `Lax`로 설정 (기본값)

---

## 코드 분석 결과

### 쿠키 설정 흐름
1. `/api/auth/login` POST:
   - `getSupabaseServer(req, cookieRes)` 호출
   - `supabase.auth.signInWithPassword()` 실행
   - Supabase SSR이 내부적으로 쿠키 설정 (`cookieRes.cookies.set()`)
   - `copySetCookies(cookieRes, successRes)`로 최종 응답에 복사

2. `/api/auth/session` GET:
   - `getSupabaseServer(req, cookieRes)` 호출
   - `supabase.auth.getUser()` 실행
   - 쿠키에서 세션 읽기

### 예상 쿠키 속성 (Supabase SSR 기본값)
- **Path**: `/` (전체 경로)
- **HttpOnly**: `true` (보안)
- **Secure**: `true` (HTTPS만)
- **SameSite**: `Lax` (기본값)
- **Domain**: 설정 안 함 (현재 도메인)

### `fetchJson()` 함수 확인 필요
`src/lib/read-json.ts`에서 `fetch()` 호출 시 `credentials: 'include'` 옵션이 있는지 확인:
```typescript
export async function fetchJson<T>(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    credentials: 'include', // ✅ 이 옵션이 있어야 쿠키 전송
  });
  // ...
}
```

---

## 테스트 체크리스트

- [ ] 로그인 성공 시 `/api/auth/login` 응답에 `Set-Cookie` 헤더 존재
- [ ] `Set-Cookie` 헤더에 `Path=/`, `HttpOnly`, `Secure`, `SameSite` 속성 포함
- [ ] 브라우저 **Application** 탭에서 쿠키 저장 확인
- [ ] 로그인 직후 `/api/auth/session` GET이 자동 호출됨
- [ ] `/api/auth/session` GET 요청의 **Cookie** 헤더에 쿠키 포함
- [ ] `/api/auth/session` GET 응답이 `200 OK` + `{"ok":true,"user":{...}}`
- [ ] 수동 `fetch('/api/auth/session')` 호출 시에도 정상 응답

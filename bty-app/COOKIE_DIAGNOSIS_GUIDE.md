# 쿠키 진단 가이드: 4가지 체크리스트

## 배포 URL
`https://bty-website.ywamer2022.workers.dev`

## 브라우저 개발자 도구 준비

1. Chrome/Edge에서 `F12` 또는 `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
2. **Network** 탭 열기
3. **Preserve log** 체크 ✅ (페이지 이동 시 로그 유지)
4. **Disable cache** 체크 ✅ (캐시 비활성화)
5. **Application** 탭도 열어두기 (쿠키 확인용)

---

## 체크리스트 1: `/api/auth/login` 응답에 Set-Cookie가 찍히는가

### 테스트 단계
1. 로그인 폼에 유효한 이메일/비밀번호 입력
2. 로그인 버튼 클릭
3. **Network** 탭에서 `/api/auth/login` 요청 선택

### 확인 사항

#### ✅ 정상 케이스
- **Status**: `200 OK`
- **Response Headers** → **Set-Cookie** 헤더 존재
- **Set-Cookie 헤더 예시:**
  ```
  set-cookie: sb-<project-ref>-auth-token=<value>; Path=/; HttpOnly; Secure; SameSite=Lax
  set-cookie: sb-<project-ref>-auth-token-code-verifier=<value>; Path=/; HttpOnly; Secure; SameSite=Lax
  ```

#### ❌ 문제 케이스
- **Set-Cookie 헤더가 없음**
- **결론**: 서버에서 쿠키를 만들지 못했거나 응답에 전달하지 못함
- **원인 후보:**
  - `copySetCookies()` 함수 실패
  - `cookieRes`에 쿠키가 설정되지 않음
  - Supabase `signInWithPassword` 후 쿠키 설정 실패

### 캡처 방법
1. **Network** 탭 → `/api/auth/login` 클릭
2. **Headers** 탭 → **Response Headers** 섹션
3. `set-cookie` 검색 또는 스크롤하여 확인
4. 스크린샷 또는 텍스트 복사

---

## 체크리스트 2: `/api/auth/session` POST 응답에 Set-Cookie가 찍히는가

### 테스트 단계
1. 로그인 성공 후 (체크리스트 1 완료)
2. **Network** 탭에서 `/api/auth/session` POST 요청 찾기
3. (로그인 직후 자동으로 호출됨)

### 확인 사항

#### ✅ 정상 케이스
- **Status**: `200 OK`
- **Response Headers** → **Set-Cookie** 헤더 존재
- **Request Payload**: `{"access_token":"...","refresh_token":"..."}`
- **Response Body**: `{"ok":true}`

#### ❌ 문제 케이스
- **Set-Cookie 헤더가 없음**
- **결론**: `setSession()` 호출은 했지만 쿠키 설정 실패
- **원인 후보:**
  - `copySetCookie()` 함수 실패
  - `cookieRes`에 쿠키가 설정되지 않음
  - Supabase `setSession()` 후 쿠키 설정 실패

### 중요도
**이 POST는 `setSession(access_token, refresh_token)`이므로, 여기서 Set-Cookie가 찍히는 게 가장 중요합니다.**
- 여기서 Set-Cookie가 찍히면 → 서버가 쿠키 세팅을 시도했다는 뜻
- 여기서 Set-Cookie가 없으면 → 서버 측 문제 (쿠키 생성/전달 실패)

### 캡처 방법
1. **Network** 탭 → `/api/auth/session` POST 요청 클릭
2. **Headers** 탭 → **Response Headers** 섹션
3. `set-cookie` 검색 또는 스크롤하여 확인
4. **Payload** 탭에서 요청 본문 확인
5. **Response** 탭에서 응답 본문 확인

---

## 체크리스트 3: Application 탭에서 쿠키가 실제로 저장됐는가

### 테스트 단계
1. 로그인 성공 후
2. **Application** 탭 클릭
3. 왼쪽 사이드바 → **Cookies** → `https://bty-website.ywamer2022.workers.dev` 클릭

### 확인 사항

#### ✅ 정상 케이스
- 쿠키 목록에 `sb-<project-ref>-auth-token` 존재
- 쿠키 목록에 `sb-<project-ref>-auth-token-code-verifier` 존재
- 각 쿠키의 속성:
  - **Name**: `sb-...-auth-token`
  - **Value**: (긴 문자열)
  - **Domain**: `bty-website.ywamer2022.workers.dev`
  - **Path**: `/`
  - **Expires**: (만료 시간)
  - **Size**: (바이트 수)
  - **HttpOnly**: ✅ (체크됨)
  - **Secure**: ✅ (체크됨)
  - **SameSite**: `Lax` 또는 `Strict`

#### ❌ 문제 케이스
- **쿠키가 저장되지 않음** (목록에 없음)
- **결론**: 브라우저가 쿠키 저장을 거부함
- **원인 후보:**
  - 브라우저 쿠키 설정이 차단됨 (Third-party cookies 차단)
  - `SameSite=Strict` + 다른 컨텍스트에서 접근
  - `Secure` 속성이 있는데 HTTP로 접근 (HTTPS 필수)
  - 브라우저 확장 프로그램이 쿠키 차단 (예: Privacy Badger, uBlock Origin)
  - 브라우저의 쿠키 정책 설정

### 확인 방법
1. **Application** 탭 → **Cookies** → `https://bty-website.ywamer2022.workers.dev`
2. 쿠키 목록 확인
3. 각 쿠키의 속성 확인 (HttpOnly, Secure, SameSite)
4. 스크린샷 캡처

### 추가 확인
브라우저 콘솔에서:
```javascript
// HttpOnly 쿠키는 JavaScript로 접근 불가 (정상)
document.cookie // sb-... 쿠키는 보이지 않아야 함
```

---

## 체크리스트 4: 저장된 상태에서 `/api/auth/session` GET 요청 헤더에 Cookie가 실려 가는가

### 테스트 단계
1. 체크리스트 3에서 쿠키 저장 확인 완료
2. **Network** 탭에서 `/api/auth/session` GET 요청 찾기
3. (로그인 직후 자동으로 호출되거나, 페이지 새로고침 시 호출)

### 확인 사항

#### ✅ 정상 케이스
- **Status**: `200 OK`
- **Request Headers** → **Cookie** 헤더 존재
- **Cookie 헤더 예시:**
  ```
  Cookie: sb-<project-ref>-auth-token=<value>; sb-<project-ref>-auth-token-code-verifier=<value>
  ```
- **Response Body**: `{"ok":true,"user":{"id":"...","email":"..."}}`

#### ❌ 문제 케이스 1: Cookie 헤더가 없음
- **증상**: Request Headers에 `Cookie` 헤더가 없음
- **Application 탭**: 쿠키는 저장되어 있음
- **결론**: **전송 누락** - 쿠키는 저장되었지만 요청에 포함되지 않음
- **원인 후보:**
  - `Path` 속성 문제 (예: `/api`만 허용하는데 `/api/auth/session` 요청)
  - `Domain` 속성 문제
  - `SameSite=Strict` + 다른 컨텍스트에서 요청
  - `fetch()` 호출 시 `credentials: 'include'` 옵션 누락 (이미 확인됨 - 문제 없음)

#### ❌ 문제 케이스 2: Cookie 헤더는 있지만 401 응답
- **증상**: Request Headers에 `Cookie` 헤더는 있음
- **Status**: `401 Unauthorized`
- **Response Body**: `{"ok":false,"error":"..."}`
- **결론**: 쿠키는 전송되었지만 서버에서 인증 실패
- **원인 후보:**
  - 쿠키 값이 잘못됨 (만료됨, 손상됨)
  - 서버 측 세션 검증 실패
  - Supabase 세션 만료

### 캡처 방법
1. **Network** 탭 → `/api/auth/session` GET 요청 클릭
2. **Headers** 탭 → **Request Headers** 섹션
3. `Cookie:` 검색 또는 스크롤하여 확인
4. **Response** 탭에서 응답 본문 확인
5. 스크린샷 캡처

---

## 진단 플로우차트

```
로그인 시도
    ↓
[체크리스트 1] /api/auth/login 응답에 Set-Cookie 있나?
    ├─ 없음 → ❌ 서버 문제: copySetCookies 실패 또는 쿠키 생성 실패
    └─ 있음 → 다음 단계
         ↓
[체크리스트 2] /api/auth/session POST 응답에 Set-Cookie 있나?
    ├─ 없음 → ❌ 서버 문제: setSession 후 쿠키 설정 실패
    └─ 있음 → 다음 단계
         ↓
[체크리스트 3] Application 탭에서 쿠키 저장됐나?
    ├─ 없음 → ❌ 브라우저 문제: 쿠키 저장 거부 (속성 문제/보안 정책/확장프로그램)
    └─ 있음 → 다음 단계
         ↓
[체크리스트 4] /api/auth/session GET 요청에 Cookie 헤더 있나?
    ├─ 없음 → ❌ 전송 누락: SameSite/Path/도메인 매칭 문제
    └─ 있음 → 다음 단계
         ↓
[체크리스트 4-2] GET 응답이 {ok:true}인가?
    ├─ 401 → ❌ 인증 실패: 쿠키 값 문제 또는 서버 검증 실패
    └─ 200 + {ok:true} → ✅ 성공!
```

---

## 문제별 해결 방법

### 문제 1: Set-Cookie 없음 (체크리스트 1 또는 2)
**원인**: 서버에서 쿠키 생성/전달 실패

**확인 사항:**
- Cloudflare Workers 로그 확인
- `copySetCookies()` 함수 동작 확인
- Supabase SSR 버전 확인

**해결 방법:**
- 코드에서 디버깅:
  ```typescript
  console.log('cookieRes headers:', cookieRes.headers.getSetCookie?.());
  console.log('successRes headers:', successRes.headers.getSetCookie?.());
  ```

### 문제 2: 쿠키 저장 거부 (체크리스트 3)
**원인**: 브라우저가 쿠키 저장 거부

**확인 사항:**
- 브라우저 쿠키 설정 확인
- Third-party cookies 허용 여부
- 브라우저 확장 프로그램 비활성화 후 재시도
- 시크릿 모드에서 테스트

**해결 방법:**
- 브라우저 설정에서 쿠키 허용
- 확장 프로그램 비활성화
- `SameSite=None; Secure`로 변경 (크로스 도메인 필요 시)

### 문제 3: 전송 누락 (체크리스트 4 - Cookie 헤더 없음)
**원인**: 쿠키는 저장되었지만 요청에 포함되지 않음

**확인 사항:**
- 쿠키의 `Path` 속성 확인 (`/`여야 함)
- 쿠키의 `Domain` 속성 확인
- 쿠키의 `SameSite` 속성 확인 (`Lax` 권장)
- `fetch()` 호출 시 `credentials: 'include'` 확인 (이미 확인됨)

**해결 방법:**
- 쿠키 `Path`를 `/`로 설정
- `SameSite`를 `Lax`로 설정
- `fetchJson()` 함수에서 `credentials: 'include'` 확인

### 문제 4: 인증 실패 (체크리스트 4 - Cookie 있지만 401)
**원인**: 쿠키는 전송되었지만 서버에서 인증 실패

**확인 사항:**
- 쿠키 값이 유효한지 확인
- 쿠키 만료 시간 확인
- 서버 로그에서 인증 실패 원인 확인

**해결 방법:**
- 쿠키 삭제 후 재로그인
- 서버 측 세션 검증 로직 확인

---

## 테스트 결과 캡처 템플릿

### 체크리스트 1: /api/auth/login Set-Cookie
- [ ] Set-Cookie 헤더 존재 여부: ✅ / ❌
- [ ] 헤더 내용: `_________________`
- [ ] 스크린샷: (첨부)

### 체크리스트 2: /api/auth/session POST Set-Cookie
- [ ] Set-Cookie 헤더 존재 여부: ✅ / ❌
- [ ] 헤더 내용: `_________________`
- [ ] Response Body: `_________________`
- [ ] 스크린샷: (첨부)

### 체크리스트 3: Application 탭 쿠키 저장
- [ ] 쿠키 저장 여부: ✅ / ❌
- [ ] 쿠키 이름: `_________________`
- [ ] HttpOnly: ✅ / ❌
- [ ] Secure: ✅ / ❌
- [ ] SameSite: `_________________`
- [ ] Path: `_________________`
- [ ] 스크린샷: (첨부)

### 체크리스트 4: /api/auth/session GET Cookie 헤더
- [ ] Cookie 헤더 존재 여부: ✅ / ❌
- [ ] 헤더 내용: `_________________`
- [ ] Response Status: `_________________`
- [ ] Response Body: `_________________`
- [ ] 스크린샷: (첨부)

### 최종 결론
- [ ] 모든 체크리스트 통과: ✅ / ❌
- [ ] 문제 발생 시 원인: `_________________`
- [ ] 해결 방법: `_________________`

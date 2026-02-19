# 쿠키 테스트 결과 기록 템플릿

## 배포 URL
`https://bty-website.ywamer2022.workers.dev`

## 테스트 일시
- 날짜: `_________________`
- 시간: `_________________`
- 브라우저: `_________________` (Chrome/Edge/Safari 등)
- 브라우저 버전: `_________________`

---

## A. Network → /api/auth/login 응답 헤더

### 테스트 방법
1. 개발자 도구 → Network 탭 열기
2. Preserve log 체크 ✅
3. 로그인 실행
4. `/api/auth/login` 요청 선택
5. Headers 탭 → Response Headers 확인

### 결과 기록

#### Status
```
_________________
```
예: `200 OK` 또는 `401 Unauthorized`

#### Response Headers 중 set-cookie 전체
```
_________________
_________________
_________________
```
예:
```
set-cookie: sb-xxxxx-auth-token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; Path=/; HttpOnly; Secure; SameSite=Lax
set-cookie: sb-xxxxx-auth-token-code-verifier=...; Path=/; HttpOnly; Secure; SameSite=Lax
```

**Set-Cookie 존재 여부**: ✅ 있음 / ❌ 없음

#### (있으면) x-opennext
```
_________________
```
예: `x-opennext: 1`

#### (있으면) cf-ray
```
_________________
```
예: `cf-ray: 9d0684b29d0bdeec-SEA`

### 스크린샷
- [ ] 스크린샷 첨부 (선택사항)

---

## B. Network → /api/auth/session (POST) 응답 헤더

### 테스트 방법
1. 로그인 성공 후 (A 완료)
2. Network 탭에서 `/api/auth/session` POST 요청 찾기
3. (로그인 직후 자동으로 호출됨)
4. Headers 탭 → Response Headers 확인

### 결과 기록

#### Status
```
_________________
```
예: `200 OK` 또는 `401 Unauthorized`

#### Response Headers 중 set-cookie 전체
```
_________________
_________________
_________________
```
예:
```
set-cookie: sb-xxxxx-auth-token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; Path=/; HttpOnly; Secure; SameSite=Lax
set-cookie: sb-xxxxx-auth-token-code-verifier=...; Path=/; HttpOnly; Secure; SameSite=Lax
```

**Set-Cookie 존재 여부**: ✅ 있음 / ❌ 없음

**⭐ 중요**: 이 POST에서 Set-Cookie가 있어야 서버가 쿠키 설정을 시도한 것으로 판단됩니다.

### 스크린샷
- [ ] 스크린샷 첨부 (선택사항)

---

## C. Application → Cookies 에 실제로 저장됐는지

### 테스트 방법
1. 로그인 성공 후 (A, B 완료)
2. 개발자 도구 → Application 탭 클릭
3. 왼쪽 사이드바 → Cookies → `https://bty-website.ywamer2022.workers.dev` 클릭
4. 쿠키 목록 확인

### 결과 기록

#### 쿠키 이름(sb-...-auth-token 등)
```
_________________
_________________
```
예:
- `sb-xxxxx-auth-token`
- `sb-xxxxx-auth-token-code-verifier`

**쿠키 저장 여부**: ✅ 저장됨 / ❌ 저장 안 됨

#### Domain
```
_________________
```
예: `bty-website.ywamer2022.workers.dev`

#### Path
```
_________________
```
예: `/`

#### SameSite
```
_________________
```
예: `Lax` 또는 `Strict` 또는 `None`

#### Secure
```
_________________
```
예: ✅ 체크됨 / ❌ 체크 안 됨

#### HttpOnly
```
_________________
```
예: ✅ 체크됨 / ❌ 체크 안 됨

### 스크린샷
- [ ] 스크린샷 첨부 (선택사항)

---

## D. Network → /api/auth/session (GET) 요청 헤더

### 테스트 방법
1. 쿠키 저장 확인 완료 (C 완료)
2. Network 탭에서 `/api/auth/session` GET 요청 찾기
3. (로그인 직후 자동으로 호출되거나, 페이지 새로고침 시 호출)
4. Headers 탭 → Request Headers 확인
5. Response 탭 → 응답 본문 확인

### 결과 기록

#### Request Headers의 cookie가 실제로 붙어가는지
```
_________________
_________________
```
예:
```
Cookie: sb-xxxxx-auth-token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; sb-xxxxx-auth-token-code-verifier=...
```

**Cookie 헤더 존재 여부**: ✅ 있음 / ❌ 없음

#### 응답 JSON (ok / error / where)
```
_________________
_________________
```
예:
```json
{
  "ok": true,
  "user": {
    "id": "xxx-xxx-xxx",
    "email": "user@example.com"
  }
}
```

또는 에러 시:
```json
{
  "ok": false,
  "error": "Auth session missing!",
  "where": "supabase.auth.getUser()"
}
```

**응답 Status**: `_________________` (예: `200 OK` 또는 `401 Unauthorized`)

### 스크린샷
- [ ] Request Headers 스크린샷 (선택사항)
- [ ] Response 스크린샷 (선택사항)

---

## 진단 결과

### 체크리스트 통과 여부

- [ ] **A. /api/auth/login Set-Cookie**: ✅ 통과 / ❌ 실패
- [ ] **B. /api/auth/session POST Set-Cookie**: ✅ 통과 / ❌ 실패 ⭐ 가장 중요
- [ ] **C. Application 탭 쿠키 저장**: ✅ 통과 / ❌ 실패
- [ ] **D. /api/auth/session GET Cookie 헤더**: ✅ 통과 / ❌ 실패
- [ ] **D. /api/auth/session GET 응답 {ok:true}**: ✅ 통과 / ❌ 실패

### 문제 발생 시 진단

#### 문제 1: A 또는 B에서 Set-Cookie 없음
- **원인**: 서버에서 쿠키 생성/전달 실패
- **확인 사항**: `copySetCookies()` 함수 동작, Supabase SSR 쿠키 설정
- **해결 방법**: `_________________`

#### 문제 2: C에서 쿠키 저장 안 됨
- **원인**: 브라우저가 쿠키 저장 거부
- **확인 사항**: 브라우저 쿠키 설정, 확장 프로그램, SameSite/Secure 속성
- **해결 방법**: `_________________`

#### 문제 3: D에서 Cookie 헤더 없음
- **원인**: 전송 누락 (SameSite/Path/도메인 매칭 문제)
- **확인 사항**: 쿠키 Path 속성, SameSite 속성, fetch credentials 옵션
- **해결 방법**: `_________________`

#### 문제 4: D에서 Cookie 있지만 401 응답
- **원인**: 인증 실패 (쿠키 값 문제 또는 서버 검증 실패)
- **확인 사항**: 쿠키 값 유효성, 만료 시간, 서버 로그
- **해결 방법**: `_________________`

### 최종 결론

```
_________________
_________________
_________________
```

예:
- ✅ 모든 체크리스트 통과 - 로그인 플로우 정상 동작
- ❌ B에서 Set-Cookie 없음 - 서버 측 문제, `copySetCookies()` 함수 확인 필요
- ❌ C에서 쿠키 저장 안 됨 - 브라우저 문제, SameSite 속성 확인 필요
- ❌ D에서 Cookie 헤더 없음 - 전송 누락, Path 속성 확인 필요

---

## 추가 메모

```
_________________
_________________
_________________
```

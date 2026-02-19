# 증거 수집 가이드 (2-3A vs 2-3B 판단용)

## 준비
1. 크롬 시크릿 창에서 사이트 열기
2. DevTools 열기 (F12) → Network 탭
3. ✅ Preserve log 체크
4. ✅ Disable cache 체크
5. Network 상단 필터에서 "All" 선택

---

## A) /train/day/1 Document 요청

1. 주소창에 입력 후 Enter:
   ```
   https://bty-website.ywamer2022.workers.dev/train/day/1
   ```

2. Network 목록에서 Type이 **document** 인 항목 클릭

3. Headers 탭에서 아래 복사:
   - Status Code
   - Response Headers의 `location` (있으면)
   - Response Headers의 `x-mw-hit` (있으면)
   - Response Headers의 `set-cookie` (있으면 전부)

---

## B) /api/auth/session GET

### 방법 1: Network에서 자동 생성된 것 잡기
1. Network 검색창에 `session` 입력
2. `api/auth/session` 항목 클릭
3. Headers 탭에서:
   - Request Headers의 `cookie` 존재 여부
   - Status Code
4. Response 탭에서 JSON 바디 복사

### 방법 2: 콘솔에서 강제 호출 (추천)
브라우저 콘솔(Console 탭)에서 아래 실행:

```javascript
// 증거 수집용 세션 호출
fetch("/api/auth/session?_diag=1", {
  credentials: "include",
  cache: "no-store"
})
  .then(r => {
    console.log("=== SESSION GET 증거 ===");
    console.log("Status:", r.status);
    console.log("Headers:", Object.fromEntries(r.headers.entries()));
    return r.text();
  })
  .then(body => {
    console.log("Body:", body);
    console.log("========================");
  });
```

그 후 Network에서 `session?_diag=1` 요청 클릭하여 Request Headers의 `cookie` 확인

---

## C) Application > Cookies

1. Application 탭 → Cookies → 현재 도메인 클릭
2. `sb-...` 쿠키 행 1개 클릭
3. 아래 값 복사:
   - Name
   - Domain
   - Path
   - SameSite
   - Secure
   - HttpOnly

### 콘솔에서 쿠키 정보 자동 수집 (선택사항)

```javascript
// 쿠키 정보 자동 수집
const cookies = document.cookie.split(';').map(c => c.trim());
const sbCookies = cookies.filter(c => c.startsWith('sb-'));
console.log("=== COOKIE 증거 ===");
sbCookies.forEach(c => {
  const [name, value] = c.split('=');
  console.log(`Name: ${name}`);
  // Application 탭에서 상세 속성 확인 필요
});
console.log("전체 쿠키:", cookies);
console.log("===================");
```

---

## 결과 공유 포맷

아래 템플릿을 채워서 전달:

```
A) Document(/train/day/1): 
   status= , 
   location= , 
   x-mw-hit= , 
   set-cookie=있/없(있으면 이름들)

B) Session GET(/api/auth/session): 
   request.cookie=있/없(있으면 이름들), 
   status= , 
   body=

C) Cookie attr: 
   name= , 
   domain= , 
   path= , 
   samesite= , 
   secure= , 
   httponly=
```

---

## 판단 기준

- **2-3A (쿠키가 서버로 안 옴)**: 
  - B) request.cookie=없 또는 C) cookie attr가 없음
  - 또는 cookie는 있지만 Domain/Path/SameSite 설정 문제

- **2-3B (쿠키는 오는데 Supabase가 못 읽음)**:
  - B) request.cookie=있 + cookie 이름에 sb-... 포함
  - 하지만 B) status=401 또는 body에 error

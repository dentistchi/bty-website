# Supabase SSR 쿠키 세션 진단 및 수정 가이드

## 배포 환경
- **Platform**: Cloudflare Workers
- **Framework**: OpenNext (Next.js on Cloudflare)
- **Auth**: Supabase SSR (`@supabase/ssr`)

---

## 진단 플로우: 4가지 증거 기반 분기

### 증거 수집 순서
1. **A**: `/api/auth/login` 응답에 Set-Cookie 있나?
2. **B**: `/api/auth/session` POST 응답에 Set-Cookie 있나?
3. **C**: 브라우저 Application 탭에 쿠키 저장됐나?
4. **D**: `/api/auth/session` GET 요청에 Cookie 헤더 붙나?

---

## 분기 1: A = ❌ (login 응답에 Set-Cookie 없음)

### 가능 원인 Top 3

#### 1. Cloudflare Workers에서 `getSetCookie()` 미지원 또는 동작 불일치
**원인:**
- Cloudflare Workers의 `Headers` API가 Node.js와 다를 수 있음
- `getSetCookie()` 메서드가 없거나 빈 배열 반환
- OpenNext가 NextResponse 헤더를 변환하는 과정에서 Set-Cookie 손실

**확인 방법:**
```typescript
// 디버깅 코드 추가
console.log('cookieRes.getSetCookie:', cookieRes.headers.getSetCookie?.());
console.log('cookieRes headers:', Array.from(cookieRes.headers.entries()));
```

**코드 수정:**
```typescript
// bty-app/src/app/api/auth/login/route.ts

function copySetCookies(from: NextResponse, to: NextResponse) {
  // Cloudflare Workers 호환성 개선
  const anyHeaders = from.headers as any;
  
  // 방법 1: getSetCookie() 시도
  const getSetCookie = anyHeaders.getSetCookie?.bind(anyHeaders);
  if (getSetCookie) {
    try {
      const cookies: string[] = getSetCookie() || [];
      if (cookies.length > 0) {
        cookies.forEach((c) => to.headers.append("set-cookie", c));
        return;
      }
    } catch (e) {
      console.warn('[copySetCookies] getSetCookie failed:', e);
    }
  }
  
  // 방법 2: 모든 set-cookie 헤더 직접 추출 (Cloudflare Workers 호환)
  const allHeaders = Array.from(from.headers.entries());
  const setCookieHeaders = allHeaders
    .filter(([key]) => key.toLowerCase() === 'set-cookie')
    .map(([, value]) => value);
  
  if (setCookieHeaders.length > 0) {
    setCookieHeaders.forEach((c) => to.headers.append("set-cookie", c));
    return;
  }
  
  // 방법 3: 단일 set-cookie 폴백
  const single = from.headers.get("set-cookie");
  if (single) {
    to.headers.append("set-cookie", single);
  }
}
```

#### 2. `cookieRes` 생성 시점 문제
**원인:**
- `NextResponse.json()`으로 생성한 응답에 Supabase가 쿠키를 설정하기 전에 복사
- `signInWithPassword()` 호출 후 쿠키가 `cookieRes`에 설정되지 않음

**확인 방법:**
```typescript
// signInWithPassword 전후로 확인
console.log('Before signIn:', cookieRes.headers.getSetCookie?.());
const { data, error } = await supabase.auth.signInWithPassword({ email, password });
console.log('After signIn:', cookieRes.headers.getSetCookie?.());
```

**코드 수정:**
```typescript
// bty-app/src/app/api/auth/login/route.ts

export async function POST(req: NextRequest) {
  // ✅ 빈 응답으로 시작 (쿠키만 담을 용도)
  const cookieRes = noStore(new NextResponse(null, { status: 200 }));
  const supabase = getSupabaseServer(req, cookieRes);

  if (!supabase) {
    return noStore(NextResponse.json({ ok: false, error: "Server not configured" }, { status: 503 }));
  }

  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = body.email?.trim();
  const password = body.password;

  if (!email || !password) {
    return noStore(NextResponse.json({ ok: false, error: "missing email or password" }, { status: 400 }));
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    return noStore(
      NextResponse.json(
        { ok: false, error: error?.message ?? "Invalid login credentials" },
        { status: 401 }
      )
    );
  }

  // ✅ 쿠키가 cookieRes에 설정되었는지 확인
  const cookiesBeforeCopy = cookieRes.headers.getSetCookie?.() || [];
  console.log('[login] Cookies before copy:', cookiesBeforeCopy.length);

  const successRes = noStore(
    NextResponse.json(
      {
        ok: true,
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: {
          id: data.user?.id ?? null,
          email: data.user?.email ?? null,
        },
      },
      { status: 200 }
    )
  );

  copySetCookies(cookieRes, successRes);
  
  // ✅ 복사 후 확인
  const cookiesAfterCopy = successRes.headers.getSetCookie?.() || [];
  console.log('[login] Cookies after copy:', cookiesAfterCopy.length);

  return successRes;
}
```

#### 3. Supabase SSR 쿠키 옵션 미설정
**원인:**
- `setAll()`에서 쿠키 옵션이 제대로 전달되지 않음
- Cloudflare Workers 환경에서 쿠키 옵션 파싱 실패

**코드 수정:**
```typescript
// bty-app/src/lib/supabase-server.ts

export function getSupabaseServer(req: NextRequest, res: NextResponse) {
  if (!url || !key) return null;

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookies: CookieToSet[]) {
        cookies.forEach(({ name, value, options }) => {
          // ✅ Cloudflare Workers 호환성을 위해 옵션 명시적 설정
          const cookieOptions: any = {
            ...options,
            // 기본값 명시
            path: options?.path ?? '/',
            httpOnly: options?.httpOnly ?? true,
            secure: options?.secure ?? true,
            sameSite: options?.sameSite ?? 'lax',
          };
          
          // ✅ NextResponse.cookies.set() 사용 (Cloudflare Workers 호환)
          res.cookies.set(name, value, cookieOptions);
        });
      },
    },
  });
}
```

---

## 분기 2: A = ✅, B = ❌ (login에는 있지만 session POST에 없음)

### 가능 원인 Top 3

#### 1. `copySetCookie()` 함수 불일치
**원인:**
- `login/route.ts`의 `copySetCookies()`와 `session/route.ts`의 `copySetCookie()` 구현이 다름
- `session/route.ts`에서 단일 쿠키만 처리하는 폴백이 제대로 동작하지 않음

**코드 수정:**
```typescript
// bty-app/src/app/api/auth/session/route.ts

function copySetCookie(from: NextResponse, to: NextResponse) {
  // ✅ login/route.ts와 동일한 로직으로 통일
  const anyHeaders = from.headers as any;
  
  // 방법 1: getSetCookie() 시도
  const getSetCookie = anyHeaders.getSetCookie?.bind(anyHeaders);
  if (getSetCookie) {
    try {
      const cookies: string[] = getSetCookie() || [];
      if (cookies.length > 0) {
        cookies.forEach((c) => to.headers.append("set-cookie", c));
        return;
      }
    } catch (e) {
      console.warn('[copySetCookie] getSetCookie failed:', e);
    }
  }
  
  // 방법 2: 모든 set-cookie 헤더 직접 추출
  const allHeaders = Array.from(from.headers.entries());
  const setCookieHeaders = allHeaders
    .filter(([key]) => key.toLowerCase() === 'set-cookie')
    .map(([, value]) => value);
  
  if (setCookieHeaders.length > 0) {
    setCookieHeaders.forEach((c) => to.headers.append("set-cookie", c));
    return;
  }
  
  // 방법 3: 단일 set-cookie 폴백
  const single = from.headers.get("set-cookie");
  if (single) {
    to.headers.append("set-cookie", single);
  }
}
```

#### 2. `setSession()` 호출 후 쿠키 미설정
**원인:**
- `supabase.auth.setSession()`이 성공했지만 쿠키가 `cookieRes`에 설정되지 않음
- Supabase SSR이 내부적으로 쿠키를 설정하지 않음

**확인 방법:**
```typescript
console.log('Before setSession:', cookieRes.headers.getSetCookie?.());
const { error } = await supabase.auth.setSession({ access_token, refresh_token });
console.log('After setSession:', cookieRes.headers.getSetCookie?.());
```

**코드 수정:**
```typescript
// bty-app/src/app/api/auth/session/route.ts

export async function POST(req: NextRequest) {
  const cookieRes = new NextResponse(null);
  
  try {
    const supabase = getSupabaseServer(req, cookieRes);
    if (!supabase) {
      const out = NextResponse.json(
        { ok: false, error: "Server not configured" },
        { status: 503 }
      );
      copySetCookie(cookieRes, out);
      return out;
    }

    const body = (await req.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
    };
    const { access_token, refresh_token } = body;

    if (!access_token || !refresh_token) {
      const out = NextResponse.json(
        { ok: false, error: "missing access_token/refresh_token" },
        { status: 400 }
      );
      copySetCookie(cookieRes, out);
      return out;
    }

    // ✅ setSession 전후로 쿠키 확인
    const cookiesBefore = cookieRes.headers.getSetCookie?.() || [];
    console.log('[session POST] Cookies before setSession:', cookiesBefore.length);

    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    
    const cookiesAfter = cookieRes.headers.getSetCookie?.() || [];
    console.log('[session POST] Cookies after setSession:', cookiesAfter.length);

    if (error) {
      const out = NextResponse.json({ ok: false, error: error.message }, { status: 401 });
      copySetCookie(cookieRes, out);
      return out;
    }

    const out = NextResponse.json({ ok: true }, { status: 200 });
    copySetCookie(cookieRes, out);
    
    // ✅ 최종 확인
    const cookiesFinal = out.headers.getSetCookie?.() || [];
    console.log('[session POST] Cookies final:', cookiesFinal.length);
    
    return out;
  } catch (e: any) {
    const out = NextResponse.json(
      { ok: false, error: e?.message ?? String(e), where: "/api/auth/session POST" },
      { status: 500 }
    );
    copySetCookie(cookieRes, out);
    return out;
  }
}
```

#### 3. OpenNext가 응답 헤더 병합 시 Set-Cookie 손실
**원인:**
- Cloudflare Workers에서 여러 Set-Cookie 헤더를 병합하는 과정에서 손실
- OpenNext의 응답 변환 과정에서 Set-Cookie 필터링

**코드 수정:**
```typescript
// ✅ 공통 유틸리티 함수로 통일
// bty-app/src/lib/cookie-utils.ts (새 파일)

import { NextResponse } from "next/server";

/**
 * Cloudflare Workers + OpenNext 호환 Set-Cookie 복사 함수
 */
export function copySetCookies(from: NextResponse, to: NextResponse): void {
  const anyHeaders = from.headers as any;
  
  // 방법 1: getSetCookie() 시도 (Node.js 18+)
  const getSetCookie = anyHeaders.getSetCookie?.bind(anyHeaders);
  if (getSetCookie) {
    try {
      const cookies: string[] = getSetCookie() || [];
      if (cookies.length > 0) {
        cookies.forEach((c) => {
          // ✅ 각 쿠키를 개별적으로 append (Cloudflare Workers 호환)
          to.headers.append("set-cookie", c);
        });
        return;
      }
    } catch (e) {
      console.warn('[copySetCookies] getSetCookie failed:', e);
    }
  }
  
  // 방법 2: 모든 set-cookie 헤더 직접 추출 (Cloudflare Workers 호환)
  const allHeaders = Array.from(from.headers.entries());
  const setCookieHeaders = allHeaders
    .filter(([key]) => key.toLowerCase() === 'set-cookie')
    .map(([, value]) => value);
  
  if (setCookieHeaders.length > 0) {
    setCookieHeaders.forEach((c) => {
      to.headers.append("set-cookie", c);
    });
    return;
  }
  
  // 방법 3: 단일 set-cookie 폴백
  const single = from.headers.get("set-cookie");
  if (single) {
    to.headers.append("set-cookie", single);
  }
}
```

그리고 모든 파일에서 이 함수를 import:
```typescript
// bty-app/src/app/api/auth/login/route.ts
import { copySetCookies } from "@/lib/cookie-utils";

// bty-app/src/app/api/auth/session/route.ts
import { copySetCookies as copySetCookie } from "@/lib/cookie-utils";
```

---

## 분기 3: A = ✅, B = ✅, C = ❌ (응답에는 있지만 브라우저에 저장 안 됨)

### 가능 원인 Top 3

#### 1. SameSite 속성 문제
**원인:**
- `SameSite=Strict`인데 다른 컨텍스트에서 접근
- Cloudflare Workers에서 쿠키 옵션이 제대로 전달되지 않음

**코드 수정:**
```typescript
// bty-app/src/lib/supabase-server.ts

export function getSupabaseServer(req: NextRequest, res: NextResponse) {
  if (!url || !key) return null;

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookies: CookieToSet[]) {
        cookies.forEach(({ name, value, options }) => {
          // ✅ Cloudflare Workers 환경에 최적화된 쿠키 옵션
          const cookieOptions: any = {
            path: options?.path ?? '/',
            httpOnly: options?.httpOnly ?? true,
            secure: options?.secure ?? true,
            // ✅ SameSite를 Lax로 명시 (Strict는 크로스 도메인에서 문제 발생 가능)
            sameSite: options?.sameSite ?? 'lax',
            // ✅ Domain은 명시하지 않음 (현재 도메인 사용)
            // domain 옵션은 제거 (Cloudflare Workers에서 문제 발생 가능)
          };
          
          res.cookies.set(name, value, cookieOptions);
        });
      },
    },
  });
}
```

#### 2. Secure 속성 문제 (HTTPS 필수)
**원인:**
- `Secure` 속성이 있는데 HTTP로 접근 (하지만 workers.dev는 HTTPS이므로 문제 없어야 함)
- 브라우저가 Secure 쿠키를 거부하는 경우

**확인 방법:**
- 브라우저 콘솔에서 확인:
  ```javascript
  // Application 탭에서 쿠키 속성 확인
  // Secure가 체크되어 있는지 확인
  ```

**코드 수정:**
```typescript
// bty-app/src/lib/supabase-server.ts

setAll(cookies: CookieToSet[]) {
  cookies.forEach(({ name, value, options }) => {
    const cookieOptions: any = {
      path: options?.path ?? '/',
      httpOnly: options?.httpOnly ?? true,
      // ✅ 환경에 따라 Secure 설정 (프로덕션에서는 항상 true)
      secure: process.env.NODE_ENV === 'production' ? true : (options?.secure ?? true),
      sameSite: options?.sameSite ?? 'lax',
    };
    
    res.cookies.set(name, value, cookieOptions);
  });
}
```

#### 3. 브라우저 쿠키 정책 차단
**원인:**
- Third-party cookies 차단
- 브라우저 확장 프로그램 차단
- 브라우저 설정에서 쿠키 차단

**해결 방법:**
- 브라우저 설정 확인
- 확장 프로그램 비활성화
- 시크릿 모드에서 테스트
- **코드 수정 불가** (브라우저 설정 문제)

---

## 분기 4: A = ✅, B = ✅, C = ✅, D = ❌ (저장됐지만 GET 요청에 Cookie 헤더 없음)

### 가능 원인 Top 3

#### 1. Path 속성 불일치
**원인:**
- 쿠키 `Path=/api`인데 `/api/auth/session` 요청에 포함되지 않음
- Path가 `/`가 아님

**확인 방법:**
- Application 탭에서 쿠키의 Path 속성 확인
- `/`여야 함

**코드 수정:**
```typescript
// bty-app/src/lib/supabase-server.ts

setAll(cookies: CookieToSet[]) {
  cookies.forEach(({ name, value, options }) => {
    const cookieOptions: any = {
      // ✅ Path를 명시적으로 '/'로 설정
      path: '/',
      httpOnly: options?.httpOnly ?? true,
      secure: options?.secure ?? true,
      sameSite: options?.sameSite ?? 'lax',
    };
    
    res.cookies.set(name, value, cookieOptions);
  });
}
```

#### 2. SameSite=Strict로 인한 전송 차단
**원인:**
- `SameSite=Strict`인데 다른 컨텍스트에서 요청
- 크로스 사이트 요청에서 쿠키 전송 차단

**코드 수정:**
```typescript
// bty-app/src/lib/supabase-server.ts

setAll(cookies: CookieToSet[]) {
  cookies.forEach(({ name, value, options }) => {
    const cookieOptions: any = {
      path: '/',
      httpOnly: options?.httpOnly ?? true,
      secure: options?.secure ?? true,
      // ✅ SameSite를 Lax로 강제 (Strict는 첫 방문 시 쿠키 전송 안 됨)
      sameSite: 'lax',
    };
    
    res.cookies.set(name, value, cookieOptions);
  });
}
```

#### 3. fetch() credentials 옵션 누락
**원인:**
- `fetchJson()`에서 `credentials: 'include'`가 제대로 설정되지 않음
- 이미 확인됨 - 문제 없음

**확인:**
```typescript
// bty-app/src/lib/read-json.ts
// 이미 credentials: 'include' 설정되어 있음 ✅
```

---

## 통합 수정안: 모든 문제 해결

### 1. 공통 쿠키 유틸리티 함수 생성

```typescript
// bty-app/src/lib/cookie-utils.ts (새 파일)

import { NextResponse } from "next/server";

/**
 * Cloudflare Workers + OpenNext 호환 Set-Cookie 복사 함수
 * 모든 Route Handler에서 사용
 */
export function copySetCookies(from: NextResponse, to: NextResponse): void {
  const anyHeaders = from.headers as any;
  
  // 방법 1: getSetCookie() 시도 (Node.js 18+)
  const getSetCookie = anyHeaders.getSetCookie?.bind(anyHeaders);
  if (getSetCookie) {
    try {
      const cookies: string[] = getSetCookie() || [];
      if (cookies.length > 0) {
        cookies.forEach((c) => {
          to.headers.append("set-cookie", c);
        });
        return;
      }
    } catch (e) {
      console.warn('[copySetCookies] getSetCookie failed:', e);
    }
  }
  
  // 방법 2: 모든 set-cookie 헤더 직접 추출 (Cloudflare Workers 호환)
  const allHeaders = Array.from(from.headers.entries());
  const setCookieHeaders = allHeaders
    .filter(([key]) => key.toLowerCase() === 'set-cookie')
    .map(([, value]) => value);
  
  if (setCookieHeaders.length > 0) {
    setCookieHeaders.forEach((c) => {
      to.headers.append("set-cookie", c);
    });
    return;
  }
  
  // 방법 3: 단일 set-cookie 폴백
  const single = from.headers.get("set-cookie");
  if (single) {
    to.headers.append("set-cookie", single);
  }
}
```

### 2. Supabase 서버 클라이언트 수정

```typescript
// bty-app/src/lib/supabase-server.ts

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

type CookieToSet = { name: string; value: string; options?: any };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function createServerSupabaseClient(): SupabaseClient | null {
  if (!url || !key) return null;
  return createClient(url, key);
}

export function getSupabaseServer(req: NextRequest, res: NextResponse) {
  if (!url || !key) return null;

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookies: CookieToSet[]) {
        cookies.forEach(({ name, value, options }) => {
          // ✅ Cloudflare Workers 환경에 최적화된 쿠키 옵션
          const cookieOptions: any = {
            path: '/', // ✅ 명시적으로 루트 경로
            httpOnly: true, // ✅ 보안을 위해 항상 true
            secure: true, // ✅ HTTPS 필수
            sameSite: 'lax', // ✅ Lax로 설정 (Strict는 문제 발생 가능)
            // domain은 명시하지 않음 (현재 도메인 사용)
          };
          
          // ✅ options에서 오는 값이 있으면 덮어쓰기 (단, path는 항상 '/')
          if (options) {
            if (options.httpOnly !== undefined) cookieOptions.httpOnly = options.httpOnly;
            if (options.secure !== undefined) cookieOptions.secure = options.secure;
            if (options.sameSite !== undefined) cookieOptions.sameSite = options.sameSite;
            // path는 항상 '/'로 유지
          }
          
          res.cookies.set(name, value, cookieOptions);
        });
      },
    },
  });
}
```

### 3. 모든 Route Handler에서 공통 함수 사용

```typescript
// bty-app/src/app/api/auth/login/route.ts
import { copySetCookies } from "@/lib/cookie-utils";

// 기존 copySetCookies 함수 제거하고 import 사용

// bty-app/src/app/api/auth/session/route.ts
import { copySetCookies as copySetCookie } from "@/lib/cookie-utils";

// 기존 copySetCookie 함수 제거하고 import 사용

// bty-app/src/app/api/auth/register/route.ts
import { copySetCookies } from "@/lib/cookie-utils";

// 기존 copySetCookies 함수 제거하고 import 사용
```

---

## 디버깅 코드 추가

모든 Route Handler에 디버깅 코드 추가:

```typescript
// 예: bty-app/src/app/api/auth/session/route.ts

export async function POST(req: NextRequest) {
  const cookieRes = new NextResponse(null);
  
  try {
    const supabase = getSupabaseServer(req, cookieRes);
    // ... 기존 코드 ...
    
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    
    // ✅ 디버깅: 쿠키 설정 확인
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
      const cookiesAfter = cookieRes.headers.getSetCookie?.() || [];
      console.log('[session POST] Cookies after setSession:', cookiesAfter.length);
      cookiesAfter.forEach((c, i) => {
        console.log(`[session POST] Cookie ${i + 1}:`, c.substring(0, 100) + '...');
      });
    }
    
    const out = NextResponse.json({ ok: true }, { status: 200 });
    copySetCookie(cookieRes, out);
    
    // ✅ 디버깅: 최종 쿠키 확인
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
      const cookiesFinal = out.headers.getSetCookie?.() || [];
      console.log('[session POST] Cookies final:', cookiesFinal.length);
    }
    
    return out;
  } catch (e: any) {
    // ... 기존 코드 ...
  }
}
```

---

## 테스트 체크리스트

수정 후 다음을 확인:

1. [ ] `/api/auth/login` 응답에 Set-Cookie 헤더 존재
2. [ ] `/api/auth/session` POST 응답에 Set-Cookie 헤더 존재
3. [ ] Application 탭에서 쿠키 저장 확인 (Path=/, SameSite=Lax, Secure=true, HttpOnly=true)
4. [ ] `/api/auth/session` GET 요청에 Cookie 헤더 포함
5. [ ] `/api/auth/session` GET 응답이 `{ok:true}`

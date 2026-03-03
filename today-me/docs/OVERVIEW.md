# Dear Me — 프로젝트 개요

## 목적

**Dear Me**는 “Better Than Yesterday” 훈련 생태계 안에서 **회복·심리적 안전**을 위한 공간입니다.  
평가·비교·경쟁을 넣지 않고, **재해석(Reframing)** 과 **검증(Validation)** 만 제공합니다.

---

## 아키텍처 요약

```
[사용자]
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  today-me (Next.js 14, React 18)                          │
│  ├── AuthProvider → AuthGate                             │
│  │   └── 인증: bty 앱 API (NEXT_PUBLIC_AUTH_API_URL)     │
│  ├── 메인 페이지: SafeMirror, SmallWinsStack, SelfEsteemTest │
│  └── /journey: JourneyBoard (28일 여정)                   │
│        └── API: /api/journey/* → Supabase (선택)           │
└─────────────────────────────────────────────────────────┘
    │                              │
    │ (로그인/세션)                 │ (여정 저장)
    ▼                              ▼
[bty 앱 Auth API]              [Supabase]
    │
    ▼
[bty 앱: Arena, 대시보드, 리더보드 등]
```

- **인증**: today-me은 **자체 DB가 아닌 bty 앱의 Auth API**를 사용합니다. (`/api/auth/login`, `/api/auth/register`, `/api/auth/session`)  
  따라서 `NEXT_PUBLIC_AUTH_API_URL`이 bty 앱 URL을 가리켜야 합니다.
- **여정(28일)**: Supabase를 사용할 경우 `SUPABASE_SERVICE_ROLE_KEY`와 프로젝트 URL/anon key가 필요합니다.  
  API 라우트에서 `getSupabaseAdmin()`으로 쓰기합니다.

---

## 데이터 흐름

### 인증

1. 사용자가 로그인/회원가입 → `auth-client.ts`의 `login` / `register`가 **bty Auth API** 호출.
2. 응답으로 받은 **JWT**를 `localStorage` (`bty_auth_token`)에 저장.
3. `AuthContext`의 `fetchSession(token)`이 bty의 `/api/auth/session`을 호출해 `user` 상태 유지.
4. **「bty에서도 로그인」**: `buildCrossSiteLoginUrl(BTY_ORIGIN, token)`으로 bty 앱 URL에 `#bty_token=...`을 붙여 이동.  
   bty 앱이 해시에서 토큰을 읽어 동일 계정으로 로그인합니다.

### 28일 여정

- **콘텐츠**: `src/lib/journey-content.ts`의 `JOURNEY_DAYS` (읽을거리 + 일별 미션). 정적 데이터.
- **진행 상태**: `/api/journey/profile`, `/api/journey/entries`, `/api/journey/bounce-back` 등이 Supabase(또는 설정된 백엔드)에 저장/조회.

### 자존감 알아보기

- **클라이언트만** 사용. 문항·선택지·결과 메시지는 `SelfEsteemTest.tsx`의 `CONTENT` (ko/en)에 있으며, 서버/DB 없이 동작합니다.
- 언어는 메인 페이지에서 `locale` state + localStorage (`dearme:lang`)로 유지됩니다.

---

## 주요 파일 역할

| 파일/폴더 | 역할 |
|-----------|------|
| `src/contexts/AuthContext.tsx` | 인증 상태, login/register/logout, 세션 로드 |
| `src/lib/auth-client.ts` | bty Auth API 호출, 토큰 저장/조회, 크로스 사이트 로그인 URL |
| `src/components/AuthGate.tsx` | 비로그인 시 로그인/회원가입 폼, 로그인 시 헤더(이메일, bty 링크, 로그아웃) + children |
| `src/lib/journey-content.ts` | 28일 읽기/미션 데이터 (한국어) |
| `src/lib/supabase.ts` | Supabase 서버 클라이언트 (API 라우트용) |

---

## 톤앤매너 가이드

- **평가·비교 금지**: 점수, 순위, “더 나음” 강조 문구 사용하지 않기.
- **수용·검증**: “괜찮아요”, “그런 마음 드는 건 당연해요”, “그대로 두어도 돼요” 등.
- **안식처 비주얼**: 파스텔(sage, blush, lavender, mint, peach) 중심, 부드러운 대비.

---

## 확장 시 참고

- **자존감 문항 확장**: `SelfEsteemTest.tsx`의 `CONTENT.ko.questions` / `CONTENT.en.questions`에 동일 인덱스로 문항 추가.
- **28일 콘텐츠 영어화**: `journey-content.ts`에 `readingEn`, `missionsEn` 등 필드를 추가하고, `JourneyBoard`/`MissionCard`에서 `locale`에 따라 표시 분기.
- **Safe Mirror 실제 Reframing API**: 현재 예시 응답 대신 외부 API 또는 bty 백엔드 연동 시 `SafeMirror.tsx` 내부에서 호출하도록 변경.

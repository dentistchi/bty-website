# Dear Me (오늘의 나 · 안식처)

회복(Recovery)과 심리적 안전을 위한 공간. **평가·비교·"Better" 금지.** Reframing & Validation만 제공합니다.  
bty(Better Than Yesterday) 훈련장과 **하나의 계정**으로 연동됩니다.

---

## 빠른 시작

```bash
cd today-me
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속.

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **Safe Mirror (안전한 거울)** | 텍스트로 감정/상황 입력 → 조언이 아닌 **재해석(Reframing)** 문장만 표시. |
| **Small Wins (작은 승리)** | 제안 버튼 또는 직접 입력으로 아주 작은 성공 기록. 클릭 시 꽃 피어남 애니메이션. |
| **자존감 알아보기** | 5문항 선택형. 결과는 **점수/등급 없이** 안식처 톤의 받아들임 메시지로만 표시. **한국어/영어(EN·KO)** 전환 지원. |
| **28일 여정** | `/journey` — 28일 읽기 + 미션. 진행 상황 저장. |

---

## 언어 (EN / KO)

- 메인 페이지 상단 **EN | KO** 버튼으로 전환.
- 선택한 언어는 **localStorage**에 저장되어 다음 방문 시에도 유지됩니다.
- 자존감 알아보기 문항·선택지·결과 메시지가 선택한 언어로 표시됩니다.

---

## 프로젝트 구조

```
today-me/
├── src/
│   ├── app/
│   │   ├── globals.css       # 파스텔 안식처 테마 (sanctuary 색상)
│   │   ├── layout.tsx        # 루트 레이아웃, AuthProvider, 메타
│   │   ├── page.tsx          # 메인 페이지 (SafeMirror, SmallWins, SelfEsteemTest)
│   │   ├── journey/
│   │   │   └── page.tsx     # 28일 여정
│   │   └── api/
│   │       └── journey/     # 여정 프로필·엔트리·bounce-back API
│   ├── components/
│   │   ├── AuthGate.tsx     # 로그인/회원가입 게이트, bty 연동 링크
│   │   ├── SafeMirror.tsx   # 감정 입력 → Reframing
│   │   ├── SmallWinsStack.tsx # 작은 승리 스택
│   │   ├── SelfEsteemTest.tsx  # 자존감 알아보기 (ko/en)
│   │   └── journey/
│   │       ├── JourneyBoard.tsx  # 28일 여정 보드
│   │       └── MissionCard.tsx   # 일별 미션 카드
│   ├── contexts/
│   │   └── AuthContext.tsx  # 인증 상태·로그인·회원가입
│   └── lib/
│       ├── utils.ts         # cn() 등
│       ├── supabase.ts      # Supabase 클라이언트 (서버용)
│       ├── auth-client.ts   # 크로스 사이트 로그인 URL·토큰
│       └── journey-content.ts  # 28일 읽기/미션 콘텐츠
├── package.json
└── README.md
```

---

## 기술 스택

- **Next.js 14** (App Router)
- **React 18**
- **Tailwind CSS** (sanctuary 테마: sage, blush, lavender, mint, peach)
- **Supabase** (인증·DB — bty-app과 동일 백엔드 사용 가능)
- **Framer Motion** (애니메이션)

---

## 환경 변수

| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_AUTH_API_URL` | **bty 앱** 인증 API 기준 URL. 로그인/회원가입/세션은 이 주소의 `/api/auth/*` 사용. (필수) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL (여정 등 저장 시) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (클라이언트) |
| `SUPABASE_SERVICE_ROLE_KEY` | 서비스 롤 키 (API 라우트·여정 저장용) |
| `NEXT_PUBLIC_BTY_URL` | bty 앱 URL (「bty에서도 로그인」 링크용). 예: `https://bty-website.pages.dev` 또는 `http://localhost:3001` |

`.env.local`에 설정 후 `npm run dev` 실행.

---

## bty 연동

- **하나의 계정**: Dear Me에서 로그인/가입한 계정으로 bty 훈련장(Arena, 대시보드, 리더보드)에도 로그인됩니다.
- 메인 페이지 상단 **「bty에서도 로그인」** 링크로 bty 앱으로 토큰을 전달해 SSO처럼 사용할 수 있습니다.
- 푸터 **「어제보다 나은 연습하러 가기 (bty)」** 로 bty 사이트로 이동.

---

## 톤앤매너

- 병원이 아닌 **따뜻한 안식처**. 파스텔(sage, blush, lavender, mint, peach) 중심.
- 문구: 평가·비교·압박 금지. "괜찮아요", "그런 마음 드는 건 당연해요" 등 **수용·검증** 톤 유지.

---

## 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 서버 (기본 3000) |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 프로덕션 서버 실행 |
| `npm run lint` | ESLint 실행 |

---

## 추가 문서

- **상세 아키텍처·데이터 흐름**: [docs/OVERVIEW.md](./docs/OVERVIEW.md)
- **bty 앱**(Arena·대시보드·리더보드): 상위 `bty-app/README.md` 참고.

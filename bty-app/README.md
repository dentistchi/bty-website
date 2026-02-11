# Dear Me & BTY (통합 앱)

한 앱에서 **자존감 회복실(Dear Me)** 와 **훈련장(BTY)** 를 모두 제공. 한국어 + **영어(/en)** 지원. 기본 AI 챗봇 탑재.

## 경로

| 경로 | 내용 |
|------|------|
| `/` | Dear Me (한국어) |
| `/bty` | BTY 훈련장 (한국어) |
| `/en` | Dear Me (English) |
| `/en/bty` | BTY (English) |

상단 네비로 Dear Me ↔ 훈련장, 한국어 ↔ English 전환.

## 하나의 계정

- 로그인/회원가입은 이 앱 한 곳. 로그인하면 모든 경로에서 동일 계정.
- Dear Me 자존감 회복 데이터를 BTY에서 맞춤 제안에 활용할 수 있음.

## 실행

```bash
cd bty-app
npm install
npm run dev
```

http://localhost:3001  
- `/` → 안식처 (한국어)  
- `/en` → Sanctuary (English)  
- `/bty` → 훈련장 (한국어)  
- `/en/bty` → Dojo (English)

## AI 챗봇

- 우측 하단 말풍선 버튼으로 열기.
- **역할:** 사용자를 평가하지 않는 친구. "실패해도 괜찮다"고 말해 줌.
- `OPENAI_API_KEY`가 있으면 GPT로 응답, 없으면 고정 격려 문구로 응답.

## 페이지·구조

```
bty-app/src/
├── app/
│   ├── page.tsx           # Dear Me (KO)
│   ├── bty/page.tsx       # BTY (KO)
│   ├── en/page.tsx        # Dear Me (EN)
│   ├── en/bty/page.tsx    # BTY (EN)
│   ├── api/auth/*         # 로그인/회원가입/세션
│   └── api/chat/route.ts  # 챗봇 (비평가·실패 허용 페르소나)
├── components/
│   ├── SafeMirror, SmallWinsStack, SelfEsteemTest  # Dear Me
│   ├── IntegritySimulator, PracticeJournal, Comeback  # BTY
│   ├── AuthGate, Chatbot, Nav, ThemeBody, SetLocale
│   └── ...
└── lib/
    ├── i18n.ts   # ko/en 메시지
    └── ...
```

## UI 톤

- **안식처 (/)** 파스텔(sanctuary). 평가·비교 금지.
- **훈련장 (/bty)** 보라/흰색(dojo). 연습(Practice) 강조.

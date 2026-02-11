# Dear Me (안식처)

회복(Recovery)과 심리적 안전을 위한 공간. 평가·비교·"Better" 금지. Reframing & Validation만 제공.

## 실행

```bash
cd today-me
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속.

## 컴포넌트 구조

```
src/
├── app/
│   ├── globals.css      # 파스텔 안식처 테마 (sanctuary 색상)
│   ├── layout.tsx       # 루트 레이아웃, 메타, 폰트
│   └── page.tsx         # 메인 페이지 (세 섹션 조합)
├── components/
│   ├── SafeMirror.tsx   # 안전한 거울: 부정 감정 입력 → Reframing만 응답
│   ├── SmallWinsStack.tsx # 작은 승리: 작은 성공 기록 + 꽃 피어남 피드백
│   └── SelfEsteemTest.tsx # 자존감 알아보기: 기존 유지, 결과는 점수 없이 받아들임 메시지
└── lib/
    └── utils.ts         # cn() 등
```

## 기능 요약

| 기능 | 설명 |
|------|------|
| **Safe Mirror** | 텍스트로 감정 입력 → AI는 조언 없이 재해석(Reframing) 문장만 표시. (현재 예시 응답, 추후 API 연동) |
| **Small Wins Stack** | 제안 버튼 또는 직접 입력으로 아주 작은 성공 기록. 클릭 시 꽃 피어남 애니메이션. |
| **자존감 알아보기** | 5문항 선택형 유지. 결과는 점수/등급 없이 안식처 톤의 받아들임 메시지로만 표시. |

## 톤앤매너

- 병원이 아닌 **따뜻한 안식처**. 파스텔(sage, blush, lavender, mint, peach) 중심.
- 문구: 평가·비교·압박 금지. "괜찮아요", "그런 마음 드는 건 당연해요" 등 수용·검증 톤.

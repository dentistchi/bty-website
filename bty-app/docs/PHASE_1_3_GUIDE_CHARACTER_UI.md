# Phase 1-3: 가이드 캐릭터 비주얼·챗봇 UI — Dr. Chi 플로팅·멘토 동일 노출

**목표**: 플로팅 챗봇과 멘토 페이지에서 Dr. Chi(또는 mascot)를 **동일한 비주얼**로 노출한다.

---

## 구현 내용

### 1. 아바타 variant 통일

- **멘토 페이지**: `GuideCharacterAvatar variant="warm"` 사용 (기존 유지).
- **플로팅 챗봇**: Dojo·멘토·Dear Me 경로에서 `variant="warm"` 사용.
  - `/bty` (Dojo, dashboard, mentor 등) → `warm`
  - `/dear-me` → `warm`
  - 그 외(랜딩 등) → `default`

→ 플로팅 버튼·챗봇 패널 헤더·메시지 아바타가 멘토 페이지와 같은 **warm** 이미지를 사용한다.

### 2. 플로팅 챗봇 헤더 라벨

- 멘토 페이지(`/mentor`)에서 플로팅 챗봇을 열면, 서브타이틀에 **「멘토」/「Mentor」** 표시.
- 그 외 Dojo는 「Dojo · 연습」/「Dojo」, Dear Me는 「Dear Me」, 랜딩은 「랜딩」/「Home」.

→ 멘토 화면에서 플로팅 챗봇이 “Dr. Chi · Mentor”로 멘토 페이지와 동일한 맥락으로 노출된다.

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/components/Chatbot.tsx` | `guideVariant` = bty/dear-me → warm; `spaceLabel` = /mentor → 멘토/Mentor |
| `src/components/GuideCharacterAvatar.tsx` | Dr. Chi 아바타 컴포넌트 (variant: default, welcome, warm) |
| `src/app/[locale]/bty/(protected)/mentor/page.client.tsx` | 멘토 페이지 — `GuideCharacterAvatar variant="warm"` |
| `bty-app/docs/GUIDE_CHARACTER_ASSET.md` | 에셋 1종 정의 및 사용처 |

---

## 완료 기준

- [x] Dojo/멘토/Dear Me에서 플로팅 챗봇이 `variant="warm"` 사용 (멘토와 동일)
- [x] `/mentor` 경로에서 플로팅 챗봇 헤더 서브타이틀 = 「멘토」/「Mentor」
- [x] 챗봇·멘토 모두 `GuideCharacterAvatar` + 동일 에셋 경로 사용

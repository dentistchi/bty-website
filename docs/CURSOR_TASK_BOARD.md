# Cursor 태스크 보드 (공동)

> **이 프로젝트에는 태스크 보드가 이 파일 하나뿐입니다.** Feature / Fix·Polish / Explore·Plan **모든 창이 이 파일만** 사용합니다. 다른 보드 파일을 만들지 말고, **이 파일의 "현재 작업" 표만** 업데이트하세요.
> **이 파일은 이미 있습니다.** "없어서 새로 만든다"고 하지 말고, 아래 **현재 작업** 표만 업데이트해서 쓰세요.
> **"지금 할 일: X"** 받으면: 긴 설명·옵션 메뉴 없이 바로 작업 진행하고, 끝나면 이 표의 해당 행만 **완료**로 바꾸세요.

**태스크 타입별 Cursor**가 이 파일을 보고, 작업을 가져가고 완료 시 업데이트한다.  
다른 창에서 어떤 일을 하는지 볼 수 있어 서로 겹치지 않게 한다.

---

## 사용 방법

1. **작업 시작 전**: 이 파일을 열어서 비어 있는 행에 자신의 Cursor 타입·할 일·상태를 적는다.
2. **작업 중**: 상태를 `진행 중`으로 바꾼다 (선택).
3. **작업 완료 후**: 상태를 `완료`로 바꾸고, 필요하면 한 줄 요약을 남긴다. 다른 Cursor는 `git pull` 후 이 파일을 새로고침해서 확인한다.

---

## 현재 작업 (최신이 위로)

| Cursor 타입 | 할 일 (한 줄) | 상태 | 비고 |
|-------------|----------------|------|------|
| Feature / Explore·Plan | Phase 2-4: Dojo/Dear Me XP 설계 — 무엇을 기록할지(멘토 대화·챗·체류 시간 등), 얼마나 줄지 (스펙+이벤트 정의) | <span style="color:blue">완료</span> | DOJO_DEAR_ME_XP_SPEC 보강: 이벤트 정의·XP·추후 체류시간 |
| Feature | Phase 2-5: Dojo/Dear Me 이벤트 기록 및 XP 반영 — 이벤트 저장 + weekly_xp 연동 (API·DB) | <span style="color:blue">완료</span> | 20260229_activity_xp_events.sql, recordActivityXp→active league |
| Feature | Phase 1-1: 전역 챗봇 Dear Me 안전 밸브 — /api/chat에서 낮은 자존감 패턴 감지 시 Dear Me 링크 메시지 | <span style="color:blue">완료</span> | 기존 구현 확인, 영어 패턴 추가, docs/PHASE_1_1_DEAR_ME_SAFETY_VALVE.md |
| Feature | Phase 1-2: 전역 챗봇 Dojo 추천 — 학습/연습 필요 시 Dojo(멘토·역지사지) 링크 제안 | <span style="color:blue">완료</span> | mode 제한 제거(전역), docs/PHASE_1_2_DOJO_RECOMMEND.md |
| Feature | Phase 1-3: 가이드 캐릭터 비주얼·챗봇 UI — Dr. Chi(또는 mascot) 플로팅·멘토 동일 노출 | <span style="color:blue">완료</span> | variant warm 통일, /mentor 시 spaceLabel 멘토, docs/PHASE_1_3_GUIDE_CHARACTER_UI.md |
| Feature / Fix·Polish | 기타 Arena 버그/누락 기능 수정 또는 리더보드 UI 다듬기 | <span style="color:blue">완료</span> | 리더보드 locale·내 순위 강조·notOnBoard 메시지·API 디버그 헤더 제거 |
| Feature | Leaderboard 시즌 API 연동 — active league 기준 정렬·연동 | <span style="color:blue">완료</span> | leaderboard/weekly-xp/run/complete 반영, Leaderboard UI 시즌 표시 |
| Feature | Arena L4 시나리오 노출·UI 검증 — admin l4_access 부여 후 클라이언트에서 L4만 보이는지 확인 | <span style="color:blue">완료</span> | Dashboard ARENA LEVELS 카드 추가, docs/ARENA_L4_VERIFICATION.md |
| Fix/Polish | 로컬 테스트 문서 보완 — bty-app/docs/LOCAL_TEST.md 최신화 | <span style="color:blue">완료</span> | 스크립트 표·경로·트러블슈팅 정리 |

**상태:** <span style="color:red">대기</span> | <span style="color:green">진행 중</span> | <span style="color:blue">완료</span>

---

## Cursor 타입별 역할

- **Feature**: 새 기능 (feature 브랜치). API·페이지·DB 등.
- **Fix/Polish**: 버그 수정, 리팩터, 문서, 린트.
- **Explore/Plan**: 조사·설계·정리. 코드 수정 최소, Chat 위주.

이 파일을 수정할 때는 **맨 위 표만** 바꾸고, 아래 설명은 유지한다.

# Dojo·Dear Me 2차 구현 검증 체크리스트 (5~10항목)

**용도**: 다른 커서가 2차 구현을 끝냈을 때 검증 에이전트가 확인할 때 사용.  
**스펙**: `docs/DOJO_DEAR_ME_NEXT_CONTENT.md` §1-4(50문항·연습 플로우), §2-2(Dear Me 진입), §4·§5·§6(진입·1단계·스펙 요약).

---

## 검증 항목 (5~10개)

| # | 항목 | 확인 방법 |
|---|------|------------|
| 1 | **Dojo 진입 문구** | `/en/bty`, `/ko/bty` 접속 시 `bty.entryIntro` 소개 1~2문장 노출 여부 |
| 2 | **Dojo "시작하기" 동작** | `bty.startCta` 버튼 클릭 시 `/[locale]/bty/mentor`로 이동하는지 |
| 3 | **Dojo i18n** | `src/lib/i18n.ts`에 `bty.entryIntro`, `bty.startCta` ko·en 정의 여부 |
| 4 | **Dojo 1단계(훈련 선택)** | `/bty/mentor`에서 멘토 주제 선택 + "역지사지 시뮬레이터"(`/bty/integrity`) 링크 노출·동작 |
| 5 | **Dear Me 진입** | `/en/dear-me`, `/ko/dear-me`에서 `todayMe.entryIntro` + `todayMe.startCta` 노출, 클릭 시 본문(자존감 진단·안전한 거울 등) 노출 |
| 6 | **Dear Me i18n** | `todayMe.entryIntro`, `todayMe.startCta` ko·en 정의 여부 |
| 7 | **locale 전달** | en/ko 전환 시 위 문구가 해당 언어로 바뀌는지 |
| 8 | **규칙 준수** | 변경 구간에 XP/랭킹/시즌 계산 없음, 도메인·API 분리 유지(AGENTS_SHARED_README·bty-*.mdc) |
| 9 | **기존 경로 회귀 없음** | `/bty/mentor`, `/bty/dashboard`, `/bty-arena`, `/bty/integrity` 등 기존 라우트 정상 동작 |
| 10 | **(2차 확장 시) 스펙 부합** | 50문항 진행·제출·결과 또는 연습 플로우 2~5단계 구현 시 §1-4·§6 플로우·API 연동 대로 동작하는지 |

---

## 실행 요약

- **PASS**: 구현 범위에 해당하는 항목이 모두 충족될 때.
- **FAIL**: 불충족 항목 번호 + 현상 기록.
- 검증 후 이 문서 하단에 `검증 일자`, `결과(PASS/FAIL)`, `비고`를 추가하면 됨.

---

## 검증 결과 (템플릿)

| 항목 | 내용 |
|------|------|
| 검증 일시 | 2026-02-28 재검증 (체크리스트 1~10 순서대로 코드·스펙 대조) |
| 결과 | **PASS** |
| 비고 | 항목 1~9 충족. 항목 10(2차 확장): 50문항 진행·제출·결과 및 연습 플로우 2~5단계는 미구현 범위로 해당 없음. DOJO_DEAR_ME_NEXT_CONTENT §4·§5·§6·§2-2 기준 진입·1단계·Dear Me 진입 구현 일치. 불충족 항목 없음. |

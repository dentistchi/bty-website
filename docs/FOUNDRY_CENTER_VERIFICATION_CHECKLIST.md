# Foundry·Center 2차 구현 검증 체크리스트

**용도**: `docs/FOUNDRY_CENTER_NEXT_CONTENT.md` 2차 구현 완료 후, 다른 커서(검증 에이전트)가 확인할 때 사용.  
**참고**: FOUNDRY_CENTER_NEXT_CONTENT.md §4(2차 구현 요약), §2-2(Center 진입).

**2차 전체 검증(항목 1~10, 50문항·연습 플로우 2~5단계·규칙 포함)**: **`docs/FOUNDRY_CENTER_2ND_VERIFICATION.md`** 를 사용하세요. 해당 문서에 체크리스트·검증 결과 템플릿이 있음.

---

## 체크리스트 (5~10항목)

| # | 항목 | 확인 방법 | PASS/ |
|---|------|------------|-------|
| 1 | **/bty 첫 화면에 진입 문구 노출** | `/en/bty`, `/ko/bty` 접속 시 `bty.entryIntro` 소개 1~2문장이 보이는지 | |
| 2 | **/bty "시작하기" 버튼 노출·동작** | `bty.startCta`("시작하기") 버튼이 보이고, 클릭 시 `/bty/mentor`로 이동하는지 | |
| 3 | **i18n: bty 진입 문구 ko/en** | `src/lib/i18n.ts`에 `bty.entryIntro`, `bty.startCta`가 ko·en 모두 정의되어 있는지 | |
| 4 | **/bty 레이아웃** | `/bty` 첫 화면이 ArenaLayoutShell·BtyTopNav를 사용하는지(헤더·크림 배경 등) | |
| 5 | **/center 첫 화면 진입 문구·CTA** | `/en/center`, `/ko/center` 접속 시 `center.entryIntro` + `center.startCta`("시작하기")가 보이고, 클릭 시 본문(자존감 진단·안전한 거울 등) 또는 다음 단계가 노출되는지 | |
| 6 | **i18n: Center 진입 ko/en** | `center.entryIntro`, `center.startCta`가 ko·en 모두 정의되어 있는지 | |
| 7 | **locale 전달** | `/bty`·`/center` 페이지에서 locale이 하위 컴포넌트·i18n에 올바르게 전달되는지 (en/ko 전환 시 문구 변경) | |
| 8 | **기존 경로 회귀 없음** | `/bty/mentor`, `/bty/dashboard`, `/bty-arena` 등 기존 라우트가 정상 동작하는지 (링크·네비·로그인 후 접근) | |

---

## 실행 요약

- **PASS**: 위 8항목 모두 충족 시.
- **FAIL**: 불충족 항목 번호 + 현상 기록.
- 검증 후 이 문서 하단에 `검증 일자`, `결과(PASS/FAIL)`, `비고`를 추가하면 됨.

---

## 검증 결과 — 옵션 A (Center 1차 플로우 진입, 단계 1)

| 항목 | 내용 |
|------|------|
| **검증 일시** | 옵션 A 구현 후 Cursor 2 검증 수행. |
| **가정** | 옵션 A = FOUNDRY_CENTER_NEXT_CONTENT §4 "Center 1차 플로우 진입(단계 1)"만 해당. 50문항 목차·연습 플로우는 1차에서 스펙/목차만 확정된 항목으로 이번 구현 범위 미포함. |
| **규칙 점검** | AGENTS_SHARED_README·bty-*.mdc — 도메인/API/UI 분리, XP·시즌·리더보드 계산 금지(UI), 비즈니스 로직 중복 없음. PageClient·center 페이지·i18n만 사용, 새 API/도메인 로직 없음. ✅ |
| **결과** | **PASS** |
| **발견 이슈** | 없음. |

---

## 검증 결과 — Foundry·Center 2차 전체 (재검증)

| 항목 | 내용 |
|------|------|
| **검증 일시** | 다른 커서가 Foundry·Center 2차(옵션 A) 구현 완료 후 Cursor 2 검증. |
| **스펙 대조** | FOUNDRY_CENTER_NEXT_CONTENT §4·§5·§6·§2-2: 진입(entryIntro+startCta), Foundry → mentor, Center → 본문 노출, 50문항/연습 플로우는 문서 목차·스펙만(코드 미구현 범위). |
| **규칙 점검** | AGENTS_SHARED_README·bty-arena-global·bty-ui-render-only: 변경 파일이 XP/랭킹/시즌 계산 없음, API/도메인 호출 없이 페이지·i18n·진입 분기만 사용. ✅ |
| **결과** | **PASS** |
| **발견 이슈** | 없음. |

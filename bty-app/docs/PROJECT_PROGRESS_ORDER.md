# 프로젝트 진행 순서 (새 창에서 참고용)

**이 파일을 새 Cursor 창에서 열어두고**, 어떤 순서로 작업할지 참고하세요.  
태스크 보드는 **`docs/CURSOR_TASK_BOARD.md`** 하나만 사용하고, 그 **표만** 업데이트합니다.

---

## 1. 전체 진행 순서 (한 줄)

| 순서 | 단계 | 요약 |
|------|------|------|
| 0 | **Phase 0** | 랜딩·챗봇·멘토·문서 — ✅ 완료 |
| 1 | **Arena 완성** | 버그 수정, L4·리더보드 시즌·자유 입력 등 — ✅ 완료 |
| 2 | **Phase 1** | 챗봇 Dear Me/Dojo 밸브 + 가이드 캐릭터 통일 — ✅ 완료 |
| 3 | **Phase 2** | Arena 자유 입력 심화 + Dojo/Dear Me XP 연동 — ✅ 완료 |
| 4 | **Phase 3** | 사용자 아바타 (DB·UI·리더보드 반영) — ✅ 거의 완료 |
| 5 | **Phase 4** | 코드별 테마·엘리트 5% — ✅ 완료 (`docs/PHASE_4_CHECKLIST.md`) |
| 6 | **Dojo/Dear Me 콘텐츠** | 50문항·자존감 훈련·Dear Me 진입·빈 상태 보강 등 — ✅ 완료 (`docs/DOJO_DEAR_ME_NEXT_CONTENT.md`, BACKLOG §7·§8) |
| 7 | **다음 프로젝트** | 아래 §3 "다음에 진행할 작업" 참고. (챗봇 훈련, Dojo/Dear Me 심화, 엘리트 3차, 또는 새 백로그.) |

---

## 2. 지금 상태 (최근까지)

- **Phase 0·1·2**: 완료.
- **Phase 3**: 아바타 URL·캐릭터 선택·아웃핏 테마 저장, 리더보드 아바타 반영, 대시보드 저장 피드백까지 반영. (3-2 RPM 대안 생성 플로우는 보류.)
- **Phase 4**: 완료. 코드별 가이드 스킨 스펙·챗봇/멘토 스킨, 엘리트 5% 기획·멘토 배지 확장·Elite 전용 페이지 등 `docs/PHASE_4_CHECKLIST.md` 4-1~4-4 반영.

---

## 3. 다음에 진행할 작업 (우선순위)

### 현재: 백로그 §1~§8 완료. "다음 프로젝트" 후보

- **챗봇 훈련** (로드맵 "챗봇 훈련 시기"): MVP 직전에 시스템 프롬프트·예시·필요 시 RAG 한 번 설계. 구역별(bty / today-me) 말투·역할 정리.
- **Dojo·Dear Me 콘텐츠 심화**: 50문항 문항 세트·선택지 DB화, 연습 플로우 2종 이상, Dear Me 자존감 회복 훈련 플로우 설계. (`docs/DOJO_DEAR_ME_NEXT_CONTENT.md` §1·§2 확장)
- **엘리트 3차**: 챔피언십, 멘토 대화 신청, 엘리트 배지 증정 등. (`docs/PHASE_4_ELITE_5_PERCENT_SPEC.md` §10 후보)
- **새 백로그**: 위와 무관한 새 기능·새 제품·다른 레포 등. `docs/CURRENT_TASK.md` 또는 `docs/PROJECT_BACKLOG.md`에 §9 이후로 추가 후 진행.

**진행 에이전트**: 구체 지시는 `docs/CURRENT_TASK.md` 한 줄 지시 또는 위 후보 중 하나를 문장으로 적어서 지시.

---

## 4. 사용 방법

1. **새 Cursor 창**을 열고 이 파일(`docs/PROJECT_PROGRESS_ORDER.md`)을 열어둔다.
2. **할 일**을 정하면 **`docs/CURSOR_TASK_BOARD.md`**를 열고, **현재 작업 표**에 한 줄 추가한다 (Cursor 타입, 할 일, 상태).
3. 해당 타입 창(Feature / Fix·Polish / Explore·Plan)에서 그 할 일을 지시하고, 끝나면 보드에서 해당 행만 **완료**로 바꾼다.
4. **다른 보드 파일은 만들지 않고**, `docs/CURSOR_TASK_BOARD.md`의 **표만** 업데이트한다.

---

*로드맵 상세: `docs/ROADMAP_NEXT_STEPS.md`*

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
| 3 | **Phase 2** | Arena 자유 입력 심화 + Dojo/Dear Me XP 연동 — **← 현재** |
| 4 | **Phase 3** | 사용자 아바타 (DB·UI) |
| 5 | **Phase 4** | 코드별 테마·엘리트 5% |
| 6 | **Dojo/Dear Me 콘텐츠** | Arena 안정 후 50문항·자존감 훈련 등 채우기 |

---

## 2. 지금 상태 (최근까지)

- **Phase 0·1**: 완료 (랜딩, 챗봇 전역, Dear Me/Dojo 밸브, 가이드 캐릭터 UI, Dr. Chi 멘토).
- **Arena**: L4·리더보드 시즌·자유 입력(free-response API + UI "기타" 제출) 연동 완료.
- **Phase 2**: Arena 자유 입력(2-1~2-3)은 이미 반영됨. **Dojo/Dear Me XP**(2-4 설계, 2-5 이벤트·XP 반영) 진행 대상.

---

## 3. 다음에 진행할 작업 (우선순위)

### Phase 2 — 지금 할 일

| # | 작업 (한 줄) | 담당 타입 | 비고 |
|---|----------------|----------|------|
| 2-4 | **Dojo/Dear Me XP 설계** — 무엇을 기록할지(멘토 대화 1회, 챗 1회, 체류 시간 등), 얼마나 줄지 | Feature / Explore·Plan | 스펙 + 이벤트 정의 (DOJO_DEAR_ME_XP_SPEC 참고) |
| 2-5 | **Dojo/Dear Me 이벤트 기록 및 XP 반영** — 이벤트 저장 + weekly_xp 등과 연동 | Feature | API·DB 마이그레이션, recordActivityXp 등 |

*(Phase 2-1~2-3 Arena 자유 입력 설계·API·UI는 이미 반영됨.)*

### Phase 3 이후

- **3**: 아바타 서비스 선정·생성 플로우·DB·대시보드/리더보드 노출.
- **4**: 코드별 가이드 스킨, 엘리트 5% 기획·구현.

---

## 4. 사용 방법

1. **새 Cursor 창**을 열고 이 파일(`docs/PROJECT_PROGRESS_ORDER.md`)을 열어둔다.
2. **할 일**을 정하면 **`docs/CURSOR_TASK_BOARD.md`**를 열고, **현재 작업 표**에 한 줄 추가한다 (Cursor 타입, 할 일, 상태).
3. 해당 타입 창(Feature / Fix·Polish / Explore·Plan)에서 그 할 일을 지시하고, 끝나면 보드에서 해당 행만 **완료**로 바꾼다.
4. **다른 보드 파일은 만들지 않고**, `docs/CURSOR_TASK_BOARD.md`의 **표만** 업데이트한다.

---

*로드맵 상세: `bty-app/docs/ROADMAP_NEXT_STEPS.md`*

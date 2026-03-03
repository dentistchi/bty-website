# 현재 작업 (진행 에이전트용)

**진행 에이전트**: 이 파일 또는 커맨더 메시지에 적힌 **기능(요구사항)** 을 구현하세요.  
지시가 없으면 이 파일의 내용을 확인하고, 아래 형식으로 적힌 항목을 도메인 → API → UI 순으로 진행하세요.

**오늘 4커서 병렬 작업 목록**: **`docs/CURSORS_PARALLEL_TASK_LIST.md`** — Cursor 1·2·3·4별 할 일·복사용 프롬프트·완료 시 문서 업데이트 규칙이 정리되어 있음. 커맨더가 해당 문서에서 프롬프트를 복사해 각 Cursor에 붙이면 병렬 진행 가능.

---

## 형식 예시

아래처럼 **한 줄이라도** 구체적으로 적어 주세요.

- 「대시보드에 ○○ 버튼 추가하고, 클릭 시 API /api/arena/… 호출」
- 「리더보드에 주간 리셋 일시 표시」
- 「Arena 시나리오 완료 시 △△ 알림 토스트」
- 「프로필에 ○○ 필드 추가, PATCH /api/arena/profile 에 반영」

---

## 이번에 구현할 기능

**이번 작업 (One-liner)**: First Task = 미들웨어 인증 시 /bty/login → /bty 리다이렉트(Center 재로그인 버그). 이후 C2 Gate → C3/C4 → C5 원클릭 검증.

**DoD**: [ ] lint 통과 [ ] test 통과 [ ] build 통과 [ ] (옵션) workers verify [ ] `./scripts/orchestrate.sh` 또는 `./scripts/ci-gate.sh` 실행.

*(커맨더가 여기에 요구사항을 적거나, 채팅으로 "CURRENT_TASK.md 참고해서 구현해줘" + 기능 설명을 보냅니다.)*

**우선 진행 (Center 페이지)**  
- **`docs/CENTER_PAGE_IMPROVEMENT_SPEC.md`** §9 순서대로: CTA 통합·재로그인 버그 → 챗으로 이어하기 → 5문항 순서 → EN/KO 플로우·로딩 → 회복 탄력성 그래프 → 50문항 정성 → 아늑한 방 톤.  
- 전체 분류·다음 리스트: **`docs/COMMANDER_BACKLOG_AND_NEXT.md`**.  
- 백로그 §10: **`docs/PROJECT_BACKLOG.md`** §10.

**이번 지시 (택일 진행)**  
- **옵션 A — 감정 스탯 v3 확장**: `docs/HEALING_COACHING_SPEC_V3.md`·`docs/specs/healing-coaching-spec-v3.json` 기준으로 coreStats에 v3 이벤트 14종·stat_distribution·헬퍼 추가 후, 30일 가속·phase_tuning을 formula와 recordEmotionalEventServer에 반영.  
- **옵션 B — Dojo 2차 확장 (WHAT_NEXT §2-2)**: `docs/DOJO_DEAR_ME_NEXT_CONTENT.md` §1-4·§6·§4·§5 기준으로 50문항 목차·연습 플로우 2~5단계 스펙 정리 및 추가 구현. PROJECT_BACKLOG §7은 [x]; 2차 확장은 위 스펙으로 진행.

*진행 에이전트는 위 A/B 중 지시된 쪽을 우선 진행. 지시가 없으면 CURRENT_TASK 또는 WHAT_NEXT §2-2 표의 복사용 프롬프트를 참고.*

**이전 완료**: 챗봇 훈련 (PROJECT_BACKLOG §9) — ✅ 완료

- **Cursor 4 UI Worker (bty-ui-render-only)**: 대시보드에서 도메인/티어 계산 제거, CoreXpRes 옵션 필드(stage, progressPct, nextCodeName, xpToNext, codeLore, milestoneToCelebrate, previousSubName)로 API 계약만 사용. 리더보드: API 계약 주석·에러 시 재시도 버튼 추가. **결정 요청**: core-xp API가 위 display 필드를 반환하도록 백엔드 확장 필요(미반환 시 진행 바·로어·마일스톤 모달 비노출).

- **할 일**: `docs/ROADMAP_NEXT_STEPS.md` § 챗봇 훈련 시기, `docs/CHATBOT_TRAINING_CHECKLIST.md` 참고해서 시스템 프롬프트 보강(역할·말투·금지), 구역별(bty / today-me) 예시 대화, 메타 질문 답변 가이드. 필요 시 RAG. `src/app/api/chat/route.ts`, `src/components/Chatbot.tsx` 수정. CHATBOT_TRAINING_CHECKLIST §3 [ ] 항목 정리·반영.
- **반영 요약**: `src/lib/bty/chat/buildChatMessages.ts`(NVC·치유 스펙, 메타/인사/BTY·Dear Me 소개, few-shot), `chatGuards.ts`(isMetaQuestion, getMetaReply), `route.ts`(메타 질문 시 고정 답변), `Chatbot.tsx`(소개·공간 안내 i18n), `i18n.ts`(chat.introDojo/introDearMe/spaceHintDojo/spaceHintDearMe). §3 항목 전부 [x].
- **구현 테스트 검증**: ✅ **PASS** — Cursor 2에서 Lint 통과, Vitest 10/10 통과. next/headers·supabaseServer 목 추가로 테스트 환경 이슈 해결. 상세는 `docs/NEXT_STEPS_RUNBOOK.md` § "챗봇 구현 테스트 결과".

**다음 예정 (챗봇 훈련 이후)**  
- **시스템 업그레이드 (감정 스탯)**: `docs/SYSTEM_UPGRADE_PLAN_EMOTIONAL_STATS.md` — Core Stats·Events·Advanced Stats 해금, Q/Δ 공식, UI 문구만·악용 방지.  
  - **Phase A1–F1**: ✅ **도메인 → DB → API → UI 순 반영 완료** (coreStats/formula/unlock/antiExploit, 마이그레이션, record-event/display API, 챗/멘토 연동, UI phrases).  
  - **이후**: v3 스펙(이벤트 15종·stat_distribution·30일 가속·rapid_session_penalty 등)은 `docs/HEALING_COACHING_SPEC_V3.md`·`docs/specs/healing-coaching-spec-v3.json` 기준으로 확장 가능. 검증은 Cursor 2에 "감정 스탯 API·UI 검증해줘" 등으로 지시.

**현재 단계**: Phase 4 (코드별 테마·엘리트 5%). 상세 목록은 **`docs/PHASE_4_CHECKLIST.md`** 참고.  
**백로그**: **`docs/PROJECT_BACKLOG.md`**.

- **시나리오 노출 확인**: **`docs/SCENARIO_UNLOCK_VERIFICATION.md`** — 가입·레벨에 따른 시나리오 노출 검증 시, 문서의 체크박스를 **순서대로** 확인하면 됩니다.

**한 줄 지시 (복사용)** — 상세·전체 프롬프트: **`docs/NEXT_PROMPTS.md`**. 작업 반영 시 해당 문서에서 `[x]` 로 체크.  
**진행 방식**: NEXT_PROMPTS.md 상단 「다음 작업 진행 방식」 참고 — [ ] 항목 선택 → 프롬프트 복사 → 에이전트 지시 → 완료 시 [x] 반영.

| 상태 | 지시 |
|------|------|
| [x] | **챗봇 훈련 (PROJECT_BACKLOG §9)**: ROADMAP § 챗봇 훈련 시기·CHATBOT_TRAINING_CHECKLIST 참고 — 시스템 프롬프트 보강, 구역별 예시, 메타 질문 가이드, Chatbot 소개·공간 안내 i18n. |
| [x] | **Phase 4 (4-1~4-4)** 완료. 스펙·코드 스킨·엘리트 기획·멘토 배지·해금 콘텐츠. `docs/PHASE_4_CHECKLIST.md` 참고. |
| [x] | **대시보드 Arena Level 숨기기**: "PROJECT_BACKLOG §2: Arena Level 카드 플래그로 MVP 후 숨기기 구현해줘." |
| [x] | **Partner 시나리오**: "PROJECT_BACKLOG §3: Partner일 때 S1~L4 시나리오 노출되도록 점검·수정해줘." |
| [x] | **엘리트 정책**: "PROJECT_BACKLOG §4: 주간 vs 시즌 5% 정책·특혜 1페이지 정리해줘." |
| [x] | **엘리트 특혜 선정**: "PROJECT_BACKLOG §5: 엘리트 특혜 후보 중 1~2차 구현 항목 선정·한 줄 스펙해줘." |
| [x] | **시나리오 검증**: "SCENARIO_UNLOCK_VERIFICATION.md 체크리스트 순서대로 검증해줘." |
| [x] | **Arena UI (B)**: "ARENA_UI_REDESIGN_BRIEF C → B 적용해줘." — B(대시보드 카드·상단 문구) 적용 완료. |
| [x] | **Arena UI (C)**: "ARENA_UI_REDESIGN_BRIEF 프롬프트 C 적용해줘." — 색·테마(변수·그라데이션) 적용 완료. |
| [x] | **Arena UI (D)**: "ARENA_UI_REDESIGN_BRIEF 프롬프트 D 적용해줘." (문구·톤만) |
| [x] | **Arena UI (E)**: "ARENA_UI_REDESIGN_BRIEF 프롬프트 E 적용해줘." (네비·레이아웃, 헤더 포근함) |
| [x] | **Arena UI (A)**: "ARENA_UI_REDESIGN_BRIEF 프롬프트 A 적용해줘." (전체 감성·테마·타이포·카드 변수 통일) |
| [x] | **Leadership Engine P8 최종 검증**: ENGINE_ARCHITECTURE_DIRECTIVE_PLAN §8 — SPEC 일치·bty-arena-global·bty-release-gate·bty-ui-render-only 점검. **통과**. |

- 위 한 줄 지시를 복사해 붙여 넣거나, NEXT_TASKS_2.md §4 표에서 [ ] 항목을 복사해 지시하면 됩니다.

---

**한 줄 지시 (2차)** — 상세·전체 프롬프트: **`docs/NEXT_TASKS_2.md`**. 작업 반영 시 해당 문서에서 `[x]` 로 체크.  
**진행 방식**: NEXT_TASKS_2.md 상단 「다음 작업 진행 방식」 참고 — [ ] 항목 선택 → 프롬프트 복사 → 에이전트 지시 → 완료 시 [x] 반영.  
**진행 ↔ 검증 번갈아**: 한 커서는 진행, 다른 커서는 검증으로 단계별 진행할 때는 **`docs/AGENTS_TURN_BY_TURN.md`** 참고 (단계 1 진행 → 1 검증 → 2 진행 → 2 검증 → …).

| 상태 | 지시 |
|------|------|
| [x] | **Dojo·Dear Me 콘텐츠 기획**: "NEXT_TASKS_2 §1-1: Dojo/Dear Me 1차 콘텐츠 스펙 문서 작성해줘." |
| [x] | **배포 전 체크**: "NEXT_TASKS_2 §1-2: bty-release-gate 규칙에 맞게 배포 전 체크 실행해줘." |
| [x] | **진행 순서 문서 업데이트**: "NEXT_TASKS_2 §1-3: PROJECT_PROGRESS_ORDER·로드맵 Phase 4 완료 반영해줘." |
| [x] | **엘리트 2차 기능**: "NEXT_TASKS_2 §1-4: 챔피언십 또는 특별 프로젝트 1종 구현해줘." |
| [x] | **언어 선택 시나리오·안내·대답 통일**: "NEXT_TASKS_2 §1-5: 한국어 선택 시 한국어 시나리오·안내·대답, 영어 선택 시 영어로 나오게 해줘." |
| [x] | **통합 테스트**: "NEXT_TASKS_2 §2-1: 로그인→XP→리더보드·프로필 통합 시나리오 테스트해줘." |
| [x] | **접근성 점검**: "NEXT_TASKS_2 §3-1: 대시보드·멘토·Arena·리더보드 접근성·키보드 포커스 점검해줘." |
| [x] | **첫인상 디자인**: "NEXT_TASKS_2 §3-3: DESIGN_FIRST_IMPRESSION_BRIEF 참고해서 히어로·폰트·악센트·호버 적용해줘." |
| [x] | **성능 점검 (선택)**: "NEXT_TASKS_2 §3-4: 메인 경로 번들·로딩 점검해줘." |

**Dojo·Dear Me 2차 (진행)**  
| [x] | **Dear Me 1차 플로우 진입 화면**: `docs/DOJO_DEAR_ME_NEXT_CONTENT.md` §2-2 단계 1 — 소개 1~2문장 + "시작하기" 버튼, 클릭 시 본문 노출. (i18n `entryIntro`/`startCta`, PageClient 진입 분기.) |

**Integrator 검증 (2026-03-03)**  
- **로컬**: `npm run lint` FAIL (ESLint defaultMeta/ajv), `npm run test` FAIL (mentor route `dear_me_url` 1건), `npm run build` PASS (PageClient.tsx EOF 누락 수정 반영).  
- **Workers 검증**: `scripts/verify-workers-dev.sh` exit 0/1 자동 판정으로 개선 완료. BASE/LOGIN_BODY placeholder 시 즉시 exit 1, 단계별 HTTP 검증·실패 시 단계명+코드+응답 스니펫 출력.  
- **notify-done**: 전체 PASS 아님으로 미실행.

**Gatekeeper 검사 (2026-03-03)**  
- **규칙 준수**: bty-release-gate, bty-auth-deploy-safety, bty-ui-render-only 기준으로 변경분·관련 경로 검사. **Release Gate Results: PASS.**  
- **상세**: `docs/GATE_REPORT_LATEST.md` — Auth/리셋/리더보드/API/검증 단계 정리. UI에서 tierFromCoreXp/codeIndexFromTier 사용 시 FAIL로 처리하도록 명시.

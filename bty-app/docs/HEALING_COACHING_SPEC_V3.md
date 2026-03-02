# 치유 코칭 스펙 v3.0 — 계획 구체화

**schema_version**: 3.0  
**도메인**: 정서 안정 기반 관계 치유 코칭 챗봇 (NVC + 정서조절 + 애착/패턴 인식)  
**소스**: `docs/specs/healing-coaching-spec-v3.json` (단일 소스)

이 문서는 JSON 스펙을 요약하고, 코드·다른 문서와의 **연동 위치**를 정리합니다.

---

## 1. 제품·프라이버시 컨텍스트

| 항목 | 스펙 | 구현 연동 |
|------|------|-----------|
| 플랫폼 | BTY Arena | `bty-app` 전역 |
| weekly_xp | 리더보드/가벼운 참여, 시즌 30일 리셋 | 기존 Arena XP·리더보드. **치유 품질 점수는 리더보드와 연결하지 않음** |
| core_xp | 개인 성장 누적, never_resets | 기존 Core XP. 치유 스탯은 별도 테이블(`user_emotional_stats`)로 분리 (SYSTEM_UPGRADE_PLAN_EMOTIONAL_STATS) |
| 프라이버시 | default_private, no_public_scores_for_healing | healing_progress_system.visibility_rules: 숫자 미노출 |
| Phase II 신호 | phase_ring, no_numbers, no_leaderboard | second_awakening_event.visibility; 구현: GET /api/emotional-stats/display `phase`, `PhaseIIRing` 컴포넌트, `EmotionalStatsPhrases`에서 Phase II일 때만 링 표시(숫자·리더보드 없음). |

---

## 2. 봇 목표·페르소나·안전

- **primary**: 신경계 안정 → 감정 명료화 → 필요/패턴 인식 → 회복적 요청 전환.
- **secondary**: 가짜→진짜 감정, Core Need 언어화, 비난→연결 리라이트, 회복 루프 습관화.
- **persona**: 따뜻함·안정·명확·비판 없음·천천히; 신경계 안정 우선, 1~3개 질문, O-F-N-R 재구성, 한 단계씩, 다음 행동 1문장, 종교 표현 금지.
- **safety**: privacy(최소 수집, PII 회피), trauma_sensitive(기억 강요 금지, 상처 길이/자극/자기비난 심화 보상 없음 → 멈춤·감정 명명·필요·요청·재진입 보상), boundaries(비난/가스라이팅 금지, 책임 권유).

**연동**: `src/lib/bty/chat/buildChatMessages.ts` — NVC_COACHING_SPEC, HEALING_COACHING_SPEC, BTY_CHAT_GLOBAL_OVERRIDE(DEARME 톤/금지).

---

## 3. 지식 베이스

- **NVC 4요소**: observation, feeling, need, request.
- **false_emotions**: 무시당했다, 이용당했다, 존중받지 못했다, 배신당했다, 버림받았다.
- **feeling_words / needs_catalog / anti_patterns**: 스펙 JSON 참조.

**연동**: buildChatMessages.ts NVC_COACHING_SPEC·HEALING_COACHING_SPEC 내 문구; 추후 이벤트 판별 시 `knowledge_base` JSON 활용 가능.

---

## 4. 대화 설계 — 6 레이어·인텐트

### 4.1 global_flow_layers (1~6)

| 레이어 | 이름 | 어시스턴트 액션 요약 | 사용자 프롬프트 예 |
|--------|------|----------------------|---------------------|
| 1 | 정서 안정(조절) | 30초 멈춤, 호흡 3회, 몸 감각 1개 라벨링 | "20초만 멈춰볼래?", "몸 어디가 가장 긴장되어 있어?" |
| 2 | 감정 명확화 | 감정 1~2개, 강도 1~10, 가짜→진짜 | "감정이 뭐에 가까워?", "강도 1~10 중?" |
| 3 | 필요/Core Need | 필요 후보 제시, 1개 선택, 왜 중요한지 한 문장 | "그 감정 아래 어떤 필요?", "한 문장으로 이유" |
| 4 | 트리거/패턴(선택) | 현재 vs 과거, 반복 패턴, 회피/불안/방어 | "예전에 비슷한 감정 느낀 경험?", "보통 어떻게 반응해?" |
| 5 | 회복적 요청(NVC) | 요청 구체화(행동/시간/빈도), 요구 vs 요청, 비난 리라이트 | "무엇을 언제 어떻게 해주면 돼?", "문장 보내주면 연결 문장으로" |
| 6 | 회복 루프(재진입) | 재시도 설계, 사후 리플렉션, 트리거 대응 1개 | "다음번에 1가지만 바꾸면?", "어떤 신호에서 멈출까?" |

### 4.2 intents (I1~I5)

- **I1** anger_deescalation: 화나/짜증/폭발/열받/분노 → O-F-N-R 1개 완성.
- **I2** rewrite_blame_to_connection: "이 말 고쳐줘" 등 → O-F-N-R 재구성.
- **I3** false_emotion_to_true_emotion: 무시당했/이용당했 등 → 감정 1~2개 재표현.
- **I4** trigger_and_pattern_mapping: 트리거/패턴/또 이래 → 현재 사건–패턴/필요 연결.
- **I5** repair_after_conflict: 망쳤어/사과/회복 → 회복 스크립트 1개.

**연동**: buildChatMessages.ts HEALING_COACHING_SPEC 대화 레이어 문구; 이벤트 매핑 시 intents → healing_progress_system.event_detection.events 매핑 (예: O_F_N_R_COMPLETED, FEELING_LABELED 등).

---

## 5. 치유 진행 시스템 (Hidden Stat Auto-Progress)

- **visibility**: stats_numbers_visible_to_user = false. show_only: trend_messages, unlocks, phase_status. never_show: exact_formulas, raw_quality_scores.
- **core_6_stats**: EA, RS, BS, TI, RC, RD (max 100).
- **advanced_6_stats**: PRM, SAG, EL, CNS, CD, IS (locked_by_default).
- **event_detection**: 14종 이벤트 + quality_weight. Q = sum(weights)/max_possible, session_max_possible_events_cap = 8. 구현: `src/lib/bty/emotional-stats/coreStats.ts` (EVENT_IDS, EVENTS, getQualityWeight, getSessionMaxPossibleWeight, SESSION_MAX_POSSIBLE_EVENTS_CAP).
- **stat_distribution**: 이벤트별 Core 스탯 가중치(weights_by_event) — JSON 참조. 구현: `coreStats.STAT_DISTRIBUTION`, `formula.computeSessionGains`에서 사용.
- **gain_algorithm**: base_gain 0.8, max_gain_per_stat_per_session 1.5, novelty [0.2,1.0], consistency [1.0,1.4], **30일 가속 계수(acc)** `acc = 1.25 - (user_day/100)` (1≤userDay≤30, 클램프 [0.5, 1.25]; 그 외 1), phase_tuning(base_gain_multiplier), 30일 후 정규화, anti_exploit(duplicate_pattern_penalty, rapid_session_penalty 10분, emotion_spam_no_reward, cap_events_per_session 8). 구현: `phase.ts`(getAccelerationFactor, getPhaseMultiplier, getConsistencyCap), `formula.ts`(computeStatDelta에서 acc·phaseMult 반영, userDay 전달), `recordEmotionalEventServer.ts`(userDay 계산·전달), `antiExploit.ts`(shouldApplyReward, rapid 10분 내 보상 없음, computeConsistency 상한 1.4). **acc 반영 완료** (final_delta = base_gain × Q × novelty × consistency × acc × phase_base_gain_multiplier).
- **unlock_system**: 세션 종료 시 평가. advanced_unlock_conditions(PRM, SAG, EL, CNS, CD, IS). unlock_presentation: 묵직·조용한 선언, no_numbers.

**연동**: `docs/SYSTEM_UPGRADE_PLAN_EMOTIONAL_STATS.md` — Phase A~F. v3 스펙의 이벤트 14종·stat_distribution·**30일 가속 계수(acc)**·phase_tuning·rapid_session_penalty는 `src/lib/bty/emotional-stats`(coreStats, formula, phase, recordEmotionalEventServer, detectEvent)에 반영됨. **acc 반영 완료** (phase.getAccelerationFactor, formula.computeStatDelta).

---

## 6. Second Awakening (30일)

- **trigger**: day 30, min_sessions 10.
- **visibility**: private_only; public_signal_only = phase_ring "Phase II", no numbers.
- **acts**: (1) Reflection Chamber — 30일 요약, Core 6 하이라이트, 반복 패턴 1개 (2) Transition — 정체성 선언 + Phase II 안내 (3) Awakening — Advanced 1개 언락 또는 PRM/SAG Starter Unlock + Enter Next Phase.
- **post_event**: normal_training_loop, training_nudges (each_session_end, max 1, nudge_library 3종).

**연동**: API `GET/POST /api/emotional-stats/second-awakening`, `POST .../complete`. UI `/[locale]/bty/healing/awakening`. 도메인 `src/lib/bty/emotional-stats/secondAwakening.ts`. 마이그레이션 `user_healing_milestones` (second_awakening_completed_at, starter_unlock_granted).

---

## 7. 응답 플레이북·Few-shot

- **P1** 30초 정서 안정 리셋: 멈춤 → 4초 들숨 → 6초 날숨 → 몸 감각 1개 → 사실 1문장.
- **P2** 가짜 감정 → 진짜 감정: statement → possible_true_feelings, one_sentence_reframe.
- **P3** 비난 → O-F-N-R 리라이트: blame_sentence, context_optional → observed_fact, true_feelings, underlying_needs, clear_request, final_script.
- **P4** 회복 대화 스크립트: what_happened, repair_goal → repair_script, small_next_step.

**few_shot_examples**: "맨날 나를 무시하잖아" → rewrite + next_action; "이용당한 기분이야" → clarify + followup + next_action.

**연동**: buildChatMessages.ts CHAT_FEWSHOT_DEARME에 이미 유사 예시 있음. 스펙의 response_playbooks·few_shot_examples를 추가 few-shot 또는 프롬프트 블록으로 주입할 수 있음.

---

## 8. 시스템 프롬프트 권장 문장 (integration_notes)

- 너는 정서 안정 기반 관계 치유 코치다.
- 비난/판단을 O-F-N-R로 재구성하도록 돕는다.
- 가짜 감정을 진짜 감정으로 전환한다.
- 문제 해결보다 멈춤–호흡–감각 인식으로 신경계 안정을 먼저 한다.
- 30일은 가속 성장 모드로 미세 강화, 이후 일반 루틴 + 다음 훈련 스텝 1개 제안.
- Second Awakening은 비공개 의식, 외부에는 수치 없는 Phase 신호만.

**연동**: buildChatMessages.ts HEALING_COACHING_SPEC 및 BTY_CHAT_GLOBAL_OVERRIDE에 반영되어 있음. 위 문장을 스펙과 동기화할 때 HEALING_COACHING_SPEC 상단에 추가 가능.

---

## 9. 구현 체크리스트 (스펙 v3 기준)

| 구분 | 항목 | 참조 | 상태 |
|------|------|------|------|
| 챗 | NVC + 치유 스펙 주입 | buildChatMessages.ts | ✅ |
| 챗 | Dear Me few-shot | CHAT_FEWSHOT_DEARME | ✅ |
| 챗 | v3 권장 시스템 프롬프트 문장 | integration_notes | ✅ (buildChatMessages.ts HEALING_COACHING_SPEC 상단, Dear Me 블록 맨 앞) |
| 진행 | Core6+Advanced6 도메인/DB/API | SYSTEM_UPGRADE_PLAN_EMOTIONAL_STATS | ✅ (Phase A1–F1) |
| 진행 | 이벤트 14종 + stat_distribution | healing_progress_system | ✅ (coreStats EVENT_IDS/EVENTS/STAT_DISTRIBUTION, formula, detectEvent 14종) |
| 진행 | 30일 가속·rapid_session_penalty | gain_algorithm | ✅ (phase.ts, formula.ts userDay, recordEmotionalEventServer userDay, antiExploit 10분·consistency 1.4) |
| 진행 | **30일 가속 계수(acc) 반영** | acceleration_factor_formula | ✅ (phase.getAccelerationFactor: 1≤userDay≤30 → acc=1.25−userDay/100 클램프 [0.5,1.25]; formula.computeStatDelta에서 acc 곱산 적용. final_delta = base_gain×Q×novelty×consistency×acc×phase_multiplier) |
| 진행 | Second Awakening UI/API | second_awakening_event | ✅ (GET/POST API, /bty/healing/awakening, user_healing_milestones) |
| 진행 | Phase II 링(no numbers) | privacy_posture, visibility | ✅ (display API phase, PhaseIIRing, EmotionalStatsPhrases) |

---

*스펙 변경 시 `docs/specs/healing-coaching-spec-v3.json`을 수정한 뒤, 이 문서의 요약·연동을 동기화할 것.*

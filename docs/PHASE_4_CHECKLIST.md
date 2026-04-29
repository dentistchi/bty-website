# Phase 4: 코드별 테마·엘리트 5% — 체크리스트

Phase 3(사용자 아바타) 거의 마무리 후 **Phase 4**로 전환합니다.  
진행 시 `[ ]` → `[x]` 로 체크하세요.

**상위 로드맵**: `docs/ROADMAP_NEXT_STEPS.md` § Phase 4

---

## Phase 4 목표

- **코드별 가이드 캐릭터 스킨**: Code에 따라 가이드 캐릭터(챗봇·멘토) 비주얼 변경.
- **엘리트 5%**: 상위 5% 사용자용 기능(해금 콘텐츠, 멘토 배지, 챔피언십 등) 1~2개 구현.

---

## 1. 코드 진행

| # | 작업 | 산출물 | 체크 |
|---|------|--------|------|
| 4-1 | **코드별 가이드 캐릭터 스킨** 기획 | Code별 의상/배경 1세트 스펙 문서. **산출물**: `docs/PHASE_4_CODE_GUIDE_SKIN_SPEC.md` (Code 목록, 콘셉트 표, 경로 제안). 실제 에셋 제작/라이선스 완료 후 체크해도 됨. | [x] |
| 4-2 | 챗봇/멘토에서 코드별 스킨 표시 | 사용자 Code에 따라 가이드 캐릭터 이미지 교체 (현재 Code 계산 로직 활용) | [x] |
| 4-3 | **엘리트 5%** 기능 기획 | 우선순위·스펙 문서. **산출물**: `docs/PHASE_4_ELITE_5_PERCENT_SPEC.md` | [x] |
| 4-4 | 우선순위 높은 1~2개 구현 | (1) 멘토 배지 확장 "Elite 멘토". (2) 해금 콘텐츠: 대시보드 카드 + `/[locale]/bty/elite` 페이지. **상세**: `docs/PHASE_4_ELITE_5_PERCENT_SPEC.md` §9 | [x] |

---

## 2. 에러 / 테스트

| # | 과정 | 확인 방법 | 체크 |
|---|------|-----------|------|
| 1 | 코드별 스킨 노출 | 로그인 사용자 Code 변경 시 챗봇/멘토 이미지가 바뀌는지 확인 | [x] |
| 2 | 엘리트 5% 기능 | 구현한 1~2개 기능이 상위 5% 조건에서만 노출/동작하는지 확인 | [x] |

**§2-2 검증 결과 (엘리트 5% 기능 노출/동작)**  
- **판정 소스**: `GET /api/me/elite` → `getIsEliteTop5(supabase, user.id)` (주간 XP 상위 5%)만 사용. UI는 `isElite` 값을 API 응답으로만 사용.  
- **해금 콘텐츠(1차)**: 대시보드 — `isElite`일 때만 Elite 전용 카드에서 `/[locale]/bty/elite` 링크 노출, 비Elite는 "주간 리더보드 상위 5% 달성 시 이용 가능" 문구만. Elite 전용 페이지 — `GET /api/me/elite`로 확인, Elite일 때만 전용 콘텐츠·멘토 신청 카드, 비Elite 직접 진입 시 "상위 5% 달성 시 이용 가능"만 노출.  
- **멘토 배지(2차)**: 멘토 페이지에서 `isElite`일 때만 "Elite 멘토" 배지 표시 (`{isElite && (...)}`).  
- **멘토 대화 신청(3차)**: POST `/api/me/mentor-request`에서 `canRequestMentorSession(isElite, ...)` 호출, 비Elite 시 403 ELITE_ONLY. UI는 Elite 페이지에서만 신청 카드 노출(isElite 분기).  
- **챔피언십**: 리더보드 상단 챔피언 영역은 전체 사용자에게 상위 1~3명 표시(노출 제한 아님).  
- **결론**: 상위 5% 판정은 API·도메인만 사용, UI는 노출/동작 모두 `isElite`(API 응답) 기준. 버그 없음.

**§2-1 검증 결과 (코드별 스킨 노출)**  
- **챗봇**: `Chatbot.tsx` — bty/mentor 경로에서 패널 오픈 시 `GET /api/arena/core-xp`로 `codeName` 로드 → `GuideCharacterAvatar`에 `codeName` 전달. Code 변경 후 챗을 다시 열면 새 `codeName`으로 요청·이미지 갱신.  
- **멘토**: `mentor/page.client.tsx` — 마운트 시 `GET /api/arena/core-xp`에서 `core?.codeName` → `userCodeName` → `GuideCharacterAvatar`에 전달. Code 변경 후 멘토 페이지 재진입 시 초기 로드에서 새 Code 반영.  
- **스킨 표시**: `GuideCharacterAvatar.tsx` — `getGuideAvatarUrlForCode(codeName)` → `/images/guide-character/code-{slug}.png` 시도, 로드 실패 시 `variant` 폴백. `codeName` 변경 시 `useEffect`로 `codeSkinFailed` 초기화 후 새 URL 시도.  
- **결론**: Code 변경 후 해당 페이지 재진입 또는 챗(패널) 재오픈 시 챗봇/멘토 이미지가 새 Code 기준으로 갱신됨. 버그 없음.

---

## 3. 백로그·기타

| # | 작업 | 산출물 / 확인 | 체크 |
|---|------|----------------|------|
| §7 | **Dojo 2차**: 50문항 목차 또는 연습 플로우 1종 스펙 정리·진입/1단계 구현 | `docs/DOJO_DEAR_ME_NEXT_CONTENT.md` §1-4(목차·스펙), §5(완료 체크리스트). `/bty` 진입 → 시작하기 → `/bty/mentor` 훈련 선택. | [x] |
| §8 | **빈 상태 보강 (선택)**: BRIEF §2에 따라 리더보드/대시보드 등 빈 상태에 일러·아이콘 + 한 줄 문구 | 리더보드 빈 목록: `EmptyState`(🏆 + 문구 + CTA). 대시보드 Arena Level 카드 `membershipPending`: `EmptyState`(📋 + 문구). `PROJECT_BACKLOG.md` §8. | [x] |
| §9 | **챗봇 훈련**: 시스템 프롬프트·NVC 스펙·구역별 예시·메타 질문·BTY/Dear Me 소개 | `src/lib/bty/chat/buildChatMessages.ts`, `chatGuards.ts`, `src/app/api/chat/route.ts`. CHATBOT_TRAINING_CHECKLIST §3 반영. | [x] |

---

## 진행 에이전트용 — 구체적 지시 예시

커맨더가 **`docs/CURRENT_TASK.md`** 또는 메시지로 아래처럼 한 줄 지시하면, 진행 에이전트가 구현합니다.

- 「4-1: 코드별 가이드 캐릭터 스킨 스펙 문서 한 페이지 작성해줘」 → **산출물**: `docs/PHASE_4_CODE_GUIDE_SKIN_SPEC.md` (완료됨)
- 「4-2: 챗봇/멘토 컴포넌트에서 사용자 Code 읽어서 해당 Code 이미지로 교체해줘」
- 「4-3: 엘리트 5% 기능 후보 4가지 정리하고 우선순위 스펙 문서 작성해줘」
- 「4-4: 엘리트 5% 중 “○○ 해금 콘텐츠” 구현해줘 (조건: 상위 5%일 때만 노출)」

---

*이전 단계: `docs/PHASE_3_CHECKLIST.md`*

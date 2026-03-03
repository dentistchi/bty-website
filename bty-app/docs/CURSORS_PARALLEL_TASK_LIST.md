# Cursor 1·2·3·4 병렬 작업 목록 (오늘 할 일)

**목적**: 지금까지 정리된 문서를 바탕으로 **앞으로 할 일**을 한 서류에 모아, **Cursor 1, 2, 3, 4**가 각자 복사용 프롬프트만 보고 **병렬로** 코드를 짜도록 정렬한 문서입니다.

**기준 문서**: `CURRENT_TASK.md`, `PROJECT_BACKLOG.md`, `COMMANDER_BACKLOG_AND_NEXT.md`, `CENTER_PAGE_IMPROVEMENT_SPEC.md`, `WHAT_NEXT.md`, `NEXT_STEPS_RUNBOOK.md`

---

## 📖 참고 문서 (작업 전·작업 중 읽기)

아래 문서는 **이 작업 목록과 함께 읽을 수 있는** 컨텍스트 문서입니다. UI·비주얼·아바타 관련 작업 시 참고하세요.

| 문서 | 용도 |
|------|------|
| **`docs/DESIGN_FIRST_IMPRESSION_BRIEF.md`** | 웹사이트 첫인상 디자인 계획 — 히어로·폰트·악센트·호버 등 전체 감성·비주얼 방향. |
| **`docs/ARENA_UI_REDESIGN_BRIEF.md`** | Arena UI 리디자인 계획 — 대시보드 카드·문구·색·테마·네비·레이아웃 등 Arena 영역 디자인 방향. |
| **`docs/AVATAR_LAYER_SPEC.md`** | 아바타 레이어 명세 — 캐릭터(base) + 옷(outfit) + 악세사리(accessory) 저장/조회/합성, DB·API·프론트·Cursor별 할일(§6·§7). |

*(각 Cursor는 담당 작업에 맞춰 위 문서를 열어 두거나 @ 로 첨부해 컨텍스트로 사용하면 됩니다.)*

---

## 📋 어제 한 작업 — 서류 요약 (확인용)

어제(이전) 진행한 작업이 **어느 서류에 어떻게 기록돼 있는지** 한눈에 보려면 아래 표를 참고하세요. 확인 후 **오늘 할 수 있는 것**은 § "오늘 할 수 있는 것 — 한눈에"와 §3~§7 표를 보면 됩니다.

| 서류 | 기록된 완료 내용 |
|------|------------------|
| **`docs/CURRENT_TASK.md`** | 한 줄 지시 표: 챗봇 훈련, Phase 4, Arena Level 숨기기, Partner 시나리오, 엘리트 정책·특혜, 시나리오 검증, Arena UI A~E, Leadership P8, NEXT_TASKS_2 §1-1~§3-4, Dear Me 1차 플로우 진입 — 전부 [x]. |
| **`docs/WHAT_NEXT.md`** | §1 마무리된 것: BACKLOG §1~§9, Foundry·Center 2차 검증, 감정 스탯 A1–F1, BRIEF §2 로딩·빈 상태, Cursor 4 아바타·코드네임·마이그레이션 3개, 배포 전 체크 PASS, Leadership P8 PASS. §2 다음에 할 일(택일)·검증 프롬프트. |
| **`docs/PROJECT_BACKLOG.md`** | §1~§9 각 항목 [x]. §10 Center·챗봇 플로팅·Arena 한국어·아바타·대시보드 코드네임·리더보드 팀 뷰 — [ ] Center 명세대로 진행 중. |
| **`docs/NEXT_STEPS_RUNBOOK.md`** | §6 현재 상태·다음 지시, Cursor 4 마이그레이션 적용 완료, 배포 전 체크 PASS, 옵션 A 검증·재검증 PASS, 챗봇 테스트 10/10 PASS, Leadership P8 PASS. §7 복사용 프롬프트. |
| **`docs/ARENA_CODENAME_AVATAR_PLAN.md`** | §0 완료·진행, 마이그레이션 3개 적용 완료. §7 검증 결과: 리더보드 아바타·sub-name·코드별 1회·캐릭터+옷 1단계·BTY 규칙 — 전부 PASS. |
| **`docs/FOUNDRY_CENTER_2ND_VERIFICATION.md`** | 검증 결과 템플릿: 2026-02-28 재검증 **PASS**, 항목 1~9 충족, 항목 10(2차 확장) 미구현 범위. |
| **`docs/DOJO_DEAR_ME_VERIFICATION_CHECKLIST.md`** | Dear Me 1차 플로우 진입 검증·재검증 **PASS** 기록. |
| **`docs/AVATAR_LAYER_SPEC.md`** | §8 완료 이력 표 — **비어 있음** (레이어 합성 Cursor 1·3·4 작업은 아직 미착수). |

---

## ✅ 오늘 할 수 있는 것 — 한눈에

서류 확인 결과, **아직 [ ] 인 작업**만 정리했습니다. 아래부터 오늘 바로 착수 가능합니다.

**우선순위 1 — Center 페이지 (COMMANDER_BACKLOG §10, CENTER_PAGE_IMPROVEMENT_SPEC §9 순서)**  
| 누가 | 뭘 | 본문 위치 |
|------|-----|-----------|
| Cursor 1 | §5 CTA 통합 + 재로그인 버그 | §3 표 1번 |
| Cursor 1 | §3 콘텐츠 순서 (5문항→안내→50문항) | §3 표 2번 |
| Cursor 3 | §6 "챗으로 이어하기" 동작 | §5 표 1번 |
| Cursor 4 | (Center와 별도) Arena 한국어 시뮬레이션 | §6 표 1번 |

**라운드 1 끝난 뒤**  
| Cursor 1 | §2 EN/KO 플로우 + 로딩 (§3 표 3번) → §7 50문항 정성 (§3 표 4번) |
| Cursor 3 | §4 회복 탄력성 그래프 (§5 표 2번) → §1+§8 톤·영어 일관 (§5 표 3번) |
| Cursor 2 | Center §5·§6·§3 검증 (§4 표 2번) |

**우선순위 2 — 플로팅·기타**  
| Cursor 1 | 챗봇 플로팅 전역 제거 (§3 표 5번) |
| Cursor 1 또는 3 | (선택) 대시보드 코드네임 툴팁 (§3 표 7번) |
| Cursor 2 | 배포 전 체크 재실행(필요 시) (§4 표 1번), 아바타·코드네임 검증(선택) (§4 표 3번) |

**우선순위 3 — 택일·선택**  
| Cursor 1 | 감정 스탯 v3 확장, Foundry 2차 확장, 챗봇·Safe Mirror 로케일 통일 — `docs/WHAT_NEXT.md` §2-2 표 참고 |
| Cursor 1·3·4 | 아바타 레이어(AVATAR_LAYER_SPEC §6·§7) — DB+API → 프론트 → 검증 순 |
| Cursor 3 | 리더보드 팀/역할/지점 뷰 (§5 표 5번) |

**오늘 시작 시**: 아래 §7 "오늘 시작 시 권장 배분" 표대로 각 Cursor에 프롬프트만 복사해 붙이면 됩니다.

---

## ⚠️ 완료 시 반드시 할 일 (모든 Cursor 공통)

**자기 담당 항목을 끝내면 이 문서를 아래 규칙대로 업데이트해 주세요.**

1. **이 문서** `docs/CURSORS_PARALLEL_TASK_LIST.md` 에서 해당 작업 행의 **상태**를 `[ ]` → `[x]` 로 바꾼다.
2. **완료 일시**와 **변경한 파일 요약(한 줄)** 을 해당 행 옆 또는 하단 "완료 로그" 표에 추가한다.
3. 해당 작업이 정의된 **원본 문서**(예: `CENTER_PAGE_IMPROVEMENT_SPEC.md`, `AVATAR_LAYER_SPEC.md`)에 완료 여부·완료 이력을 명시한다.  
   (예: `- §5 CTA 통합: 완료 (2026-03-03, Center page.client.tsx·링크 통합)`)

이렇게 하면 커맨더와 다른 Cursor가 진행 상황을 한눈에 파악할 수 있습니다.

---

## 1. 지금까지 마무리된 것 (요약)

| 구분 | 항목 | 상태 |
|------|------|------|
| BACKLOG | §1 리더보드 nearMe (위5+나+아래5) | [x] |
| BACKLOG | §2 Arena Level MVP 후 숨기기 | [x] |
| BACKLOG | §3 Partner S1~L4 시나리오 노출 | [x] |
| BACKLOG | §4 엘리트 5% 정책 | [x] |
| BACKLOG | §5 엘리트 특혜 선정 | [x] |
| BACKLOG | §6 언어 선택 시나리오·안내·대답 | [x] |
| BACKLOG | §7 Dojo 50문항·연습 플로우 2차 | [x] |
| BACKLOG | §8 빈 상태·로딩 | [x] |
| BACKLOG | §9 챗봇 훈련 | [x] |
| 기타 | Phase 4, Dear Me 1차 진입, 감정 스탯 A1–F1, 아바타·코드네임 1단계·마이그레이션 3개, 배포 전 체크 PASS | [x] |

**다음으로 진행할 큰 블록**: Center 페이지 개선, 챗봇 플로팅 제거, Arena 한국어, Arena 아바타(레이어 합성), 대시보드 코드네임 설명, 리더보드 팀 뷰.

---

## 2. 병렬 진행 순서 (의존성 정리)

아래 **라운드**는 “이 순서로 진행하면 충돌 없이 병렬 가능”하도록 정렬했습니다.

- **라운드 1**: 서로 다른 파일/영역 → **동시에 시작 가능**
- **라운드 2**: 라운드 1 완료 후 동시 진행 권장
- **라운드 3**: 라운드 2 완료 후 동시 진행 권장
- **검증/기타**: Cursor 2는 라운드와 무관하게 배포 전 체크·검증 등 병렬 수행 가능

---

## 3. Cursor 1 — 할 일 및 복사용 프롬프트

| 순서 | 라운드 | 상태 | 작업 | 복사용 프롬프트 |
|------|--------|------|------|------------------|
| 1 | 1 | [ ] | Center §5 CTA 통합 + 재로그인 버그 | `docs/CENTER_PAGE_IMPROVEMENT_SPEC.md` §5 반영해줘. Center 페이지 하단에서 "문 열고 나가기" / "어제보다 나은 연습하러 가기" 등 같은 목적지(Foundry) 링크를 하나의 CTA로 통합하고, 클릭 시 재로그인 페이지로 가지 않도록 해줘. 이미 인증된 사용자는 /bty 등 보호된 경로로 직행해야 함. 경로·미들웨어·링크 href 확인. |
| 2 | 1 | [ ] | Center §3 콘텐츠 순서 (5문항→안내→50문항) | `docs/CENTER_PAGE_IMPROVEMENT_SPEC.md` §3 반영해줘. Center 본문에서 자존감 알아보기(5문항)를 맨 위에, 그 다음 "더 자세한 테스트를 원하시면 클릭하세요" 문구 + 50문항으로 가는 링크, 50문항 블록 순서로 배치해줘. PageClient 또는 해당 Center 라우트 블록 순서 변경. |
| 3 | 2 | [ ] | Center §2 EN/KO 플로우 + 로딩 문구 | `docs/CENTER_PAGE_IMPROVEMENT_SPEC.md` §2 반영해줘. 영어 진입도 한국어처럼 "질문 먼저 → 답 → Center 메인" 흐름으로 통일하고, 전환 중 로딩/대기 문구는 locale에 맞게(i18n center.loading 또는 기존 메시지 locale 분기) 표시해줘. |
| 4 | 3 | [ ] | Center §7 50문항 정성 플로우 | `docs/CENTER_PAGE_IMPROVEMENT_SPEC.md` §7 반영해줘. 50문항을 한 페이지 풀 리스트 대신 한 문항(또는 소수)씩 스텝/페이지네이션으로 노출하는 플로우로 변경해줘. 질문 하나하나 정성 느낌이 나도록. |
| 5 | — | [ ] | 챗봇 플로팅 전역 제거 | `docs/COMMANDER_BACKLOG_AND_NEXT.md` §2 반영해줘. 전역 플로팅 챗봇(오른쪽 아래)을 일단 전부 제거해줘. Chatbot.tsx에서 pathname이 /center 이거나 모든 경로에서 플로팅을 안 보이게 하거나, 레이아웃에서 Chatbot 컴포넌트를 제거하는 방식 중 하나로 처리해줘. Center·Foundry에는 챗 기능이 있으니 플로팅 창만 없애면 됨. |
| 6 | — | [ ] | (선택) 아바타 DB+API — AVATAR_LAYER_SPEC | `docs/AVATAR_LAYER_SPEC.md` §6·§7 "Cursor 1 — DB + API" 블록 전체를 읽고 그대로 구현해줘. DB 마이그레이션, 트리거, GET/PATCH API에 avatar + allowed(outfits, accessorySlots) 반영. 완료 후 해당 문서 하단 완료 이력에 §와 변경 파일 요약 추가해줘. |
| 7 | — | [ ] | (선택) 대시보드 코드네임 툴팁 | 대시보드에서 내 코드네임이 보이는 영역에, 마우스 오버 시 코드네임 단계·수준 설명이 나오는 툴팁(또는 팝오버)을 추가해줘. `docs/COMMANDER_BACKLOG_AND_NEXT.md` §5. 문구는 BTY_ARENA_SYSTEM_SPEC·ARENA_CODENAME_AVATAR_PLAN의 Code/Tier/Sub Name 규칙 요약으로 작성해줘. |

---

## 4. Cursor 2 — 할 일 및 복사용 프롬프트

| 순서 | 라운드 | 상태 | 작업 | 복사용 프롬프트 |
|------|--------|------|------|------------------|
| 1 | — | [ ] | 배포 전 체크 (bty-release-gate) | `docs/NEXT_TASKS_2.md` §1-2: .cursor/rules/bty-release-gate 규칙에 맞게 배포 전 체크 실행해줘. Auth/Cookies, Weekly Reset, Leaderboard, Migration, API Contract, Verification Steps 확인하고 결과 요약해줘. *(최근 PASS 완료된 경우 재실행 불필요 시 생략 가능.)* |
| 2 | — | [ ] | Center 라운드 1 완료 후 검증 | Center §5·§6·§3 적용분 검증해줘. `docs/CENTER_PAGE_IMPROVEMENT_SPEC.md` §5·§6·§3 요구대로 CTA 통합·재로그인 없음·챗으로 이어하기 동작·5문항→안내→50문항 순서가 맞는지 확인하고, 결과를 PASS/FAIL + 이슈 목록으로 보고해줘. |
| 3 | — | [ ] | 아바타·코드네임 계획 검증 (선택) | `docs/ARENA_CODENAME_AVATAR_PLAN.md` 읽고, Cursor 4가 반영한 리더보드 아바타·코드네임 코드별 1회·캐릭터+옷 1단계가 스펙과 규칙을 만족하는지 검증해줘. 결과를 PASS/FAIL + 이슈 목록으로 보고해줘. |
| 4 | — | [ ] | Foundry·Center 2차 검증 (선택) | `docs/FOUNDRY_CENTER_2ND_VERIFICATION.md` 체크리스트(항목 1~10) 순서대로 확인해줘. FOUNDRY_CENTER_NEXT_CONTENT.md §4·§5·§6 스펙 기준. 결과를 PASS/FAIL + 불충족 항목으로 보고하고, 해당 문서 하단 검증 결과 템플릿에 검증 일시·결과·비고 적어줘. |

---

## 5. Cursor 3 — 할 일 및 복사용 프롬프트

| 순서 | 라운드 | 상태 | 작업 | 복사용 프롬프트 |
|------|--------|------|------|------------------|
| 1 | 1 | [ ] | Center §6 "챗으로 이어하기" 동작 | `docs/CENTER_PAGE_IMPROVEMENT_SPEC.md` §6 반영해줘. Center 페이지의 "챗으로 이어하기" 버튼이 클릭 시 Center 챗(또는 /center 챗 뷰)으로 이동하거나 챗 UI가 열리도록 수정해줘. 버튼의 href/onClick과 라우팅·상태 확인. |
| 2 | 2 | [ ] | Center §4 회복 탄력성 그래프 | `docs/CENTER_PAGE_IMPROVEMENT_SPEC.md` §4 반영해줘. ResilienceGraph를 "과거/지금" 2점이 아니라 매일의 5문항/활동에 맞는 일별(또는 기간별) 트렉으로 바꿔줘. 관련 API·데이터 소스와 시각화가 매일 질문 궤적을 반영하도록 수정. |
| 3 | 3 | [ ] | Center §1 + §8 톤·비주얼 + 영어 일관 | `docs/CENTER_PAGE_IMPROVEMENT_SPEC.md` §1·§8 반영해줘. Center 페이지를 "아늑하고 치유받는 방" 톤으로 비주얼·카피 정리하고, locale=en 일 때 로딩·버튼·안내·그래프 라벨 등 모든 문구가 영어로 나오도록 i18n·컴포넌트 점검·수정해줘. |
| 4 | — | [ ] | (선택) 아바타 프론트 — avatarAssets + AvatarComposite + UX | `docs/AVATAR_LAYER_SPEC.md` §6·§7 "Cursor 3 — avatarAssets + AvatarComposite + 프로필/아바타 UX" 블록 전체를 읽고 그대로 구현해줘. avatarAssets.ts, AvatarComposite, useAvatar, OutfitCard, 아바타 설정 페이지, 리더보드/대시보드 thumb+lazy. 완료 후 해당 문서 하단 완료 이력에 §와 변경 파일 요약 추가해줘. |
| 5 | — | [ ] | (선택) 리더보드 팀/역할/지점 뷰 | `docs/BTY_ARENA_SYSTEM_SPEC.md` §4 참고해서, 리더보드에 팀(역할/지점)별 뷰를 단계적으로 추가해줘. 팀별로 특정 수치만 노출하도록 API·UI 설계. 현재는 전역 weekly_xp 기준 nearMe만 있으니, scope=role\|office 파라미터와 해당 스코프별 노출 수치 정의부터. |

---

## 6. Cursor 4 — 할 일 및 복사용 프롬프트

| 순서 | 라운드 | 상태 | 작업 | 복사용 프롬프트 |
|------|--------|------|------|------------------|
| 1 | 1 | [ ] | Arena 한국어 시뮬레이션 | Arena에서 한국어(locale=ko) 선택 시 시뮬레이션·안내·대답이 영어로 나오는 문제를 확인해줘. `docs/COMMANDER_BACKLOG_AND_NEXT.md` §4.1. 시나리오 데이터·i18n·Arena 페이지·API에서 locale 분기가 올바른지 점검하고, 한국어 새 포맷이 반영되지 않았으면 locale=ko 일 때 일관되게 한국어로 나오도록 수정해줘. |
| 2 | — | [ ] | (선택) 아바타 검증·테스트 — AVATAR_LAYER_SPEC | `docs/AVATAR_LAYER_SPEC.md` §6·§7 "Cursor 4 — 검증·테스트" 블록 전체를 읽고 구현해줘. 허용 outfit/accessory 슬롯 검증 단위 테스트, AvatarUiResponse 등 타입/DTO 정리, (선택) E2E. 완료 후 해당 문서 하단 완료 이력에 §와 변경 파일 요약 추가해줘. |

---

## 7. 오늘 시작 시 권장 배분 (한 번에 복사해서 각 Cursor에 붙이기)

**동시에 시작할 수 있는 조합** — 아래 4개를 각 Cursor 1·2·3·4에 하나씩 붙여 넣으면 됩니다.

| Cursor | 맡을 작업 | 복사할 내용 |
|--------|-----------|-------------|
| **Cursor 1** | Center §5 + §3 | 위 §3 "Cursor 1" 표의 1번·2번 행 프롬프트를 **순서대로** 붙여 넣기. (먼저 §5, 끝나면 §3.) |
| **Cursor 2** | 배포 전 체크 또는 대기 | 위 §4 "Cursor 2" 표의 1번 프롬프트. 이미 최근 PASS였으면 "Center 라운드 1 완료 후 검증" 대기. |
| **Cursor 3** | Center §6 | 위 §5 "Cursor 3" 표의 1번 행 프롬프트. |
| **Cursor 4** | Arena 한국어 | 위 §6 "Cursor 4" 표의 1번 행 프롬프트. |

**라운드 1 완료 후**  
- Cursor 1: §2(EN/KO 플로우) → §7(50문항 정성)  
- Cursor 3: §4(회복 탄력성 그래프) → §1+§8(톤·영어 일관)  
- Cursor 2: Center 라운드 1 검증 실행  
- Cursor 4: 아바타 검증(선택) 또는 다음 지시 대기  

---

## 8. 완료 로그 (작업 끝날 때마다 여기에 추가)

| 일시 | Cursor | 작업 | 변경 파일 요약 |
|------|--------|------|----------------|
| — | — | — | — |

*(각 Cursor는 자기 담당 항목 완료 시 위 표에 한 줄 추가하고, 본문 해당 행 상태를 [x]로 바꿔 주세요.)*

---

## 9. 전체 완료 후 검증 — Cursor 3 명령 + 웹 확인 리스트

**용도**: CURSORS_PARALLEL_TASK_LIST의 모든 작업이 완료됐다고 할 때, **제대로 구현됐는지** 코드 검증(Cursor 3)과 **웹에서 직접 확인**을 하기 위한 절차.

---

### 9-1. Cursor 3에게 내릴 명령어 (복사해서 붙여 넣기)

```
docs/CURSORS_PARALLEL_TASK_LIST.md와 docs/CENTER_PAGE_IMPROVEMENT_SPEC.md를 기준으로, "전체 완료"된 작업이 스펙대로 구현됐는지 검증해줘.

1) Center 페이지 (CENTER_PAGE_IMPROVEMENT_SPEC §5·§6·§3·§2·§4·§7·§1·§8)
- §5: 하단 CTA가 하나로 통합돼 있는지, 링크가 /bty/login 등 재로그인으로 가지 않도록 되어 있는지 코드에서 확인해줘.
- §6: "챗으로 이어하기" 버튼의 href/onClick이 Center 챗 또는 챗 UI를 열도록 연결돼 있는지 확인해줘.
- §3: Center 본문 블록 순서가 5문항 → "더 자세한 테스트를 원하시면 클릭하세요" + 50문항 링크 순인지 확인해줘.
- §2: 영어 진입 시에도 "질문 먼저 → 답 → Center 메인" 플로우인지, 로딩/대기 문구가 locale 분기인지 확인해줘.
- §4: ResilienceGraph가 일별/기간별 트렉으로 되어 있는지(과거/지금 2점만이 아닌지) 확인해줘.
- §7: 50문항이 한 페이지 풀 리스트가 아니라 스텝/페이지네이션으로 노출되는지 확인해줘.
- §1·§8: Center 톤·비주얼이 "아늑한 방" 방향인지, locale=en 일 때 문구가 영어로 나오는지 확인해줘.

2) 챗봇 플로팅
- 전역 플로팅 챗봇이 제거됐는지(Chatbot.tsx 또는 레이아웃에서 /center·/bty 등에서 미노출 또는 컴포넌트 제거) 확인해줘.

3) Arena 한국어 (Cursor 4 담당 범위)
- locale=ko 일 때 시나리오·안내·대답이 한국어로 나오도록 분기/데이터가 있는지 확인해줘.

4) 규칙 준수
- .cursor/rules/bty-arena-global.mdc, bty-ui-render-only.mdc: UI에서 XP/랭킹/시즌 계산 없이 API 값만 렌더하는지, 도메인/API/UI 분리 유지되는지 해당 변경 구간만 점검해줘.

결과를 PASS/FAIL + 이슈 목록(항목별로 충족/불충족 + 파일·위치)으로 보고해줘. 이 문서 CURSORS_PARALLEL_TASK_LIST.md §9 완료 로그 또는 별도 검증 결과 문단에 요약을 추가해줘.
```

---

### 9-2. 웹페이지에서 필요한 확인 작업 리스트

**전제**: 로컬에서 `npm run dev` 실행 후 브라우저에서 확인. 가능하면 **로그인된 상태**와 **비로그인(또는 로그인 직후)** 각각에서 필요한 항목만 확인.

| # | 구역 | 확인 항목 | 통과 기준 |
|---|------|-----------|-----------|
| 1 | **Center** | 하단 CTA("문 열고 나가기" 등) 클릭 시 재로그인 페이지로 안 가고 `/bty` 등 보호된 경로로 이동하는가? | 로그인 유지, 리다이렉트 올바름 |
| 2 | **Center** | "챗으로 이어하기" 버튼 클릭 시 챗 UI가 열리거나 Center 챗 경로로 이동하는가? | 클릭 시 동작함 |
| 3 | **Center** | Center 본문에서 **5문항(자존감 알아보기)** 이 맨 위에 있고, 그 다음 "더 자세한 테스트를 원하시면 클릭하세요" + 50문항 링크 순서인가? | 5문항 → 안내 → 50문항 순 |
| 4 | **Center** | `/en/center` 진입 시 전환 중 로딩/대기 문구가 **영어**로 나오는가? | 한국어 문구 안 보임 |
| 5 | **Center** | `/en/center`에서 버튼·안내·그래프 라벨이 **영어**로 나오는가? | locale=en 일관 |
| 6 | **Center** | 회복 탄력성 그래프가 "과거/지금" 2점만이 아니라 **일별/기간별 궤적**으로 보이는가? (데이터 있으면) | 시계열/트렉 표시 |
| 7 | **Center** | 50문항 진입 시 **한 문항씩(또는 소수씩)** 스텝으로 나오는가? 한 페이지에 전부 나열되지 않는가? | 스텝/페이지네이션 |
| 8 | **전역** | Center·Foundry·대시보드 등에서 **오른쪽 아래 플로팅 챗봇**이 보이지 않는가? | 플로팅 미노출 |
| 9 | **Arena** | `/ko/bty-arena` 또는 한국어 선택 시 시뮬레이션·안내·시스템 대답이 **한국어**로 나오는가? | locale=ko 일관 |
| 10 | **대시보드** | 로그인 후 `/bty/dashboard` 진입·새로고침 시 세션이 유지되는가? | 401/재로그인 없음 |
| 11 | **리더보드** | 리더보드 페이지가 로드되고, 내 순위·주변 순위가 표시되는가? | 정상 로드 |
| 12 | **Foundry** | `/bty`, `/bty/mentor` 등 기존 경로가 정상 동작하는가? | 회귀 없음 |

**실행 요약**: 위 표를 순서대로 확인한 뒤, 통과/실패만 표에 체크하거나 `§9 검증 결과`에 "웹 확인: 1~12번 중 N번 FAIL (내용)" 형태로 적어 두면 됨.

---

**문서 위치**: `docs/CURSORS_PARALLEL_TASK_LIST.md` §9  
**갱신**: 전체 완료 후 검증 실행 시 §9-1 결과 + §9-2 웹 확인 결과를 이 섹션 또는 완료 로그에 반영.

---

**문서 위치**: `docs/CURSORS_PARALLEL_TASK_LIST.md`  
**갱신**: 작업 완료 시 이 문서 + 해당 스펙/백로그 문서에 완료 반영.  
**참고**: 상세 스펙은 `docs/CENTER_PAGE_IMPROVEMENT_SPEC.md`, `docs/COMMANDER_BACKLOG_AND_NEXT.md`, `docs/AVATAR_LAYER_SPEC.md`, `docs/CURRENT_TASK.md` 등에서 확인.  
**디자인·아바타 컨텍스트**: `docs/DESIGN_FIRST_IMPRESSION_BRIEF.md`, `docs/ARENA_UI_REDESIGN_BRIEF.md`, `docs/AVATAR_LAYER_SPEC.md` — 작업 전·중 읽기 권장.

**어제 작업 서류 확인**: 이 문서 위쪽 **§ "어제 한 작업 — 서류 요약"** 표에서 어떤 서류에 뭐가 기록됐는지 확인. **오늘 할 일**은 **§ "오늘 할 수 있는 것 — 한눈에"** + §3~§7 표 참고.

# 커맨더 백로그 및 다음 진행 목록

**역할**: Cursor 2 = 커맨더. Cursor 1, 3, 4 활용 가능.  
**용도**: 요구사항 분류·문서화, 프로젝트 첨부, "다음에 뭘 할지?" 질문 시 큰 그림과 다음 리스트 제시.

**사용법**: §8 테이블의 **상세** 링크를 클릭하면 해당 프로젝트 상세 문서로 이동. 상세 문서에는 **Cursor별 복사용 프롬프트**가 있으므로, 그대로 복사해 해당 Cursor에 붙여 넣어 병렬로 진행하면 됨.

---

## ⚠️ 모든 Cursor 공통 지시: 완료 작업 문서화

**Cursor 1, 3, 4**는 작업을 완료할 때마다 **해당 스펙/백로그 문서에 완료 여부를 반드시 명시**할 것.

- **어디에**: 작업한 내용이 정의된 문서(예: CENTER_PAGE_IMPROVEMENT_SPEC.md, AVATAR_LAYER_SPEC.md, ARENA_CODENAME_AVATAR_PLAN.md 등)의 해당 섹션 또는 문서 하단 "완료 이력" 섹션.
- **무엇을**: 완료한 § 번호/항목, 완료 일자(또는 커밋 기준), 변경한 파일/요약 한 줄.
- **예시**: `- §3 콘텐츠 순서: 완료 (2025-02-28, PageClient.tsx 순서 변경)`  
이렇게 하면 커맨더와 사용자가 진행 상황을 한눈에 파악할 수 있음.

**나머지 Cursor 지시용 문장**: `docs/DESIGN_TOKEN_AND_STORYBOOK_HANDOFF.md` §4·§5에 정리해 두었음. 디자인 토큰·스토리북 관련 지시는 해당 문서에서 복사.

---

## 0. 어떤 거부터 시작할까?

**권장 순서(§8과 동일)**  
1. **Center 페이지** → [CENTER_PAGE_IMPROVEMENT_SPEC.md](./CENTER_PAGE_IMPROVEMENT_SPEC.md) §10 라운드 1부터. Cursor 1·3·4 동시에 §5·§6·§3 담당.  
2. 그다음 **챗봇 플로팅 제거** (§9).  
3. 이후 Arena 한국어 → Arena 아바타 → 대시보드 코드네임 → 리더보드 팀 뷰 → 기존 백로그 순.

지금까지 계획한 문서·프로젝트가 많으므로, **한 번에 하나(또는 Center처럼 라운드 단위)** 씩 끝내고 다음으로 넘기는 방식이 효율적임.

---

## 1. 리더보드 정책 확인 (명령 이해 반복)

### 1.1 팀별 리더보드

**결정된 명령**
- 리더보드에서는 **팀별(또는 역할/지점별)** 로 **특정 수치만** 보이도록 한다.
- `docs/BTY_ARENA_SYSTEM_SPEC.md` §4: 3가지 뷰 — **Overall**, **Role** (Doctor/Manager/Staff/DSO), **Office** (지점별). 기본은 지점/역할 중심, 전체는 탭으로 확장.
- 팀/역할/지점 스코프에서는 **해당 스코프에 맞는 수치만 노출** (예: 팀 TII, 팀 단위 집계 등). 개인 AIR 등 민감 지표는 팀 단위로만 공개하고 개인별로는 비공개.

**현재 구현**
- `src/app/api/arena/leaderboard/route.ts`: MVP 기준 **전체 풀(league_id IS NULL)** 에서 `weekly_xp` 순 랭킹, `nearMe`(내 위5+나+아래5) 반환.
- 팀/역할/지점별 뷰 및 "특정 수치만" 제한은 스펙에 있으나 API/UI는 전역 리더보드만 구현된 상태.

**체크**
- 팀별로 특정 수치만 보이게 하라는 명령은 **스펙(BTY_ARENA_SYSTEM_SPEC §4, ENGINE_ARCHITECTURE_DIRECTIVE_PLAN 팀 TII)** 에 반영됨. 구현은 단계적으로 팀/역할/오피스 스코프와 노출 수치 제한을 추가하는 방향.

### 1.2 개인별 리더보드

**결정된 방식**
- **개인별** 리더보드는 "내 주변" **Near Me** 뷰: **내 위 5명 + 나 + 내 아래 5명** (총 11명). BACKLOG §1 구현 완료.
- `nearMe` = `slice(myRank - 6, myRank + 6)` 로 위5+나+아래5.
- 개인 Tier 숫자는 리더보드에 노출하지 않음 (Code · Sub Name · XP 등만).

---

## 2. 챗봇 (플로팅 창)

**요구**
- **전역 플로팅 챗봇(오른쪽 아래)** 은 **일단 전부 제거**.
- Center·Foundry에는 이미 **챗 기능**이 있으므로, 별도 플로팅 창 없이 해당 영역 내 챗으로 충분.

**현재**
- `Chatbot.tsx`: `pathname.includes("/bty")` 일 때 플로팅 미렌더 (Foundry·Arena 구간에서 이미 숨김).
- **추가 조치**: Center(`/center`) 포함 **전역에서 플로팅 챗봇 비노출**으로 확장할지 결정 후, 조건을 `pathname.includes("/bty") || pathname.includes("/center")` 등으로 확장하거나, 아예 컴포넌트를 레이아웃에서 제거.

**기록**
- "챗봇은 또다시 연결이 끊겼어" — 연결 끊김 이슈는 별도로 재현·점검 필요. 문서에만 기록.

---

## 3. Center 페이지

**상세 명세**
- **`docs/CENTER_PAGE_IMPROVEMENT_SPEC.md`** 에 정리됨.
- 요약: 아늑한 방 톤, EN/KO 플로우 통일, 5문항→안내→50문항 순서, 회복 탄력성 그래프 매일 트렉, CTA 통합·재로그인 버그, "챗으로 이어하기" 동작, 50문항 정성 플로우, 영어 일관.

**우선 진행**
- Center 페이지부터 제대로 만든다. CENTER_PAGE_IMPROVEMENT_SPEC §9 우선순위대로 진행.

---

## 4. Arena

### 4.1 한국어 시뮬레이션

**현상**
- Arena에서 **한국어를 선택해도 시뮬레이션이 영어로** 나옴.
- 한국어 콘텐츠는 만들어 두었으나, **새 포맷/경로가 반영되지 않았을 가능성**.

**조치**
- 코드베이스에서 Arena 시나리오·안내·대답의 **locale/언어 분기** 확인.
- **한국어 새 포맷이 아직 반영되지 않았으면** → **Cursor 4**에 프로젝트 위임: "Arena 한국어 시나리오·안내·대답이 locale=ko 일 때 일관되게 나오도록 확인하고, 새 포맷이 없으면 적용해 달라."

### 4.2 캐릭터 얼굴·몸 분리 + 옷 입히기

**요구**
- 캐릭터 **얼굴과 몸**을 **따로** 만들고, **옷을 선택했을 때**(옷 이미지가 보여야 함) **그 옷을 입은 캐릭터**가 되도록.
- 가능하다고 했으므로 **프로젝트에 포함**.

**구현 명세 (개발자 모드용)**
- **`docs/AVATAR_LAYER_SPEC.md`** — DB·API·리더보드 응답·프론트 `AvatarComposite`까지 한 번에 정리. 브레인스토밍 축 5개(키 기반, 저장 필드 2개, 잠금 트리거, 레이어 순서, thumb+lazy) 고정.
- **Cursor 할일**: 동일 문서 §6·§7 — Cursor 1(DB+API), Cursor 3(avatarAssets+AvatarComposite+UI), Cursor 4(검증·테스트). 복사용 프롬프트 있음.

**참고**
- **`docs/ARENA_CODENAME_AVATAR_PLAN.md`** §3: 배경/비전. 표시 방식 B(프론트 레이어 합성) 채택 후, 상세는 AVATAR_LAYER_SPEC에서 진행.

---

## 5. 대시보드 — 코드네임 단계/수준 설명

**요구**
- 대시보드에 **내 코드네임**이 있음. **코드네임 단계와 수준**을 설명하는 요소가 **어딘가**에 있으면 좋음.
- **아이디어**: 마우스를 올리면 **팝업(툴팁/팝오버)** 로 단계·수준 설명 노출.

**조치**
- 대시보드 코드네임 표시 영역에 **설명 툴팁/팝오버** 추가 검토. 문구는 BTY_ARENA_SYSTEM_SPEC·ARENA_CODENAME_AVATAR_PLAN의 Code/Tier/Sub Name 규칙 요약으로 작성.

---

## 6. 기존 미완료 프로젝트에 첨부

| 기존 문서/백로그 | 첨부할 항목 |
|------------------|-------------|
| **CENTER_PAGE_IMPROVEMENT_SPEC** | 새로 작성됨. Center 우선 진행 시 이 문서가 메인. |
| **ARENA_CODENAME_AVATAR_PLAN** | §3 단계에 "얼굴·몸 분리 + 옷 선택 시 옷 이미지 보이고 캐릭터가 그 옷 입은 모습" 명시. Cursor 4 또는 지정 에이전트. |
| **CURRENT_TASK.md / NEXT_TASKS_2** | Center 개선(CENTER_PAGE_IMPROVEMENT_SPEC), Arena 한국어(Cursor 4), 아바타 옷 입히기(ARENA_CODENAME_AVATAR_PLAN), 챗봇 전역 제거, 대시보드 코드네임 설명 팝오버를 [ ] 항목으로 추가 가능. |
| **PROJECT_BACKLOG** | §7 이후 Center·Arena·챗봇 관련 항목을 새 섹션으로 추가하거나 기존 §에 링크. |

---

## 7. Cursor 역할 정리

| Cursor | 역할 | 비고 |
|--------|------|------|
| **Cursor 1** | 구현 에이전트 | CURRENT_TASK·NEXT_TASKS_2·명시된 스펙 구현 |
| **Cursor 2** | 커맨더 | 문서화, 분류, "다음 뭘 할지" 리스트, 위임 지시 |
| **Cursor 3** | 구현 에이전트 | 동일 |
| **Cursor 4** | 구현 에이전트 | **Arena 한국어 포맷 점검·적용**, **아바타 얼굴·몸 분리 + 옷 입히기**(ARENA_CODENAME_AVATAR_PLAN) 위임 권장 |

---

## 8. "다음에 뭘 진행해야 하지?" — 큰 그림 리스트

아래는 **큰 그림** 기준 진행 순서 제안. 각 항목 옆 **상세** 링크를 클릭하면 해당 프로젝트의 자세한 명세·Cursor별 프롬프트로 이동.

| 순서 | 프로젝트 | 상세 (클릭 시 해당 문서로 이동) |
|------|----------|----------------------------------|
| 1 | **Center 페이지** | [CENTER_PAGE_IMPROVEMENT_SPEC.md](./CENTER_PAGE_IMPROVEMENT_SPEC.md) — §9 우선순위, §10 Cursor별 복사용 프롬프트(라운드 1~3 병렬) |
| 2 | **챗봇 플로팅 제거** | 본문 §2 + 아래 §9 "챗봇 플로팅 — Cursor 할일" |
| 3 | **Arena 한국어** | [COMMANDER_BACKLOG_AND_NEXT.md §4.1](#4-arena) + 아래 §9 "Arena 한국어 — Cursor 4 프롬프트" |
| 4 | **Arena 아바타** | [AVATAR_LAYER_SPEC.md](./AVATAR_LAYER_SPEC.md) — DB/API/리더보드/프론트 레이어 합성 전부. §6·§7 Cursor 1·3·4 복사용 프롬프트. (배경: [ARENA_CODENAME_AVATAR_PLAN.md](./ARENA_CODENAME_AVATAR_PLAN.md) §3) |
| 5 | **대시보드 코드네임 설명** | 본문 §5 + 아래 §9 "대시보드 코드네임 — Cursor 할일" |
| 6 | **리더보드 팀/역할/지점 뷰** | [BTY_ARENA_SYSTEM_SPEC.md](./BTY_ARENA_SYSTEM_SPEC.md) §4 — 팀별 특정 수치만 노출, 단계적 구현 |
| 7 | **기존 백로그** | [CURRENT_TASK.md](./CURRENT_TASK.md), [PROJECT_BACKLOG.md](./PROJECT_BACKLOG.md), [NEXT_TASKS_2.md](./NEXT_TASKS_2.md) |

---

## 9. 프로젝트별 Cursor 할일 — 프롬프트 복사용

(상세가 별도 문서인 프로젝트는 해당 문서 §10 등에서 프롬프트 복사. 여기서는 상세 문서가 이 파일이거나 짧은 항목만.)

### 챗봇 플로팅 제거

| Cursor | 복사용 프롬프트 |
|--------|------------------|
| **Cursor 1** | `docs/COMMANDER_BACKLOG_AND_NEXT.md` §2 반영해줘. 전역 플로팅 챗봇(오른쪽 아래)을 일단 전부 제거해줘. Chatbot.tsx에서 pathname이 /center 이거나 모든 경로에서 플로팅을 안 보이게 하거나, 레이아웃에서 Chatbot 컴포넌트를 제거하는 방식 중 하나로 처리해줘. Center·Foundry에는 챗 기능이 있으니 플로팅 창만 없애면 됨. |

### Arena 한국어 — Cursor 4

| Cursor | 복사용 프롬프트 |
|--------|------------------|
| **Cursor 4** | Arena에서 한국어(locale=ko) 선택 시 시뮬레이션·안내·대답이 영어로 나오는 문제를 확인해줘. `docs/COMMANDER_BACKLOG_AND_NEXT.md` §4.1. 시나리오 데이터·i18n·Arena 페이지·API에서 locale 분기가 올바른지 점검하고, 한국어 새 포맷이 반영되지 않았으면 locale=ko 일 때 일관되게 한국어로 나오도록 수정해줘. |

### Arena 아바타 (캐릭터 고정 + 옷 선택, 레이어 합성)

→ **상세 및 Cursor 1·3·4 프롬프트**: [AVATAR_LAYER_SPEC.md](./AVATAR_LAYER_SPEC.md) §6·§7. (Cursor 1: DB+API, Cursor 3: avatarAssets+AvatarComposite+UI, Cursor 4: 검증·테스트.)

### 대시보드 코드네임 설명

| Cursor | 복사용 프롬프트 |
|--------|------------------|
| **Cursor 1** 또는 **3** | 대시보드에서 내 코드네임이 보이는 영역에, 마우스 오버 시 코드네임 단계·수준 설명이 나오는 툴팁(또는 팝오버)을 추가해줘. `docs/COMMANDER_BACKLOG_AND_NEXT.md` §5. 문구는 BTY_ARENA_SYSTEM_SPEC·ARENA_CODENAME_AVATAR_PLAN의 Code/Tier/Sub Name 규칙 요약으로 작성해줘. |

### 리더보드 팀/역할/지점 뷰

| Cursor | 복사용 프롬프트 |
|--------|------------------|
| **Cursor 1** 또는 **3** | `docs/BTY_ARENA_SYSTEM_SPEC.md` §4 참고해서, 리더보드에 팀(역할/지점)별 뷰를 단계적으로 추가해줘. 팀별로 특정 수치만 노출하도록 API·UI 설계. 현재는 전역 weekly_xp 기준 nearMe만 있으니, scope=role|office 파라미터와 해당 스코프별 노출 수치 정의부터. |

---

**문서 위치**: `docs/COMMANDER_BACKLOG_AND_NEXT.md`  
**갱신**: 요구사항·결정 사항 반영 시 이 문서와 CENTER_PAGE_IMPROVEMENT_SPEC, ARENA_CODENAME_AVATAR_PLAN, CURRENT_TASK를 함께 업데이트.

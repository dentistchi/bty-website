# 멀티 Cursor 워크플로우 가이드

여러 Cursor 창을 동시에 돌려 프로젝트 속도를 올리면서, 서로 엉키지 않고 Cursor 기능을 최대한 쓰기 위한 구조와 방법.

---

## 1. 권장 구조: 작업 단위로 분리

### 1-1. **디렉터리/도메인 기준 분리 (가장 추천)**

| Cursor A | Cursor B | Cursor C |
|----------|----------|----------|
| `bty-app/src/app/api/arena/*` | `bty-app/src/app/[locale]/bty/*` (UI) | `bty-app/src/lib/bty/*` (엔진/공통) |
| API·run/complete·leaderboard·league | Dashboard·Leaderboard·Arena 페이지 | engine, scenario, mentor, arena 유틸 |
| DB 마이그레이션·Supabase | 컴포넌트·클라이언트 상태 | 타입·헬퍼·비즈니스 로직 |

- **장점**: 수정하는 파일가 겹치지 않아 merge conflict가 적음.
- **규칙**: 한 Cursor는 “이번 세션에서는 이 영역만 건드린다”고 정하고, 다른 영역 수정이 필요하면 해당 영역 담당 Cursor에 요청하거나 브랜치를 나눠서 진행.

### 1-2. **태스크 타입 기준 분리**

| Cursor | 역할 | 예시 |
|--------|------|------|
| **Feature** | 새 기능 구현 | L4 연동, 새 API, 새 페이지 |
| **Fix/Polish** | 버그 수정·리팩터·문서 | 버그 픽스, 린트, README |
| **Explore/Plan** | 조사·설계·정리 | 스펙 검토, 파일 구조 파악, 다음 작업 목록 |

- Feature 쪽은 보통 `feature/xxx` 브랜치, Fix/Polish는 `main` 또는 `fix/xxx` 등으로 나누면 충돌을 줄이기 좋음.

### 1-3. **브랜치 + Cursor 1:1 매핑**

- **Cursor 1**: `main` 또는 `develop` — 배포·핫픽스·작은 수정만.
- **Cursor 2**: `feature/leaderboard-season` — 시즌/리그 연동만.
- **Cursor 3**: `feature/l4-partner` — L4/파트너 기능만.

- 각 Cursor는 **한 브랜치만** 열어두고, 그 브랜치에서만 작업. 머지는 나중에 한 곳에서 순서대로 진행.

---

## 2. 서로 엉키지 않게 하기

### 2-1. **같은 파일을 동시에 수정하지 않기**

- 위 1-1처럼 “이 Cursor는 이 경로만” 구역을 정해두고, 다른 Cursor는 그 경로를 건드리지 않는다.
- 꼭 건드려야 하면: 한 Cursor에서 먼저 커밋한 뒤, 다른 Cursor에서 `git pull` 후 이어서 수정.

### 2-2. **한 번에 하나만 배포 브랜치에 머지**

- 여러 Cursor에서 동시에 `main`에 push하지 않는다.
- 순서: Cursor A 작업 → push/merge → Cursor B `pull` 후 작업 → push/merge.
- 또는 Cursor A는 `main`, Cursor B/C는 `feature/*`만 push하고, 머지는 사람이 한 번에 하나씩 진행.

### 2-3. **공통 파일은 “담당 Cursor” 정하기**

- `package.json`, `next.config.js`, `middleware.ts`, 공통 타입 등은 “이번에 누가 바꿀지” 정해두고, 한 Cursor만 수정. 다른 Cursor는 “이 파일 수정해줘”라고 요청만 하고, 직접 고치지 않는다.

### 2-4. **커밋 단위를 작게**

- 작업이 끝날 때마다 `git add` → `commit` → (필요 시) push. 그러면 다른 Cursor에서 `pull` 했을 때 conflict 범위가 줄어든다.

---

## 3. Cursor 기능 최적화

### 3-1. **규칙(Rules)으로 역할 명시**

- `.cursor/rules/`에 **영역별 규칙**을 두면, 각 Cursor가 자기 구역에 맞게 행동하기 쉽다.
- 예:
  - `arena-api.mdc`: “이 세션은 `/api/arena/*`만 수정한다. DB 변경 시 마이그레이션 파일만 추가한다.”
  - `arena-ui.mdc`: “이 세션은 `[locale]/bty/*` 페이지·컴포넌트만 수정한다. API 경로는 기존 것을 사용한다.”

### 3-2. **프롬프트에 컨텍스트 넣기**

- 각 Cursor에 작업 시작할 때 한 줄씩 명시해 주면 효율이 올라감.
  - 예: “지금 이 채팅에서는 **Arena API와 weekly_xp/leaderboard**만 수정해. UI나 다른 라우트는 건드리지 마.”
  - 예: “이 채팅은 **Dashboard·Leaderboard 페이지 UI**만. API 시그니처는 바꾸지 마.”

### 3-3. **@파일 / @폴더로 범위 고정**

- 특정 파일/폴더만 수정하게 할 때: `@src/app/api/arena/` 또는 `@src/lib/bty/arena/activeLeague.ts` 같이 지정해서 “이 범위 안에서만 제안해줘”라고 하면, 다른 Cursor 구역과 겹치기 어렵다.

### 3-4. **Agent + Chat 분리 활용**

- **Agent**: 자동으로 여러 파일 수정·터미널 실행이 필요한 작업 (예: “이 API 추가하고 라우트 연결까지 해줘”).
- **Chat**: “이 함수가 어디서 쓰여?” 같은 조회·설계 논의.
- Cursor를 여러 개 쓸 때는 “Agent 쓰는 Cursor”와 “Chat만 쓰는 Cursor”를 나누어 두면, Agent가 같은 파일을 동시에 고치는 상황을 줄일 수 있다.

---

## 4. 실행 방법 요약

1. **Cursor 창 2~3개** 연다 (같은 프로젝트 폴더).
2. **각 창에 역할을 정한다**  
   - 창1: Arena API + DB  
   - 창2: bty UI (dashboard/leaderboard/arena 페이지)  
   - 창3: lib/엔진·스펙 조사·문서.
3. **첫 메시지에 범위를 적는다**  
   - “이 채팅에서는 Arena API와 `weekly_xp`/리더보드만 수정해줘.”
4. **브랜치를 나눌 경우**  
   - 창1: `main` 또는 `develop`  
   - 창2: `feature/xxx`  
   - 창3: `feature/yyy`  
   → 머지는 한 브랜치씩 순서대로.
5. **한 Cursor에서 커밋·push한 뒤**  
   - 다른 Cursor에서는 `git pull` (또는 fetch + merge) 후 계속 작업.
6. **공통 설정/공통 파일**은 한 Cursor만 담당하도록 하고, 나머지는 그 Cursor에 “이거 바꿔줘”라고만 요청.

이렇게 하면 Cursor 여러 개를 돌려도 효율을 높이면서, 서로 엉키지 않고 Cursor의 기능(규칙, @참조, Agent/Chat)을 잘 쓸 수 있다.

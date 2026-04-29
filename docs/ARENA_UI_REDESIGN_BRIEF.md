# Arena UI 리디자인 브리프 — 트레이닝장·포근한 대화 느낌

**목표**: 현재 기본적인 화면을 **Arena스럽게**, **트레이닝장 같게**, **포근한 대화의 창** 같은 느낌으로 바꾼다.

**사용법**: 아래 「복사용 프롬프트」를 그대로 복사해 진행 에이전트나 디자인 담당에게 붙여 넣어 지시하면 됩니다.

---

## 1. 조사·추천 요약

- **감성 키워드**: **Arena스럽게**(연보라·크림, 경기장 느낌) / **트레이닝장**(레벨·스텝·진행 강조) / **포근한 대화 창**(둥근 카드, 부드러운 그림자, 친근한 문구).
- **색·배경**: Arena 전용 CSS 변수(`--arena-bg`, `--arena-card`, `--arena-accent` 등), `data-theme="arena"` 옵션으로 배경·본문 분리.
- **타이포·여백**: 제목 강조(`font-weight` 700~800), 줄간격·패딩 넉넉히(`line-height` 1.6 이상, 카드 `padding` 20~24px).
- **카드**: ProgressCard에 웜 화이트(`#FAFAF8` 또는 `var(--arena-card)`), 16px 라운드, 은은한 그림자, 왼쪽 세로 강조 바(보라/세이지).
- **문구**: 대시보드·Arena·리더보드용 KO/EN 예시 — “오늘도 한 걸음, Arena에서.” / “One step today, in the Arena.” 등 (§3-5 표 참고).
- **프롬프트 A**: 전체 감성 + Arena 테마 한 번에 적용 시 사용(테마 변수, 레이아웃, 카드, 문구). §4 복사용 프롬프트 참고.

**감성 키워드 (적용 포인트·추천)**

| 키워드 | 적용 포인트 | 추천 |
|--------|-------------|------|
| **Arena스럽게** | 배경 그라데이션, 카드 테두리/그림자, “경기장/연습장” 느낌 아이콘·일러 여백 | 연한 보라·딥퍼플 계열 + 크림/오프화이트 배경 (기존 dojo-purple 활용) |
| **트레이닝장 같게** | “레벨·스텝·진행” 시각화(바·스텝), 뱃지·칭호, 짧은 격려 문구 | ProgressCard를 “연습 단계” 카드처럼 보이게, 레벨 스텝 강조 |
| **포근한 대화 창** | 둥근 모서리, 부드러운 그림자, 말풍선/카드형 블록, 짧은 안내 문구 | `border-radius` 12~16px, `box-shadow` 부드럽게, 문구 톤 친근·격려 |

**3-2. 색·배경**

| 옵션 | 설명 | 추천도 |
|------|------|--------|
| **A** | Arena 전용 CSS 변수 추가 (예: `--arena-bg`, `--arena-card`, `--arena-accent`). 배경은 크림/연한 보라 그라데이션. | ⭐⭐⭐ |
| **B** | 기존 `dojo-purple`·`dojo-ink` 활용, 카드만 `#FDF8F3` 같은 웜 화이트로 통일. | ⭐⭐ |
| **C** | `data-theme="arena"` 추가해 `body` 배경·본문색만 Arena 전용으로 분리. | ⭐⭐⭐ |

**3-3. 타이포·여백**

| 항목 | 추천 |
|------|------|
| **제목** | `font-weight: 700`~`800`, 자간 약간 넓게 (tracking). Arena/대시보드 제목만 1단계 크게. |
| **본문** | `line-height: 1.6` 이상, 포근한 느낌을 위해 줄간격 넉넉히. |
| **카드** | `padding: 20px 24px`, `gap: 16px`~`24px`. 카드와 카드 사이 여백 넉넉히. |

**프롬프트 요약 (§4)**

| 프롬프트 | 내용 |
|----------|------|
| **A** | 전체 감성 + Arena 테마 (1차): 세 가지 감성 + globals.css 변수 + layout·대시보드·BtyTopNav 적용. dojo-purple 활용. |
| **B** | 대시보드만 먼저: ProgressCard 스타일(웜 화이트·16px·그림자·세로 강조 바) + 상단 한 줄 문구 + 카드 간격·패딩. |
| **C** | 색·테마만: globals.css에 `--arena-bg`, `--arena-card`, `--arena-accent` 등, `data-theme="arena"` 또는 `.bty-arena-area`, layout에 적용. |
| **D** | 문구·톤만: 대시보드 상단·Arena 레벨 카드·리더보드 상단 KO/EN 마이크로카피. i18n 또는 locale별 객체. |
| **E** | 네비·레이아웃: BtyTopNav·layout — 헤더 크림/보라 톤, 활성 링크 강조, hover 부드럽게, 본문 padding 넉넉히. |

**적용 순서 (§5)**  
**C → B → D 또는 E → (필요 시) A** — C(색·테마) → B(대시보드 카드·문구) → D(문구) 또는 E(네비·레이아웃) → 부족 시 A(전체 한 번에).

---

## 2. 현재 상태

- **레이아웃**: `bty/(protected)/layout.tsx` — 상단 스티키 헤더(흰색/80 backdrop), `max-w-6xl` 본문.
- **네비**: `BtyTopNav` — 메인 / Dashboard / Arena / Leaderboard 링크, `#111`·흰색 강조.
- **대시보드**: `ProgressCard` 단위, 인라인 스타일 다수, 흰색/회색 배경.
- **테마**: `globals.css`에 `dear`, `dojo`, `sanctuary` 변수 있음. Arena 전용 테마는 없음.

---

## 3. 조사·추천 항목

### 3-1. 감성 키워드 (우선 적용할 방향)

| 키워드 | 적용 포인트 | 추천 |
|--------|-------------|------|
| **Arena스럽게** | 배경 그라데이션, 카드 테두리/그림자, “경기장/연습장” 느낌 아이콘·일러 여백 | 연한 보라·딥퍼플 계열 + 크림/오프화이트 배경 (기존 dojo-purple 활용) |
| **트레이닝장 같게** | “레벨·스텝·진행” 시각화(바·스텝), 뱃지·칭호, 짧은 격려 문구 | ProgressCard를 “연습 단계” 카드처럼 보이게, 레벨 스텝 강조 |
| **포근한 대화 창** | 둥근 모서리, 부드러운 그림자, 말풍선/카드형 블록, 짧은 안내 문구 | `border-radius` 12~16px, `box-shadow` 부드럽게, 문구 톤 친근·격려 |

### 3-2. 색·배경

| 옵션 | 설명 | 추천도 |
|------|------|--------|
| **A** | Arena 전용 CSS 변수 추가 (예: `--arena-bg`, `--arena-card`, `--arena-accent`). 배경은 크림/연한 보라 그라데이션. | ⭐⭐⭐ |
| **B** | 기존 `dojo-purple`·`dojo-ink` 활용, 카드만 `#FDF8F3` 같은 웜 화이트로 통일. | ⭐⭐ |
| **C** | `data-theme="arena"` 추가해 `body` 배경·본문색만 Arena 전용으로 분리. | ⭐⭐⭐ |

### 3-3. 타이포·여백

| 항목 | 추천 |
|------|------|
| **제목** | `font-weight: 700`~`800`, 자간 약간 넓게 (tracking). Arena/대시보드 제목만 1단계 크게. |
| **본문** | `line-height: 1.6` 이상, 포근한 느낌을 위해 줄간격 넉넉히. |
| **카드** | `padding: 20px 24px`, `gap: 16px`~`24px`. 카드와 카드 사이 여백 넉넉히. |

### 3-4. 카드·컴포넌트

| 항목 | 추천 |
|------|------|
| **ProgressCard** | 배경 `#FAFAF8` 또는 `var(--arena-card)`, `border-radius: 16px`, `box-shadow: 0 2px 12px rgba(0,0,0,0.06)`. 왼쪽에 얇은 세로 강조 바(보라/세이지) 선택. |
| **네비** | 활성 링크에만 둥근 배경+강조색. 나머지는 텍스트만. “Arena”를 강조한 브랜딩 한 줄 추가 가능. |
| **대시보드 첫 화면** | 상단에 “오늘의 연습” / “Today’s practice” 같은 한 줄 문구 + 짧은 격려 메시지. |

### 3-5. 문구·톤 (마이크로카피)

| 위치 | 예시 (KO) | 예시 (EN) |
|------|-----------|-----------|
| 대시보드 상단 | “오늘도 한 걸음, Arena에서.” | “One step today, in the Arena.” |
| Arena 진입 | “연습을 시작해 보세요.” | “Start your practice.” |
| 레벨 카드 | “지금 여기까지 열렸어요.” | “Unlocked up to here.” |
| 리더보드 | “함께 달리는 동료들.” | “Running together.” |

---

## 4. 복사용 프롬프트 (그대로 붙여 넣어 사용)

### 프롬프트 A — 전체 감성 + Arena 테마 (1차)

```
bty-app의 Arena/대시보드 영역을 다음 세 가지 감성으로 바꿔줘.

1) Arena스럽게: 연한 보라·딥퍼플 계열과 크림/오프화이트 배경을 쓰고, 카드에 부드러운 그림자와 둥근 모서리(16px)를 줘.
2) 트레이닝장 같게: ProgressCard를 "연습 단계" 카드처럼 보이게 하고, 레벨·스텝·진행이 한눈에 들어오게 해. 뱃지/칭호 느낌 유지.
3) 포근한 대화 창 같게: 말풍선형 카드, 넉넉한 여백, 친근한 격려 톤의 문구 한두 줄을 대시보드 상단이나 Arena 진입부에 넣어줘.

globals.css에 Arena 전용 변수(예: --arena-bg, --arena-card, --arena-accent)를 추가하고, bty/(protected) layout과 대시보드·BtyTopNav에 적용해줘. 기존 dojo-purple을 Arena 악센트로 활용해도 돼.
```

### 프롬프트 B — 대시보드만 먼저 (단계적)

```
bty-app의 대시보드(dashboard/page.client.tsx)만 다음처럼 바꿔줘.

- ProgressCard: 배경 #FAFAF8 또는 연한 크림, border-radius 16px, box-shadow 0 2px 12px rgba(0,0,0,0.06). 카드 왼쪽에 4px 세로 강조 바(보라 또는 세이지).
- 대시보드 상단에 "오늘도 한 걸음, Arena에서." / "One step today, in the Arena." 같은 한 줄 문구 추가 (locale에 따라 ko/en).
- 카드 간격(gap)과 패딩을 넉넉히 해서 포근한 느낌이 나게 해줘.
```

### 프롬프트 C — 색·테마만 (최소 변경)

```
bty-app의 globals.css에 Arena 전용 테마를 추가해줘.

- 변수: --arena-bg, --arena-card, --arena-accent, --arena-text, --arena-text-soft (크림·연보라·dojo-purple 활용).
- body[data-theme="arena"] 또는 .bty-arena-area 같은 클래스로 배경 그라데이션(크림→연한 보라)과 본문 색 적용.
- bty/(protected)/layout.tsx에서 이 테마가 적용되도록 data-theme 또는 클래스를 붙여줘.
```

### 프롬프트 D — 문구·톤만 (마이크로카피)

```
bty-app의 Arena·대시보드 영역에 "포근한 대화 창" 느낌의 짧은 문구를 넣어줘.

- 대시보드 상단: "오늘도 한 걸음, Arena에서." (ko) / "One step today, in the Arena." (en).
- Arena 레벨 카드 근처: "지금 여기까지 열렸어요." (ko) / "Unlocked up to here." (en).
- 리더보드 페이지 상단: "함께 달리는 동료들." (ko) / "Running together." (en).

i18n 또는 해당 페이지의 locale별 객체에 추가하고, 기존 UI는 그대로 두고 텍스트만 교체해줘.
```

### 프롬프트 E — 네비·레이아웃 (헤더·포근함)

```
bty-app의 BtyTopNav와 bty/(protected)/layout.tsx를 Arena스럽고 포근하게 바꿔줘.

- 헤더: 배경을 연한 크림/보라 톤으로, border-bottom은 부드러운 색. "Arena" 또는 "BTY Arena" 로고/텍스트를 왼쪽에 두고, 오른쪽에 메인·Dashboard·Arena·Leaderboard 링크.
- 네비 링크: 활성만 둥근 배경+강조색, 나머지는 텍스트만. 포근한 느낌을 위해 hover 시 부드러운 배경 변화.
- 본문 영역: max-width 유지, padding 넉넉히 (py-8 또는 24px).
```

---

## 5. 적용 순서 제안

**권장 순서**: **C → B → D 또는 E → (필요 시) A**

| 순서 | 프롬프트 | 내용 | 상태 |
|------|----------|------|------|
| 1 | **C** (색·테마) | Arena 전용 CSS 변수·`data-theme="arena"` 먼저 적용. 배경·본문색만 바꿔 전제를 둠. | [x] |
| 2 | **B** (대시보드 카드·문구) | ProgressCard 스타일 + 상단 한 줄 문구 적용. 대시보드에서 체감 변화 확인. | [x] |
| 3 | **D** 또는 **E** | D: 나머지 문구만 교체. E: BtyTopNav·layout을 Arena스럽게. | [x] (D, E 적용) |
| 4 | **(필요 시) A** | 위만으로 부족할 때, 전체 감성·테마·레이아웃·카드·문구를 한 번에 맞출 때 사용. | [x] |

---

*진행 에이전트에게 지시할 때: `docs/ARENA_UI_REDESIGN_BRIEF.md` 를 참고해서 적용해달라고 하면, 이 브리프와 위 프롬프트를 함께 사용할 수 있습니다.*

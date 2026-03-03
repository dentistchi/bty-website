# BTY Arena 설계 문서 인덱스

## 📌 문서 전체 목적

BTY Arena는 리더십 훈련을 위한 시스템으로 **실행 → 분석 → 보호/회복**의 3단계 흐름을 갖는 15개의 화면 기반 Web App 설계입니다.

각 문서는 다음과 같은 역할을 합니다:

| 문서명 | 역할 |
|--------|------|
| Visual / Behavior Spec | 화면 구조 / 플로우 / 컴포넌트 설계 |
| Technical Spec | 데이터/라우트/API/트리거/챗봇 조건 |
| Design Token Spec | 색/반응형/i18n |
| **Design Token → Tailwind 매핑** | **토큰↔Tailwind 규칙, PR 체크리스트, 자동생성 Gate** |
| **Design Token/Tailwind 적용 가능 여부** | **현재 상태·진입 경로(A/B)·Storybook 웹팩 이슈·권장 순서** |
| **Tailwind Config 자동생성 구조** | **tokens.json → tailwind.tokens.ts + css-vars.css, 스크립트·CI** |
| **Tailwind Autogen 구조(문서 설계)** | **폴더·스키마·생성물·Gate 조건 정리** |
| **Token JSON→코드 스크립트** | **Gate 후 validate/build 스크립트 설계·CI·Storybook 연동** |
| **Chromatic/Visual Regression 전략** | **스냅샷 매트릭스·viewport·리뷰·플레이북·Phase 롤아웃** |
| Error · Accessibility · Mapping | 에러·빈 상태 문구, 접근성, 기존 앱 경로 매핑 |
| Visual TOC | 화면 목록·Figma Frame ID 매핑 표 |
| **Figma 네이밍·컴포넌트 가이드** | **Frame 네이밍 규칙, 컴포넌트 네임라인, 협업 Do/Don't** |
| **Figma → Code 매핑** | **React/Tailwind 1:1 매핑, 폴더 구조, 토큰·레이아웃·상태·A11y** |
| **Component Inventory (Storybook)** | **UI/Domain 컴포넌트 목록·Props·Stories·A11y** |
| Storyboard & Interaction Flow | 화면 전환/애니 원칙·전환 매트릭스 |
| 이 인덱스 문서 | 전체 설계의 읽는 순서 안내 및 링크 |

---

## 📘 읽는 순서 (Recommended Order)

아래 순서대로 읽으면 BTY Arena 설계를 가장 빠르게 이해할 수 있습니다.

1. **Visual / Behavior 설계 문서**  
   → 15 화면/라우트/플로우/컴포넌트 구조를 먼저 파악

2. **Technical Spec 문서**  
   → 그 화면들이 어떤 데이터/API/트리거로 동작하는지 확인

3. **Design Token Spec 문서**  
   → 색/반응형/i18n 적용

4. **Error · Accessibility · Mapping 문서**  
   → 에러·빈 상태 문구, 접근성 기준, 기존 코드 경로 매핑

> 참고: 이후 **기존 개선 명세(CENTER_PAGE_IMPROVEMENT_SPEC 등)** 를 보면 해당 명세들이 위 설계의 어느 화면/컨텍스트에 반영되는지 파악할 수 있습니다.

---

## 📄 문서 설명 & 링크

### 1) Visual / Behavior Spec

**파일:** `bty-app/docs/BTY_ARENA_VISUAL_BEHAVIOR_SPEC.md`  
**TOC (화면별·섹션 링크):** `bty-app/docs/BTY_ARENA_VISUAL_TOC.md`  
- 화면별 딥링크: `BTY_ARENA_VISUAL_TOC.md#arena-home`, `#arena-simulation`, … `#settings--profile`, `#screenflow-diagram` (문서 상단 앵커 표 참고). Figma Frame ID는 동일 문서 "Figma Frame ID Mapping" 표에서 `#앵커명@frameId` 형식으로 연결 가능 (ID는 TBD 입력).

**설명:**  
Arena / Foundry / Center 각 공간의 화면 구성, 15개 artboard 설계, 화면 플로우, 챗봇 연계 포인트 등이 정리되어 있습니다.

**용도:**  
UI/UX 디자이너, 프론트엔드 개발자가 “어떤 화면이 필요하고, 어떤 컴포넌트가 어떤 행동을 하는지” 확인할 때 봅니다.

---

### 2) Technical Spec (데이터·API·라우트·트리거)

**파일:** `bty-app/docs/BTY_ARENA_TECHNICAL_SPEC.md`

**설명:**  
15개 화면 구현을 위한 데이터 모델, API Endpoints, 라우트 URL 구조, Center 진입 트리거 로직, 챗봇 활성화 조건 등이 한 곳에 정리되어 있습니다.

**용도:**  
백엔드/프론트엔드 개발자가 “API로 어떤 데이터를 언제 불러오고, 어떤 조건에서 화면이 넘어가는지” 이해할 때 봅니다.

---

### 3) Design Token Spec (색·반응형·i18n)

**파일:** `bty-app/docs/BTY_ARENA_DESIGN_TOKENS.md`

**설명:**  
Arena/Foundry/Center 각각의 색상 토큰(Light/Dark), 15화면 반응형 요약, i18n UI 문자열 목록 등이 정리되어 있습니다.

**용도:**  
디자이너/FE 개발자가 “어떤 색을 써야 하고, 모바일·태블릿·데스크탑에서 어떻게 배치할지, 문구 키는 무엇인지” 적용할 때 봅니다.

---

### 3-2) Design Token → Tailwind 매핑 규칙 (자동생성 전 단계)

**파일:** `bty-app/docs/BTY_ARENA_DESIGN_TOKEN_TO_TAILWIND_MAPPING_RULES.md`

**설명:**  
색/타이포/스페이싱/radius/shadow/border/motion 토큰을 Tailwind theme·클래스와 1:1 매핑하는 규칙, 사용 원칙(하드코딩 금지·의미 기반 네이밍), PR 체크리스트, 자동생성 Gate(토큰 고정 후 스크립트 도입 조건)가 정리되어 있습니다.

**용도:**  
FE 개발자가 Tailwind 사용 시 "어떤 클래스를 쓸지, 토큰이 바뀌었을 때 어디만 수정할지" 합의하고, PR 시 체크리스트로 사용합니다. Gate 통과 후 tokens.json → tailwind.config 자동생성으로 확장할 수 있습니다. **자동생성 구조 상세**: [Tailwind Config 자동 생성 구조](BTY_ARENA_TAILWIND_CONFIG_AUTOGEN.md). **문서 설계(구조·Gate)**: [Tailwind Autogen 구조](BTY_ARENA_TAILWIND_AUTOGEN_STRUCTURE.md). **Gate 후 스크립트**: [Token JSON→코드 스크립트](BTY_ARENA_TOKEN_JSON_TO_CODE_SCRIPTS.md). **적용 가능 여부·진입 경로**: [Design Token/Tailwind 적용 가능 여부](BTY_ARENA_DESIGN_TOKEN_TAILWIND_APPLICABILITY.md).

---

### 4) Error · Accessibility · Existing Code Mapping

**파일:** `bty-app/docs/BTY_ARENA_ERROR_ACCESSIBILITY_MAPPING.md`

**설명:**  
15화면별 에러/빈 상태 메시지·CTA(en/ko), 접근성 가이드라인(WCAG, 포커스 순서, 스크린리더, 터치 타겟), 기존 앱 경로와 화면 매핑이 정리되어 있습니다.

**용도:**  
프론트엔드/QA가 “에러 시 어떤 문구를 띄울지, 접근성 기준, 실제 라우트 경로”를 확인할 때 봅니다.

---

### 5) Storyboard & Interaction Flow

**파일:** `bty-app/docs/BTY_ARENA_STORYBOARD_INTERACTION_FLOW.md`

**설명:**  
화면 전환·애니메이션 원칙(페이지 전환/모달/인라인 피드백, reduced motion), 화면 간 전환 매트릭스(From→To, 전환 타입), SCREENFLOW에 전환 라벨을 붙인 Interaction Flow 다이어그램이 정리되어 있습니다.

**용도:**  
디자이너/프론트엔드가 Figma 프로토타입·구현 시 "어디서 어디로, 어떤 애니로 넘어가는지" 스토리보드·이슈에서 공유할 때 봅니다.

---

### 6) Figma Frame 네이밍 규칙 & 컴포넌트 네임라인 가이드

**파일:** `bty-app/docs/BTY_ARENA_FIGMA_NAMING_GUIDE.md`

**설명:**  
Figma Frame 이름(15개 화면 + Settings/Profile) 목록, 권장 페이지/폴더 구조, 컴포넌트 PascalCase·공간별 네이밍, Variant/상태 규칙, 협업 시 Do/Don't가 정리되어 있습니다.

**용도:**  
디자이너·개발자가 Figma에서 협업할 때 이름 충돌을 줄이고, TOC·Behavior Spec·코드와 동일한 이름 체계를 쓰기 위해 봅니다.

---

### 7) Figma → Code 매핑 규칙 (React / Tailwind)

**파일:** `bty-app/docs/BTY_ARENA_FIGMA_CODE_MAPPING.md`

**설명:**  
Frame = Page, Section = Feature, Atomic = UI 컴포넌트 매핑, 네이밍(Figma → Route/컴포넌트명), 권장 폴더 구조, Tailwind 토큰(Color/Spacing/Typography), Auto Layout → Tailwind, 반응형·상태(Loading/Empty/Error)·Props 표준·i18n·접근성·모션, Frame ID 주석, 구현 순서가 정리되어 있습니다.

**용도:**  
프론트엔드 개발자가 Figma 디자인을 React/Tailwind로 옮길 때 "어디에 어떤 이름으로, 어떤 토큰/레이아웃을 쓸지" 한 문서로 확인할 때 봅니다.

---

### 8) Component Inventory (Storybook 대응)

**파일:** `bty-app/docs/BTY_ARENA_COMPONENT_INVENTORY_STORYBOOK.md`

**설명:**  
UI(Button, Card, Chip, ProgressRing, Slider, Modal, EmptyState, ErrorState, Skeleton 등)·Layout·Domain(Arena/Foundry/Center)·Overlay 컴포넌트를 역할별로 분류하고, 각 컴포넌트별 Props·Storybook Stories·A11y 요구사항을 정리한 인벤토리입니다.

**용도:**  
Storybook 스토리 작성·컴포넌트 API 통일·Figma Variant와 1:1 대응할 때 참고합니다. **시각 회귀**: [Chromatic/Visual Regression 전략](BTY_ARENA_CHROMATIC_VISUAL_REGRESSION_STRATEGY.md).

---

## 📌 기존 개선 명세와의 관계

| 개선 명세 | 반영 대상 화면/컨텍스트 |
|-----------|-------------------------|
| CENTER_PAGE_IMPROVEMENT_SPEC | /center, /center/safe-mirror, /center/small-wins, /center/self-esteem, /center/recovery |
| (Foundry 상세 개선 명세) | /bty-arena/foundry, /foundry/decision, /foundry/stats, /foundry/trend, /foundry/insights |
| (Arena UI 개선 명세) | /bty-arena, /bty-arena/sim, /bty-arena/result, /bty-arena/board |

> 위 표는 “기존 개선 명세가 어떤 화면 문맥에 반영되는지” 한눈에 보여줍니다.

---

## 📌 추가 참고 포인트

### 1) 문서 간 참조 관계

- **Visual/Behavior** → Technical(데이터·API·라우트), Design Tokens(색·반응형·i18n), Error/A11y/Mapping(에러·접근성·경로) 참조.
- **Technical** → Visual/Behavior(15화면·플로우), Error/A11y/Mapping §C(실제 앱 경로) 참조.
- **Design Tokens** → Visual/Behavior, Technical 참조. 접근성·에러 문구 상세는 Error/A11y/Mapping 참조.
- **Error/A11y/Mapping** → Visual/Behavior(화면 목록), Technical(라우트) 참조.

### 2) 구현 시 추천 순서

1. 라우트·API 계약 확정 (Technical Spec + Mapping §C)  
2. 공통 컴포넌트·디자인 토큰 적용 (Design Tokens)  
3. 화면별 구현 (Visual/Behavior + Error/A11y 문구)  
4. 접근성·에러 상태 점검 (Error/A11y/Mapping §B, §A)

---

**문서 위치:** `bty-app/docs/BTY_ARENA_SPEC_INDEX.md`

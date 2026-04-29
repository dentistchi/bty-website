# Design Token 확정 후 Tailwind 확장/자동생성 적용 가능 여부

**목적**: Design Token 확정 후 `tailwind.config` 색/타이포 확장 또는 `BTY_ARENA_TAILWIND_CONFIG_AUTOGEN.md` 구조의 생성 스크립트 도입이 **지금 적용 가능한지** 정리.

---

## 1. 현재 상태 요약

| 항목 | 상태 |
|------|------|
| **문서** | ✅ `BTY_ARENA_TAILWIND_CONFIG_AUTOGEN.md`, `BTY_ARENA_TAILWIND_AUTOGEN_STRUCTURE.md`, `BTY_ARENA_DESIGN_TOKENS.md`, `BTY_ARENA_DESIGN_TOKEN_TO_TAILWIND_MAPPING_RULES.md`, `BTY_ARENA_TOKEN_JSON_TO_CODE_SCRIPTS.md` 존재. 구조·스키마·Gate 조건·스크립트 개념 확정됨. |
| **tokens/source/** | ✅ `tokens.json` 초안 있음 (Arena 설계 문서 값 기준). Gate 전까지 수정·검토용. |
| **tokens/generated/** | ❌ 없음. `tailwind.tokens.ts`, `css-vars.css` 없음. (build 스크립트 실행 후 생성) |
| **tokens/scripts/** | ❌ 없음. `build-tokens.mjs`, `validate-tokens.mjs` 없음. |
| **tailwind.config.ts** | 수동 확장만 있음 (colors hex, keyframes, fontFamily, boxShadow). 생성물 import 없음. |
| **globals.css** | CSS 변수 **직접 작성** (`--arena-*`, `--dojo-*`, `--foundry-*`, `--dear-*`, `--journey-*`, `--sanctuary-*`). `DESIGN_TOKENS.md`와 **이름·값 불일치** (실제 앱은 ARENA_UI_REDESIGN_BRIEF·DESIGN_FIRST_IMPRESSION_BRIEF 반영). |
| **package.json** | `tokens:validate`, `tokens:build` 스크립트 없음. |

---

## 2. 적용 가능 여부

### 결론: **가능하지만, 선행 단계가 필요함.**

- **구조·스크립트 도입 자체**: 문서대로 `tokens/` 폴더·스크립트를 추가하고, `tailwind.config.ts`가 생성물만 import하도록 바꾸면 **기술적으로 적용 가능**.
- **바로 스크립트만 넣으면**: `tokens/source/tokens.json`이 없으면 빌드 스크립트가 동작하지 않음. **Design Token을 단일 소스(tokens.json)로 확정한 뒤** 스크립트 도입이 필요함.

---

## 3. Design Token “확정”이 필요한 이유

- **BTY_ARENA_DESIGN_TOKENS.md**: 색/타이포가 **마크다운·CSS 블록**으로만 정의되어 있고, **arena/foundry/center/neutral** 이름 체계. Light/Dark 값은 문서와 일치.
- **실제 앱(globals.css + tailwind.config)**: **arena**(크림·연보라·foundry-purple 참조), **dojo/foundry**(동일 팔레트), **dear/sanctuary/journey** 등 **다른 이름·값** 사용. ARENA_UI_REDESIGN_BRIEF·DESIGN_FIRST_IMPRESSION_BRIEF 반영.
- 따라서 “Design Token 확정”이란:
  1. **단일 소스**로 쓸 이름·값을 정하는 것 (문서 체계 vs 현재 코드 체계 중 하나로 통일 또는 매핑 규칙 명시).
  2. 그 결과를 **`tokens/source/tokens.json`** 스키마에 맞춰 작성하는 것.

---

## 4. 적용 순서 (권장)

| 순서 | 작업 | 비고 |
|------|------|------|
| **1** | **Design Token 확정** | 현재 사용 톤(globals.css + tailwind.config)을 기준으로 할지, DESIGN_TOKENS.md를 기준으로 할지 결정. arena/dojo/foundry/dear/sanctuary/journey → tokens.json 키/값으로 매핑 규칙 정리. |
| **2** | **tokens.json 초안 작성** | `BTY_ARENA_TAILWIND_CONFIG_AUTOGEN.md` §2 또는 `BTY_ARENA_TAILWIND_AUTOGEN_STRUCTURE.md` 스키마에 맞춰 `tokens/source/tokens.json` 생성. color(light/dark), typography, space, radius, shadow, motion 최소 포함. |
| **3** | **tokens/ 폴더·스크립트 추가** | `tokens/scripts/validate-tokens.mjs`, `tokens/scripts/build-tokens.mjs` 추가. `BTY_ARENA_TOKEN_JSON_TO_CODE_SCRIPTS.md` 개념대로 동작하도록 구현. |
| **4** | **생성물 연결** | `npm run tokens:build` 실행 → `tokens/generated/css-vars.css`, `tokens/generated/tailwind.tokens.ts` 생성. `tailwind.config.ts`에서 해당 생성물만 import하도록 수정. `globals.css`는 생성된 `css-vars.css` import 추가(기존 :root 블록은 생성물과 병합하거나 점진 대체). |
| **5** | **npm 스크립트** | `package.json`에 `tokens:validate`, `tokens:build` 추가. 필요 시 `predev`/`prebuild`에서 `tokens:build` 호출. |
| **6** | **(선택) Gate 조건** | `BTY_ARENA_TAILWIND_AUTOGEN_STRUCTURE.md` Gate: 토큰 2주 안정, Figma 합치, Storybook 10개 이상 토큰만 사용. 충족 후 CI에서 tokens 변경 시 생성물 일치 검증 의무화. |

---

## 5. 두 가지 진입 경로

### A) Tailwind 수동 확장만 먼저 (스크립트 없음)

- **Design Token을 문서(MD) 또는 소규모 JSON으로만 확정**하고, **tailwind.config.ts의 theme.extend**에만 색/타이포를 수동으로 넣는 방식.
- **적용 가능**: 예. 지금도 tailwind.config에 extend 추가하는 것은 가능. `BTY_ARENA_DESIGN_TOKEN_TO_TAILWIND_MAPPING_RULES.md`에 맞춰 `colors`, `fontSize` 등을 확장하면 됨.
- **장점**: tokens/ 폴더·스크립트 없이 빠르게 반영.  
- **단점**: 단일 소스(tokens.json)가 아니므로, 나중에 자동생성으로 전환 시 tokens.json 역추출 또는 재작성 필요.

### B) AUTOGEN 구조로 스크립트 도입

- **Design Token을 tokens.json으로 확정**한 뒤, `BTY_ARENA_TAILWIND_CONFIG_AUTOGEN.md` 구조대로 **build-tokens.mjs**로 `css-vars.css` + `tailwind.tokens.ts` 생성, tailwind.config는 생성물만 import.
- **적용 가능**: 예. 위 §4 순서대로 진행하면 적용 가능.
- **전제**: `tokens/source/tokens.json` 존재 및 스키마 준수.

---

## 6. Storybook 빌드 이슈 (Next 15 + Storybook 8)

- **증상**: `npm run storybook` 실행 시 웹팩 단계에서 `Cannot read properties of undefined (reading 'tap')` 로 실패.
- **원인**: Next 15 내부 웹팩과 Storybook 8의 builder-webpack5가 함께 쓰이면서 생기는 알려진 이슈에 가깝다.
- **대응**: Storybook 8.x + Next 15 호환 버전/설정 확인 또는 builder를 **@storybook/builder-vite** 등으로 바꾸는 방안 검토.  
  Design Token·Tailwind 적용 가능 여부와는 별개이며, **토큰 확정 + tailwind content**는 이미 반영됨 (`tailwind.config.ts`에 `./stories/**/*` 포함 시 스토리에서 토큰 클래스가 빌드에 포함됨).

---

## 7. 요약

| 질문 | 답 |
|------|----|
| Design Token 확정 후 tailwind.config 색/타이포 확장 적용 가능? | **가능.** 수동 확장(A) 또는 자동생성(B) 둘 다 선택 가능. |
| BTY_ARENA_TAILWIND_CONFIG_AUTOGEN 구조로 생성 스크립트 도입 가능? | **가능.** 단, **먼저 Design Token을 tokens.json으로 확정**하고, tokens/ 폴더·validate/build 스크립트를 추가한 뒤 tailwind와 globals가 생성물을 쓰도록 연결해야 함. |
| 지금 당장 스크립트만 넣으면? | **불가.** `tokens.json`이 없으면 빌드할 소스가 없음. |
| 권장 순서 | (1) Token 확정 및 tokens.json 초안 → (2) validate/build 스크립트 구현 → (3) 생성물 생성 및 tailwind/globals 연결 → (4) npm 스크립트·필요 시 predev/prebuild. |

---

## 8. tokens.json 최소 스키마 초안

- **위치**: `tokens/source/tokens.json`
- **기준**: `BTY_ARENA_DESIGN_TOKENS.md` 색상 값 + `BTY_ARENA_TAILWIND_AUTOGEN_STRUCTURE.md` 스키마.
- **내용**: color(arena/foundry/center/neutral, light/dark), typography(h1~button), space(8pt), radius, shadow, motion.
- **용도**: Gate 전까지 검토·수정용. build 스크립트 추가 후 이 파일을 소스로 `tokens:build` 실행하면 생성물이 나옴.  
- **현재 앱과 다른 점**: 앱은 dojo/foundry/dear/sanctuary/journey 등 다른 이름·팔레트 사용. 통일할 때 이 초안을 기준으로 하거나, tokens.json에 dojo/dear 등을 추가해 매핑 규칙을 정하면 됨.

---

## 9. 수동 확장용 theme.extend 예시 (방식 A)

스크립트 없이 **tailwind.config.ts의 theme.extend**에만 넣을 때 참고.  
(기존 `colors`에 dear/dojo/foundry 등이 있으면, 아래 블록을 **병합**하거나 키 이름을 맞춰 사용.)

```ts
// tailwind.config.ts — theme.extend에 추가할 예시 (arena/center/neutral 토큰 + 타이포)
theme: {
  extend: {
    colors: {
      arena: {
        primary: "var(--arena-primary)",
        accent: "var(--arena-accent)",
        bg: "var(--arena-bg)",
        "text-primary": "var(--arena-text-primary)",
        "text-secondary": "var(--arena-text-secondary)",
      },
      foundry: {
        primary: "var(--foundry-primary)",
        accent: "var(--foundry-accent)",
        bg: "var(--foundry-bg)",
        "text-primary": "var(--foundry-text-primary)",
        "text-secondary": "var(--foundry-text-secondary)",
      },
      center: {
        primary: "var(--center-primary)",
        accent: "var(--center-accent)",
        bg: "var(--center-bg)",
        "text-primary": "var(--center-text-primary)",
        "text-secondary": "var(--center-text-secondary)",
      },
      neutral: {
        textBase: "var(--text-base)",
        textLight: "var(--text-light)",
        bgBase: "var(--bg-base)",
        borderBase: "var(--border-base)",
      },
    },
    fontSize: {
      h1: ["30px", { lineHeight: "36px", fontWeight: "700", letterSpacing: "-0.01em" }],
      h2: ["24px", { lineHeight: "32px", fontWeight: "600", letterSpacing: "-0.01em" }],
      body: ["16px", { lineHeight: "24px", fontWeight: "400" }],
      caption: ["12px", { lineHeight: "16px", fontWeight: "400" }],
      button: ["16px", { lineHeight: "20px", fontWeight: "600" }],
    },
    transitionDuration: { fast: "80ms", base: "150ms", slow: "300ms" },
    transitionTimingFunction: { standard: "cubic-bezier(0.2, 0, 0, 1)" },
  },
},
```

- **전제**: `globals.css`(또는 별도 CSS)에 **:root / .dark** 로 `--arena-primary` 등 CSS 변수가 정의되어 있어야 함.  
  (값은 `BTY_ARENA_DESIGN_TOKENS.md` 또는 `tokens/source/tokens.json` 참고.)
- **클래스 사용 예**: `bg-arena-bg`, `text-arena-text-primary`, `text-h1`, `duration-base`, `ease-standard`.

---

**문서 위치**: `bty-app/docs/BTY_ARENA_DESIGN_TOKEN_TAILWIND_APPLICABILITY.md`  
**참조**: `BTY_ARENA_TAILWIND_CONFIG_AUTOGEN.md`, `BTY_ARENA_TAILWIND_AUTOGEN_STRUCTURE.md`, `BTY_ARENA_DESIGN_TOKENS.md`, `BTY_ARENA_TOKEN_JSON_TO_CODE_SCRIPTS.md`  
**관련**: Storybook 웹팩 오류(Next 15 + Storybook 8)는 §6 참고.

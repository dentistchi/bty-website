# Tailwind Config 자동 생성 구조 (Design Tokens → Tailwind)

## 목표

- Figma/Design Token(JSON)이 **단일 소스**가 되도록 한다.
- `tailwind.config.ts`는 사람이 직접 편집하지 않고, **생성 결과물**을 사용한다.
- 토큰 변경 → 생성 스크립트 실행 → `tailwind.config.ts`(또는 `tokens.tailwind.ts`) 업데이트가 일관되게 유지된다.
- light/dark 및 Arena/Foundry/Center 테마는 **CSS 변수 기반**으로 처리한다.

**관련**: `BTY_ARENA_DESIGN_TOKEN_TO_TAILWIND_MAPPING_RULES.md`, `BTY_ARENA_DESIGN_TOKENS.md`, `BTY_ARENA_DESIGN_TOKEN_TO_TAILWIND_MAPPING_RULES.md` §8 Gate

---

## 0) 핵심 전략 (권장)

**A. Tailwind는 “토큰 alias 레이어”**

- colors, spacing, radius, fontSize, shadows, motion 등을 `theme.extend`로 넣되, 값은 가능하면 **var(--token)** 형태로 넣는다.

**B. 생성물/원본 분리**

- **원본**: `tokens/source/tokens.json` (또는 `tokens/source/*.json`)
- **생성물**: `tokens/generated/tailwind.tokens.ts`, `tokens/generated/css-vars.css`
- `tailwind.config.ts`는 **생성물 import만** 한다.

**C. 다크모드 처리**

- `prefers-color-scheme` 또는 `class="dark"` 중 하나로 고정 (권장: **class** 전략).
- 실제 값(light/dark)은 **css variable 파일**에서만 바뀐다.

---

## 1) 파일/폴더 구조

프로젝트 루트 기준:

```
/tokens
  /source
    tokens.json
  /generated
    tailwind.tokens.ts
    css-vars.css
  /scripts
    build-tokens.mjs
    validate-tokens.mjs

tailwind.config.ts
postcss.config.js
src/styles/globals.css  (또는 src/app/globals.css)
```

---

## 2) tokens.json 스키마 (최소)

`tokens/source/tokens.json` 예시 구조:

```json
{
  "color": {
    "arena": {
      "primary": { "light": "#0C2D48", "dark": "#A3CEF1" },
      "accent": { "light": "#1E90FF", "dark": "#5AB9EA" },
      "bg": { "light": "#F7FAFC", "dark": "#0F172A" },
      "textPrimary": { "light": "#1A202C", "dark": "#E2E8F0" },
      "textSecondary": { "light": "#4A5568", "dark": "#A0AEC0" }
    },
    "foundry": { "...": "동일 구조" },
    "center": { "...": "동일 구조" },
    "neutral": {
      "textBase": { "light": "#2D3748", "dark": "#EDF2F7" },
      "textLight": { "light": "#718096", "dark": "#A0AEC0" },
      "bgBase": { "light": "#FFFFFF", "dark": "#1A202C" },
      "borderBase": { "light": "#E2E8F0", "dark": "#4A5568" }
    }
  },
  "typography": {
    "h1": { "size": "30px", "lineHeight": "36px", "weight": 700, "letterSpacing": "-0.01em" },
    "h2": { "size": "24px", "lineHeight": "32px", "weight": 600, "letterSpacing": "-0.01em" },
    "body": { "size": "16px", "lineHeight": "24px", "weight": 400, "letterSpacing": "0em" },
    "caption": { "size": "12px", "lineHeight": "16px", "weight": 400, "letterSpacing": "0em" },
    "button": { "size": "16px", "lineHeight": "20px", "weight": 600, "letterSpacing": "0em" }
  },
  "space": {
    "1": "4px", "2": "8px", "3": "12px", "4": "16px", "6": "24px", "8": "32px"
  },
  "radius": { "sm": "8px", "md": "12px", "lg": "16px", "xl": "20px", "2xl": "24px" },
  "shadow": {
    "sm": "0 1px 2px rgba(0,0,0,0.06)",
    "md": "0 4px 12px rgba(0,0,0,0.10)",
    "lg": "0 12px 28px rgba(0,0,0,0.14)"
  },
  "motion": {
    "fast": "80ms", "base": "150ms", "slow": "300ms",
    "easeStandard": "cubic-bezier(0.2, 0, 0, 1)"
  }
}
```

---

## 3) 생성 산출물 정의

### 3-A) tokens/generated/css-vars.css

- light/dark 값을 **CSS 변수**로 내보낸다.
- `class="dark"` 전략 사용 시:
  - `:root { --arena-primary: #...; ... }`
  - `.dark { --arena-primary: #...; ... }`
- Tailwind에서는 color 값에 **var(--arena-primary)** 만 참조.

### 3-B) tokens/generated/tailwind.tokens.ts

- Tailwind **theme.extend**에 넣을 객체를 export.
- 예: colors, spacing, borderRadius, boxShadow, fontSize, transitionDuration, transitionTimingFunction.

---

## 4) tailwind.config.ts 구성 (사람이 고치는 최소 파일)

생성물 import만 한다.

```ts
import type { Config } from "tailwindcss";
import { tailwindTokens } from "./tokens/generated/tailwind.tokens";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}", "./stories/**/*.{ts,tsx}"],
  theme: {
    extend: {
      ...tailwindTokens,
    },
  },
  plugins: [],
};

export default config;
```

---

## 5) 생성 스크립트 (build-tokens.mjs) 동작

`tokens/scripts/build-tokens.mjs`가 하는 일:

1. `tokens/source/tokens.json` 로드  
2. `validate-tokens.mjs`로 스키마/필수키 검증  
3. **css-vars.css** 생성: `:root`(light) / `.dark`(dark) 블록 생성  
4. **tailwind.tokens.ts** 생성: colors를 var(--token)로, spacing/radius/shadow/typography/motion을 Tailwind 형식으로 변환  
5. 결과물을 `tokens/generated/`에 저장  

*(실제 구현 코드는 Gate 통과 후 넣는 것을 권장. 구조만 먼저 확정.)*

---

## 6) tailwindTokens 객체 설계 (권장 형태)

`tailwind.tokens.ts`에서 export:

```ts
export const tailwindTokens = {
  colors: {
    arena: {
      primary: "var(--arena-primary)",
      accent: "var(--arena-accent)",
      bg: "var(--arena-bg)",
      text: {
        primary: "var(--arena-text-primary)",
        secondary: "var(--arena-text-secondary)",
      },
    },
    foundry: { /* 동일 */ },
    center: { /* 동일 */ },
    neutral: {
      textBase: "var(--neutral-textBase)",
      textLight: "var(--neutral-textLight)",
      bgBase: "var(--neutral-bgBase)",
      borderBase: "var(--neutral-borderBase)",
    },
  },
  spacing: { /* tokens.space */ },
  borderRadius: { sm: "var(--radius-sm)", md: "var(--radius-md)", ... },
  boxShadow: { sm: "var(--shadow-sm)", md: "var(--shadow-md)", lg: "var(--shadow-lg)" },
  fontSize: {
    h1: ["30px", { lineHeight: "36px", fontWeight: "700", letterSpacing: "-0.01em" }],
    h2: ["24px", { lineHeight: "32px", fontWeight: "600", letterSpacing: "-0.01em" }],
    body: ["16px", { lineHeight: "24px", fontWeight: "400" }],
    caption: ["12px", { lineHeight: "16px", fontWeight: "400" }],
    button: ["16px", { lineHeight: "20px", fontWeight: "600" }],
  },
  transitionDuration: { fast: "80ms", base: "150ms", slow: "300ms" },
  transitionTimingFunction: { standard: "cubic-bezier(0.2, 0, 0, 1)" },
};
```

---

## 7) globals.css 연결

`src/app/globals.css`(또는 app globals)에 포함:

```css
@import "../../tokens/generated/css-vars.css";
```

컴포넌트는 Tailwind class만 사용: `bg-arena-bg`, `text-center-text-primary`, `border-neutral-borderBase`, `text-h1`.

---

## 8) NPM Scripts (권장)

```json
"scripts": {
  "tokens:validate": "node tokens/scripts/validate-tokens.mjs",
  "tokens:build": "node tokens/scripts/build-tokens.mjs",
  "predev": "npm run tokens:build",
  "prebuild": "npm run tokens:build"
}
```

---

## 9) CI/PR 체크 (권장)

- `tokens/source/tokens.json` 변경이 있으면:
  1. `tokens:validate` 실행  
  2. `tokens:build` 실행  
  3. 생성물 diff가 있으면 커밋에 포함되어야 통과 (또는 CI에서 자동 커밋 없이 실패 처리)  

**PR 규칙**

- 토큰 변경 PR은 반드시 생성물 포함  
- “컴포넌트에서 HEX/px 직접 사용” lint로 차단 (선택)

---

## 10) Gate(토큰 고정) 이후 자동 생성 붙이는 순서 (실행 플랜)

1. 매핑 규칙 문서 확정 (현재 단계)  
2. `tokens.json` 구조 확정 + 최소 2주 안정  
3. validate 스크립트 추가  
4. build 스크립트로 `css-vars.css` + `tailwind.tokens.ts` 생성  
5. `tailwind.config.ts`에서 생성물 import로 전환  
6. Storybook에도 동일 globals.css 적용 (테마 일치)  
7. CI에서 tokens 변경 검증을 의무화  

---

**문서 위치**: `bty-app/docs/BTY_ARENA_TAILWIND_CONFIG_AUTOGEN.md`  
**참조**: `BTY_ARENA_DESIGN_TOKEN_TO_TAILWIND_MAPPING_RULES.md`, `BTY_ARENA_DESIGN_TOKENS.md`  
**구조·Gate 문서**: [Tailwind Autogen 구조(문서 설계)](BTY_ARENA_TAILWIND_AUTOGEN_STRUCTURE.md)  
**Gate 후 스크립트**: [Token JSON→코드 스크립트](BTY_ARENA_TOKEN_JSON_TO_CODE_SCRIPTS.md)

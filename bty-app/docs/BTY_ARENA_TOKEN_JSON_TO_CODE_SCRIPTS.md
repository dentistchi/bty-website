# BTY Arena – Token JSON → 코드 스크립트 (Gate 통과 후 설계)

## 목표

- **tokens/source/tokens.json** → **tokens/generated/css-vars.css** + **tokens/generated/tailwind.tokens.ts** 생성.
- **validate → build** 순서로 안정성 확보.
- 생성물은 항상 **deterministic** (같은 입력이면 같은 출력).

**전제**: Gate 통과 후 적용. 구조·규칙은 `BTY_ARENA_TAILWIND_AUTOGEN_STRUCTURE.md`와 일치.

---

## 실행 커맨드 (권장)

- `npm run tokens:validate`
- `npm run tokens:build`
- **predev / prebuild** 훅으로 `tokens:build` 자동 실행 (운영 선택)

---

## 파일 1) tokens/scripts/validate-tokens.mjs (개념 설계)

### 검증 항목

**1) 필수 키 존재**

- `color.arena.primary.light` / `color.arena.primary.dark` 등
- `typography.h1` ~ `typography.button`
- `space`, `radius`, `shadow`, `motion`

**2) 값 포맷**

- **color**: `#RRGGBB` 또는 `rgba()` 허용 여부 결정 (권장: **HEX만**)
- **size / lineHeight**: px 또는 rem (권장: **px로 통일**)
- **weight**: number
- **duration**: ms 문자열 (예: `"150ms"`)

**3) 금지**

- 빈 문자열, null, undefined
- 예상치 못한 키 (옵션: allowlist로 제한)

### 실패 시

- **어떤 경로가 왜 실패했는지** 메시지 포함.  
  예: `"color.arena.primary.light missing"`

---

## 파일 2) tokens/scripts/build-tokens.mjs (개념 설계)

- **입력**: `tokens/source/tokens.json`  
- **출력**:  
  - A) `tokens/generated/css-vars.css`  
  - B) `tokens/generated/tailwind.tokens.ts`

### A) css-vars.css 출력 템플릿 (권장)

- `:root { ...light vars... }`
- `.dark { ...dark vars... }`
- 추가(선택): `[data-domain="arena"]` 같은 도메인 스코프 변수 (나중에 확장 가능)

**변수명 규칙 (고정)**

- `--arena-primary`, `--arena-accent`, `--arena-bg`, `--arena-text-primary`, `--arena-text-secondary`
- foundry / center 동일
- **neutral**  
  - `--text-base`, `--text-light`, `--bg-base`, `--border-base`

### B) tailwind.tokens.ts 출력 템플릿 (권장)

- `export const tailwindTokens = { colors, spacing, borderRadius, boxShadow, fontSize, transitionDuration, transitionTimingFunction }`
- **colors**는 **var(--token)** 로만:  
  - `arena: { primary: "var(--arena-primary)", ... }`  
  - `neutral: { textBase: "var(--text-base)", ... }`

**fontSize 매핑 규칙**

- `text-h1` → `["30px", { lineHeight: "36px", fontWeight: "700", letterSpacing: "-0.01em" }]`
- 나머지도 동일

**motion 매핑**

- `duration-fast` / `duration-base` / `duration-slow`
- `ease-standard`

---

## Tailwind class 네이밍 (최종 합의)

- **colors**  
  - `bg-arena-bg`, `text-arena-text-primary`, `text-arena-text-secondary`  
  - `bg-foundry-primary`, `bg-center-accent`  
  - `border-neutral-borderBase`
- **typography**  
  - `text-h1`, `text-h2`, `text-body`, `text-caption`, `text-button`
- **spacing / radius / shadow**  
  - Tailwind 기본 스케일 + extend 필요한 값만 추가

---

## CI 규칙 (권장)

- **tokens.json 변경 PR**이면:  
  1) validate  
  2) build  
  3) **생성물이 최신인지 확인** (커밋에 포함 안 되면 fail)
- **생성물을 레포에 커밋할지 여부**  
  - **커밋 권장** (디버깅/리뷰 쉬움)  
  - 미커밋을 원하면: CI에서 생성 후 diff 확인만 하고 fail 처리 (레포 청결)

---

## Storybook 연동 (중요)

- **.storybook/preview.ts**에서 **globals.css** import 유지.
- **globals.css**가 **css-vars.css**를 import하므로 Storybook도 **동일 토큰** 렌더링.

---

**문서 위치**: `bty-app/docs/BTY_ARENA_TOKEN_JSON_TO_CODE_SCRIPTS.md`  
**참조**: `BTY_ARENA_TAILWIND_AUTOGEN_STRUCTURE.md`, `BTY_ARENA_TAILWIND_CONFIG_AUTOGEN.md`, `BTY_ARENA_DESIGN_TOKEN_TO_TAILWIND_MAPPING_RULES.md`

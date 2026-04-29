# BTY Arena – Tailwind Config 자동 생성 구조 (문서 설계)

## 목적

- Design Token(JSON)을 **단일 소스**로 두고 Tailwind 설정을 **생성물**로 유지한다.
- 토큰이 흔들리는 구간에는 **문서/규칙만** 확정하고, Gate 통과 후 자동 생성 파이프라인을 붙인다.
- light/dark + Arena/Foundry/Center 톤은 **CSS 변수 기반**으로 처리한다 (컴포넌트에서 HEX 하드코딩 금지).

**관련**: `BTY_ARENA_DESIGN_TOKEN_TO_TAILWIND_MAPPING_RULES.md`, `BTY_ARENA_TOKEN_JSON_TO_CODE_SCRIPTS.md` (Gate 후 스크립트 설계)

---

## 핵심 결정 (고정)

1. **Tailwind는 토큰의 alias layer**  
   - tailwind theme의 값은 가능하면 **var(--token)** 참조로만 구성.

2. **생성물/원본 분리**  
   - **원본**: `tokens/source`  
   - **생성물**: `tokens/generated`  
   - `tailwind.config.ts`는 **생성물 import만** 함.

3. **다크모드 전략**  
   - **darkMode: ["class"]** 고정 (권장).  
   - 실제 light/dark 값은 **css-vars.css**에서만 전환.

---

## 폴더 구조 (권장)

```
tokens/
  source/
    tokens.json
  generated/
    css-vars.css           (생성물)
    tailwind.tokens.ts     (생성물)
  scripts/
    validate-tokens.mjs    (Gate 후 추가)
    build-tokens.mjs       (Gate 후 추가)

tailwind.config.ts         (사람이 최소 편집)
src/app/globals.css        (또는 src/styles/globals.css)
```

---

## tokens/source/tokens.json 최소 스키마 (권장)

- **color**  
  - arena / foundry / center / neutral 각각:  
    - primary, accent, bg, textPrimary, textSecondary, borderBase(optional)  
  - 각 값은 **{ light, dark }**.

- **typography**  
  - h1 / h2 / body / caption / button  
  - (size, lineHeight, weight, letterSpacing)

- **space**  
  - 8pt 스케일 (1, 2, 3, 4, 6, 8 …)

- **radius**  
  - sm, md, lg, xl, 2xl

- **shadow**  
  - sm, md, lg

- **motion**  
  - fast / base / slow + easeStandard

---

## 생성물 정의

### A) tokens/generated/css-vars.css

- **:root** 에 light 변수 세팅.  
- **.dark** 에 dark 변수 세팅.  

예:

```css
:root { --arena-primary: #0C2D48; ... }
.dark { --arena-primary: #A3CEF1; ... }
```

### B) tokens/generated/tailwind.tokens.ts

- Tailwind **theme.extend**용 객체 export.  
- **colors**는 **var(--token)** 으로만 노출.  
- typography / spacing / radius / shadow / motion을 Tailwind 형태로 변환.

---

## tailwind.config.ts (사람이 건드리는 최소 파일)

- 생성물 import 후 **theme.extend**에 병합만 한다.

예 (개념):

```ts
import { tailwindTokens } from "./tokens/generated/tailwind.tokens";
export default {
  darkMode: ["class"],
  theme: { extend: { ...tailwindTokens } },
  content: ["./src/**/*.{ts,tsx}", "./stories/**/*.{ts,tsx}"],
  // ...
};
```

---

## globals.css 연결

- **src/app/globals.css** (또는 src/styles/globals.css)에서 **css-vars.css**를 import.  
- 컴포넌트는 **Tailwind 클래스만** 사용:  
  - `bg-arena-bg`, `text-center-textPrimary`, `border-neutral-borderBase`, `text-h1` 등.

---

## 운영 원칙 (문서 고정)

- 컴포넌트에서 **HEX/px 직접 값 금지**.  
- 토큰 변경은 **tokens.json만** 수정 → (Gate 후) **build**로 생성물 갱신.  
- PR에서 **“생성물 diff 포함”**을 규칙으로 둔다 (또는 CI에서 불일치 시 fail).

---

## Gate (자동생성 붙이는 조건)

다음이 충족되면 **(3) 스크립트 적용**으로 전환한다:

1. **색상/타이포/스페이싱** 토큰이 **최소 2주 안정**.  
2. **Figma 톤**(3영역)과 토큰이 합치됨.  
3. **Storybook**에서 기본 UI **10개 이상**이 토큰만으로 렌더링됨 (하드코딩 제거 완료).  

---

**문서 위치**: `bty-app/docs/BTY_ARENA_TAILWIND_AUTOGEN_STRUCTURE.md`  
**참조**: `BTY_ARENA_DESIGN_TOKEN_TO_TAILWIND_MAPPING_RULES.md`, `BTY_ARENA_TAILWIND_CONFIG_AUTOGEN.md`, `BTY_ARENA_TOKEN_JSON_TO_CODE_SCRIPTS.md` (Gate 후 스크립트)

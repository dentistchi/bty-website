# BTY Arena – Design Token → Tailwind 매핑 규칙 (자동생성 전 단계)

## 목적

- Design Token(색/타이포/스페이싱/라운드/섀도/모션)을 **Tailwind theme 및 유틸 클래스 네이밍**과 1:1로 매핑한다.
- **토큰이 고정되기 전**에는 자동생성(스크립트)을 붙이지 않고, **매핑 규칙 문서**로 합의를 먼저 만든다.

**관련**: `BTY_ARENA_DESIGN_TOKENS.md` (색·반응형·i18n), `BTY_ARENA_FIGMA_CODE_MAPPING.md` (§4 Tailwind 토큰), `BTY_ARENA_FIGMA_NAMING_GUIDE.md` (§6 Color Token)

---

## 0) 원칙 (MUST)

1. **하드코딩 금지**  
   - HEX/px/rem 값을 컴포넌트에 직접 넣지 않는다.  
   - 반드시 **token → Tailwind class → 컴포넌트** 적용 순서로만 사용한다.

2. **토큰은 ‘의미 기반’ 네이밍**  
   - `color.blue500` 같은 값 기반이 아니라  
   - `arena.primary`, `center.bg` 같은 **의미 기반**으로 정의한다.

3. **Tailwind는 “토큰 alias” 역할**  
   - Tailwind는 토큰을 “쓰기 편하게” 만든 layer.  
   - 토큰이 바뀌면 **tailwind theme만** 바꾸고, 컴포넌트 코드는 그대로 유지한다.

---

## 1) Color Tokens 매핑

### 1-1. 토큰 네이밍

- **arena**: primary, accent, bg, textPrimary, textSecondary  
- **foundry**: primary, accent, bg, textPrimary, textSecondary  
- **center**: primary, accent, bg, textPrimary, textSecondary  
- **neutral**: textBase, textLight, bgBase, borderBase  

### 1-2. Tailwind 컬러 키 네이밍 규칙

`theme.extend.colors`:

- **arena**: primary, accent, bg, text.primary, text.secondary  
- **foundry**: 동일 구조  
- **center**: 동일 구조  
- **neutral**: textBase, textLight, bgBase, borderBase  

### 1-3. 사용 규칙 (클래스)

- 배경: `bg-arena-bg`, `bg-center-bg`, `bg-foundry-bg`  
- 텍스트: `text-arena-text-primary`, `text-neutral-textBase`  
- 보더: `border-neutral-borderBase`  
- 강조: `text-arena-accent`, `bg-foundry-accent`  

### 1-4. 테마 전환 규칙

- **light/dark**는 **CSS 변수**로만 전환.  
- Tailwind는 `var(--token)` 참조 형태로만 구성.  
- 다크모드 전환은 `prefers-color-scheme` 또는 `class="dark"` 전략 중 택1.

---

## 2) Typography Tokens 매핑

### 2-1. 토큰

- `text.h1`, `text.h2`, `text.body`, `text.caption`, `text.button`  
- 각각 **fontSize / lineHeight / fontWeight / letterSpacing** 포함.

### 2-2. Tailwind 유틸 전략

**권장**: `theme.extend.fontSize`에 **객체 형태**로 등록.

- 예: `h1: [size, { lineHeight, letterSpacing, fontWeight }]`  

**클래스 사용**

- `text-h1`, `text-h2`, `text-body`, `text-caption`, `text-button`  

---

## 3) Spacing Tokens 매핑 (8pt system)

### 3-1. 토큰

| 토큰 | 값 |
|------|-----|
| space.1 | 4px |
| space.2 | 8px |
| space.3 | 12px |
| space.4 | 16px |
| space.6 | 24px |
| space.8 | 32px |

(필요 시 확장)

### 3-2. Tailwind 매핑

- Tailwind 기본 **spacing scale**을 `space.*`와 동일한 의미로 사용.  
- 신규 값이 필요하면 **theme.extend.spacing**에만 추가.

**사용 규칙**

- padding: `p-4`, `px-6`  
- gap: `gap-4`, `gap-6`  
- margin: `mt-6` 등  

---

## 4) Radius / Shadow Tokens 매핑

### 4-1. Radius 토큰

- **radius**: sm / md / lg / xl / 2xl  

**Tailwind**: `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl`  

### 4-2. Shadow 토큰

- **shadow**: sm / md / lg  

**Tailwind**: `shadow-sm`, `shadow`, `shadow-lg`  

---

## 5) Border Tokens 매핑

- `border.default` = 1px solid var(--neutral-borderBase)  
- `border.strong` = 2px solid …  

**Tailwind**

- `border`, `border-2`  
- 색상: `border-neutral-borderBase`  

---

## 6) Motion Tokens 매핑

### 6-1. duration / easing

| 토큰 | 값 |
|------|-----|
| motion.fast | 80ms |
| motion.base | 150ms |
| motion.slow | 300ms |
| easing.standard | cubic-bezier(…) |

**Tailwind**

- `theme.extend.transitionDuration`  
- `theme.extend.transitionTimingFunction`  

**사용**

- `duration-fast`, `duration-base`, `duration-slow`  
- `ease-standard`  

### 6-2. prefers-reduced-motion

- **원칙**: reduce일 때 transition/animation **제거 또는 최소화**.  
- 모션이 사라져도 **정보 전달은 유지** (텍스트/색 변화).  
- *`BTY_ARENA_STORYBOARD_INTERACTION_FLOW.md` §3과 동일.*

---

## 7) Token 사용 체크리스트 (PR 기준)

- [ ] 컴포넌트에 **HEX/px 직접 입력** 없음  
- [ ] 색상은 **bg/text/border** 클래스만 사용  
- [ ] Typography는 **text-h1 ~ text-button**만 사용  
- [ ] spacing / radius / shadow는 **스케일 내**에서만 사용  
- [ ] 다크모드 컬러는 **CSS 변수**에서만 처리  
- [ ] **prefers-reduced-motion** 고려됨  

---

## 8) 자동생성(후속 단계)로 넘어가는 조건 (Gate)

다음 조건이 충족되면 **“자동 생성 구조”**를 추가한다:

1. **색상 토큰**(Primary/Accent/BG/Text)이 **2주 이상 변경 없음**  
2. **Typography 스케일**이 확정 (H1/H2/Body/Caption/Button)  
3. **spacing 스케일**이 확정 (추가 요청 빈도 낮음)  
4. **Arena/Foundry/Center** 톤이 Figma에서 확정되었고 토큰과 일치  

**Gate 통과 후**

- `tokens.json` → `tailwind.config.ts` 자동 생성 스크립트  
- CI에서 tokens 변경 시 빌드에서 감지  

*(이 단계의 설계/코드는 Gate 통과 후 별도 문서로 진행)*

---

**문서 위치**: `bty-app/docs/BTY_ARENA_DESIGN_TOKEN_TO_TAILWIND_MAPPING_RULES.md`  
**참조**: `BTY_ARENA_DESIGN_TOKENS.md`, `BTY_ARENA_FIGMA_CODE_MAPPING.md` (§4), `BTY_ARENA_FIGMA_NAMING_GUIDE.md` (§6), `BTY_ARENA_STORYBOARD_INTERACTION_FLOW.md` (§3)  
**자동생성 구조**: [Tailwind Config 자동 생성 구조](BTY_ARENA_TAILWIND_CONFIG_AUTOGEN.md)

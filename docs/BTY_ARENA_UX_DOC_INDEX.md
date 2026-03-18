# BTY Arena UX·구현 서류 인덱스 (오늘 배치)

오늘 정리된 문서의 **단일 목차**. Commander·C1~C7이 같은 기준을 보도록 한다.

| 문서 | 용도 |
|------|------|
| [BTY_PRODUCT_DIRECTION_PROMPTS.md](./BTY_PRODUCT_DIRECTION_PROMPTS.md) | 제품 철학·3탑메뉴·톤·Cursor용 방향성 프롬프트 5종 |
| [BTY_PIXEL_WIREFRAMES.md](./BTY_PIXEL_WIREFRAMES.md) | Figma용 텍스트 와이어 + React 프로토타입 참고(§11) |
| [BTY_PAGE_SPLIT_AND_THEME_PROMPT.md](./BTY_PAGE_SPLIT_AND_THEME_PROMPT.md) | **페이지 분리 → 색감** 순서 + 한 방에 돌릴 Cursor 프롬프트 |
| [BTY_PAGE_SPLIT_IMPLEMENTATION_PLAN.md](./BTY_PAGE_SPLIT_IMPLEMENTATION_PLAN.md) | App Router 단계별 실행 계획(Phase 1~5) |
| [BTY_COMPONENT_PROPS_SPEC.md](./BTY_COMPONENT_PROPS_SPEC.md) | 공통 컴포넌트 props 설계 |
| [BTY_TAILWIND_THEME_TOKENS.md](./BTY_TAILWIND_THEME_TOKENS.md) | CSS 변수·Tailwind 매핑·화면별 색 규칙 |
| [BTY_MULTI_CURSOR_DOC_HANDOFF.md](./BTY_MULTI_CURSOR_DOC_HANDOFF.md) | **7 Cursor 역할 분담·실행 순서** |

**실행 원칙:** 구조(라우트·컴포넌트) 먼저, 테마 토큰은 그 다음. 상세는 `BTY_PAGE_SPLIT_AND_THEME_PROMPT.md`.

**Phase 1 구현:** `ScreenShell` + 스텁 라우트. Arena 첫 화면 스텁은 `/[locale]/bty-arena/wireframe` (라이브 플레이는 `/[locale]/bty-arena` 루트). 상세 `BTY_MULTI_CURSOR_DOC_HANDOFF.md` §6.

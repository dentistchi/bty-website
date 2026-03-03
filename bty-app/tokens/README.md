# Design Tokens (단일 소스)

- **source/tokens.json**: 단일 소스. `BTY_ARENA_TAILWIND_AUTOGEN_STRUCTURE.md` 스키마·`BTY_ARENA_DESIGN_TOKENS.md` 값 기준 초안.
- **generated/**: Gate 후 `npm run tokens:build` 실행 시 생성 (css-vars.css, tailwind.tokens.ts). 생성 전까지 비어 있음.
- **scripts/**: Gate 후 validate-tokens.mjs, build-tokens.mjs 추가.

자세한 적용 순서·수동 확장 예시: `docs/BTY_ARENA_DESIGN_TOKEN_TAILWIND_APPLICABILITY.md`.

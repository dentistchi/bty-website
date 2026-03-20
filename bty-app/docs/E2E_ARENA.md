# Arena · Growth · My Page E2E

**전체 운영 기준은 [`BTY_E2E_OPERATIONS_V1.md`](./BTY_E2E_OPERATIONS_V1.md)를 따릅니다.**

**Play 화면 UI 명세 (Cursor 실행용):** [`BTY_ARENA_PLAY_SCREEN_UI_SPEC.md`](./BTY_ARENA_PLAY_SCREEN_UI_SPEC.md)  
**Result/Resolve 화면 UI 명세:** [`BTY_ARENA_RESOLVE_SCREEN_UI_SPEC.md`](./BTY_ARENA_RESOLVE_SCREEN_UI_SPEC.md)  
**Lobby (Mission) 화면 UI 명세:** [`BTY_ARENA_LOBBY_SCREEN_UI_SPEC.md`](./BTY_ARENA_LOBBY_SCREEN_UI_SPEC.md)

요약:

- **Auth storage is local/CI-generated only and must never be committed.**
- 스펙: `e2e/*.spec.ts`, 비인증: `*.public.spec.ts`
- 로컬: `E2E_EMAIL` / `E2E_PASSWORD` / `BASE_URL` (선택)

## 스펙 파일

| 파일 | 프로젝트 |
|------|----------|
| `arena-hub.public.spec.ts` | public |
| `arena-hub.spec.ts` | chromium |
| `arena-play.spec.ts` | chromium |
| `journey.spec.ts` | chromium |
| `journey.spec.ts` (`@comeback-journey`) | chromium-comeback (E2E_COMEBACK_* 필요) |
| `auth-comeback.setup.ts` | setup-comeback |
| `my-page.spec.ts` | chromium |
| `auth.setup.ts` | setup |

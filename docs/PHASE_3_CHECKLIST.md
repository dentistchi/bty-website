# Phase 3 아바타 — 코드 진행 · 에러 테스트 체크리스트

Phase 3(사용자 아바타) 다음에 할 **코드 진행**과 **에러/테스트**를 한 파일에서 관리합니다.  
진행 시 `[ ]` → `[x]` 로 체크하세요.

---

## 1. 코드 진행

| # | 과정 | 설명 | 체크 |
|---|------|------|------|
| 1 | 마이그레이션 적용 | `bty-app/supabase/migrations/20260303000000_arena_profiles_avatar_url.sql` 을 로컬/스테이징 Supabase에 적용 (`supabase db push` 또는 SQL Editor에서 실행). | [x] |
| 2 | 3-2 아바타 생성 플로우 | RPM 2026-01-31 종료로 **Avatar SDK / Loom 등 대안 연동** 필요. iframe 또는 API로 아바타 생성 → 2D URL → `PATCH /api/arena/profile` 저장. | [ ] |
| 3 | (선택) 3-5 리더보드 아바타 | `LeaderboardRow`에 `UserAvatar` 추가. 리더보드 API가 `avatar_url`(또는 avatarUrl) 내려주는지 확인 후, 없으면 API에 필드 추가. | [x] |
| 4 | RPM 대안 검토 | 2026-01-31 RPM 종료 전에 Loom 등 대안 스펙 확인. `PHASE_3_1_AVATAR_SERVICE_SELECTION.md`에 대안·마이그레이션 경로 정리. | [x] |

---

## 2. 에러 / 테스트

**테스트 페이지**:
- **bty-app** (전체 Arena): `/ko/bty/test-avatar` 또는 `/en/bty/test-avatar`
- **bty-website** (Dear Me): `/bty/test-avatar` 또는 `/en/bty/test-avatar` — Arena API 없음, 404 안내만 표시

| # | 과정 | 확인 방법 | 체크 |
|---|------|-----------|------|
| 1 | 마이그레이션 적용 확인 | Supabase에서 `arena_profiles`에 `avatar_url` 컬럼 존재 여부 확인. `select avatar_url from arena_profiles limit 1;` 로 조회 가능한지 확인. | [x] |
| 2 | 대시보드 아바타 렌더 | 로그인 후 `/ko/bty/dashboard`(또는 `/en/bty/dashboard`) 접속. 아바타 없을 때 이니셜/아이콘 폴백이 나오는지, 로딩/에러 없이 표시되는지 확인. *(수동 확인 필요)* | [ ] |
| 3 | core-xp API에 avatarUrl 포함 | `GET /api/arena/core-xp` 호출 시 응답에 `avatarUrl`(null 또는 문자열) 필드가 포함되는지 확인. | [x] |
| 4 | PATCH profile 저장 | `PATCH /api/arena/profile` 에 `{ "avatarUrl": "https://..." }` 로 요청 후 200 + `{ ok: true }` 인지, 대시보드 새로고침 시 이미지 노출 확인. *(수동 확인 필요)* | [ ] |
| 5 | avatarUrl 없음/빈 문자열 | `PATCH` 로 `avatarUrl: null` 또는 `""` 보내서 기존 아바타가 지워지고 폴백만 보이는지 확인. *(수동 확인 필요)* | [ ] |
| 6 | 외부 URL 이미지 | 외부 URL 저장 후 대시보드·프로필에서 이미지가 깨지지 않고 로드되는지 확인 (CORS/도메인 이슈). *(수동 확인 필요)* | [ ] |

---

### 미체크 요약

| 항목 | 상태 | 비고 |
|------|------|------|
| **코드 2** | 보류 | RPM 종료로 Avatar SDK / Loom 등 대안 연동 후 진행 |
| **테스트 2** | 수동 확인 필요 | 대시보드 접속 후 폴백 렌더 확인 |
| **테스트 4~6** | 수동 확인 필요 | `/ko/bty/test-avatar` 페이지에서 PATCH 저장·지우기·picsum URL 테스트 |

---

*상위 문서: `docs/PROJECT_PROGRESS_ORDER.md` § Phase 3*

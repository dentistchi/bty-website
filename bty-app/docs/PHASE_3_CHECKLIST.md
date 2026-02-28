# Phase 3 아바타 — 코드 진행 · 에러 테스트 체크리스트

Phase 3(사용자 아바타) 다음에 할 **코드 진행**과 **에러/테스트**를 한 파일에서 관리합니다.  
진행 시 `[ ]` → `[x]` 로 체크하세요.

**아바타 정책 (보류 정리):** 외부 아바타 서비스(Avatar SDK/Loom 등) 연동은 **보류**. **이니셜**(기본) + **본인이 넣는 이미지**(URL 입력 또는 추후 업로드)로 진행. 요즘 사용자는 핸드폰에서 아바타/사진을 만들 수 있으므로, URL만 넣어도 충분한 경우가 많음.

---

## 1. 코드 진행

| # | 과정 | 설명 | 체크 |
|---|------|------|------|
| 1 | 마이그레이션 적용 | `bty-app/supabase/migrations/20260303000000_arena_profiles_avatar_url.sql` 을 로컬/스테이징 Supabase에 적용 (`supabase db push` 또는 SQL Editor에서 실행). | [x] |
| 2 | 3-2 아바타 이미지 | **보류(서비스 연동).** 이니셜(기본) + **본인 이미지 URL 입력** + **이미지 업로드(Supabase Storage)** UI 추가함. 대시보드 "Avatar" 카드에서 URL 입력·저장·지우기 + "Upload image" (JPEG/PNG/WebP/GIF, 2MB). `PATCH /api/arena/profile`, `POST /api/arena/avatar/upload` 사용. | [x] |
| 2b | Storage avatars 버킷 | `20260304000000_arena_storage_avatars_bucket.sql`: 버킷 `avatars`(public), RLS로 본인 폴더만 업로드/수정/삭제, 공개 읽기. | [x] |
| 3 | (선택) 3-5 리더보드 아바타 | `LeaderboardRow`에 `UserAvatar` 추가. 리더보드 API가 `avatar_url`(또는 avatarUrl) 내려주는지 확인 후, 없으면 API에 필드 추가. | [x] |
| 4 | RPM 대안 검토 | 2026-01-31 RPM 종료 전에 Loom 등 대안 스펙 확인. `PHASE_3_1_AVATAR_SERVICE_SELECTION.md`에 대안·마이그레이션 경로 정리. | [x] |
| 5 | **캐릭터 선택 (Track C)** | `avatar_character_id`, `avatarCharacters.ts`, 대시보드 캐릭터 선택 UI. `CURSOR_TWO_TRACKS_AVATAR.md`. | [x] |
| 6 | **옷 테마·레벨 (Track D)** | `avatar_outfit_theme`, professional/fantasy, `avatarOutfits.ts`, core-xp 최종 avatarUrl 계산, 대시보드 테마 선택 UI. | [x] |
| 7 | **에셋 매니페스트** | 캐릭터 10종(`avatarCharacters.ts`, `public/avatars/`), 옷 13종(Professional 7 + Fantasy 6, `public/avatars/outfits/`), 치과 악세서리 41개 SVG(`avatar-assets.json` `accessories.dental`, `public/avatars/accessories/`) 완료. | [x] |

---

## 2. 에셋 현황 (Phase 3 기준)

| 구분 | 수량 | 상태 | 비고 |
|------|------|------|------|
| 캐릭터 | 10종 | ✅ | `avatarCharacters.ts`, PNG `public/avatars/` |
| 옷 (Professional) | 7종 | ✅ | scrub_general, figs_scrub, doctor_gown, surgery_coat_suit, brand_suit, figs_scrub_short, shorts_tee |
| 옷 (Fantasy) | 6종 | ✅ | apprentice, adventurer, journeyer, warrior_mage_mid, senior, senior_plus (레벨별 6단계)
| 치과 악세서리 | 41개 | ✅ | `accessories.dental` id → SVG `public/avatars/accessories/*.svg` |
| 게임 악세서리 | 33개 | 🔶 | `accessories.game` — 별도 제작 중 |

---

## 3. 에러 / 테스트

**테스트 페이지**:
- **bty-app** (전체 Arena): `/ko/bty/test-avatar` 또는 `/en/bty/test-avatar`
- **bty-website** (Dear Me): `/bty/test-avatar` 또는 `/en/bty/test-avatar` — Arena API 없음, 404 안내만 표시

| # | 과정 | 확인 방법 | 체크 |
|---|------|-----------|------|
| 1 | 마이그레이션 적용 확인 | Supabase에서 `arena_profiles`에 `avatar_url` 컬럼 존재 여부 확인. `select avatar_url from arena_profiles limit 1;` 로 조회 가능한지 확인. | [x] |
| 2 | 대시보드 아바타 렌더 | 로그인 후 `/ko/bty/dashboard`(또는 `/en/bty/dashboard`) 접속. 아바타 없을 때 이니셜/아이콘 폴백이 나오는지, 로딩/에러 없이 표시되는지 확인. *(수동 확인 필요)* | [x] |
| 3 | core-xp API에 avatarUrl 포함 | `GET /api/arena/core-xp` 호출 시 응답에 `avatarUrl`(null 또는 문자열) 필드가 포함되는지 확인. | [x] |
| 4 | PATCH profile 저장 | `PATCH /api/arena/profile` 에 `{ "avatarUrl": "https://..." }` 로 요청 후 200 + `{ ok: true }` 인지, 대시보드 새로고침 시 이미지 노출 확인. *(수동 확인 필요)* | [x] |
| 5 | avatarUrl 없음/빈 문자열 | `PATCH` 로 `avatarUrl: null` 또는 `""` 보내서 기존 아바타가 지워지고 폴백만 보이는지 확인. *(수동 확인 필요)* | [x] |
| 6 | 외부 URL 이미지 | 외부 URL 저장 후 대시보드·프로필에서 이미지가 깨지지 않고 로드되는지 확인 (CORS/도메인 이슈). *(수동 확인 필요)* | [x] |

---

### 미체크 요약

| 항목 | 상태 | 비고 |
|------|------|------|
| — | — | 코드 2는 이니셜 + URL 입력 UI로 완료. 외부 서비스 연동만 보류. |
| **테스트 2** | 완료 | 대시보드 접속 후 폴백 렌더 확인 |
| **테스트 4~6** | 완료 | `/ko/bty/test-avatar` 페이지에서 PATCH 저장·지우기·picsum URL 테스트 |

---

*상위 문서: `docs/PROJECT_PROGRESS_ORDER.md` § Phase 3*

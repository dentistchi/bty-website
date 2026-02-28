# 프로젝트 진행 순서 (새 창에서 참고용)

**이 파일을 새 Cursor 창에서 열어두고**, 어떤 순서로 작업할지 참고하세요.  
태스크 보드는 **`docs/CURSOR_TASK_BOARD.md`** 하나만 사용하고, 그 **표만** 업데이트합니다.

---

## 1. 전체 진행 순서 (한 줄)

| 순서 | 단계 | 요약 |
|------|------|------|
| 0 | **Phase 0** | 랜딩·챗봇·멘토·문서 — ✅ 완료 |
| 1 | **Arena 완성** | 버그 수정, L4·리더보드 시즌·자유 입력 등 — ✅ 완료 |
| 2 | **Phase 1** | 챗봇 Dear Me/Dojo 밸브 + 가이드 캐릭터 통일 — ✅ 완료 |
| 3 | **Phase 2** | Arena 자유 입력 심화 + Dojo/Dear Me XP 연동 — **← 현재** |
| 4 | **Phase 3** | 사용자 아바타 (DB·UI) |
| 5 | **Phase 4·기타** | 아바타와 무관한 다음 단계(코드별 테마, 엘리트 5% 등) 설계·구현 진행 |
| — | **Arena 멤버십·레벨** | ✅ Track A+B 완료: arena_membership_requests·승인·이메일·Admin UI·unlocked-scenarios; 대시보드 ARENA LEVELS 카드·Bar+Steps (`CURSOR_TWO_TRACKS_ARENA.md`) |
| 6 | **Dojo/Dear Me 콘텐츠** | Arena 안정 후 50문항·자존감 훈련 등 채우기 |

---

## 2. 지금 상태 (최근까지)

- **Phase 0·1**: 완료 (랜딩, 챗봇 전역, Dear Me/Dojo 밸브, 가이드 캐릭터 UI, Dr. Chi 멘토).
- **Arena**: L4·리더보드 시즌·자유 입력(free-response API + UI "기타" 제출) 연동 완료.
- **Phase 2**: Arena 자유 입력(2-1~2-3)은 이미 반영됨. **Dojo/Dear Me XP** — 2-4 설계·2-5 구현 모두 반영됨 (스펙: `bty-app/docs/DOJO_DEAR_ME_XP_SPEC.md`, 마이그레이션: `20260229_activity_xp_events.sql`, API: `/api/mentor`, `/api/chat`에서 `recordActivityXp` 호출).
- **Phase 3 아바타**: 캐릭터 10종·옷 13종(Professional 7 + Fantasy 6)·치과 악세서리 41개 에셋 완료; core-xp `currentOutfit`·대시보드 옷/악세서리 라벨 표시 반영. (`bty-app/docs/PHASE_3_CHECKLIST.md`, `ARENA_AVATAR_NEXT_STEPS.md`)

---

## 3. 다음에 진행할 작업 (우선순위)

### Phase 2 — 지금 할 일

| # | 작업 (한 줄) | 담당 타입 | 비고 |
|---|----------------|----------|------|
| 2-4 | **Dojo/Dear Me XP 설계** — 무엇을 기록할지(멘토 대화 1회, 챗 1회, 체류 시간 등), 얼마나 줄지 | Feature / Explore·Plan | ✅ 스펙: `bty-app/docs/DOJO_DEAR_ME_XP_SPEC.md` (이벤트: MENTOR_MESSAGE, CHAT_MESSAGE 각 5 XP, 일일 캡 1,200) |
| 2-5 | **Dojo/Dear Me 이벤트 기록 및 XP 반영** — 이벤트 저장 + weekly_xp 등과 연동 | Feature | ✅ 마이그레이션 `20260229_activity_xp_events.sql`, `recordActivityXp`(active league·Core), `/api/mentor`·`/api/chat` 호출 |

*(Phase 2-1~2-3 Arena 자유 입력 설계·API·UI는 이미 반영됨.)*

### Phase 3 이후

- **Phase 3 — 사용자 아바타**: 아래 표대로 진행. 상세: `bty-app/docs/ROADMAP_NEXT_STEPS.md` § Phase 3, `bty-app/docs/AVATAR_AND_CHARACTER_VISION.md`.

| # | 작업 (한 줄) | 담당 타입 | 비고 |
|---|----------------|----------|------|
| 3-1 | **아바타 서비스 선정** — Ready Player Me / Loom / Meta 등 중 1곳, 2D 먼저 | Explore·Plan | ✅ `bty-app/docs/PHASE_3_1_AVATAR_SERVICE_SELECTION.md` — RPM 권장, 비용·API·다음 단계 정리 |
| 3-2 | **아바타 이미지** — 이니셜(기본) 또는 본인 지정 이미지(URL 입력·추후 업로드) | Feature | **보류.** 외부 서비스 연동 없음. 사용자가 핸드폰 등에서 만든 이미지 URL 저장 가능. `PATCH /api/arena/profile` 구현됨. 필요 시 "URL 입력" 또는 업로드 UI만 추가. |
| 3-3 | **DB에 아바타 URL 저장** — arena_profiles에 avatar_url | Feature | ✅ `20260303000000_arena_profiles_avatar_url.sql`, GET/PATCH `/api/arena/profile`, core-xp에 avatarUrl 포함 |
| 3-4 | **대시보드·Arena·프로필에 아바타 표시** — 공통 UserAvatar, 로그인 사용자 노출 | Feature | ✅ `UserAvatar` 컴포넌트, 대시보드 헤더 노출. 리더보드(3-5)는 선택 |
| 3-5 | **(선택) 리더보드에 아바타 노출** — Code·Sub Name과 함께 표시 | Feature | leaderboard UI |

### Phase 3 다음 과정 — 코드 진행 · 에러 테스트

상세 체크리스트(체크박스 포함): **`bty-app/docs/PHASE_3_CHECKLIST.md`**

| # | 과정 | 설명 |
|---|------|------|
| 1 | 마이그레이션 적용 | `bty-app/supabase/migrations/20260303000000_arena_profiles_avatar_url.sql` 을 로컬/스테이징 Supabase에 적용 (`supabase db push` 또는 SQL Editor에서 실행). |
| 2 | 3-2 아바타 생성 플로우 | RPM Studio 접근 가능해지면: Avatar Creator iframe 페이지 추가 → postMessage로 avatarId 수신 → 2D URL 생성 후 `PATCH /api/arena/profile` 로 저장. (RPM 응답 대기 중이면 보류) |
| 3 | (선택) 3-5 리더보드 아바타 | `LeaderboardRow`에 `UserAvatar` 추가. 리더보드 API가 `avatar_url`(또는 avatarUrl) 내려주는지 확인 후, 없으면 API에 필드 추가. |
| 4 | RPM 대안 검토 | 2026-01-31 RPM 종료 전에 Loom 등 대안 스펙 확인. `PHASE_3_1_AVATAR_SERVICE_SELECTION.md`에 대안·마이그레이션 경로 정리. |

**에러 / 테스트** (확인 순서)

| # | 과정 | 확인 방법 |
|---|------|-----------|
| 1 | 마이그레이션 적용 확인 | Supabase에서 `arena_profiles`에 `avatar_url` 컬럼 존재 여부 확인. `select avatar_url from arena_profiles limit 1;` 로 조회 가능한지 확인. |
| 2 | 대시보드 아바타 렌더 | 로그인 후 `/ko/bty/dashboard`(또는 `/en/bty/dashboard`) 접속. 아바타 없을 때 이니셜/아이콘 폴백이 나오는지, 로딩/에러 없이 표시되는지 확인. |
| 3 | core-xp API에 avatarUrl 포함 | `GET /api/arena/core-xp` 호출 시 응답에 `avatarUrl`(null 또는 문자열) 필드가 포함되는지 확인. |
| 4 | PATCH profile 저장 | `PATCH /api/arena/profile` 에 `{ "avatarUrl": "https://models.readyplayer.me/xxxxx.png?size=256" }` 로 요청 후 200 + `{ ok: true }` 인지, 대시보드 새로고침 시 해당 이미지가 나오는지 확인. |
| 5 | avatarUrl 없음/빈 문자열 | `PATCH` 로 `avatarUrl: null` 또는 `""` 보내서 기존 아바타가 지워지고 폴백만 보이는지 확인. |
| 6 | 외부 URL 이미지 | `avatarUrl`에 Ready Player Me 등 외부 URL 저장 후 대시보드·프로필에서 이미지가 깨지지 않고 로드되는지 확인 (CORS/이미지 도메인 이슈 여부). |

---

- **Phase 4·기타**: 아바타와 무관한 다음 단계 — 코드별 테마, 엘리트 5% 등 설계·구현 진행.

---

## 4. 사용 방법

1. **새 Cursor 창**을 열고 이 파일(`docs/PROJECT_PROGRESS_ORDER.md`)을 열어둔다.
2. **할 일**을 정하면 **`docs/CURSOR_TASK_BOARD.md`**를 열고, **현재 작업 표**에 한 줄 추가한다 (Cursor 타입, 할 일, 상태).
3. 해당 타입 창(Feature / Fix·Polish / Explore·Plan)에서 그 할 일을 지시하고, 끝나면 보드에서 해당 행만 **완료**로 바꾼다.
4. **다른 보드 파일은 만들지 않고**, `docs/CURSOR_TASK_BOARD.md`의 **표만** 업데이트한다.

---

*로드맵 상세: `bty-app/docs/ROADMAP_NEXT_STEPS.md`*

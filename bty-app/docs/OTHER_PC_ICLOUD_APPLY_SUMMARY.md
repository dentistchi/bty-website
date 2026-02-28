# 다른 PC / iCloud 작업 정리 — 이 Mac 기준

**목적:** 다른 컴퓨터에서 하던 작업을 iCloud에서 이쪽으로 옮겨와 마무리·적용하라는 요청에 맞춰, **지금 이 Mac에 있는 상태**를 기준으로 정리한 문서입니다.

---

## 1. 다른 컴퓨터에서 한 작업 (문서·커밋 기준)

### 이미 원격에 반영된 커밋 (다른 PC에서 푸시한 것 포함)

- **`ab54304`** — `chore: 다른 PC 이어하기 — 리더보드 UI·태스크보드 색상·complete-notify·문서·HANDOFF 갱신`
  - 리더보드 locale(한/영), 내 순위 강조, notOnBoard 메시지 등
  - 태스크 보드 상태 색상 (대기=빨강, 진행=녹색, 완료=파랑)
  - `.cursor/rules/complete-notify.mdc` 등 문서·HANDOFF 갱신
- **`2f64e3f`** — Phase 1-3/1-4 가이드 캐릭터, Arena free-response, 챗/멘토 XP, 문서 정리
- 그 이전: OAuth/세션, 대시보드, Arena 7단계 등

### iCloud 문서에서 정리된 "이미 적용한 것"

- **챗·멘토 모두 OpenAI만 사용** — 멘토 API에서 Gemini 제거, `.env.local`에는 `OPENAI_API_KEY`만 있으면 됨 (`docs/ICLOUD_AND_CURRENT_STATE.md`에 "적용함" 기록).

---

## 2. iCloud와 "어디서 만든 파일인지"

- 두 Mac이 **같은 폴더를 iCloud로 공유**하므로, **마지막에 저장한 쪽**이 현재 보이는 내용입니다.
- **"이 파일만 다른 Mac 것이다"**라고 구분하는 것은 **불가능**합니다.  
  → **지금 이 Mac 폴더에 보이는 내용 = iCloud 기준 최종 반영 상태**로 보면 됩니다.
- 따라서 "그곳에서 이곳으로 옮긴다"는 것은, **이미 iCloud 동기화로 이 Mac에 반영된 상태를 기준으로 작업을 마무리·커밋·배포하는 것**으로 이해하면 됩니다.

---

## 3. 배포 실패에 대해

- **#254 (c5c2747), #253 (4e52fc2)** — Cloudflare Workers(OpenNext) 배포 실패로 문서에 기록돼 있음.
- main 푸시 시 **CI/CD가 자동으로 배포를 트리거**하는 구조일 가능성이 큽니다.
- 배포 실패 원인은 **빌드/환경 이슈**일 수 있으므로, "작업 마무리·적용"과는 별도로 다음을 권장합니다.
  - 로컬에서 `cd bty-app && npm run build` 로 빌드 성공 여부 확인
  - 필요 시 main 푸시 시 자동 배포를 끄거나, 배포 전에 로컬/스테이징에서만 확인하도록 설정 검토

---

## 4. 지금 이 Mac에만 있는 변경 (커밋 안 된 것) — "적용해달라"고 한 작업 후보

아래는 **현재 워킹 트리에만 있고 커밋되지 않은** 변경입니다.  
iCloud로 동기화된 "다른 PC에서 하던 작업"이 섞여 있을 수 있고, 이걸 **마무리·적용** 대상으로 보면 됩니다.

### 삭제된 파일

| 경로 | 비고 |
|------|------|
| `.cursor/rules/complete-notify.mdc` | 규칙 정리로 삭제된 것으로 추정 |
| `.cursor/rules/deploy-without-approval.mdc` | |
| `.cursor/rules/task-board-behavior.mdc` | |
| `bty-app/src/app/api/admin/arena/l4-access/route.ts` | Admin L4 API 제거 |

### 수정된 파일 (주요)

| 경로 | 내용 요약 |
|------|-----------|
| `bty-app/src/app/api/auth/callback/route.ts` | **OAuth 세션 유지 수정** — `createServerClient` + 쿠키 캡처 → `writeSupabaseAuthCookies`, locale 리다이렉트 (`/en/bty/login` 등). `AUTH_STABILIZATION.md` 제안안과 일치. |
| `bty-app/src/app/[locale]/bty/(protected)/dashboard/page.client.tsx` | 대시보드 UI 변경 (약 198줄 차이) |
| `bty-app/src/app/api/arena/run/complete/route.ts` | Arena run complete API 변경 |
| `bty-app/src/app/api/arena/unlocked-scenarios/route.ts` | 언락 시나리오 API 변경 |
| `bty-app/src/components/bty-arena/index.ts` | Arena 컴포넌트 export 등 |
| `bty-app/src/lib/bty/chat/chatGuards.ts` | 챗 가드 정리 (13줄 삭제) |
| `docs/CURSOR_SETUP_BY_TYPE.md`, `docs/MULTI_CURSOR_WORKFLOW.md` | 문서 수정 |
| `package.json`, `package-lock.json` | 의존성 변경 (lock 대량 추가) |

### 새로 추가된 파일/디렉터리 (추적 안 됨)

- **Cursor 규칙:**  
  `bty-arena-data.mdc`, `bty-arena-global.mdc`, `bty-auth-deploy-safety.mdc`, `bty-domain-pure-only.mdc`, `bty-release-gate.mdc`, `bty-ui-render-only.mdc`
- **Cursor:** `.cursor/agents/`, `.cursor/skills/`
- **Arena/도메인:**  
  `bty-app/src/domain/`, `bty-app/src/lib/bty/arena/domain.ts`,  
  `LeaderboardRow.tsx`, `ProgressCard.tsx`, `ProgressVisual.tsx`
- **문서:**  
  `bty-app/docs/ARENA_DB_SCHEMA.md`, `bty-app/docs/AUTH_STABILIZATION.md`
- **콘텐츠·DB:**  
  `bty-app/src/content/arena-mvp-content-pack.json`,  
  `bty-app/supabase/migrations/20260301000000_arena_league_season_schema.sql`,  
  `bty-app/supabase/migrations/20260302000000_arena_ledgers_memberships_snapshots.sql`
- **기타:** `docs/content/`, `docs/spec/`, 루트 `src/domain/`, `src/engine/`, `vitest.config.ts`

---

## 5. "작업 마무리하고 적용"하기 — 권장 순서

1. **현재 변경 검토**  
   - 위 목록 기준으로, 의도한 "다른 PC에서 하던 작업"이 모두 들어가 있는지 확인.
2. **빌드·테스트**  
   - `cd bty-app && npm install && npm run build`  
   - 로컬에서 로그인/로그아웃, Arena, 리더보드 등 한 번씩 확인 (선택).
3. **커밋·푸시**  
   - 검토가 끝나면:
     ```bash
     cd /Users/hanbit/Documents/web_development/btytrainingcenter
     git add -A
     git status   # 삭제/수정/추가 재확인
     git commit -m "chore: 다른 PC/iCloud 작업 반영 — auth callback, Arena 도메인·UI, 규칙·문서·마이그레이션"
     git push origin main
     ```
   - 커밋 메시지는 실제 변경 내용에 맞게 수정해도 됩니다.
4. **배포**  
   - 자동 배포가 켜져 있으면 push 후 다시 배포가 돌 수 있음.  
   - 실패 시 로컬 빌드 로그와 CI 로그를 보고 OpenNext/Cloudflare 설정을 점검.

---

## 6. 참고 문서

- **`bty-app/docs/ICLOUD_AND_CURRENT_STATE.md`** — iCloud 동기화·배포 실패·멘토 OpenAI 적용 정리.
- **`bty-app/docs/HANDOFF_OTHER_PC.md`** — 다른 PC에서 이어할 때 체크리스트.
- **`bty-app/docs/AUTH_STABILIZATION.md`** — OAuth 콜백 수정 제안 및 검증 체크리스트.

이 문서는 "다른 컴퓨터에서 작업한 걸 iCloud에서 이쪽으로 옮겨와 마무리·적용해달라"는 요청에 맞춰, **현재 이 Mac 상태를 기준으로** 찾아본 결과입니다.

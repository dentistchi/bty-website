# Admin Debug / Quality 현황 (확인 결과)

배포 URL: https://bty-website.ywamer2022.workers.dev  
로그인 후 `/en/admin/debug`, `/en/admin/quality` 로 이동하는 구조입니다.

---

## 1. Admin Debug (`/admin/debug`)

**의도:** 디버깅용 사이트. MVP가 내용을 남기면 그걸 바탕으로 디버깅·업그레이드하는 시스템.

**현재 bty-app 구현:**

| 항목 | 상태 |
|------|------|
| 로그인 테스트 (이메일/비밀번호) | ✅ 있음 |
| 세션 확인 (토큰 기반) | ✅ 있음 |
| 디버깅 팁 (Network/Console/localStorage) | ✅ 있음 |
| **MVP가 내용을 남기는 기능** | ❌ **없음** |
| MVP 메모/피드백 저장·조회 | ❌ 없음 |
| 그 내용으로 디버깅·업그레이드하는 플로우 | ❌ 없음 |

**파일:** `bty-app/src/app/[locale]/admin/debug/page.tsx`  
→ MVP 메모/피드백 폼, 저장 API, 목록/상세 조회 등은 아직 없습니다.

---

## 2. Admin Quality (`/admin/quality`)

**의도:** 챗봇/멘토 에러를 기록하고, quality 이벤트를 모아 패치 초안을 자동 생성·배포.

**현재 bty-app 구현:**

| 항목 | 상태 |
|------|------|
| Quality 대시보드 UI (요약/트렌드/패치 목록 등) | 스텁만 (프론트는 추후 연동 가능) |
| `/api/admin/quality/[[...path]]` (summary, trends, health, seed, event) | ✅ **프록시 있음** — `requireAdminEmail` + `NEXT_PUBLIC_BTY_AI_URL` + `ADMIN_API_KEY` |
| 챗봇/멘토 응답 시 quality 이벤트 기록 | ✅ **있음** — fallback/empty/error 시 bty-ai-core `POST /api/quality/event` 로 전송 (`route: "app"`) |
| Rate limiting (`/api/chat`, `/api/mentor`) | ✅ **분당 60회/IP** (429 + Retry-After) |
| 에러 로깅 (500/4xx) | ✅ `logApiError(route, status, err)` 사용 |
| API 테스트 | ✅ Vitest — `src/app/api/chat/route.test.ts`, `src/app/api/mentor/route.test.ts` (mode/lang별) |

**bty-app의 챗봇·멘토:**

- `bty-app/src/app/api/chat/route.ts` → OpenAI 호출, fallback/empty/error 시 `recordQualityEventApp()` 호출 (fire-and-forget)
- `bty-app/src/app/api/mentor/route.ts` → 동일
- `bty-app/src/lib/bty/quality.ts` → `recordQualityEventApp()` — bty-ai-core `POST /api/quality/event` 호출 (ADMIN_API_KEY 필요)

**bty-ai-core:** `POST /api/quality/event` 추가됨. body: `role`, `intent`, `issues`, `severity`, `route` ("app"|"web"|"teams"), `css_score`, `model_version`. Admin 인증은 `x-admin-api-key`.

---

## 3. Quality + 패치가 구현된 쪽 (bty-website + bty-ai-core)

다음 구조는 **bty-website**와 **bty-ai-core**에만 있습니다.

| 구성요소 | 위치 | 설명 |
|----------|------|------|
| Quality 이벤트 기록 | `bty-ai-core` `qualityEvents.ts` | Self-critic 실패 시 `recordQualityEvent()` → DB `bty_quality_events` |
| 채팅 엔진에서 기록 | `bty-ai-core` `aiEngine.ts` | `generateMaturityReply` 내 critic 실패 시 `recordQualityEvent()` 호출 |
| Quality API | `bty-ai-core` `/api/quality/*` | summary, trends, health, seed |
| Patch 생성 | `bty-ai-core` `patchGenerator.ts` | quality 이벤트 집계 → GPT로 rule_patches 등 생성 |
| Patch API | `bty-ai-core` `/api/patch/*` | generate, latest, recent, apply |
| Admin Quality 페이지 | `bty-website/bty-app` `admin/quality/page.tsx` | KPI, 트렌드, 패치 리포트 카드, health, seed |
| Admin Quality/Patch 프록시 | `bty-website/bty-app` `api/admin/quality/[[...path]]`, `api/admin/patch/[[...path]]` | `NEXT_PUBLIC_BTY_AI_URL` + `ADMIN_API_KEY`로 bty-ai-core로 프록시 |
| 주간 패치 타이머 | `bty-website/bty-patch-timer` `WeeklyPatchTimer.ts` | Azure Functions, 매주 월요일 8시 → `generatePatchSuggestions("7d")` → Teams 알림 (TEAMS_ADMIN_URL으로 admin/quality 링크) |

즉, **에러 기록 → Quality 대시보드 → 패치 자동 생성·알림** 파이프라인은 **bty-website + bty-ai-core** 기준으로만 연결되어 있습니다.

---

## 4. 정리 및 권장 사항

1. **Admin Debug**
   - 현재: 로그인/세션 테스트만 가능.
   - “MVP가 내용을 남기면 디버깅·업그레이드”를 하려면:
     - MVP용 메모/피드백 입력 폼
     - 저장용 API 및 DB(또는 Supabase 등) 테이블
     - Admin에서 해당 내용 조회·필터·상태 관리
     - 필요 시 이슈/디버깅 태그와 연동  
   위 요소들이 추가로 필요합니다.

2. **Admin Quality + 챗봇/멘토 에러 기록**
   - 현재 배포(bty-app)에는 quality/패치 API와 이벤트 기록이 없음.
   - 옵션 A: **bty-app에 quality·patch 연동 추가**
     - `bty-app`에 `/api/admin/quality/[[...path]]`, `/api/admin/patch/[[...path]]` 프록시 추가 (bty-website와 동일하게 `BTY_AI_URL` + `ADMIN_API_KEY`).
     - 챗봇/멘토 API에서 응답 품질 실패 시 bty-ai-core의 quality API로 이벤트 전송하는 로직 추가 (또는 bty-ai-core를 호출하는 구조로 통일).
     - `admin/quality` 페이지를 bty-website처럼 summary/trends/health/patches 를 쓰도록 교체.
   - 옵션 B: **배포를 bty-website 앱으로 통일**
     - workers.dev를 bty-website 기반으로 배포하면, 이미 구현된 quality·패치 플로우를 그대로 사용 가능. (이 경우 bty-app의 admin/quality는 사용하지 않음.)

3. **패치 “자동 배포”**
   - 현재: 패치 **초안 생성** + Teams 알림까지가 자동(WeeklyPatchTimer).
   - “배포” 자체(예: 코드/설정 반영, 재배포 트리거)는 **자동화되어 있지 않음**. Admin Quality에서 패치 보고를 보고 사람이 적용·배포하는 구조로 보입니다. 완전 자동 배포를 원하면 배포 파이프라인(예: GitHub Actions 등)과의 연동이 추가로 필요합니다.

---

## 5. 구현 완료 (MVP 에러 제보 + 교정·패치 배포 연동)

- **DB**: `supabase/migrations/20260220_mvp_debug_reports.sql` — `mvp_debug_reports` 테이블 (RLS: 로그인 사용자 조회/본인 제보만 insert/누구나 update).
- **API**
  - `POST /api/admin/debug/reports` — 에러 제보 (title 필수, description, route, context 선택).
  - `GET /api/admin/debug/reports?status=open|resolved` — 목록 (전체/미해결/해결됨).
  - `PATCH /api/admin/debug/reports/[id]` — 교정 완료 (status=resolved, resolution_note, resolved_at/resolved_by).
  - `POST /api/admin/debug/patch-deploy` — 패치 생성(bty-ai-core `/api/patch/generate`) + 배포 웹훅 호출.
- **디버그 페이지** (`/admin/debug`): 에러 제보 폼, 제보 목록(필터·교정 완료 버튼), 「패치 생성 및 배포」 버튼.
- **환경 변수**
  - `NEXT_PUBLIC_BTY_AI_URL`, `ADMIN_API_KEY`: bty-ai-core 연동 시 패치 생성 호출.
  - `DEPLOY_WEBHOOK_URL`: 클릭 시 배포 트리거 (예: Cloudflare Pages Deploy Hook URL). 설정 시 실제 배포 실행.

마이그레이션 적용: Supabase 대시보드에서 SQL 실행 또는 `supabase db push` 등으로 `20260220_mvp_debug_reports.sql` 적용.

이 문서는 2025-02 기준 코드베이스 확인 결과를 바탕으로 작성되었습니다.

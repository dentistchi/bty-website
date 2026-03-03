# Cursor 태스크 보드 (공동) — 우선순위 자동결정

**단일 진실**: 이 표 + `docs/CURRENT_TASK.md` 1줄. First Task 완료 전 다음 Task 시작 불가(Start Trigger 잠금).  
**우선순위 규칙**: 1) Auth/Redirect/Session 2) API Contract 3) Domain/Engine 4) UI 5) 문서.

---

## First Task (1개만)

**미들웨어: 인증된 사용자 `/bty/login` 접근 시 `/${locale}/bty`로 리다이렉트 (Center CTA 재로그인 버그 제거).**

- **근거 1**: `src/middleware.ts`는 bty-auth-deploy-safety 적용 파일 → Priority Rule 1순위.
- **근거 2**: 현재 `isPublicPath`에 `/${locale}/bty/login` 포함되어 인증 여부 무관 접근 가능; 인증 사용자가 CTA로 `/bty/login` 갈 때 재로그인 유도 제거하려면 미들웨어에서 user 존재 시 login → /bty 리다이렉트 필요.

---

## 현재 작업 (배치 단위 · C1~C5)

| 역할 | 상태 | 변경 범위 | Start Trigger | Exit Criteria |
|------|------|-----------|---------------|---------------|
| **C1 Commander** | [ ] | `docs/CURRENT_TASK.md`, `docs/CURSOR_TASK_BOARD.md`, `docs/EXECUTION_PLAN.md` | [ ] (항상) | [ ] 목표 1줄 존재 [ ] 보드 C1~C5·Start/Exit 존재 [ ] EXECUTION_PLAN 존재 |
| **C2 Gatekeeper** | [x] | `.cursor/rules/`, `docs/BTY_RELEASE_GATE_CHECK.md` | [ ] C1 Exit 모두 체크 | [x] Center Gate A·Auth Safety·F 체크 완료 [x] BTY_RELEASE_GATE_CHECK.md에 PASS/FAIL·위반 목록 반영 (결과: FAIL, 위반 1건 — C3 패치 후 재검사) |
| **C3 Domain/API** | [ ] | `src/middleware.ts`, `src/app/api/center/**`, `src/domain/`, `src/lib/bty/` | [ ] C1 Exit 모두 체크 | [ ] 인증 user + `/bty/login` 요청 → `/${locale}/bty` 리다이렉트 [ ] `npm test` 통과 |
| **C4 UI** | [ ] | `src/app/[locale]/center/**`, Center `src/components/**`, `src/lib/i18n.ts` | [ ] C1 Exit [ ] C3 Exit (CTA 링크는 C3 리다이렉트 적용 후에도 `/bty` 권장) | [ ] CTA href=`/${locale}/bty` [ ] `npm run lint` 통과 |
| **C5 Integrator** | [ ] | 전체(검증만) | [ ] C2 Exit [ ] C3 Exit [ ] C4 Exit | [ ] `npm run lint` 통과 [ ] `npm test` 통과 [ ] `npm run build` 통과 |

**진행 정책**: 기능 작업(C3/C4)은 병렬 OK. 통합 게이트(C5)는 하루에 1~2번만, **lint가 고쳐진 뒤에만** 돌린다.

**현재 상태**:
- C3: 진행(병렬)
- C4: 진행(병렬)
- C5: **BLOCKED by LINT**

---

## C2~C5 붙여넣을 1줄 명령어 (4개)

| 커서 | 1줄 명령어 |
|------|------------|
| **C2** | `docs/CURSOR_TASK_BOARD.md C2 체크리스트대로 .cursor/rules·BTY_RELEASE_GATE_CHECK.md 대조 후 Center Gate(A·Auth Safety·F) 결과 PASS/FAIL·위반 목록 docs/BTY_RELEASE_GATE_CHECK.md에 반영하고 Exit 체크.` |
| **C3** | `src/middleware.ts에서 인증된 user가 /${locale}/bty/login 요청 시 ${locale}/bty로 302 리다이렉트 추가. 쿠키 설정 변경 금지. npm test 통과 후 Exit 체크.` |
| **C4** | `Center CTA 링크를 /${locale}/bty로 통일. docs/CENTER_PAGE_IMPROVEMENT_SPEC §5·§6·§3·§2·§4·§7·§1·§8 반영 render-only. npm run lint 통과 후 Exit 체크.` |
| **C5** | `C2·C3·C4 Exit 모두 체크 확인 후 npm run lint && npm test && npm run build 실행. 실패 시 C3 또는 C4에 넘김. 성공 시 아래 C5 실행 커맨드 1줄 실행.` |

---

## C5 실행 커맨드 (1줄)

```bash
./scripts/orchestrate.sh
```

(`orchestrate.sh` 없으면 `./scripts/ci-gate.sh`.)

**옵션 (workers 검증)**:
`BASE="https://..." LOGIN_BODY='{"email":"...","password":"..."}' ./scripts/orchestrate.sh`

---

## C2 체크리스트 (Center)

| 구분 | 체크 |
|------|------|
| A | 쿠키 설정 변경 없음. 미들웨어 리다이렉트만. |
| Auth Safety | 인증 user + /bty/login → /bty 리다이렉트. How to verify: 로컬 로그인 → Center CTA → /bty 직행. |
| F | 로컬: 로그인→CTA→/bty. Preview: 세션 유지. Prod: 401 없음. |

---

## C2 Gatekeeper 체크리스트 (Center 프로젝트)

Center 변경분은 **§5 CTA·재로그인**만 Auth/경로를 건드리므로 아래만 점검. (B~E: XP/시즌/리더보드/마이그레이션 미접촉 → N/A.)

| 구분 | 체크 항목 | 질문/포인트 |
|------|-----------|-------------|
| **A** | Auth/Cookies/Session | 쿠키 설정 변경 여부? (없으면 기존 BTY_RELEASE_GATE_CHECK 결과 유지.) CTA/미들웨어에서 쿠키 읽기만 하고 설정은 기존 auth 모듈 그대로? |
| **Auth Safety** | CTA·재로그인 경로 | CTA 클릭 시 `/bty/login`이 아닌 `/bty`(또는 보호된 경로)로 직행하는가? 미들웨어에서 인증된 사용자 리다이렉트만 수정했는가? |
| **F** | Verification Steps | 1) 로컬: 로그인 → Center CTA 클릭 → /bty 이동·재로그인 없음. 2) Preview: 로그인 유지. 3) Prod: 쿠키·401 루프 없음. |

**C2 실행**: 위 표 대조 후 `docs/BTY_RELEASE_GATE_CHECK.md`에 "Center 프로젝트" Gate 결과(PASS/FAIL + 위반 목록) 반영.

---

## Gate Report (Center)

- Release Gate: CTA/재로그인 시 A) Auth/Cookies, F) Verification Steps. B~E 생략 가능.
- Auth Safety: "How to verify: 로컬 Center CTA 클릭 → /bty 이동·재로그인 없음" 1줄.

---

## 작업 후 문서 갱신 체크리스트

- [ ] `docs/CURRENT_TASK.md` — 이번 작업 상태/완료 1줄
- [ ] `docs/CURSOR_TASK_BOARD.md` — 위 표 [ ] → [x]
- [ ] `docs/CENTER_PAGE_IMPROVEMENT_SPEC.md` — § 완료 이력
- [ ] `docs/PROJECT_BACKLOG.md` §10 — Center [x] (전체 완료 시)

---

## C5 실행 커맨드 (1줄)

```bash
./scripts/orchestrate.sh
```

**옵션 (workers 검증 시)**:

```bash
BASE="https://bty-website.YOUR_SUBDOMAIN.workers.dev" LOGIN_BODY='{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}' ./scripts/orchestrate.sh
```

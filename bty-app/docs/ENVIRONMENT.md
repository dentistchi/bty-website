# Environment Variables (Single Source of Truth)

이 문서는 BTY Website/BTY Arena가 기대하는 환경변수의 **단일 목록**이다.

---

## 1) Required (Build & Runtime)

### Public (브라우저로 노출됨)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

> `scripts/check-env.mjs`가 위 2개 존재 여부를 검사하는 구조라면, CI/배포에서 반드시 주입되어야 한다.

---

## 2) Optional (권장/기능별)

### Supabase (서버 전용 — 사용 시에만)
- `SUPABASE_SERVICE_ROLE_KEY`
  - 서버에서 "관리 권한"이 필요한 작업이 있을 때만 사용
  - 일반 로그인/세션용으로는 사용하지 않는 것을 기본으로 유지

---

## 3) Where to set (권장 운영)

### GitHub Actions
- Repository Secrets / Variables로 주입
- Cloudflare deploy step에서 Workers 환경변수로 전달되도록 설정(프로젝트 구성에 따름)

### Cloudflare Workers
- Worker 환경변수(Production/Preview 분리 가능)
- 값 변경 시: "새 배포 이후에만" 반영되는지(캐시/미스매치) 확인

---

## 4) Debug checklist

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` 미주입:
  - `npm run build` 또는 check-env 단계에서 실패 가능
- 로그인 관련 이슈:
  - 먼저 `/api/auth/session`에서 request cookie 유무 / status / body 확인

---

## 5) 다른 PC에서 같은 Supabase(같은 DB) 쓰기

앱이 **어느 Supabase 프로젝트**를 볼지는 **환경 변수**로만 결정된다.  
리포 안의 “supabase 설정 파일”로 프로젝트를 바꾸는 구조가 아니다.

- **사용하는 환경 변수**
  - `NEXT_PUBLIC_SUPABASE_URL` — 프로젝트 URL (예: `https://xxxx.supabase.co`)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon key
  - `SUPABASE_SERVICE_ROLE_KEY` — 서버 전용 (선택, 일부 API용)

- **다른 PC에서 내용이 다르게 보일 때**
  - 그 PC에서 **같은 프로젝트**를 쓰려면, **이 PC와 동일한 값**을 넣어야 한다.
  - 방법 1: 이 PC의 `bty-app/.env.local`(또는 `.env`) 내용을 그 PC로 복사해서 `bty-app/.env.local`에 넣기.
  - 방법 2: Supabase Dashboard → 프로젝트 선택 → Settings → API에서 URL / anon key / service_role key를 복사해 그 PC의 `bty-app/.env.local`에 넣기.

- **주의**
  - `.env.local`은 보통 git에 올리지 않으므로, 복사는 수동으로 하거나 비밀번호 관리 도구로 동기화한다.
  - Supabase CLI(`supabase link`, `db push`)는 **PC별로** 링크된 프로젝트가 따로 있을 수 있다. CLI로 마이그레이션만 할 때만 영향 있고, **앱이 어떤 DB를 보는지는 .env 값만** 보면 된다.

---

## 6) .env.local 한 번만 채우기 (체크리스트)

`bty-app/.env.local`에 아래 변수들을 **한 번만** 넣어두면, 앱이 런타임에 다시 묻지 않는다.  
값은 Azure Portal / OpenAI 대시보드 / Supabase 등에서 복사해 넣으면 된다. (이 문서에는 값 예시만 적고, 실제 키는 직접 입력.)

| 변수명 | 어디서 복사 | 비고 |
|--------|-------------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | service_role (서버용) |
| `OPENAI_API_KEY` | OpenAI API keys 페이지 | 채팅 AI용 |
| `GEMINI_API_KEY` | Google AI Studio | Safe Mirror용 (없으면 폴백) |
| `AZURE_AD_CLIENT_ID` | Azure Portal → 앱 등록 | Admin 대시보드 로그인 |
| `AZURE_AD_CLIENT_SECRET` | Azure Portal → 인증서 및 비밀 | 위와 쌍 |
| `AZURE_AD_TENANT_ID` | Azure Portal → 앱 등록 / 디렉터리 | 테넌트 ID |
| `NEXTAUTH_URL` | 사용하는 앱 URL (예: `http://localhost:3001`) | |
| `NEXTAUTH_SECRET` | 임의 문자열 (예: `openssl rand -base64 32`) | |
| `JWT_SECRET` | 임의 문자열 | |
| `ADMIN_API_KEY` | 자체 정한 관리용 시크릿 (선택) | |
| `BTY_ADMIN_EMAILS` | Admin 권한 줄 이메일 (쉼표 구분) | |

**멤버십 승인 알림 이메일** (Arena 가입 요청 시 Admin에게 발송):

| 변수명 | 어디서 복사 | 비고 |
|--------|-------------|------|
| `RESEND_API_KEY` | [Resend](https://resend.com) 가입 → API Keys | 없으면 이메일 대신 서버 로그만 출력 |
| `RESEND_FROM` | Resend에서 발신 도메인 인증 후 (예: `Arena <noreply@yourdomain.com>`) | 없으면 `onboarding@resend.dev` 사용 |

수신 주소는 `BTY_ADMIN_EMAILS`의 첫 번째 이메일을 사용합니다. (없으면 기본 ddshanbit@gmail.com)

**Resend 무료 한도:** `onboarding@resend.dev`로 보낼 때는 **Resend 가입 시 쓴 이메일로만** 발송 가능합니다. 다른 Admin 주소로 받으려면 Resend에서 **자기 도메인을 인증**하고 `RESEND_FROM`을 그 도메인으로 설정하세요. (예: `Arena <noreply@yourdomain.com>`)

**비밀번호 재설정:** 로그인 화면 "비밀번호 찾기" 사용 시, Supabase Dashboard → Authentication → URL Configuration → Redirect URLs에 `https://yourdomain.com/en/auth/reset-password`, `https://yourdomain.com/ko/auth/reset-password` (로컬은 `http://localhost:3001/...`) 를 추가해야 합니다.  
**리셋 링크를 눌렀을 때 재설정 폼 대신 메인 사이트로 바로 들어간다면** → Supabase에서 리셋 메일의 이동 주소가 재설정 페이지로 안 잡혀 있는 경우입니다. Redirect URLs에 위 주소가 **정확히** 들어가 있는지, 그리고 "Site URL"이 재설정 페이지가 아닌 앱 루트(예: `https://yourdomain.com`)인지 확인하세요.

다른 PC에서도 같은 환경을 쓰려면, 이 PC의 `.env.local` 내용을 그 PC로 복사하면 된다. (git에는 올라가지 않으므로 수동/비밀번호 관리자로 공유.)

# 리더보드에서 아바타가 안 보일 때 (대시보드에는 보임)

**요약:** 리더보드 API는 **Storage 아바타 URL을 앱 프록시 URL**(`/api/arena/avatar?userId=xxx`)로 치환해 반환합니다. 프론트는 같은 오리진으로 이미지를 요청하므로 **Storage CORS 설정 없이** 리더보드에서 아바타가 로드됩니다.  
Supabase 대시보드에는 Storage 전용 CORS 메뉴가 없고, Settings → API의 Allowed Origins는 PostgREST/Auth용이라 Storage에는 적용되지 않을 수 있음. CLI로 CORS를 설정하려면 아래 "방법 1" 참고.

---

아바타 이미지는 **Supabase Storage**의 `avatars` 버킷에 있고, URL 형식은 다음과 같습니다.

```
https://[project-ref].supabase.co/storage/v1/object/public/avatars/[user-id]/avatar.png
```

대시보드에서는 보이는데 **리더보드에서만** 깨지거나 이니셜로 나온다면, 보통 **요청이 나가는 도메인(Origin)** 이 다르기 때문입니다.

## 원인

- **대시보드**: 같은 도메인(예: localhost 또는 배포 URL)에서 `<img src="...supabase.../avatar.png">` 로 요청 → Supabase가 허용.
- **리더보드**: Cloudflare Workers 등 **다른 도메인**에서 같은 URL로 요청하면, Supabase Storage의 **CORS / Referer** 설정에 따라 차단될 수 있음.

즉, `public/avatars` 폴더나 앱 정적 자산과는 무관하고, **Supabase Storage가 배포 도메인에서 오는 요청을 허용하는지**가 중요합니다.

## 현재 구현 (프록시)

리더보드에서 **Storage 업로드 아바타**는 CORS 없이 동작하도록 다음처럼 처리했습니다.

- **GET /api/arena/avatar?userId=xxx**  
  서버에서 Storage `avatars/{userId}/avatar.png` 를 가져와 그대로 내려주며, 응답에 `Access-Control-Allow-Origin: *` 를 붙입니다.
- **리더보드 API**  
  아바타 URL이 우리 프로젝트 Storage 공개 URL이면, 응답 시 `avatarUrl` 을 `/api/arena/avatar?userId=xxx` 로 바꿔서 내려줍니다.  
  프론트는 같은 오리진으로 요청하므로 CORS 이슈가 없습니다.

따라서 **리더보드 페이지에서는 별도 Storage CORS 설정 없이** 아바타가 표시되어야 합니다. 다른 도메인에서 직접 Storage URL을 쓸 경우에만 아래 설정이 필요합니다.

## 해결 방법 (단계별) — 직접 Storage URL을 쓸 때

> **UI가 자주 바뀝니다.** 아래 경로가 없으면 왼쪽 사이드바에서 **Settings**, **Storage**, **API** 메뉴를 둘러보고, "CORS", "Allowed origins", "Allowed domains" 같은 항목이 있는 화면을 찾으면 됩니다.

### 1단계: Supabase Dashboard 접속

1. [https://app.supabase.com](https://app.supabase.com) 에 로그인.
2. 리더보드/아바타에 쓰는 **해당 프로젝트** 선택.

### 2단계: CORS / Allowed origins 찾기

경로는 버전에 따라 다음 중 하나일 수 있습니다.

**방법 A — Settings → API**

1. 왼쪽 사이드바에서 **Project Settings** (톱니바퀴) 클릭.
2. **API** 탭 선택.
3. 아래로 내려서 **CORS** 또는 **Allowed origins** / **Additional allowed origins** 섹션 찾기.
4. 여기에 리더보드가 서비스되는 주소를 추가.

**방법 B — Storage 쪽**

1. 왼쪽 사이드바에서 **Storage** 클릭.
2. **Configuration** 또는 **Settings** 탭이 있으면 클릭.
3. **CORS**, **Allowed origins**, **Domains** 같은 항목 찾기.
4. 없으면 **Project Settings → API** 로 가서 방법 A 시도.

**방법 C — Bucket 단위 CORS (최신 UI)**

1. **Storage** → 사용 중인 버킷(예: `avatars`) 클릭.
2. 버킷 상세 화면에 **CORS**, **Settings**, **Configuration** 메뉴가 있으면 들어가서 **Allowed origins** 추가.

### 3단계: 허용할 주소 입력

- **배포(프로덕션)**  
  - 예: `https://bty-website.ywamer2022.workers.dev`  
  - 한 줄에 하나, 또는 쉼표로 구분해서 여러 개 입력 (UI에 따라 다름).
- **로컬 개발**  
  - `http://localhost:3000`  
  - 다른 포트 쓰면 `http://localhost:3001` 등도 추가.
- 가능하다면 `*`(모든 출처)도 선택지에 있지만, 보안상 필요한 도메인만 넣는 편이 좋음.

입력 후 **Save** / **Update** 버튼으로 저장.

### 4단계: Referer 제한 확인

- 같은 설정 화면에 **Referer**, **Allowed referrers**, **Domain allowlist** 같은 항목이 있으면,
- 리더보드가 열리는 **정확한 도메인**을 허용 목록에 추가  
  (예: `https://bty-website.ywamer2022.workers.dev`, `http://localhost:3000`).
- 저장.

### 5단계: 리더보드에서 확인

1. 리더보드가 열려 있는 **브라우저 탭**에서 **새로고침**(F5 또는 Cmd+R).
2. 아바타가 이미지로 로드되는지 확인.
3. 여전히 깨지면:
   - 브라우저 **개발자 도구**(F12) → **Console** 탭에서 CORS/네트워크 에러 확인.
   - **Network** 탭에서 아바타 이미지 요청 선택 → **Headers**에서 `Access-Control-Allow-Origin` 응답 헤더 확인.

---

## 대시보드에 Storage CORS가 없는 것에 대해 (공식/커뮤니티 안내)

- **대시보드에 Storage 전용 CORS 메뉴는 없음.**
- **Settings → API** 의 **Allowed Origins**는 **PostgREST/Auth용**이며, **Storage에는 적용되지 않을 수 있음.**
- **권장:** 최신 Supabase CLI의 `supabase storage update-bucket-cors` 사용.

---

## 방법 1: Supabase CLI로 CORS 설정 (권장)

**가장 좋은 방법:** 지원팀/커뮤니티 권장대로 **최신 Supabase CLI**의 `supabase storage update-bucket-cors` 를 사용하는 것입니다.

> **CLI 버전 안내:** 2025년 기준 npm/Homebrew 배포 CLI(2.75~2.76)에는 `storage` 하위에 `cp`, `ls`, `mv`, `rm` 만 있고 **`update-bucket-cors` 가 없을 수 있습니다.**  
> `supabase storage --help` 로 확인 후, 명령이 없으면 [Supabase CLI Releases](https://github.com/supabase/cli/releases) 에서 최신 바이너리를 쓰거나, 아래 **방법 2(우회)** 를 사용하세요.

### 1) CLI 설치 (전역 npm 미지원 — 아래 중 하나 사용)

- **프로젝트 dev 의존성 (권장):** `cd bty-app && npm i supabase --save-dev` 후 `npx supabase` 로 실행.
- **macOS:** `brew install supabase/tap/supabase`

버전 확인: `npx supabase --version` 또는 `supabase --version`

### 2) 로그인 및 프로젝트 연결 (한 번만)

```bash
npx supabase login
cd /path/to/bty-app && npx supabase link --project-ref <프로젝트-ref>
```

### 3) avatars 버킷 CORS 적용

```bash
npx supabase storage update-bucket-cors \
  --bucket-name avatars \
  --cors-config '{
    "allowedOrigins": ["https://bty-website.ywamer2022.workers.dev", "http://localhost:3000"],
    "allowedMethods": ["GET", "POST", "PUT", "DELETE"],
    "allowedHeaders": ["*"],
    "maxAgeSeconds": 3600
  }'
```

- 프로젝트 dev 의존성으로 설치한 경우 `npx supabase` 사용. Homebrew로 설치한 경우 `supabase` 만 써도 됨.
- 저장 후 리더보드 페이지 **새로고침** 후 아바타 로드 확인.

**한 줄 실행 (CLI에 명령이 있을 때):**  
`bty-app` 디렉터리에서 `npm run storage:cors` (또는 `./scripts/storage-cors.sh`) 로 동일 CORS 설정을 적용할 수 있습니다.  
현재 npm/Homebrew 배포 CLI에는 해당 명령이 없을 수 있어, 명령이 추가된 CLI 버전으로 업데이트한 뒤 실행하세요.

---

## 방법 2: 우회 (CLI가 안 될 때)

1. **Signed URL**  
   공개 URL 대신 `createSignedUrl` 로 일시 URL을 만들어 사용하면 CORS 제약을 우회·제어하기 쉬울 수 있습니다. (리더보드 API에서 아바타 URL을 signed URL로 바꾸는 작업 필요.)

2. **Edge Functions 프록시**  
   Supabase Edge Function에서 이미지를 스트리밍으로 전달하고, 해당 Function 응답에 CORS 헤더를 넣는 방식.

3. **SQL Editor**  
   대시보드 SQL Editor에서 `storage.buckets` 테이블 설정을 직접 수정할 수 있는지 시도해 볼 수 있으나, 공식 권장 방식은 아니며 일부 환경에서 제한될 수 있습니다.

---

## 확인한 내용 (대시보드)

다음 위치에는 **Storage 버킷용** CORS/Allowed origins 설정이 없음을 확인했습니다:  
Settings → General, Settings → Integrations, **Integrations → Data API → Settings** (Exposed schemas, Extra search path, Max rows, Pool size만 있음).  
Settings → API 의 Allowed Origins는 PostgREST/Auth 용으로, Storage에는 적용되지 않을 수 있음.

### 한눈에 넣을 주소 정리

| 환경     | 추가할 주소 예시                                    |
|----------|------------------------------------------------------|
| 프로덕션 | `https://bty-website.ywamer2022.workers.dev`         |
| 로컬     | `http://localhost:3000`, `http://localhost:3001`    |

## 참고

- 아바타 URL은 `arena_profiles.avatar_url` 에 저장되며, 리더보드 API는 이 값을 그대로 내려줍니다.
- 이미지 로드 실패 시 `UserAvatar` 컴포넌트는 **이니셜**로 대체 표시합니다 (깨진 이미지 대신).

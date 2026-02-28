# 로컬에서 테스트하기

## 1. 환경 준비

- **Node.js 20** (프로젝트 권장)
- 작업 디렉터리: **bty-app** (저장소 루트의 `bty-app` 폴더)

```bash
cd /Users/hanbit/Dev/btytrainingcenter/bty-app
# 또는 저장소 루트에서: cd bty-app
```

## 2. 환경 변수

빌드·로그인·Supabase 연동을 쓰려면 `.env.local`이 필요합니다.

```bash
cp .env.example .env.local
```

`bty-app/.env.local`에서 아래만이라도 설정하세요.

| 변수 | 설명 |
|------|------|
| `JWT_SECRET` | 아무 문자열 (예: `local-dev-secret`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 API용 (없으면 일부 기능만 미동작) |

Supabase가 없어도 `npm run dev`는 실행 가능하고, 로그인·Arena·멘토 등 DB 기능만 동작하지 않을 수 있습니다.

## 3. 의존성 설치

```bash
npm install
```

## 4. 개발 서버 (권장)

```bash
npm run dev
```

- **http://localhost:3000** → 루트 접속 시 `/en`으로 리다이렉트
- **http://localhost:3000/en** · **http://localhost:3000/ko** → 랜딩
- **http://localhost:3000/en/bty** · **http://localhost:3000/ko/bty** → 훈련장(Dojo)
- **http://localhost:3000/en/bty-arena** · **http://localhost:3000/ko/bty-arena** → Arena

코드 수정 시 Hot Reload로 반영됩니다.

## 5. (선택) 프로덕션 빌드 후 실행

| 스크립트 | 설명 |
|----------|------|
| `npm run build` | 정식 빌드 (소스맵 포함). 로컬에서 오래 걸릴 수 있음. |
| `npm run build:local` | 메모리 4GB로 빌드. `build`가 느릴 때 시도. |
| `npm run build:fast` | 소스맵 끄고 메모리 4GB. 로컬에서 가장 빨리 끝나는 옵션. |
| `npm run start` | 빌드 결과로 서버 실행 (위 빌드 중 하나 실행 후 사용) |

예:

```bash
npm run build:fast
npm run start
```

이후 **http://localhost:3000/en** 접속.

---

## 요약 (복붙용)

```bash
cd bty-app
cp .env.example .env.local   # 한 번만, 필요 시 값 편집
npm install
npm run dev
```

브라우저: **http://localhost:3000/en** 또는 **http://localhost:3000/ko**

---

## 트러블슈팅

### 첫 로딩이 1~2분 걸림

`npm run dev` 후 **처음** `/en` 또는 `/ko` 접속 시 Next.js가 해당 경로를 컴파일하는 동안 로딩이 길어질 수 있습니다.

- 터미널에 `✓ Compiled /[locale]` 나오면 곧 페이지가 뜹니다.
- 한 번 컴파일된 뒤에는 수정 시에만 다시 컴파일되고 보통 몇 초면 반영됩니다.

### 빌드가 10분 넘게 걸리거나 멈춤

- **권장:** 빌드는 **Ctrl+C**로 중단하고 **개발 서버만** 사용하세요.  
  `npm run dev` → http://localhost:3000/en 접속 후 첫 페이지만 1~2분 기다리면 됩니다.
- 꼭 프로덕션 빌드가 필요하면:
  - **5~10분**만 기다려 보시고, 안 끝나면 중단 후 `npm run build:fast`로 다시 시도.
  - `build:fast`는 소스맵 비활성화 + Node 메모리 4GB로, 같은 환경에서 더 빨리 끝나는 경우가 많습니다.

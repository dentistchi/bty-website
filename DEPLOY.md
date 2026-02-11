# Cloudflare Pages 배포 — Dear Me가 보이게 하기

**bty-app**(Dear Me Next.js 앱)을 `https://bty-website.pages.dev` 에 올리려면, Cloudflare Pages 프로젝트의 **Root directory**를 `bty-app`으로 설정하고, Next.js를 Cloudflare용으로 빌드해 배포합니다.

## Cloudflare Dashboard 설정

1. **Workers & Pages** → **bty-website** → **Settings** → **Builds & deployments**
2. 다음처럼 설정:
   - **Root directory:** `bty-app` ← **꼭 입력** (비우면 루트에서 빌드되어 `pages:build` 없음 에러 발생)
   - **Build command:** `npm run pages:build`
   - **Build output directory:**  
     - Root directory를 `bty-app`로 둔 경우: `.vercel/output/static`  
     - Root directory를 비운 경우(루트에서 빌드): `bty-app/.vercel/output/static`
3. **Save** 후 **Deployments** 탭에서 **Retry deployment** 실행

이렇게 하면 bty-app 폴더를 기준으로 `@cloudflare/next-on-pages`가 Next.js를 빌드하고, API(Edge)와 정적 자산이 함께 배포되어 **Dear Me** 화면과 로그인·채팅 등이 동작합니다.

## 로컬에서 확인

- bty-app에서 일반 Next 개발: `cd bty-app && npm run dev`
- Cloudflare Pages 로컬 미리보기: `cd bty-app && npm run preview` (먼저 `npm run pages:build` 실행됨)

## 참고

- API 라우트는 모두 Edge 런타임으로 설정되어 있어 Cloudflare Workers에서 동작합니다.
- 루트의 `index.html`은 이 설정과 무관합니다. 배포되는 것은 **bty-app** 빌드 결과뿐입니다.

---

## 배포 에러가 날 때

1. **빌드 로그 확인**  
   Cloudflare **Deployments** → 실패한 배포 **View details** → **Build log** 끝부분의 에러 메시지를 확인하세요.

2. **설정 재확인** (Settings → Builds & deployments)
   - **Root directory:** `bty-app` (앞뒤 공백 없이)
   - **Build command:** `npm run pages:build`
   - **Build output directory:** `.vercel/output/static`
   - **Framework preset:** None(또는 Don’t override) — Next.js 프리셋이 있으면 빌드 명령이 덮어쓰일 수 있음

3. **Node 버전**  
   bty-app에 `.nvmrc`(18)가 있으므로 Cloudflare가 Node 18을 쓰도록 할 수 있습니다.  
   그래도 빌드가 실패하면 **Settings** → **Environment variables**에서 **NODE_VERSION** = `18` 추가 후 다시 배포해 보세요.

4. **에러 메시지 공유**  
   위로도 해결되지 않으면, 빌드 로그에서 **빨간색 에러 부분**을 복사해 주시면 원인 파악에 도움이 됩니다.

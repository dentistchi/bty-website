# Dear Me & bty (통합 앱)

한 앱에서 **자존감 회복실(Dear Me)** 와 **훈련장(bty)** 를 모두 제공. 한국어 + **영어(/en)** 지원. 기본 AI 챗봇 탑재.

**CI:** GitHub Actions는 `working-directory: bty-app` 기준으로만 실행됩니다. Next.js 소스(`src/`)와 **모든 의존성은 반드시 이 폴더(bty-app/package.json, package-lock.json) 안에서 완결**해야 합니다. 루트 package.json이나 다른 폴더에만 있으면 CI에서 실패합니다.

## Cloudflare Pages 배포 시 설정

**반드시 아래처럼 설정해야 Dear Me 화면이 나옵니다.** (루트가 아니라 `bty-app`을 빌드해야 함)

1. **Cloudflare Dashboard** → Workers & Pages → **bty-website** → **Settings** → **Builds & deployments**
2. **Build configuration**에서:
   - **Root directory (Build root):** `bty-app` 입력
   - **Framework preset:** `Next.js` 선택
   - **Build command:** `npm run build` (기본값 유지)
   - **Build output directory:** Next.js 사용 시 Cloudflare가 자동 처리 (비워두거나 기본값)

3. **Save** 후 **Retry deployment** 또는 새 커밋 푸시로 다시 배포.

이후 `bty-website.pages.dev` 접속 시 Dear Me 랜딩이 보입니다.

## 경로

| 경로 | 내용 |
|------|------|
| `/` | Dear Me (한국어) |
| `/bty` | bty 훈련장 (한국어) |
| `/en` | Dear Me (English) |
| `/en/bty` | bty (English) |

상단 네비로 Dear Me ↔ 훈련장, 한국어 ↔ English 전환.

## 하나의 계정

- 로그인/회원가입은 이 앱 한 곳. 로그인하면 모든 경로에서 동일 계정.
- Dear Me 자존감 회복 데이터를 bty에서 맞춤 제안에 활용할 수 있음.

## 로컬 실행

```bash
cd bty-app
npm install
npm run dev
```

http://localhost:3001  
- `/` → Dear Me (한국어)  
- `/en` → Dear Me (English)  
- `/bty` → 훈련장 (한국어)  
- `/en/bty` → Dojo (English)

## AI 챗봇

- 우측 하단 말풍선 버튼으로 열기.
- **역할:** 사용자를 평가하지 않는 친구. "실패해도 괜찮다"고 말해 줌.
- `GEMINI_API_KEY`가 있으면 Gemini로 응답, 없으면 고정 격려 문구로 응답.

## Admin Dashboard (Quality Events)

`/admin/quality` – Quality Events + Patch Suggestions. Microsoft Entra ID 로그인 후 접근.

### How to configure Entra ID + env vars for admin dashboard

1. **Azure Portal – Microsoft Entra ID (구 Azure AD)**  
   - 앱 등록 → 새 등록  
   - 이름: `bty-admin` (또는 원하는 이름)  
   - 지원되는 계정: **이 조직 디렉터리만**  
   - 리디렉션 URI: `웹` → `http://localhost:3001/api/auth/callback/azure-ad` (개발)  
     - 프로덕션: `https://your-domain.com/api/auth/callback/azure-ad`

2. **클라이언트 비밀 생성**  
   - 인증서 및 비밀 → 클라이언트 비밀 → 새 클라이언트 비밀  
   - 생성된 값을 복사 (한 번만 표시됨)

3. **애플리케이션(클라이언트) ID, 디렉터리(테넌트) ID**  
   - 앱 등록 개요에서 확인

4. **`.env`에 다음 변수 설정:**

   ```env
   AZURE_AD_CLIENT_ID=<애플리케이션(클라이언트) ID>
   AZURE_AD_CLIENT_SECRET=<클라이언트 비밀>
   AZURE_AD_TENANT_ID=<디렉터리(테넌트) ID>
   NEXTAUTH_URL=http://localhost:3001
   NEXTAUTH_SECRET=<32자 이상 랜덤 문자열>
   BTY_ADMIN_EMAILS=admin@yourcompany.com,other@yourcompany.com
   ```

5. **RBAC**  
   - `BTY_ADMIN_EMAILS`: 쉼표로 구분된 이메일 목록. 이 목록에 있는 이메일만 admin 접근 가능  
   - (선택) Entra ID에서 App Role(`bty_admin`, `bty_owner`)을 정의하고 사용자/그룹에 할당하면, 토큰의 `roles` 클레임으로도 판단 가능

6. **접근**  
   - 미인증 → `/api/auth/signin` 리다이렉트  
   - 인증되어 있으나 admin 아님 → "권한이 없습니다" 페이지

### 주의

- 원문 대화는 저장·표시하지 않음. 시그니처/집계만 노출.

## 페이지·구조

```
bty-app/src/
├── app/
│   ├── page.tsx           # Dear Me (KO)
│   ├── bty/page.tsx       # bty (KO)
│   ├── admin/quality/     # Admin 대시보드 (Entra ID 필요)
│   ├── en/page.tsx        # Dear Me (EN)
│   ├── en/bty/page.tsx    # bty (EN)
│   ├── api/auth/*         # 로그인/회원가입/세션
│   ├── api/admin/quality  # Quality API 프록시
│   ├── api/admin/patch    # Patch API 프록시
│   └── api/chat/route.ts  # 챗봇
├── lib/
│   ├── auth.ts            # NextAuth + Entra ID
│   ├── rbac.ts            # isAdmin (이메일/역할)
│   └── admin-auth.ts      # API 가드
├── components/
│   ├── admin/AdminHeader
│   ├── SafeMirror, SmallWinsStack, SelfEsteemTest  # Dear Me
│   ├── IntegritySimulator, PracticeJournal, Comeback  # bty
│   ├── AuthGate, Chatbot, Nav, ThemeBody, SetLocale
```

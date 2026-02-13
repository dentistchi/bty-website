# Cloudflare Pages 배포 문제 해결 가이드

## "로딩 중…"만 표시되는 경우

### 1. 빌드 로그 확인

Cloudflare Dashboard에서:
1. **Pages** → **bty-website** 프로젝트 선택
2. **Deployments** 탭 클릭
3. 최신 배포의 **Build logs** 확인

### 2. 일반적인 문제들

#### 문제 A: Path 설정이 잘못됨
**증상**: 빌드 로그에 "package.json not found" 또는 "Cannot find module" 에러

**해결**:
1. **Settings** → **Builds & deployments**
2. **Path** 필드 확인
3. `bty-app`으로 설정되어 있는지 확인 (절대 `/`가 아님)

#### 문제 B: 빌드 출력 디렉토리 오류
**증상**: 빌드는 성공하지만 사이트가 로드되지 않음

**해결**:
1. **Settings** → **Builds & deployments**
2. **Build output directory** 확인
3. `.vercel/output/static`으로 설정되어 있는지 확인

#### 문제 C: 환경 변수 누락
**증상**: 빌드는 성공하지만 앱이 시작되지 않음

**확인 방법**:
```bash
curl https://bty-website.pages.dev/api/deploy/ready
```

**해결**:
1. **Settings** → **Environment variables**
2. `env.example`에 있는 모든 변수 추가
3. 특히 필수 변수:
   - `NEXTAUTH_URL`
   - `NEXTAUTH_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

#### 문제 D: Next.js 빌드 실패
**증상**: 빌드 로그에 TypeScript 에러나 빌드 에러

**해결**:
1. 로컬에서 테스트:
   ```bash
   cd bty-app
   npm run build:cf
   ```
2. 에러가 있으면 수정 후 다시 커밋/푸시
3. Cloudflare가 자동으로 재배포

### 3. 단계별 디버깅

#### Step 1: 빌드 상태 확인
- Cloudflare Dashboard → Deployments → 최신 배포 상태 확인
- "Success"인지 "Failed"인지 확인

#### Step 2: 빌드 로그 확인
- 실패한 경우: 로그에서 에러 메시지 확인
- 성공한 경우: 다음 단계로

#### Step 3: 환경 변수 확인
```bash
curl https://bty-website.pages.dev/api/deploy/ready
```

응답 예시:
```json
{
  "ok": false,
  "critical_missing": ["NEXTAUTH_SECRET", "SUPABASE_URL"],
  ...
}
```

#### Step 4: 로컬 빌드 테스트
```bash
cd bty-website/bty-app
npm install
npm run build:cf
```

성공하면 `.vercel/output/static` 폴더가 생성되어야 함.

### 4. 빠른 체크리스트

- [ ] Path = `bty-app` (Advanced settings)
- [ ] Build command = `npm run build:cf`
- [ ] Build output directory = `.vercel/output/static`
- [ ] Node version = 20
- [ ] 모든 환경 변수 설정됨 (Settings → Environment variables)
- [ ] 빌드 로그에서 에러 없음
- [ ] `/api/deploy/ready` 엔드포인트 접근 가능

### 5. 재배포 방법

1. **자동 재배포**: GitHub에 새 커밋 푸시
2. **수동 재배포**: 
   - Deployments → 최신 배포 → "Retry deployment"
3. **설정 변경 후**: 
   - Settings 변경 후 자동 재배포되거나
   - 수동으로 "Retry deployment" 클릭

### 6. 도움이 필요한 경우

다음 정보를 확인하세요:
1. 빌드 로그의 마지막 50줄
2. `/api/deploy/ready` 응답
3. Path 설정 스크린샷
4. Build settings 스크린샷

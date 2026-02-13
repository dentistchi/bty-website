# Cloudflare Pages Node.js 버전 설정 가이드

## Node.js 버전 설정 위치

Cloudflare Pages에서 Node.js 버전을 설정하는 방법은 UI 버전에 따라 다를 수 있습니다.

### 방법 1: Runtime 섹션 (권장)

1. Cloudflare Dashboard → Pages → `bty-website` 프로젝트
2. **Settings** 탭 클릭
3. 왼쪽 사이드바에서 **Build** → **Runtime** 클릭
4. **Node.js version** 드롭다운에서 **20** 선택
5. Save

### 방법 2: Build system version

1. Settings → Build 섹션
2. **Build system version** 옆의 **Edit** 아이콘 클릭
3. Node.js 버전 선택 옵션이 있으면 **20** 선택
4. Save

### 방법 3: package.json에서 자동 감지

Cloudflare가 `package.json`의 `engines` 필드를 읽어 자동으로 Node.js 버전을 감지할 수 있습니다.

**확인**:
- `bty-app/package.json`에 다음이 있는지 확인:
  ```json
  "engines": {
    "node": ">=20"
  }
  ```

**이미 업데이트됨**: ✅ `package.json`이 `">=20"`으로 설정되어 있습니다.

### 방법 4: .nvmrc 파일 생성 (선택사항)

`bty-app` 폴더에 `.nvmrc` 파일을 생성하여 Node.js 버전을 명시할 수 있습니다:

```bash
cd bty-website/bty-app
echo "20" > .nvmrc
```

## 현재 상태 확인

빌드 로그에서 Node.js 버전 확인:
- `Detected the following tools from environment: npm@10.9.2, nodejs@18.20.8` ← 이게 문제!
- `nodejs@20.x.x`로 표시되어야 함

## 해결 방법

1. **Runtime 섹션 확인**:
   - Settings → Build → **Runtime** 클릭
   - Node.js version이 있으면 **20**으로 설정

2. **없으면 package.json에 의존**:
   - `package.json`의 `engines` 필드가 이미 `">=20"`으로 설정되어 있음
   - 변경사항을 커밋하고 푸시하면 Cloudflare가 자동으로 감지할 수 있음

3. **재배포**:
   - GitHub에 커밋 푸시하거나
   - Deployments → Retry deployment

## 확인

재배포 후 빌드 로그에서:
- ✅ `nodejs@20.x.x` 표시되면 성공
- ❌ `nodejs@18.x.x` 표시되면 아직 설정이 안 됨

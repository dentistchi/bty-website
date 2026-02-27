# 다른 PC에서 이어서 진행하기

이 PC에서 마무리한 뒤 **다른 컴퓨터**에서 테스트·다음 단계 진행할 때 쓰는 체크리스트입니다.

---

## 1. 이 PC에서 마무리할 것

### (1) 코드 원격 저장소에 올리기 (필수)

```bash
cd /Users/hanbit/Documents/web_development/btytrainingcenter
git add -A
git status   # 확인 후
git commit -m "feat: Phase 1-3/1-4 가이드 캐릭터, Arena free-response, 챗/멘토 XP, 문서 정리"
git push origin main
```

- 다른 PC에서 `git pull` 하면 이 상태 그대로 받을 수 있습니다.

### (2) 배포할지 정하기

- **배포하는 경우**: 다른 PC에서 **바로 URL로 테스트** 가능. 로그인·Arena·챗·멘토 등 실제 환경에서 확인하기 좋음.
- **배포 안 하는 경우**: 다른 PC에서 `git pull` → `npm install` → `npm run dev` 로 로컬 테스트.

**추천**: **푸시까지 이 PC에서 하고, 배포는 다른 PC에서 `git pull` 한 뒤 그쪽에서 실행.**  
(배포 키/환경이 다른 PC에만 있을 수 있으므로)

---

## 2. 다른 PC에서 할 것

### (1) 코드 받기

```bash
cd <프로젝트 루트>
git pull origin main
cd bty-app
npm install
```

### (2) 환경 변수

- `bty-app/.env.local` (또는 사용하던 env 파일)을 **이 PC에서 복사**해 두었다가 다른 PC에 붙여넣기.
- 없으면 `bty-app/.env.example` 참고해서 필요한 값 채우기 (Supabase, API 키 등).

### (3) 테스트

- **로컬**: `npm run dev` → 브라우저에서 확인.
- **배포 URL 사용**: 이미 배포했다면 해당 URL로 접속해서 테스트.

### (4) 다음 단계

- 테스트 후 Phase 2 정리·보완 또는 다음 작업 진행.

---

## 3. 최근 반영된 내용 (참고)

- **리더보드**: locale(한/영), 내 순위 강조, notOnBoard 메시지, API 디버그 헤더 제거
- **태스크 보드**: `docs/CURSOR_TASK_BOARD.md` — 상태 색상 (대기=빨강, 진행 중=녹색, 완료=파랑)
- **작업 완료 알림**: `.cursor/rules/complete-notify.mdc` — afplay + osascript (다른 PC에서도 동일 규칙 적용)
- Arena free-response, 챗/멘토 XP, 가이드 캐릭터 UI, Phase 1-1~1-3 문서 등

---

## 4. 배포 (Cloudflare Workers)

이 앱은 `package.json`에 `opennextjs-cloudflare` 배포 스크립트가 있습니다.

```bash
cd bty-app
npm run deploy
```

- 배포 전에 해당 PC에서 Cloudflare/Wrangler 로그인·환경 변수 설정이 되어 있어야 합니다.
- 처음이면 `wrangler login` 후 프로젝트 설정 확인.

이 문서는 다른 PC에서 열어보면 이어서 작업하기 쉬우도록 작성했습니다.

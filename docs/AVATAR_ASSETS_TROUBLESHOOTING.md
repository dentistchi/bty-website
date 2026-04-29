# Avatar assets — 반복되는 404 / 옛 UI

## Network에서 악세서리·캐릭터·옷 PNG 404

1. **로컬**: 저장소 루트에서 `bty-app` 기준으로 플레이스홀더·검증 실행  
   - `npm run write:accessory-placeholders` — 매니페스트 + 레거시 레벨맵 id용 파일 생성  
   - `npm run write:character-placeholder-pngs` + `npm run generate:character-thumbs` — 캐릭터 전신·512 썸네일  
   - `npm run verify:avatar-assets` — 캐릭터·옷·악세서리 경로 일괄 검사  

2. **프로덕션**: 위 파일들이 **배포 아티팩트에 포함**되는지 확인(OpenNext/Cloudflare는 `public/`이 빌드에 들어가야 함).  
   오래된 에지 캐시면 **강력 새로고침** 또는 캐시 무효화.

3. **자주 보이는 404**
   - `character_11.png` / `character_12.png` — 논리 id 기준 파일명을 요청하는 경우가 있어, 저장소에는 `artisan_11` / `assistant_12`와 **동일 내용의 복제본**을 함께 둡니다(`generate:character-thumbs`가 생성).
   - `outfit_shorts_tee.png` — 레거시 Professional L4 레벨맵(`shorts_tee`)이 참조하는 파일. `public/avatars/outfits/`에 파일이 있어야 하며 `verify:avatar-assets`가 검사합니다.

## 대시보드에 아직 "Professional / Fantasy" 테마가 보일 때

현재 `bty-app` 소스의 `dashboard/page.client.tsx`에는 **테마 토글이 없습니다**(통합 옷 드롭다운만).  
그 UI가 보이면:

- 배포 브랜치·커밋이 최신인지 확인  
- **Vercel/호스트 캐시**·**브라우저 Service Worker** 제거 후 재시도  

## 레거시 악세서리 id

`avatarOutfits.ts`의 `LEGACY_ACCESSORY_IDS_FOR_ASSETS`는 레벨 맵에서 쓰는 id(`apron`, `dental_mirror` 등)를 매니페스트와 맞추기 위한 목록입니다.  
플레이스홀더 스크립트와 `verify-avatar-assets`가 동일 집합을 사용합니다.

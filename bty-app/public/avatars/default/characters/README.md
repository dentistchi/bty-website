# Default 전신 캐릭터 PNG (합성 전)

옷 레이어·악세사리 합성을 넣기 **전**에는 여기에 전신 일러스트를 둡니다.

- **경로·파일명**: `public/avatars/default/characters/{basename}.png` — 논리 `id`와 다를 수 있음(`character_11` → `artisan_11.png` 등, [`avatarCharacters.ts`](../../../../src/lib/bty/arena/avatarCharacters.ts)의 `CHARACTER_IMAGE_FILE_BASENAME` 참고). **대시보드 썸네일**은 `public/avatars/default/characters/thumbs/{basename}.png`(512px 권장) — 파일이 없으면 UI는 이니셜만 표시합니다. 전신 PNG를 기준으로 썸네일을 다시 만들 때: `npm run generate:character-thumbs`
- **코드**: [`avatarCharacters.ts`](../../../../src/lib/bty/arena/avatarCharacters.ts) — `AVATAR_CHARACTER_IMAGE_BASE`
- **검증 (캐릭터만)**: `npm run verify:avatar-assets:characters`
- **검증 (캐릭터 + Professional 옷)**: `npm run verify:avatar-assets`

합성 파이프라인 완성 후 `avatars/characters/` 등으로 옮길 때는 `AVATAR_CHARACTER_IMAGE_BASE`만 조정하면 됩니다.

# Default 전신 캐릭터 PNG (합성 전)

옷 레이어·악세사리 합성을 넣기 **전**에는 여기에 전신 일러스트를 둡니다.

- **경로·파일명**: `public/avatars/default/characters/{characterId}.png` — **`characterId`는 `AVATAR_CHARACTERS`의 `id`와 정확히 같아야** 합니다(예: `hero_01.png`, `guardian_04.png`). 표시용 라벨·번호를 파일명에 쓰면 브라우저가 `/avatars/default/characters/hero_01.png`를 요청할 때 404가 납니다.
- **코드**: [`avatarCharacters.ts`](../../../../src/lib/bty/arena/avatarCharacters.ts) — `AVATAR_CHARACTER_IMAGE_BASE`
- **검증 (캐릭터만)**: `npm run verify:avatar-assets:characters`
- **검증 (캐릭터 + Professional 옷)**: `npm run verify:avatar-assets`

합성 파이프라인 완성 후 `avatars/characters/` 등으로 옮길 때는 `AVATAR_CHARACTER_IMAGE_BASE`만 조정하면 됩니다.

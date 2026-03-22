# Default 전신 캐릭터 PNG (합성 전)

옷 레이어·악세사리 합성을 넣기 **전**에는 여기에 전신 일러스트를 둡니다.

- **경로·파일명**: `public/avatars/default/characters/{basename}.png`.
  - 대부분 **`basename` = `AVATAR_CHARACTERS`의 `id`**(예: `hero_01.png`, `guardian_04.png`).
  - 예외(매핑): `character_11` → 디스크 파일 **`artisan_11.png`**, `character_12` → **`assistant_12.png`**. API/DB에는 `character_11` / `character_12` 유지.
- **썸네일(512)**: `public/avatars/default/characters/thumbs/{basename}.png` — 본편과 같은 `basename` 규칙(예: `thumbs/artisan_11.png`).
- **코드**: [`avatarCharacters.ts`](../../../../src/lib/bty/arena/avatarCharacters.ts) — `AVATAR_CHARACTER_IMAGE_BASE`
- **검증 (캐릭터만)**: `npm run verify:avatar-assets:characters`
- **검증 (캐릭터 + Professional 옷)**: `npm run verify:avatar-assets`

합성 파이프라인 완성 후 `avatars/characters/` 등으로 옮길 때는 `AVATAR_CHARACTER_IMAGE_BASE`만 조정하면 됩니다.

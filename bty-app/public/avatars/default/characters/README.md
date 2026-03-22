# Default 전신 캐릭터 PNG (합성 전)

옷 레이어·악세사리 합성을 넣기 **전**에는 여기에 전신 일러스트를 둡니다.

## 파일명·basename

- **전신(풀해상도)**: `public/avatars/default/characters/{basename}.png`
- 논리 `id`(DB/API)와 디스크 파일명이 다를 수 있습니다. **`getCharacterImageBasename(id)`** ([`avatarCharacters.ts`](../../../../src/lib/bty/arena/avatarCharacters.ts))로 basename을 구합니다.  
  예: `character_11` → `artisan_11.png`, `character_12` → `assistant_12.png`

## 썸네일 512×512

- **경로**: `public/avatars/default/characters/thumbs/{basename}.png`
- **크기**: 512×512 PNG (대시보드·그리드용). 전신 PNG를 소스로 생성합니다.
- **생성**: 저장소 루트에서 `bty-app` 기준으로 실행

```bash
cd bty-app
npm run generate:character-thumbs
```

전신 파일이 없으면 해당 캐릭터는 스킵되며 경고만 출력됩니다.

## 플레이스홀더(개발·CI용)

전신 PNG가 없을 때 임시 타일을 만들려면:

```bash
cd bty-app
npm run write:character-placeholder-pngs
npm run generate:character-thumbs
```

실제 일러스트로 교체한 뒤 위 `generate:character-thumbs`를 다시 실행하면 썸네일이 갱신됩니다.

## 기타

- **코드**: [`avatarCharacters.ts`](../../../../src/lib/bty/arena/avatarCharacters.ts) — `AVATAR_CHARACTER_IMAGE_BASE`, `getCharacterThumbImageUrl`
- **검증 (캐릭터만)**: `npm run verify:avatar-assets:characters`
- **검증 (캐릭터 + 옷 PNG)**: `npm run verify:avatar-assets`

합성 파이프라인 완성 후 `avatars/characters/` 등으로 옮길 때는 `AVATAR_CHARACTER_IMAGE_BASE`만 조정하면 됩니다.

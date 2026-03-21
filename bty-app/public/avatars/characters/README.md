# 캐릭터 PNG 배치

1. 정렬된 **1024×1024** PNG를 이 폴더에 둔다 (규칙: [AVATAR_ALIGNMENT_AND_OUTFIT_SPEC.md](../../../../docs/spec/AVATAR_ALIGNMENT_AND_OUTFIT_SPEC.md)).
2. **파일명 규칙**: 캐릭터 id와 동일 — `{characterId}.png` (예: `healer_07.png`, `hero_01.png`). `AVATAR_CHARACTERS`의 `id`와 1:1로 맞춘다.
3. [`src/lib/bty/arena/avatarCharacters.ts`](../../../src/lib/bty/arena/avatarCharacters.ts)에서 `AVATAR_CHARACTERS`에 `id`, `label`, **`bodyType`** (A/B/C/D)만 유지.
4. 검증: `npx --yes tsx scripts/verify-avatar-assets.ts`

**기본 스크럽:** 옷 레이어는 API가 레벨 기본으로 `professional_outfit_scrub_general` 등을 내려준다. 캐릭터 베이스만 “맨몸”이면 옷 PNG가 반드시 배포되어야 한다.

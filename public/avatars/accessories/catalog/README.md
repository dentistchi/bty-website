# 악세사리 catalog (매니페스트 스캔용)

`npm run generate:avatar-manifest`는 **`accessories/catalog/` 안에 스캔 가능한 파일이 1개라도 있으면 이 폴더만** 사용합니다. 그렇지 않으면 **`accessories/` 루트**만 스캔합니다(둘을 합치지 않음). 24개를 한쪽에 모으세요.

- **파일명**: `mask.svg` / `sword.png` 같은 표준명, 또는 `Arena core.png` → id `arena_core` 로 슬러그(공백→`_`). `--rename-loose` 시 `{id}.svg|png` 로 정규화.
- **치과(dental)**: `.svg`  
- **게임(game)**: `.png`  
- **합계**: `avatar-manifest-constants.ts` 기준 **24개** (보통 dental 12 + game 12).

생성 후 스크립트가 **동일 파일명**으로 `../`(accessories 루트)에 복사합니다. 런타임 URL은 `/avatars/accessories/{id}.svg|png` 이므로 루트에 있어야 합니다.

**PNG → 덴탈 전용 SVG(래스터 포함):** 루트에 `.png`만 있을 때 진짜 벡터 변환은 별도 툴에서 하고, 임시로 동일 화면을 쓰려면 `npm run embed:accessory-png-as-svg` — 각 PNG를 Base64로 넣은 SVG로 바꾼 뒤 `.png`를 지웁니다.

**주의:** `avatarOutfits.ts` 레벨 맵에서 쓰는 악세 id(예: `mask`, `hat`)가 매니페스트에 없으면 합성 URL은 404가 납니다. 스캔 결과를 커밋하기 전에 **레벨 맵·카탈로그와 id 집합이 맞는지** 확인하세요.

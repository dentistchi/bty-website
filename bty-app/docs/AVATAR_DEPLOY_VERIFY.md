# 배포 후 아바타 404·깨짐 확인

**목적:** 프로덕션에서 캐릭터/옷 PNG가 **200**으로 내려오는지 확인한다. 코드는 [`AvatarComposite`](../src/components/bty-arena/AvatarComposite.tsx)에서 레이어 `onError` 시 숨김 → **빈 원·`—`** 처럼 보일 수 있다.

---

## 배포 시 할 일 (산출물에 넣을 파일)

1. **`public/avatars/characters/`**  
   - 코드의 캐릭터 `id`와 **동일한 파일명**의 PNG (예: `hero_01.png`, `healer_07.png`, …).  
   - 기준: [`AVATAR_CHARACTERS`](../src/lib/bty/arena/avatarCharacters.ts)의 `id`와 1:1.

2. **`public/avatars/outfits/`**  
   - [`OUTFIT_ID_TO_FILENAME`](../src/lib/bty/arena/avatarOutfits.ts) 및 [`public/avatars/outfits/README.md`](../public/avatars/outfits/README.md) 목록과 동일한 이름 (예: `outfit_scrub_general.png`, `outfit_figs_scrub_short.png`).

3. **`public/avatars/accessories/`**  
   - 경로: `/avatars/accessories/{id}.svg` — **치과(dental)** 는 기본 `.svg`.  
   - **게임(game)** 악세사리는 코드상 `.png` 요청 가능 (`getAccessoryImageUrl`).  
   - Network에서 404면 해당 경로에 SVG(또는 game용은 PNG)를 추가한다.  
   - 치과 장비 PNG만 있고 이름이 다르면, 파일명을 `explorer.svg` 등 **코드 id 규칙**에 맞추거나 에셋을 다시 내보낸다.

4. **체형(`bodyType`) 사용 시**  
   - [`getOutfitImageUrlForBodyType`](../src/lib/bty/arena/avatarOutfits.ts) 때문에 `outfit_figs_scrub_short_A.png` 같이 **확장자 앞에 `_${bodyType}`** 접미사 파일이 요청될 수 있다.  
   - 없으면 해당 레이어만 404일 수 있다. 당분간 체형별 에셋이 없으면 캐릭터에서 `bodyType` 생략 등도 검토.

5. **재배포 후**  
   - 같은 화면에서 DevTools Network로 `healer_07.png`, `outfit_figs_scrub_short.png` 등 요청이 **코드와 일치하는지** 보고 **200**인지 확인한다.

---

## 1. 브라우저 (프로덕션)

1. 아바타 설정 또는 리더보드 페이지를 연다.
2. DevTools → **Network** → 필터 `avatars`.
3. `characters`·`outfits` 요청이 **404**인지 **200**인지 확인.
4. 404면 `public/avatars/characters`·`public/avatars/outfits`에 동일 파일명으로 PNG를 추가한 뒤 재배포한다.

**파일명 단일 기준**

- 캐릭터: `public/avatars/characters/{characterId}.png` — id는 [`AVATAR_CHARACTERS`](../src/lib/bty/arena/avatarCharacters.ts)와 동일 (예: `healer_07.png`).
- 옷: [`OUTFIT_ID_TO_FILENAME`](../src/lib/bty/arena/avatarOutfits.ts) — Professional은 `outfit_{outfitId}.png` (예: `outfit_figs_scrub_short.png`).
- 악세사리(dental): [`getAccessoryImageUrl`](../src/lib/bty/arena/avatarOutfits.ts) → `/avatars/accessories/{id}.svg` (game은 `.png`).

---

## 2. 로컬/CI (저장소 기준)

저장소에 PNG가 포함된 경우:

```bash
cd bty-app
npx --yes tsx scripts/verify-avatar-assets.ts
```

- **exit 0:** 매핑된 경로에 파일이 있음.
- **exit 1:** 누락 목록 출력 — `public/avatars/`에 에셋을 넣거나 매핑을 수정.

에셋이 Git에 없고(용량·LFS) 배포 파이프라인에서만 주입하는 경우, 이 스크립트는 스킵하고 §1만 수행한다.

---

## 3. 체형별 옷 파일 (`_A` … `_D`)

[`getOutfitImageUrlForBodyType`](../src/lib/bty/arena/avatarOutfits.ts)는 `bodyType`이 있으면 `기본파일명_A.png` 형태를 요청한다.  
해당 파일이 없으면 404 → 옷 레이어가 숨겨질 수 있으므로, 체형별 PNG를 추가하거나 당분간 `bodyType`을 캐릭터에서 빼는 등 기획에 맞게 맞춘다.

---

## 4. 관련 문서

- [AVATAR_ALIGNMENT_AND_OUTFIT_SPEC.md](../../docs/spec/AVATAR_ALIGNMENT_AND_OUTFIT_SPEC.md)
- [ARENA_AVATAR_NEXT_STEPS.md](./ARENA_AVATAR_NEXT_STEPS.md)

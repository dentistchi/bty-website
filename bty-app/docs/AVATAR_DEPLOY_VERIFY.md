# 배포 후 아바타 404·깨짐 확인

**목적:** 프로덕션에서 캐릭터/옷 PNG가 **200**으로 내려오는지 확인한다. 코드는 [`AvatarComposite`](../src/components/bty-arena/AvatarComposite.tsx)에서 레이어 `onError` 시 숨김 → **빈 원·`—`** 처럼 보일 수 있다.

---

## 1. 브라우저 (프로덕션)

1. 아바타 설정 또는 리더보드 페이지를 연다.
2. DevTools → **Network** → 필터 `avatars`.
3. `characters`·`outfits` 요청이 **404**인지 **200**인지 확인.
4. 404면 `public/avatars/characters`·`public/avatars/outfits`에 동일 파일명으로 PNG를 추가한 뒤 재배포한다.

**파일명 단일 기준**

- 캐릭터: [`avatarCharacters.ts`](../src/lib/bty/arena/avatarCharacters.ts) `CHARACTER_ID_TO_FILENAME`
- 옷: [`avatarOutfits.ts`](../src/lib/bty/arena/avatarOutfits.ts) `OUTFIT_ID_TO_FILENAME` 및 `getOutfitFilename`

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

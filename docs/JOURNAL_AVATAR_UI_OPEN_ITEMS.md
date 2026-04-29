# Journal / Avatar UI — 열린 이슈 (요약)

| 주제 | 상태 | 비고 |
|------|------|------|
| `/en/journal` 한글 하드코딩 | ✅ 수정 | `getMessages(locale).journal` + `HubTopNav` (`page.client.tsx`) |
| 저널 상위 메뉴 네비 | ✅ 보완 | `HubTopNav`(Center 컨텍스트)로 Center·Foundry 등 링크 |
| 대시보드 Avatar 카드 한글 고정 라벨 | ✅ 수정 | `avatarOutfit.currentLevelAccessories` 등 i18n 키 |
| 캐릭터 일러스트(글자만 보임) | ⏳ 에셋 | `public/avatars/characters/*.png` 미배치(`.gitkeep`만). 경로는 `avatarCharacters.ts` → `/avatars/characters/{id}.png`. 스펙: `public/avatars/README.md`, `docs/AVATAR_LAYER_SPEC.md`, `COMMANDER_BACKLOG_AND_NEXT.md` §4.2 |
| **현재:** 옷 라벨(`outfitLabel`) 한글 | API/도메인 | `core.currentOutfit.outfitLabel`이 서버/도메인에서 오면 로케일별 라벨 매핑 별도 작업 |

백로그 연동: **`docs/CURSORS_PARALLEL_TASK_LIST.md`**, **`docs/COMMANDER_BACKLOG_AND_NEXT.md`** (Arena 아바타·레이어·에셋).

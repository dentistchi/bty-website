# 아바타·옷·악세서리 — 현재 상태와 다음 단계

**목적**: 치과/게임 악세서리 제작이 한쪽씩 진행된 시점에서, **얼마나 되었는지** 정리하고 **다음에 할 일**을 순서대로 정리합니다.

---

## 1. 현재 상태 요약

| 구분 | 내용 | 상태 |
|------|------|------|
| **캐릭터** | 10종 PNG (`Hero.png`, `Maga.png` 등) | ✅ `public/avatars/` 에 있음, `avatarCharacters.ts`와 연동 |
| **옷 (Professional)** | 7종 PNG (`outfit_scrub_general.png` 등) | ✅ `public/avatars/outfits/` 에 두면 됨. 코드는 `outfit_{outfitId}.png` 참조 |
| **옷 (캐릭터 게임)** | 6종 PNG (`outfit_hero_armor.png` 등) | ✅ fantasy 테마 + 해당 캐릭터일 때 사용 |
| **악세서리 (치과)** | 41개 id → SVG | ✅ **41개 모두 있음** (`public/avatars/accessories/`, viewbox 64×64, 치과 테마 색상). `avatar-assets.json`의 `accessories.dental`과 1:1 일치. |
| **악세서리 (게임)** | 33개 id → SVG | 🔶 **다른 Cursor에서 제작 중** (sword, shield, hat, weapon 등) |
| **로직** | 캐릭터 선택, 테마(professional/fantasy), 레벨→옷, core-xp avatarUrl | ✅ 반영됨 |

---

## 2. 곧 할 일 (악세서리·폴더 마무리)

| # | 할 일 | 담당 | 비고 |
|---|--------|------|------|
| 1 | **치과 악세서리 41개 SVG** | ✅ 완료 | `public/avatars/accessories/`, id는 `avatar-assets.json`의 `accessories.dental`과 1:1. viewbox 64×64, 플랫/실루엣, 치과 테마 색상. |
| 2 | **게임 악세서리 33개 SVG** | 🔶 진행 중 | `accessories.game` id → 같은 폴더 `accessories/` 에 추가 |
| 3 | **outfits 폴더·PNG 확인** | 수동 또는 한 번에 | `public/avatars/outfits/` 아래에 Professional 7개 + 캐릭터 게임 6개 PNG가 들어갔는지 확인. 없으면 생성한 옷 이미지 복사 |

---

## 3. 그 다음 (선택·우선순위)

| # | 할 일 | 설명 |
|---|--------|------|
| 4 | **대시보드에서 현재 옷·악세서리 표시** | core-xp 응답에 이미 `currentOutfit.outfitLabel`, `currentOutfit.accessoryLabels` 있음. 대시보드 Avatar 카드에 "현재: 일반 스크럽 · Apron, 고글, …" 같이 라벨만 표시해도 됨. |
| 5 | **악세서리 아이콘을 아바타 주변에 렌더** | `getAccessoryImageUrl(id)`로 SVG URL 얻을 수 있음. 아바타 주변에 작은 아이콘으로 띄우려면 컴포넌트 추가 (선택). |
| 6 | **Phase 3 체크리스트·진행 순서 문서 정리** | `PHASE_3_CHECKLIST.md`에 "캐릭터 10종·옷 13종·악세서리 매니페스트" 반영, `PROJECT_PROGRESS_ORDER.md`에서 Phase 3 상태 업데이트. |
| 7 | **통합 테스트** | 로그인 → 캐릭터 선택 → 테마(professional/fantasy) 선택 → 레벨에 따라 아바타 이미지 바뀌는지, 리더보드·대시보드 노출 확인. |
| 8 | **Phase 4로 전환** | 아바타 게임 요소가 충분히 마무리되면 코드별 테마, 엘리트 5%, Dojo 콘텐츠 등 다음 단계 진행. |

---

## 4. 정리

- **지금**: 치과 악세서리 41개 완료. 게임 악세서리 33개는 진행 여부 확인 후 추가.
- **다음**: (1) 게임 33개 SVG 추가 (2) outfits PNG 확인 (3) 대시보드에 현재 옷/악세서리 라벨 표시 (4) Phase 3 문서·테스트 후 Phase 4 검토.

이 순서대로 진행하면 된다.

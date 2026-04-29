# Phase 4: 코드별 가이드 캐릭터 스킨 — 에셋 스펙

**목표**: 사용자 Code(FORGE, PULSE, …)에 따라 챗봇·멘토에 노출되는 **가이드 캐릭터(Dr. Chi) 비주얼**을 Code별로 1세트씩 정의한다.  
**산출물**: Code별 의상/배경 이미지 1세트 스펙 — 에셋 제작 또는 라이선스 확보 시 참고.

**상위**: `docs/PHASE_4_CHECKLIST.md` 4-1 · `docs/GUIDE_CHARACTER_ASSET.md` (기본 1종)

---

## 1. Code 목록 (BTY Arena)

| Code | codeIndex | Lore (참고) |
|------|-----------|-------------|
| FORGE | 0 | Shape your foundation. |
| PULSE | 1 | Find your rhythm. |
| FRAME | 2 | Build the structure. |
| ASCEND | 3 | Rise to the summit. |
| NOVA | 4 | Let your light shine. |
| ARCHITECT | 5 | Design what endures. |
| CODELESS ZONE | 6 | You define the path. (기본 스킨 또는 공용 폴백 사용) |

---

## 2. Code별 1세트 정의 (의상 + 배경)

각 Code당 **1세트** = **캐릭터 의상(또는 스킨) 1종** + **배경 이미지 1종**.  
동일 캐릭터(Dr. Chi)를 유지하고, Code 테마에 맞게 의상/배경만 바꾼다.

| Code | 의상/스킨 콘셉트 | 배경 콘셉트 | 비고 |
|------|------------------|-------------|------|
| FORGE | 불꽃/대장간·기초 톤 (따뜻한 색, 단순한 작업복) | 용광로/불꽃/발판 느낌 | 첫 단계 |
| PULSE | 리듬·맥박 톤 (생동감, 간단한 악세사리) | 파동/심장박동/리듬 시각 | |
| FRAME | 구조·뼈대 톤 (선명한 실루엣, 격자/프레임) | 설계도/골조/프레임 | |
| ASCEND | 등반·상승 톤 (산/계단, 가벼운 장비) | 산정/계단/올라가는 느낌 | |
| NOVA | 빛·폭발 톤 (밝은 포인트, 별/광채) | 별/초신성/빛나는 배경 | |
| ARCHITECT | 설계·완성 톤 (정장/청사진, 완성도) | 청사진/건축/최종 설계 | |
| CODELESS ZONE | 공용 기본 또는 “경계 밖” 느낌 | 중립/그라데이션 또는 기본 1종 재사용 | 폴백 |

---

## 3. 파일 경로·포맷 (제안)

에셋 제작/도입 시 아래 규칙을 쓰면 4-2 구현 시 경로 매핑이 쉽다.

- **캐릭터(의상)**: `public/images/guide-character/code-{codeNameLower}.png`  
  예: `code-forge.png`, `code-pulse.png`, …  
  없으면 기존 `guide-character-default.png` 사용.
- **배경**: `public/images/guide-character/bg-{codeNameLower}.png`  
  예: `bg-forge.png`, `bg-pulse.png`, …  
  없으면 배경 없음(단색/투명) 처리.

**포맷**: PNG(투명 배경 권장), 해상도는 기존 가이드 캐릭터와 동일 권장(예: 512×512 또는 1:1).

---

## 4. 에셋 제작 vs 라이선스

- **제작**: 위 콘셉트로 원화/일러스트 1세트(의상+배경) per Code 제작.  
  캐릭터는 기존 Dr. Chi와 동일인물로 유지(일관된 얼굴/체형).
- **라이선스**: 서드파티 일러스트/테마 구매 시, Code 테마와 저작권·상업적 이용 범위를 확인.  
  - 사용처: bty-app 내 챗봇·멘토 UI(웹).  
  - 필요 시 크레딧/라이선스 문구 노출 위치 정리.

---

## 5. 완료 기준 (4-1)

- [ ] Code 6종(FORGE ~ ARCHITECT) 각각 의상+배경 1세트 콘셉트 확정.
- [ ] CODELESS ZONE: 기본 1종 재사용 또는 별도 1세트 결정.
- [ ] 파일 경로·포맷 규칙 확정 후, 에셋 제작 또는 라이선스 진행 후 4-2(코드별 스킨 표시) 연동.

**체크리스트**: `docs/PHASE_4_CHECKLIST.md` 4-1 — 이 스펙 문서를 4-1 산출물로 둠. 스펙 확정 시 4-1 진행 완료로 보고, 실제 에셋 준비가 끝나면 체크해도 됨.

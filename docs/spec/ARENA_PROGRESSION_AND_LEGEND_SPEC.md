# Arena 진행 체계 및 Legend 해금 — 명세

6개 코드네임 + Stage 7 (Codeless Zone), 각 100 레벨, 총 700 레벨. Legend 캐릭터는 **진행 레벨 700** 달성 시 해금 (Core XP 700이 아님). UI는 제공 이미지처럼 7단계 진행 시각화와 각 코드 아이콘을 사용한다.

---

## 1. 진행 레벨 vs Core XP

| 용어 | 의미 | 비고 |
|------|------|------|
| **Core XP** | 영구 누적 성장치. `arena_profiles.core_xp_total`. | 리셋 없음. Tier/Code/Stage 산출에 사용. |
| **Tier** | 내부 값. `tier = floor(coreXpTotal / 10)`. 0~699+ | UI에 tier 숫자 노출하지 않음. |
| **진행 레벨 (Level)** | 사용자에게 보이는 진행도. **Level = tier + 1**, 최대 700. | Stage 1 = 레벨 1~100, … Stage 7 = 레벨 601~700. |
| **Legend 해금** | **진행 레벨 700** = tier 699 달성 시. | **Core XP 700이 아님.** Core XP 6990 이상 (tier 699). |

---

## 2. 6개 코드네임 + Stage 7 (각 100 레벨)

도메인 상수 `CODE_NAMES` (code index 0~6):

| Stage | Code Name | Tier 구간 | 레벨 구간 |
|-------|------------|-----------|-----------|
| 1 | FORGE | 0–99 | 1–100 |
| 2 | PULSE | 100–199 | 101–200 |
| 3 | FRAME | 200–299 | 201–300 |
| 4 | ASCEND | 300–399 | 301–400 |
| 5 | NOVA | 400–499 | 401–500 |
| 6 | ARCHITECT | 500–599 | 501–600 |
| 7 | CODELESS ZONE | 600–699+ | 601–700 |

- **1 Code = 100 tiers = 1,000 Core XP**.
- **진행 레벨 700** = tier 699 = Core XP 6,990 구간 도달 (레벨 700 = Stage 7의 100번째 레벨).

---

## 3. Legend 캐릭터 해금

- **조건**: 진행 레벨 700 도달 = **tier >= 699** (Core XP 6,990 이상).
- **코드**: `domain/constants.ts` — `LEGEND_UNLOCK_TIER = 699`, `PROGRESSION_LEVEL_MAX = 700`.  
  `avatarCharacters.ts` — `legend_13`에 `unlockAtTier: LEGEND_UNLOCK_TIER`.  
  `getVisibleAvatarCharacters(coreXpTotal)`는 `tierFromCoreXp(coreXpTotal)`로 tier를 구한 뒤, `unlockAtTier == null || tier >= c.unlockAtTier`인 캐릭터만 반환.
- **서류**: Legend 해금은 **레벨 700** 기준으로만 기술. Core XP 700과 혼동하지 않음.

---

## 4. UI 디자인 (제공 이미지 기준)

- **전체**: 다크 톤 배경, 회로/별 패턴, 좌→우 진행 플로우.
- **Stage 1–6**: 각각 아이콘 + “STAGE N 이름” + “100 Levels”.
  - FORGE: 오렌지 빛 모루/불꽃.
  - PULSE: 파란 파형/심박.
  - FRAME: 초록 3D 프레임/구조.
  - ASCEND: 보라 상승/산 정상.
  - NOVA: 핑크/마젠타 스타버스트.
  - ARCHITECT: 골드 도시/건물.
- **Stage 7**: “STAGE 7 CODELESS ZONE”, 우주/은하 배경, 중앙 물음표, “100 Levels”.
- **Hidden Recognition Unlocked**: 레벨 700 달성 시 열리는 경로 표시 (자물쇠 해제 아이콘 등).
- **구현**: 위 7단계와 각 코드 이미지를 그대로 사용해 진행 UI를 꾸미고, 필요 시 `CODE_NAMES`·`CODE_LORE`와 매핑.

---

## 5. 코드/도메인 참조

- `bty-app/src/domain/constants.ts`: `CODE_NAMES`, `TIERS_PER_CODE`, `PROGRESSION_LEVEL_MAX`, `LEGEND_UNLOCK_TIER`.
- `bty-app/src/domain/rules/level-tier.ts`: `tierFromCoreXp`, `codeIndexFromTier`.
- `bty-app/src/lib/bty/arena/codes.ts`: `CODE_LORE`, `computeCoreXpDisplay`, `progressToNextTier`.
- `bty-app/src/lib/bty/arena/avatarCharacters.ts`: `getVisibleAvatarCharacters(coreXpTotal)`, Legend `unlockAtTier`.
- `docs/spec/arena-domain-rules.md`: Tier / Code / Stage 매핑.

---

## 6. 요약

- **6개 코드네임 + Stage 7**, 각 **100 레벨** → 총 **700 레벨**.
- **Legend** 해금 = **진행 레벨 700** (tier 699). Core XP 700이 아님.
- 서류에는 “Legend = 레벨 700”으로만 명시하고, 코드는 `LEGEND_UNLOCK_TIER = 699`로 처리.
- UI는 제공 이미지처럼 7단계 진행 + 코드별 이미지로 꾸미기.

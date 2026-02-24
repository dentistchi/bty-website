# BTY Arena 시스템 설계 정리본

단일 문서로 Code/Tier, Dual XP, 리더보드, Sub Name 리네임, Anti-farming, UX 트리거를 정리한 스펙입니다.

---

## 목차

1. [Code · Tier · Sub Name 구조](#1-code--tier--sub-name-구조)
2. [Dual XP (Seasonal / Core)](#2-dual-xp-seasonal--core)
3. [Beginner 종료 + 부스터](#3-beginner-종료--부스터)
4. [리더보드](#4-리더보드)
5. [Sub Name 리네임 규칙 (정체성 보상)](#5-sub-name-리네임-규칙-정체성-보상)
6. [Anti-farming](#6-anti-farming)
7. [UX 트리거 (축하 · 모달)](#7-ux-트리거-축하--모달)
8. [숫자 요약표](#8-숫자-요약표)
9. [구현 체크리스트](#9-구현-체크리스트)

---

## 1. Code · Tier · Sub Name 구조

- **Code는 XP로 직접 결정하지 않음.** Code는 **Tier 기반**.
- **7 Codes**: FORGE → PULSE → FRAME → ASCEND → NOVA → ARCHITECT → CODELESS ZONE
- **1 Code = 100 Tier**
- **1 Tier = Core XP 10** → 1 Code 완성 = Core XP 1,000
- **1년 목표**: Core XP ≈ 1,000 → Code 1개 완성, Stage 2 진입

### Tier → Code · Sub Tier

```
tier = floor(coreXP / 10)
codeIndex = floor(tier / 100)
subTierGroup = floor((tier % 100) / 25)   // 0, 1, 2, 3
```

### 각 Code당 4개 Sub Name (Tier 구간별)

앞선 6개 Code는 구간별 고정 Sub Name을 사용합니다. **CODELESS ZONE**만 예외입니다.

| Tier 구간 | 0–24 | 25–49 | 50–74 | 75–100 |
|-----------|------|-------|-------|--------|
| **FORGE** | Spark | Ember | Flame | Inferno |
| **PULSE** | Echo | Rhythm | Resonance | Surge |
| **FRAME** | Outline | Structure | Framework | Foundation |
| **ASCEND** | Lift | Rise | Elevation | Summit |
| **NOVA** | Glimmer | Radiance | Brilliance | Supernova |
| **ARCHITECT** | Draft | Design | Blueprint | Grand Architect |
| **CODELESS ZONE** | *(사용자 정의)* | *(사용자 정의)* | *(사용자 정의)* | *(사용자 정의)* |

**CODELESS ZONE**  
- Codeless이므로 **고정 Sub Name 없음**.  
- 이 구간에서는 **언제든** 자신이 원할 때 이름(및 이모티콘)을 부여할 수 있음.  
- **7자 내** (이름 + 이모티콘 포함 길이 또는 각각 7자, 구현 시 정의).  
- Tier 25 리네임 1회 제한은 적용하지 않음 → 이 구간에서는 자유 설정.

### 사용자 노출

- **보여줌**: Code 이름, Sub Name, **Core XP**, Seasonal XP
- **숨김**: **Tier 숫자**(0–100), 전환 로직
- **Tier 인지**: Tier 숫자는 노출하지 않음. **25 / 50 / 75 구간 도달 시 축하**로 “티어가 올랐다”는 것만 인지하게 함.

예: `FORGE · Ember` / Core XP: 320 / Seasonal XP: 8,430

---

## 2. Dual XP (Seasonal / Core)

| 구분 | Seasonal XP | Core XP |
|------|-------------|---------|
| 성격 | 경쟁 · 불꽃 · 리셋 | 정체성 · 뿌리 · 영구 |
| 리셋 | 3개월마다, 10% carryover | 없음 |
| 노출 | 사용자에게 숫자 표시 | 사용자에게 숫자 표시 (Tier는 숨기고 Core XP만 노출) |
| 용도 | 리더보드, 시즌 랭킹 | Tier/Code/Sub Name 계산 |

### Seasonal XP 수치 감각

- 시나리오 1회: **25–40 XP**
- 고난도: **~80 XP**
- 시즌 목표(보통): **~10,000 XP**
- 헤비 유저: **~20,000 XP**
- 일일 1,000+도 가능 (캡은 Anti-farming 섹션 참고)

### Seasonal → Core 전환 (비가시)

- **Core XP < 200 (Beginner 구간)**: Seasonal **45** → Core **1**
- **Core XP ≥ 200**: Seasonal **60** → Core **1**
- 누적 소수점은 **내부 버퍼**에 저장, Core 1 단위가 채워질 때만 Tier 반영
- 사용자는 “Tier가 가끔 올라간다”만 경험, 전환 비율은 알 수 없음

---

## 3. Beginner 종료 + 부스터

- **초급(Beginner) 종료 기준**: Core XP ≥ **200** → Tier ≥ **20**
- **의도**: 한 시즌(3개월) 정도 플레이하면 중급(Intermediate) 오픈. 열심히 하면 시즌 중반에도 도달 가능.

### Beginner Boost

- Core XP 0–199 구간에서만 **45:1** 적용 (그 외 60:1)
- 시즌 10,000 XP 달성 시: 10,000 / 45 ≈ **222 Core** → 한 시즌이면 중급 진입
- 15,000 XP면 Core ≈ 333 → Tier 33 수준

---

## 4. 리더보드

### 원칙

- **랭킹**은 보여주되 **낙인**은 만들지 않기 (하위권 공개 최소화)
- **기본 뷰**: 내 주변 ±5명 (Near Me)
- **경쟁 단위**: 시즌(3개월). 시즌마다 10% carryover 후 리셋
- **경쟁 지표**: **Seasonal XP만**. Core XP는 공개, Tier는 비공개(축하로만 상승 인지).
- **보상**: 금전보다 상징·경험(배지, 스페셜 세션, 라운드테이블 등)

### 3가지 뷰

1. **Overall** (전체)
2. **Role** (Doctor / Manager / Staff / DSO)
3. **Office** (지점별)

기본은 **지점/역할 중심**, 전체는 탭으로 확장.

### 정체성 (공개되는 것만)

| 공개 | 비공개 |
|------|--------|
| 순위, Seasonal XP, **Core XP** | 실명, 이메일 |
| Code · Sub Name | 지점, 역할, **Tier 숫자** |
| (예: NOVA · Brilliance · 12,420 XP · Core 670) | |

리더보드 행 예: `#12   NOVA · Brilliance   12,420 XP` (Tier는 표시하지 않음)

---

## 5. Sub Name 리네임 규칙 (정체성 보상)

### 왜 “고심하게” 만드는가

Sub Name은 **숫자 보상이 아니라, 자신을 어떻게 나타낼지 정하는 보상**입니다.

- 리더보드에는 **Code · Sub Name**만 노출되므로, Sub Name이 곧 **공개되는 자기 정체성**.
- 실명·지점·역할은 보이지 않고, **내가 고른 한 단어(또는 짧은 문구)**만 보이게 됩니다.
- 그래서 **새로운 code를 받고 Tier 25를 넘길 때마다 “한 번만 바꿀 수 있는 기회”**를 주어,  
  “지금 나는 이 구간을 뭐라고 부르고 싶은가?”를 **한 번 더 생각하게** 만드는 것이 목적입니다.
- 쉽게 바꿀 수 있으면 의미가 희석되므로, **1회 per Code**로 제한해 **선택의 무게**를 둡니다.

### 규칙 요약

- **언제**: 해당 Code 안에서 **Tier 25 도달 시** 1회 “리네임 기회” 부여  
  (구현상: Tier 25 도달 시 1회)
- **횟수**: **Code당 1회**. 해당 Code에서 리네임을 사용하면, 그 Code 구간 동안은 더 이상 변경 불가.
- **다음 Code 진입 시**: Sub Name은 새 Code의 **기본 4개 이름**(또는 CODELESS ZONE이면 사용자 정의)으로 초기화, 리네임 여부도 리셋.
- **제한**: 최대 **7자**, **욕설/비방 필터** 적용.
- **노출**: 리더보드·프로필에는 **사용자가 정한 Sub Name**이 그대로 표시됨.

### CODELESS ZONE 예외

- **CODELESS ZONE**에서는 고정 Sub Name이 없으므로 **Tier 25 리네임 1회** 제한이 적용되지 않음.
- 이 구간에서는 **언제든** 이름(및 이모티콘)을 설정·변경 가능. 7자 내.
- 리더보드·프로필에는 사용자가 정한 문자열이 그대로 표시됨.

### UX 흐름 (Tier 25 도달 시)

1. 모달: **"Ember Unlocked"** / **"You may rename this phase once."**  
   (이 구간을 자신만의 이름으로 부를 수 있는 일회성 기회임을 전달)
2. 입력창: **Sub Name: [___________]**  
   - placeholder 예: "이 구간을 어떻게 부르고 싶나요?"
   - 7자 제한, 실시간 유효성(필터) 안내
3. 저장 후: **"Sub Name Updated"** 등 짧은 확인 메시지.
4. 이후 같은 Code 구간에서는 리네임 UI 비노출 (이미 사용함).

### 확장 (추후)

- **이모티콘 / 아바타**: “자신을 나타내는 상징”을 게임적 요소로 추가 가능.
- **CODELESS ZONE**에서는 이름과 함께 이모티콘도 7자 내로 자유 설정 가능 (이미 위 규칙에 포함).
- 다른 Code에서도 Tier 75 구간 등에서 **선택 가능한 이모티콘 또는 소량의 아바타 요소** 해금 검토.
- 정체성 = **Sub Name + (선택) 이모티콘**으로 확장하면, 표현의 폭만 넓어지고 “고민하는 보상” 구조는 유지 가능.

---

## 6. Anti-farming

- **일일 Seasonal XP 캡**
  - 일반: **1,200** (soft cap)
  - 헤비: **2,000** (hard cap, 주 2~3회만 허용 등으로 제한)
- **디미니싱 리턴**: 같은 시나리오를 **24시간 이내** 반복 시 XP 감소.
- **품질 게이트**: Step 7 Reflection이 너무 짧거나 무의미하면 XP 감점. Quality Events의 low-quality 비율이 높으면 XP **-30%** 등 적용 검토.
- **부정행위 감지**: 동일 패턴(같은 선택·같은 문장) 반복 시 XP **50%** 감소 등.

---

## 7. UX 트리거 (축하 · 모달)

### Tier 25, 50, 75 구간 도달 시 — 개인 축하

- **비공개** 개인 축하. Tier 숫자는 노출하지 않음.
- 축하로 “티어가 올랐다”는 것만 인지하게 함.
- 짧은 모달 예: **"Ember Unlocked"** / **"You've moved beyond Spark."**
- Tier 25일 때는 **Sub Name 리네임 1회 기회** 안내 (위 5절 참고). (CODELESS ZONE 제외)

### Code 변경 시 — 공개 축하

- **새 Code 진입 시**에만 **공개** 축하 (예: 보드에서 축하 이모티콘, 하루 동안 등).
- 예: **"FRAME unlocked"** / **"You've entered a new Code."**
- Tier 구간(25/50/75)은 개인 축하, **Code 변경은 공개 축하**로 구분.

### 중급(Intermediate) 오픈 (Core XP ≥ 200)

- **한 번만** 노출되는 축하. (공개/개인은 정책에 따라 결정)
- 예: **"Intermediate Mode is now available."**
- 과한 게임 느낌보다는, “이제 더 넓은 콘텐츠가 열렸다”는 안내 톤 유지.

---

## 8. 숫자 요약표

| 항목 | 값 |
|------|-----|
| 1 Tier | Core XP 10 |
| 1 Code | 100 Tier = Core XP 1,000 |
| Beginner 종료 | Core XP ≥ 200 (Tier ≥ 20) |
| Seasonal → Core (Beginner) | 45 : 1 |
| Seasonal → Core (일반) | 60 : 1 |
| 시즌 리셋 | 3개월-2일(2일간의 브레이크후 다음 시즌 시작), 10% carryover |
| 시즌 목표 XP | ~10,000 (헤비 ~20,000) |
| 시나리오 1회 XP | 25–40 (고난도 ~80) |
| 일일 캡 (soft/hard) | 1,200 / 2,000 |
| Sub Name 길이 | 최대 7자, Code당 1회 리네임 (CODELESS ZONE은 언제든 설정) |
| **노출 정책** | **Core XP 공개, Tier 숨김. Tier 상승은 25/50/75 축하로만 인지.** |

---

## 9. 구현 체크리스트

### DB

- [ ] `arena_profiles` 확장: `core_xp_total`, `core_xp_buffer`(소수 누적), `tier`, `code_index`, `sub_name`, `sub_name_renamed_in_code`(boolean)
- [ ] Seasonal: `seasonal_xp_log`, `seasonal_xp_total` (user_id, season_id, total, role, office_id)
- [ ] 시즌 메타: `seasons` (season_id, start_at, end_at)
- [ ] 리더보드 조회용 인덱스 (season_id, total DESC 등)

### API

- [ ] XP 적립 시: Seasonal 증가 + 내부 Core 전환(버퍼 반영), Tier/Code/Sub Tier 재계산
- [ ] `GET /api/arena/profile` 또는 동일: 노출 필드 (seasonal_xp, core_xp, code, sub_name). Tier 미포함.
- [ ] `GET /api/leaderboard?scope=overall|role|office&window=season&nearMe=true` → myRank, myXP, nearMe[], top10[]
- [ ] Sub Name 리네임: `POST /api/arena/sub-name` (tier 25+ 확인, renamed_in_code 확인, 필터, 7자)

### UI

- [ ] 대시보드: Code · Sub Name, Core XP, Seasonal XP 표시 (Tier 숫자 미표시)
- [ ] 리더보드: 3탭(Overall / Role / Office), 기본 Near Me, 행 포맷 `Code · Sub Name · XP` (Tier 없음)
- [ ] Tier 25 도달 모달(개인 축하) + Sub Name 리네임 1회 플로우. CODELESS ZONE은 언제든 이름/이모티콘 설정 UI
- [ ] Code 변경 시 공개 축하. Core XP ≥ 200 시 Intermediate 오픈 모달 1회

---

*문서 버전: 1.0. 정리본.*

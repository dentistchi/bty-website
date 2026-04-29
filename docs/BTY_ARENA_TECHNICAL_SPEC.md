# BTY Arena — Technical Spec

**목적**: 데이터 모델, API, 라우트, 트리거 로직, 챗봇 활성화 조건, UI↔API 매핑을 한 문서로 정의.  
**관련**: `BTY_ARENA_VISUAL_BEHAVIOR_SPEC.md`, `BTY_ARENA_DESIGN_TOKENS.md`, `BTY_ARENA_ERROR_ACCESSIBILITY_MAPPING.md`(에러 상태·접근성·기존 앱 경로 매핑)

---

## 1. 데이터 모델 정의

### WeeklyTarget

```json
{
  "teamId": "string",
  "weekStartDate": "string",
  "weekEndDate": "string",
  "targetXP": "number",
  "currentXP": "number",
  "updatedAt": "string"
}
```

### Team

```json
{
  "teamId": "string",
  "name": "string",
  "organization": "string",
  "roles": "string[]",
  "region": "string",
  "leaderId": "string",
  "members": "string[]"
}
```

### Trend (14일)

```json
{
  "userId": "string",
  "date": "string",
  "stabilityScore": "number",
  "decisionVolatility": "number",
  "resilienceIndex": "number"
}
```

### InsightCard

```json
{
  "type": "success | opportunity | suggestion",
  "text": "string",
  "referenceData": "object"
}
```

---

## 2. API Endpoints

| Method | Endpoint | 용도 |
|--------|----------|------|
| GET | `/api/weekly-targets?teamId={teamId}` | 주간 목표·현재 XP |
| GET | `/api/teams` | 팀 목록 |
| POST | `/api/simulation/complete` | 시뮬레이션 완료 |
| GET | `/api/trends?userId={userId}&days=14` | 14일 트렌드 |
| GET | `/api/insights?userId={userId}&range=14` | 인사이트 카드 |
| POST | `/api/center/safe-mirror` | Safe Mirror 제출 |
| POST | `/api/center/small-wins` | Small Win 추가 |
| POST | `/api/center/self-esteem` | Self-esteem 제출 |
| GET | `/api/center/recovery?userId={userId}` | 회복 요약 |
| POST | `/api/chat/mentor/activate` | 멘토 챗봇 활성화 |
| POST | `/api/trigger/center` | Center 권고/트리거 체크 |

---

## 3. Routes

| 경로 | 화면 |
|------|------|
| `/bty-arena` | Arena Home |
| `/bty-arena/sim` | Arena Simulation |
| `/bty-arena/result` | Arena Result |
| `/bty-arena/board` | Team Board |
| `/foundry` | Foundry Home |
| `/foundry/decision` | Decision Replay Detail |
| `/foundry/stats` | Hidden Stats |
| `/foundry/trend` | Trend Graph |
| `/foundry/insights` | Insight Cards |
| `/center` | Center Entry |
| `/center/safe-mirror` | Safe Mirror Input |
| `/center/small-wins` | Small Wins Capture |
| `/center/self-esteem` | Self-esteem Check |
| `/center/recovery` | Center Mini Recovery |
| `/chat/mentor` | Mentor Chat Panel |
| `/settings/profile` | Settings / Profile |

*실제 앱 경로가 locale·네스팅 적용 시:* `BTY_ARENA_ERROR_ACCESSIBILITY_MAPPING.md` §C 참고.

---

## 4. Trigger Logic (Center 권고)

### 입력 상태값

- `userId`
- `stabilityScore`
- `lossStreak`
- `decisionVolatility`
- `selfEsteemFlag`
- `recentFoundrySkips`

### Risk Score 공식

- **R1** = clamp(12×z_sim + 8×z_min, 0, 35)
- **R2** = clamp(10×lossStreak, 0, 25)
- **R3** = clamp(30×decisionVolatility, 0, 30)
- **R4** = 10 if `selfEsteemFlag` else 0
- **R** = R1 + R2 + R3 + R4

### Foundry 권고

- `recentFoundrySkips >= 3` **OR** `decisionVolatility >= 0.6`

### Center 권고

- **R ≥ 55**  
  **OR** **(R ≥ 45 AND selfEsteemFlag === true)**

### Center 자동 팝업

- **R ≥ 75**

### Trigger API 예시

```http
POST /api/trigger/center
Content-Type: application/json

{
  "userId": "...",
  "riskScore": 62
}
```

---

## 5. 챗봇 활성화 조건 (Safe Mirror)

### 활성 조건

- **조건 1**: `safeMirrorText.length >= 10`
- **조건 2**: 입력 텍스트에 키워드 포함  
  `"feel"`, `"think"`, `"difficult"`, `"proud"`, `"learn"`, `"reflect"`

*(조건 1 OR 조건 2 충족 시 활성화)*

### 챗봇 대화 제한

- 최대 **8 턴** 상호작용

### 챗봇 활성화 API

```http
POST /api/chat/mentor/activate
Content-Type: application/json

{
  "userId": "...",
  "context": "safeMirror",
  "text": "..."
}
```

---

## 6. UI 이벤트 ↔ API 매핑

| UI 이벤트 | API |
|-----------|-----|
| Arena Load | GET `/api/weekly-targets` + GET `/api/teams` |
| Simulation Complete | POST `/api/simulation/complete` |
| Go to Foundry | GET `/api/trends` + GET `/api/insights` |
| Safe Mirror Submit | POST `/api/center/safe-mirror` |
| Small Win Add | POST `/api/center/small-wins` |
| Self-esteem Submit | POST `/api/center/self-esteem` |
| Center Recovery Fetch | GET `/api/center/recovery` |
| Mentor Chat Start | POST `/api/chat/mentor/activate` |
| Trigger Check | POST `/api/trigger/center` |

---

## 7. API ↔ 화면 매핑 (단일 테이블)

각 API Endpoint와 화면이 정확히 매핑되어야 합니다.  
Figma Frame ID가 확정되고, 실제 라우트·화면 흐름이 업데이트되면 **아래 테이블만** 수정하세요.  
→ API 추가/수정 시에도 이 한 테이블만 유지하면 됩니다.

| Screen | Path | API Endpoints | Figma Frame ID |
|--------|------|---------------|-----------------|
| Arena Home | /bty-arena | GET /api/weekly-targets, GET /api/teams | *(TBD)* |
| Arena Simulation | /bty-arena/sim | POST /api/simulation/complete | *(TBD)* |
| Arena Result | /bty-arena/result | (결과 데이터는 simulation/complete 응답 또는 별도 GET) | *(TBD)* |
| Team Board | /bty-arena/board | GET /api/teams | *(TBD)* |
| Foundry Home | /bty-arena/foundry | GET /api/trends, GET /api/insights, POST /api/trigger/center | *(TBD)* |
| Decision Replay Detail | /bty-arena/foundry/decision | GET /api/insights (또는 decision 전용 API) | *(TBD)* |
| Hidden Stats Insight | /bty-arena/foundry/stats | GET /api/trends, GET /api/insights | *(TBD)* |
| Trend Graph Full | /bty-arena/foundry/trend | GET /api/trends | *(TBD)* |
| Foundry Insight Cards | /bty-arena/foundry/insights | GET /api/insights, POST /api/trigger/center | *(TBD)* |
| Center Entry | /bty-arena/center | POST /api/trigger/center | *(TBD)* |
| Safe Mirror | /bty-arena/center/safe-mirror | POST /api/center/safe-mirror, POST /api/chat/mentor/activate | *(TBD)* |
| Small Wins Capture | /bty-arena/center/small-wins | POST /api/center/small-wins | *(TBD)* |
| Self-esteem Check | /bty-arena/center/self-esteem | POST /api/center/self-esteem | *(TBD)* |
| Center Mini Recovery | /bty-arena/center/recovery | GET /api/center/recovery | *(TBD)* |
| Mentor Chat Panel | /bty-arena/chat/mentor | POST /api/chat/mentor/activate | *(TBD)* |
| Settings / Profile | /bty-arena/settings/profile | (프로필/세션 API) | *(TBD)* |

*실제 앱 경로가 locale·네스팅 적용 시:* `BTY_ARENA_ERROR_ACCESSIBILITY_MAPPING.md` §C 참고.  
*기존 앱 API:* `GET /api/arena/core-xp`, `GET /api/arena/leaderboard`, `GET /api/arena/unlocked-scenarios` 등이 있으면 해당 화면 행에 추가.

---

**문서 위치**: `bty-app/docs/BTY_ARENA_TECHNICAL_SPEC.md`  
**참조**: `BTY_ARENA_VISUAL_BEHAVIOR_SPEC.md` §1.5–1.8 (Artboard·Flow·컴포넌트·체크리스트), `BTY_ARENA_DESIGN_TOKENS.md` (색상·반응형·i18n)

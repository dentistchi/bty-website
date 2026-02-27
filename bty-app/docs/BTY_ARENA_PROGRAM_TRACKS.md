# BTY Arena — 프로그램 트랙 (직군별)

버전 1.0. 직군에 따라 **일반 스텝(staff)** 과 **리더 스텝(leader)** 프로그램을 적용한다.

---

## 1. 트랙 정의

| 트랙 | 대상 직군 | 레벨 |
|------|----------|------|
| **일반 스텝 (staff)** | assistant, admin, 초보 의사, hygienist | S1 → S2 → S3 |
| **리더 스텝 (leader)** | 3년차 이상 의사, OM, Regional OM, Director, DSO | L1 → L2 → L3 |

---

## 2. 신입 규칙

**회사에 처음 들어온 사람은 1개월간 일반 스텝 트레이닝을 받는다.**

- 리더 직군(OM, 의사 등)으로 입사해도 **입사 후 30일** 동안은 **일반 스텝(staff)** 프로그램 적용.
- 30일 경과 후부터 직군에 따라 staff / leader 트랙 적용.

---

## 3. 직군 매핑 (코드)

- **staff 트랙**  
  `job_function` ∈ `assistant` | `admin` | `junior_doctor` | `hygienist`
- **leader 트랙**  
  `job_function` ∈ `doctor` | `office_manager` | `regional_om` | `director` | `dso`  
  또는 `membership.role` ∈ `office_manager` | `regional_manager` | `doctor` (role만 있을 때)

`job_function`이 없으면 `membership.role`로 판단.  
`getEffectiveTrack({ jobFunction, membershipRole, joinedAt })` 사용 시 `joinedAt`이 30일 이내면 항상 `"staff"` 반환.

---

## 4. 레벨 언락 (Tenure Only)

**레벨 오픈은 경력(tenure)만으로 결정된다. Tier/XP는 참여·진척도만 반영하며 레벨을 열지 않는다.**

- **Staff 트랙**  
  `tenure_months` = `joinedAt` 기준 경과 달력 월 수.  
  최소 경력: S1=0개월, S2=3개월, S3=12개월.  
  `tenure_basis`: `joinedAt`.
- **Leader 트랙**  
  `tenure_months` = `leaderStartedAt`(OM/Regional/파트너/Clinical Lead 등 리더 역할 시작일) 기준 경과 달력 월 수.  
  없으면 `joinedAt`으로 대체.  
  최소 경력: L1=24개월, L2=60개월, L3=120개월.  
  `tenure_basis`: `leaderStartedAt`.

**엣지 케이스**: 재입사 시 `joinedAt`은 재입사일(이전 경력 자동 합산 없음). Staff→Leader 전환 시 리더 경력은 `leaderStartedAt`부터만. 파트타임 가중 없이 달력 월만 사용.

**코드**: `getMaxUnlockedLevel({ track, joinedAt, leaderStartedAt })` → 해당 트랙에서 열 수 있는 최상위 레벨 id (예: `"S2"`, `"L1"`).  
`tenureMonthsSince(since)` → 기준일부터 현재까지 경과 달력 월.

---

## 5. 설정 파일

- **구조·레벨·tenure**: `src/lib/bty/arena/arena_program.json` (각 레벨에 `min_tenure_months`, `tenure_basis`)
- **로직**: `src/lib/bty/arena/program.ts`
  - `getEffectiveTrack(params)` — 적용 트랙
  - `isNewJoiner(joinedAt)` — 신입 여부 (30일 이내 → staff 강제)
  - `getMaxUnlockedLevel({ track, joinedAt, leaderStartedAt })` — tenure 기준 최대 오픈 레벨
  - `tenureMonthsSince(since)` — 경과 달력 월
  - `loadProgramConfig()` — JSON 설정 반환

---

## 6. 레벨 구조 (참고)

**Staff**  
- S1: situation, role, options, immediate_outcome, team_signal  
- S2: situation, kpi, stakeholder, options, first_order, culture_signal  
- S3: situation, kpi_data, constraint, stakeholder_map, options, short_term, long_term  

**Leader**  
- L1: situation, constraint, stakeholder, options, first_order, second_order, identity_signal  
- L2: situation, kpi_conflict, constraint, stakeholder_map, options, first_order, second_order, identity_signal  
- L3: situation, multi_constraint, stakeholder_power_map, options_architecture, first_order, second_order, identity_signal  

각 레벨의 `items`는 시나리오/콘텐츠.
- **S1(Staff Beginner)**: 20개 (환자 대기 불만, 보험 확인 지연, SSO 커뮤니케이션 오해 등)
- **S2(Staff Intermediate)**: 15개 (보험 Verification 반복 지연, AR 증가, No-show 증가, SSO 톤 오해, 청구 오류, 결제 플랜 오해 등). 구조: situation, kpi, stakeholder, options, first_order, culture_signal
- **S3(Staff Advanced)**: 15개 (SSO 지연+현장 불만, AR 콜 갈등, 대기시간·팀 마찰, 치료 동의율 하락, SSO 커뮤니케이션 오해, 리뷰 대응, 결제 플랜 연체, 체어사이드 인수인계, 재예약률 하락, 신규 환자 온보딩, SSO 업로드 누락, 재고/소모품 부족, 문의 전화 폭주, 치료 지연 안내, 팀 피드백 방식 충돌 등). 구조: situation, kpi_data, constraint, stakeholder_map, options, short_term, long_term

**리더 스텝 (leader)**  
- **L1(Beginner Leader)**: 15개 (SSO 지연 사실 고정, Associate 생산성 코칭 vs PIP, 대기시간 오버북 재설계, Front-Back 갈등 중재, 리뷰 대응 표준화, 결제 플랜 연체, 소모품 재고, 체어턴 병목, 신규 직원 온보딩, 컴플레인 원인 분리, 팀 피드백 방식, SSO 파일 누락, 마감 누락, 예약 공백, 현장-SSO 회의 설계 등). 구조: situation, constraint, stakeholder, options, first_order, second_order, identity_signal
- **L2(Intermediate Leader)**: 15개 (멀티 오피스 No-show 편차, Associate 간 생산성 격차, AR vs 환자 경험, SSO vs 현장 권한 충돌, 마케팅 ROI 충돌, OM 성과 vs 팀 이직, 확장 오피스 적자, 임플란트 케이스 전략, 리뷰 vs 생산성 압박, SSO 비용 재협상, Associate 리텐션 vs 계약, 재고 통합, 보험 네트워크 탈퇴, Regional KPI 공개, AI 도입 파일럿 등). 구조: situation, kpi_conflict, constraint, stakeholder_map, options, first_order, second_order, identity_signal
- **L3(Advanced Leader)**: 15개 (글로벌 SSO 구조 재설계, 확장 속도 vs 조직 역량, EBITDA vs 문화 투자, 보험 네트워크 전략 전환, Regional KPI 투명성, AI 자동화 전면 도입, 고마진 케이스 집중, 멀티 오피스 통합 vs 자율, 투자자 배당 vs 재투자, 리더십 파이프라인, 브랜드 통합, SSO 계약 재구조화, 위기 대응 구조, 가격 전략 전환, 조직 정체성 선언 등). 구조: situation, multi_constraint, stakeholder_power_map, options, first_order, second_order, identity_signal

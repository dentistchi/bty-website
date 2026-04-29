# BTY Arena: Board / BSM Level (L3 다음 단계)

## 정의
- **Board(BSM)** 레벨은 **Leader L3 다음 단계**로, 보드/전략 의사결정 시나리오를 다룹니다.
- L3는 기존대로 시나리오를 유지하며, 별도로 영어 시나리오 등을 추가할 예정입니다.

## 구조 (structure)
| 필드 | 설명 |
|------|------|
| `macro_environment` | 거시 환경 (산업·밸류에이션 등) |
| `trigger_event` | 보드가 결의를 내리게 된 계기 |
| `board_composition` | 이사회 구성 |
| `power_distribution` | 의결권/권력 분포 |
| `motion_proposal` | 상정 안건(모션) |
| `coalition_options` | 연합 옵션 배열 `[{ coalition, argument }]` |
| `vote_scenarios` | 투표 시나리오 배열 `[{ result, outcome }]` |
| `five_year_projection` | 5년 시나리오 `{ if_pass, if_fail }` 등 |
| `identity_shift` | 정체성 전환 질문 (예: Asset platform vs. generational group) |

## 데이터 위치
- **설정**: `src/lib/bty/arena/arena_board_program.json`
- **템플릿 참조**: `src/lib/bty/arena/arena_l3_scenario_template.json` → BSM 구조 참고용 (L3가 아님)

## 언락
- L3 완료 또는 tenure/정책에 따른 Board 단계 도달 시 노출하도록 설계 가능.

---

## Legacy 트랙 · L4_Board (vote-math 형식)

**track**: `legacy`, **level**: `L4_Board`. 보드 의결 구조·투표 수학을 강조한 시나리오.

### 구조 (structure)
| 필드 | 설명 |
|------|------|
| `macro_context` | 거시 환경 |
| `trigger_event` | 결의 촉발 사건 |
| `board_structure` | 이사회 구성 설명 |
| `voting_weights` | 의결권 비중 객체 |
| `motion` | 상정 모션 |
| `coalition_paths` | 연합 시나리오 (선택, 문자열 배열) |
| `vote_math` | 투표 요건 객체 (threshold 등) |
| `if_pass_5yr` | 가결 시 5년 시나리오 |
| `if_fail_5yr` | 부결 시 5년 시나리오 |
| `institutional_shift` | 제도·정체성 전환 질문 |

### 데이터 위치
- **영어 (L4_Board)**: `src/lib/bty/arena/arena_legacy_program.json` — L4_01 ~ L4_15
- **한국어 (L4_Board_KO)**: `src/lib/bty/arena/arena_legacy_program_ko.json` — L4K_01 ~ L4K_15

### 구조 필드 매핑 (EN ↔ KO)
| EN (L4_Board) | KO (L4_Board_KO) |
|---------------|------------------|
| macro_context | 거시_환경 |
| trigger_event | 발생_사건 |
| board_structure | 이사회_구성 |
| voting_weights | 의결권_구조 |
| motion | 상정_안건 |
| coalition_paths | 연합_가능성 |
| vote_math | 의결_수치 |
| if_pass_5yr | 5년후_가결시 |
| if_fail_5yr | 5년후_부결시 |
| institutional_shift | 정체성_변화 |

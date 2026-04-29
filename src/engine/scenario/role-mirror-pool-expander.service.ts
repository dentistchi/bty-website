/**
 * Role-mirror (역지사지) curated pool v2: 24 bilingual templates with explicit
 * `origin_flag_type` coverage for Arena mentor buckets + LRU in {@link getRoleMirrorScenario}.
 *
 * POV mix: 7 subordinate, 4 peer, 3 client-facing; remainder neutral/leadership roles.
 */

/** Canonical flag buckets used by Arena / delayed outcome routing. */
export type RoleMirrorOriginFlag =
  | "HERO_TRAP"
  | "INTEGRITY_SLIP"
  | "CLEAN"
  | "ROLE_MIRROR";

export type ExpandedRoleMirrorPoolEntry = {
  id: string;
  titleKo: string;
  titleEn: string;
  bodyKo: string;
  bodyEn: string;
  origin_flag_type: RoleMirrorOriginFlag;
  target_role: string;
  difficulty: 1 | 2 | 3;
  /** Migration / analytics: v2 expanded pool (replaces legacy 10-entry pool). */
  pool_version: 2;
};

/** 24 entries: 8 HERO_TRAP + 8 INTEGRITY_SLIP + 4 CLEAN + 4 ROLE_MIRROR. */
export const EXPANDED_ROLE_MIRROR_POOL: readonly ExpandedRoleMirrorPoolEntry[] = [
  // —— HERO_TRAP (8): leadership / over-function ——
  {
    id: "rmv2_ht01",
    titleEn: "Assistant asked to “fix” the schedule the doctor already broke",
    titleKo: "의사가 이미 망친 스케줄을 어시스턴트가 ‘수습’하라고 할 때",
    bodyEn:
      "You are the dental assistant pulled into the operatory between patients to reshuffle columns because the lead doctor double-booked. Mirror: set a boundary without rescuing the whole day alone.",
    bodyKo:
      "리드 의사가 이중 예약을 남긴 뒤, 환자 사이마다 오퍼레토리로 끌려가 열을 다시 짜야 하는 치과 어시스턴트입니다. 역지사지: 하루 전체를 혼자 구하지 않으면서 경계를 세웁니다.",
    origin_flag_type: "HERO_TRAP",
    target_role: "dental_assistant",
    difficulty: 2,
    pool_version: 2,
  },
  {
    id: "rmv2_ht02",
    titleEn: "Clinical assistant covering sterilization gaps “just today”",
    titleKo: "멸균 공백을 ‘오늘만’ 메우는 임상 어시스턴트",
    bodyEn:
      "You are the clinical assistant asked to skip documentation steps to keep chairs full. Mirror: name the risk and propose one sustainable fix.",
    bodyKo:
      "체어를 채우려 문서 단계를 건너뛰라는 압박을 받는 임상 어시스턴트입니다. 역지사지: 위험을 명명하고 지속 가능한 한 가지 해결을 제안합니다.",
    origin_flag_type: "HERO_TRAP",
    target_role: "clinical_assistant",
    difficulty: 1,
    pool_version: 2,
  },
  {
    id: "rmv2_ht03",
    titleEn: "Peer dentist carries your production narrative to the patient",
    titleKo: "동료 의사가 환자에게 당신의 생산 내러티브를 전달할 때",
    bodyEn:
      "You are the peer dentist who sees the associate being framed as “the slow one.” Mirror: correct the story without shaming the room.",
    bodyKo:
      "어소시에트가 ‘느린 쪽’으로 프레임되는 것을 보는 동료 의사입니다. 역지사지: 자리를 부끄럽게 하지 않고 이야기를 바로잡습니다.",
    origin_flag_type: "HERO_TRAP",
    target_role: "peer_dds",
    difficulty: 2,
    pool_version: 2,
  },
  {
    id: "rmv2_ht04",
    titleEn: "Hygienist asked to add a “quick” exam for free",
    titleKo: "위생사에게 ‘공짜로’ 짧은 검진을 추가하라 할 때",
    bodyEn:
      "You are the hygienist pressured to absorb an exam the front promised. Mirror: protect scope without becoming the villain.",
    bodyKo:
      "프론트가 약속한 검진을 흡수하라는 압박을 받는 위생사입니다. 역지사지: 악역이 되지 않으면서 범위를 지킵니다.",
    origin_flag_type: "HERO_TRAP",
    target_role: "peer_hygienist",
    difficulty: 2,
    pool_version: 2,
  },
  {
    id: "rmv2_ht05",
    titleEn: "Practice manager smoothing every conflict before lunch",
    titleKo: "점심 전 모든 갈등을 매끄럽게 덮는 실장",
    bodyEn:
      "You are the practice manager who jumps in to rescue every tense huddle. Mirror: delegate tension back to owners of the work.",
    bodyKo:
      "긴장한 허들마다 뛰어들어 구하는 실장입니다. 역지사지: 긴장을 일의 주인에게 돌려보냅니다.",
    origin_flag_type: "HERO_TRAP",
    target_role: "practice_manager",
    difficulty: 3,
    pool_version: 2,
  },
  {
    id: "rmv2_ht06",
    titleEn: "Associate taking night-calls the owner “forgot” to rotate",
    titleKo: "원장이 ‘깜빡’ 순환하지 않은 야간 연락을 떠안는 어소시에트",
    bodyEn:
      "You are the associate covering after-hours messages again. Mirror: negotiate fairness without apologizing for having limits.",
    bodyKo:
      "또다시 시간 외 연락을 떠안는 어소시에트입니다. 역지사지: 한계를 사과하지 않고 공정함을 협상합니다.",
    origin_flag_type: "HERO_TRAP",
    target_role: "associate_dds",
    difficulty: 2,
    pool_version: 2,
  },
  {
    id: "rmv2_ht07",
    titleEn: "Lead dentist defending throughput over consent pauses",
    titleKo: "동의 멈춤보다 처리량을 옹호하는 리드 의사",
    bodyEn:
      "You are the lead dentist rushing past consent checkpoints to hit daily targets. Mirror: model slowing down without losing authority.",
    bodyKo:
      "일일 목표를 위해 동의 확인을 지나치게 재촉하는 리드 의사입니다. 역지사지: 권위를 잃지 않고 속도를 늦추는 모델을 보입니다.",
    origin_flag_type: "HERO_TRAP",
    target_role: "lead_dds",
    difficulty: 3,
    pool_version: 2,
  },
  {
    id: "rmv2_ht08",
    titleEn: "Hygiene coordinator absorbing every last-minute swap",
    titleKo: "급한 스왑을 전부 떠안는 위생 코디네이터",
    bodyEn:
      "You are the hygiene coordinator who rearranges everyone else’s chaos. Mirror: reset expectations with the front and doctors in one thread.",
    bodyKo:
      "다른 사람의 혼란을 모두 재배치하는 위생 코디네이터입니다. 역지사지: 프론트와 의사에게 기대를 한 흐름에서 바로잡습니다.",
    origin_flag_type: "HERO_TRAP",
    target_role: "hygiene_coordinator",
    difficulty: 2,
    pool_version: 2,
  },

  // —— INTEGRITY_SLIP (8): boundaries / values ——
  {
    id: "rmv2_is01",
    titleEn: "Sterilization log challenged—you signed anyway",
    titleKo: "멸균 기록이 문제인데 서명을 했을 때",
    bodyEn:
      "You are the sterile tech asked to backdate a log. Mirror: refuse with procedure language and escalate once.",
    bodyKo:
      "기록을 소급하라는 요청을 받은 멸균 담당입니다. 역지사지: 절차 언어로 거절하고 한 번만 상위 보고합니다.",
    origin_flag_type: "INTEGRITY_SLIP",
    target_role: "sterile_tech",
    difficulty: 2,
    pool_version: 2,
  },
  {
    id: "rmv2_is02",
    titleEn: "Second sterilization bay—ambiguous handoff",
    titleKo: "두 번째 멸균 베이—모호한 인수인계",
    bodyEn:
      "You are another sterile tech left with unclear accountability between shifts. Mirror: name the gap and propose a single checklist owner.",
    bodyKo:
      "교대 사이 책임이 불명확한 또 다른 멸균 담당입니다. 역지사지: 공백을 명명하고 체크리스트 주인을 한 명 정합니다.",
    origin_flag_type: "INTEGRITY_SLIP",
    target_role: "sterile_tech",
    difficulty: 3,
    pool_version: 2,
  },
  {
    id: "rmv2_is03",
    titleEn: "Scheduling coordinator pressured to hide wait times",
    titleKo: "대기 시간을 숨기라는 압박을 받는 스케줄 코디네이터",
    bodyEn:
      "You are the scheduling coordinator told to soft-pedal delays in messages. Mirror: communicate honestly without torching relationships.",
    bodyKo:
      "메시지에서 지연을 축소하라는 지시를 받은 스케줄 코디네이터입니다. 역지사지: 관계를 태우지 않고 정직하게 전달합니다.",
    origin_flag_type: "INTEGRITY_SLIP",
    target_role: "scheduling_coord",
    difficulty: 2,
    pool_version: 2,
  },
  {
    id: "rmv2_is04",
    titleEn: "Co-manager sees revenue target override clinical triage",
    titleKo: "매출 목표가 임상 트리아지를 덮어쓸 때 보는 공동 매니저",
    bodyEn:
      "You are the co-manager who hears triage being bent for production. Mirror: surface the conflict to both owners with data, not drama.",
    bodyKo:
      "생산을 위해 트리아지가 휘어지는 말을 듣는 공동 매니저입니다. 역지사지: 드라마 없이 데이터로 양쪽 오너에게 갈등을 드러냅니다.",
    origin_flag_type: "INTEGRITY_SLIP",
    target_role: "co_manager",
    difficulty: 2,
    pool_version: 2,
  },
  {
    id: "rmv2_is05",
    titleEn: "Specialty peer suggests unbundling consent steps",
    titleKo: "전문의 동료가 동의 단계를 분리하자고 할 때",
    bodyEn:
      "You are the specialty peer tempted to trim consent to fit the slot. Mirror: hold the line with a patient-centered reason.",
    bodyKo:
      "슬롯에 맞추려 동의를 줄이고 싶은 전문의 동료입니다. 역지사지: 환자 중심 이유로 선을 유지합니다.",
    origin_flag_type: "INTEGRITY_SLIP",
    target_role: "specialty_peer",
    difficulty: 3,
    pool_version: 2,
  },
  {
    id: "rmv2_is06",
    titleEn: "Office manager asked to “lose” a patient complaint note",
    titleKo: "환자 불만 메모를 ‘없애’ 달라는 요청을 받는 오피스 매니저",
    bodyEn:
      "You are the office manager pressured to delete documentation. Mirror: document ethically and route to compliance language.",
    bodyKo:
      "기록 삭제 압박을 받는 오피스 매니저입니다. 역지사지: 윤리적으로 기록하고 컴플라이언스 언어로 전달합니다.",
    origin_flag_type: "INTEGRITY_SLIP",
    target_role: "office_manager",
    difficulty: 2,
    pool_version: 2,
  },
  {
    id: "rmv2_is07",
    titleEn: "Specialist DDS tempted to chart optimism",
    titleKo: "차트에 낙관만 적고 싶은 전문의",
    bodyEn:
      "You are the specialist who wants to avoid a hard conversation on the record. Mirror: chart accurately and offer next-step clarity.",
    bodyKo:
      "기록에서 어려운 대화를 피하고 싶은 전문의입니다. 역지사지: 정확히 기록하고 다음 단계 명료성을 제공합니다.",
    origin_flag_type: "INTEGRITY_SLIP",
    target_role: "specialist_dds",
    difficulty: 2,
    pool_version: 2,
  },
  {
    id: "rmv2_is08",
    titleEn: "Team member stays silent in a rushed huddle",
    titleKo: "급한 허들에서 침묵하는 팀원",
    bodyEn:
      "You are the team member who notices a safety shortcut but stays quiet. Mirror: speak up with one concrete observation and ask.",
    bodyKo:
      "안전 지름길을 보지만 조용히 넘기는 팀원입니다. 역지사지: 한 가지 관찰로 말하고 질문합니다.",
    origin_flag_type: "INTEGRITY_SLIP",
    target_role: "team_member",
    difficulty: 1,
    pool_version: 2,
  },

  // —— CLEAN (4): clarity / clean communication ——
  {
    id: "rmv2_cl01",
    titleEn: "Lab tech receives conflicting prescriptions",
    titleKo: "상충하는 처방을 받는 기공/랩 테크",
    bodyEn:
      "You are the lab tech with two incompatible Rx versions. Mirror: reconcile with a single written thread and timestamp.",
    bodyKo:
      "서로 맞지 않는 Rx 두 벌을 받은 랩 테크입니다. 역지사지: 타임스탬프가 있는 하나의 글로 정리합니다.",
    origin_flag_type: "CLEAN",
    target_role: "lab_tech",
    difficulty: 1,
    pool_version: 2,
  },
  {
    id: "rmv2_cl02",
    titleEn: "Patient confused by insurance vs. clinical estimate",
    titleKo: "보험과 임상 견적이 헷갈리는 환자",
    bodyEn:
      "You are the patient hearing different numbers at desk and chair. Mirror: ask for one plain-language reconciliation.",
    bodyKo:
      "데스크와 체어에서 다른 숫자를 듣는 환자입니다. 역지사지: 한 가지 쉬운 언어로 정리해 달라고 요청합니다.",
    origin_flag_type: "CLEAN",
    target_role: "patient",
    difficulty: 1,
    pool_version: 2,
  },
  {
    id: "rmv2_cl03",
    titleEn: "Caregiver needs a single point of contact",
    titleKo: "단일 연락 담당이 필요한 보호자",
    bodyEn:
      "You are the caregiver juggling multiple portals and texts. Mirror: request one channel and one owner without blame.",
    bodyKo:
      "여러 포털과 문자를 오가는 보호자입니다. 역지사지: 비난 없이 한 채널과 한 담당을 요청합니다.",
    origin_flag_type: "CLEAN",
    target_role: "caregiver",
    difficulty: 2,
    pool_version: 2,
  },
  {
    id: "rmv2_cl04",
    titleEn: "Treatment coordinator closing the loop after consult",
    titleKo: "상담 후 고리를 닫는 트리트먼트 코디네이터",
    bodyEn:
      "You are the treatment coordinator ensuring the patient knows fees, sequence, and who to call. Mirror: confirm understanding in one recap.",
    bodyKo:
      "비용·순서·연락처를 환자가 알게 하는 트리트먼트 코디네이터입니다. 역지사지: 한 번의 요약으로 이해를 확인합니다.",
    origin_flag_type: "CLEAN",
    target_role: "treatment_coordinator",
    difficulty: 2,
    pool_version: 2,
  },

  // —— ROLE_MIRROR (4): empathy / perspective ——
  {
    id: "rmv2_rm01",
    titleEn: "Front desk associate catching the patient’s frustration first",
    titleKo: "먼저 환자의 좌절을 받는 프론트 데스크",
    bodyEn:
      "You are the front desk associate who hears anger before the clinical team does. Mirror: validate without over-promising fixes.",
    bodyKo:
      "임상팀보다 먼저 분노를 듣는 프론트입니다. 역지사지: 해결을 과장 약속하지 않고 공감합니다.",
    origin_flag_type: "ROLE_MIRROR",
    target_role: "front_desk_associate",
    difficulty: 2,
    pool_version: 2,
  },
  {
    id: "rmv2_rm02",
    titleEn: "Parent deciding for a teen patient",
    titleKo: "청소년 환자를 위해 결정하는 부모",
    bodyEn:
      "You are the parent balancing autonomy and safety in the operatory. Mirror: voice one worry and one hope clearly.",
    bodyKo:
      "오퍼레토리에서 자율과 안전 사이의 부모입니다. 역지사지: 걱정 하나와 희망 하나를 분명히 말합니다.",
    origin_flag_type: "ROLE_MIRROR",
    target_role: "parent_patient",
    difficulty: 2,
    pool_version: 2,
  },
  {
    id: "rmv2_rm03",
    titleEn: "Owner dentist imagining the patient’s next visit",
    titleKo: "환자의 다음 방문을 상상하는 원장",
    bodyEn:
      "You are the owner dentist picturing continuity of care across providers. Mirror: state one commitment the team can keep.",
    bodyKo:
      "여러 제공자에 걸린 연속 치료를 그리는 원장입니다. 역지사지: 팀이 지킬 수 있는 약속 한 가지를 말합니다.",
    origin_flag_type: "ROLE_MIRROR",
    target_role: "owner_dds",
    difficulty: 3,
    pool_version: 2,
  },
  {
    id: "rmv2_rm04",
    titleEn: "Patient advocate in a complex case conference",
    titleKo: "복합 케이스 회의의 환자 옹호자",
    bodyEn:
      "You are the patient advocate ensuring preferences are heard amid specialists. Mirror: reflect back the patient’s words once.",
    bodyKo:
      "전문의들 사이에서 선호를 드러내게 하는 옹호자입니다. 역지사지: 환자의 말을 한 번 되돌려 말합니다.",
    origin_flag_type: "ROLE_MIRROR",
    target_role: "patient_advocate",
    difficulty: 2,
    pool_version: 2,
  },
];

function assertExpandedPoolCoverage(pool: readonly ExpandedRoleMirrorPoolEntry[]): void {
  if (pool.length !== 24) {
    throw new Error(`EXPANDED_ROLE_MIRROR_POOL: expected 24 entries, got ${pool.length}`);
  }
  const want: Record<RoleMirrorOriginFlag, number> = {
    HERO_TRAP: 8,
    INTEGRITY_SLIP: 8,
    CLEAN: 4,
    ROLE_MIRROR: 4,
  };
  const got: Record<string, number> = {};
  for (const e of pool) {
    got[e.origin_flag_type] = (got[e.origin_flag_type] ?? 0) + 1;
  }
  for (const k of Object.keys(want) as RoleMirrorOriginFlag[]) {
    if (got[k] !== want[k]) {
      throw new Error(`EXPANDED_ROLE_MIRROR_POOL: ${k} expected ${want[k]}, got ${got[k] ?? 0}`);
    }
  }
  const sub = pool.filter((p) =>
    [
      "dental_assistant",
      "clinical_assistant",
      "sterile_tech",
      "scheduling_coord",
      "lab_tech",
      "front_desk_associate",
    ].includes(p.target_role),
  ).length;
  const peer = pool.filter((p) =>
    ["peer_dds", "peer_hygienist", "co_manager", "specialty_peer"].includes(p.target_role),
  ).length;
  const client = pool.filter((p) => ["patient", "caregiver", "parent_patient"].includes(p.target_role)).length;
  if (sub !== 7 || peer !== 4 || client !== 3) {
    throw new Error(
      `EXPANDED_ROLE_MIRROR_POOL: POV coverage expected subordinate 7, peer 4, client 3; got ${sub}, ${peer}, ${client}`,
    );
  }
}

assertExpandedPoolCoverage(EXPANDED_ROLE_MIRROR_POOL);

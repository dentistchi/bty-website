/**
 * KO ACTION CONTRACT V1 — THE CORPUS (Slice R4-R10A).
 *
 * Written BEFORE the detectors, and deliberately not adjusted to fit them afterwards. Sixty-six
 * fixtures across five Host contexts, because a one-context corpus proves only that a rule fits
 * one sentence — which is how the English-only detectors came to look adequate for four slices.
 *
 * WHAT EACH FIXTURE IS: the ACTION the model owns (`action_verb` + `action_detail`, composed the
 * way the server composes them), judged against a Host context the server owns. `expect` is what
 * the product SHOULD do, argued from the authority boundary, never from what the code does today.
 */
import type { BuilderAnswers } from "./module-builder";

export type KoContext = {
  readonly id: string;
  readonly answers: BuilderAnswers;
  readonly trigger: string;
  readonly criterion: string;
};

const ctx = (id: string, audienceType: string, audienceDetail: string | null, trigger: string, criterion: string, behavior: string): KoContext => ({
  id,
  trigger,
  criterion,
  answers: {
    title: id,
    problem: `${id} 문제`,
    audienceType,
    ...(audienceDetail ? { audienceDetail } : {}),
    recurringMoment: trigger,
    observableBehavior: behavior,
    successEvidence: criterion,
    evidenceType: "seen",
    materialIntent: "written",
    materialText: "한 장짜리 안내",
  } as unknown as BuilderAnswers,
});

/** Five distinct Host contexts, with different audiences and different moment shapes. */
export const KO_CONTEXTS: readonly KoContext[] = [
  ctx("meeting", "leaders", "팀 리더", "회의가 끝나기 전에 다음 할 일을 정할 때",
      "각 할 일마다 담당자와 마감일이 정해져 있다.", "담당자와 마감일을 정한다."),
  ctx("handover", "everyone", null, "업무를 다른 사람에게 넘길 때",
      "받은 사람이 해야 할 일을 정확히 설명할 수 있다.", "해야 할 일과 완료 시점을 말한다."),
  ctx("shift", "job_group", "간호사", "교대 인수인계를 시작할 때",
      "인수인계 기록에 복창이 표시된다.", "투약량을 복창한다."),
  ctx("support", "job_group", "상담원", "고객 문의를 종료하기 전에",
      "다음 조치가 티켓에 기록되어 있다.", "다음 조치를 기록한다."),
  ctx("release", "leaders", "엔지니어링 리드", "배포를 승인하기 전에",
      "점검 항목이 모두 확인 표시되어 있다.", "점검 항목을 확인한다."),
];

/**
 * `accept_inert_role` IS A CHANGED SPECIFICATION, NOT A FIXTURE BENT TO THE CODE (Slice V1-R2).
 *
 * Seven fixtures below were written `refuse_actor` because the model had named the Host's own
 * audience as the subject. V1-R2 re-decided that question and this file records the re-decision
 * in the open rather than editing the verdicts quietly:
 *
 *   · the refusal could not be kept without also refusing legitimate Korean. `팀 리더가 승인한
 *     내용을 기록한다` is an embedded relative clause and `팀 리더가 핵심 내용을 확인한다` is a
 *     reclaim; they share their first three tokens, and separating them is clause parsing.
 *   · the refusal protected nothing a person reads. THE STANDARD is the Host's own sentence, the
 *     actor is server-written, and no path persists the contract — so the subject the model wrote
 *     reaches neither the learner nor the Host.
 *
 * So these seven are ACCEPTED, and the expectation says WHY they are accepted, which plain
 * `accept` would not. They are a tolerated defect, not good output: the prompt still forbids
 * writing a subject, and `koActorAuthority.test.ts` asserts the invariants that make tolerating
 * it safe. The second-person fixtures in the same block are untouched and still refuse.
 */
export type Expectation = "accept" | "accept_inert_role" | "refuse_actor" | "refuse_moment" | "refuse_language";

export type Fixture = {
  readonly context: string;
  readonly label: string;
  readonly verb: string;
  readonly detail: string;
  readonly expect: Expectation;
  readonly why: string;
};

const f = (context: string, label: string, verb: string, detail: string, expect: Expectation, why: string): Fixture =>
  ({ context, label, verb, detail, expect, why });

export const KO_ACTION_FIXTURES: readonly Fixture[] = [
  // ── 20 KO CLEAN ────────────────────────────────────────────────────────────
  f("meeting", "clean/owner+deadline", "확인하다", "담당자와 마감일을 확인한다", "accept", "object reference, no actor, no moment"),
  f("meeting", "clean/name aloud", "말하다", "담당자와 마감일을 소리 내어 말한다", "accept", "concrete and observable"),
  f("meeting", "clean/write down", "적다", "정해진 담당자와 마감일을 회의록에 적는다", "accept", "a record is not a criterion restatement"),
  f("meeting", "clean/read back", "복창하다", "정해진 담당자와 마감일을 복창한다", "accept", "observable speech act"),
  f("handover", "clean/state tasks", "말하다", "해야 할 일과 완료 시점을 말한다", "accept", "the Host's own shape, cleanly"),
  f("handover", "clean/confirm understanding", "확인하다", "상대가 이해한 내용을 한 번 확인한다", "accept", "no actor named"),
  f("handover", "clean/hand over list", "전달하다", "남은 일의 목록을 전달한다", "accept", "plain action"),
  f("handover", "clean/ask back", "묻다", "무엇을 언제까지 해야 하는지 되묻는다", "accept", "a statement, not an interrogative action"),
  f("shift", "clean/read dose", "복창하다", "투약량을 복창한다", "accept", "the Host's behaviour"),
  f("shift", "clean/sign", "서명하다", "복창한 내용을 확인하고 서명한다", "accept", "two verbs, still one action phrase"),
  f("shift", "clean/mark record", "표시하다", "인수인계 기록에 복창 여부를 표시한다", "accept", "record-marking is observable"),
  f("support", "clean/log next step", "기록하다", "다음 조치를 티켓에 기록한다", "accept", "plain"),
  f("support", "clean/summarise", "요약하다", "합의한 내용을 한 문장으로 요약한다", "accept", "plain"),
  f("support", "clean/read back to customer", "확인하다", "고객에게 다음 조치를 확인한다", "accept", "recipient is an object, not the actor"),
  f("release", "clean/tick items", "확인하다", "점검 항목을 하나씩 확인한다", "accept", "plain"),
  f("release", "clean/record approver", "남기다", "확인한 항목의 기록을 남긴다", "accept", "plain"),
  f("release", "clean/raise blocker", "알리다", "확인되지 않은 항목을 알린다", "accept", "plain"),
  f("meeting", "clean/assign one owner", "정하다", "할 일마다 담당자 한 명을 정한다", "accept", "person noun as object"),
  f("handover", "clean/deadline only", "정하다", "완료 시점을 함께 정한다", "accept", "plain"),
  f("shift", "clean/double check", "대조하다", "기록과 실제 투약량을 대조한다", "accept", "plain"),

  // ── 10 KO WHO-RECLAIM ──────────────────────────────────────────────────────
  f("meeting", "actor/팀 리더가", "확인하다", "팀 리더가 담당자와 마감일을 확인한다", "accept_inert_role", "names the Host's audience as subject — V1-R2: reachable, and inert"),
  f("meeting", "actor/팀 리더는", "확인하다", "팀 리더는 담당자와 마감일을 확인한다", "accept_inert_role", "topic marker, same reclaim — V1-R2: same verdict as the subject marker"),
  f("meeting", "actor/리더가", "확인하다", "리더가 담당자와 마감일을 확인한다", "accept_inert_role", "shortened role — V1-R2: indistinguishable from 리더가 요청한 …"),
  f("meeting", "actor/당신이", "확인하다", "당신이 담당자와 마감일을 확인한다", "refuse_actor", "second person — the server writes the actor"),
  f("handover", "actor/당신은", "말하다", "당신은 해야 할 일을 말한다", "refuse_actor", "second person, topic marker"),
  f("handover", "actor/여러분이", "말하다", "여러분이 완료 시점을 말한다", "refuse_actor", "plural second person"),
  f("shift", "actor/간호사가", "복창하다", "간호사가 투약량을 복창한다", "accept_inert_role", "the Host's own audience detail — V1-R2 accepts here; the one-token role is refused earlier by actionVerbDefect when it leads the action"),
  f("shift", "actor/간호사는", "복창하다", "간호사는 투약량을 복창한다", "accept_inert_role", "topic marker — same as above"),
  f("support", "actor/상담원이", "기록하다", "상담원이 다음 조치를 기록한다", "accept_inert_role", "audience detail as subject — inert intermediate variance"),
  f("release", "actor/엔지니어링 리드가", "확인하다", "엔지니어링 리드가 점검 항목을 확인한다", "accept_inert_role", "multi-word audience detail — the shape that bypasses the arity gate; see koActorAuthority T9"),

  // ── 10 KO WHEN-RECLAIM ─────────────────────────────────────────────────────
  f("meeting", "moment/verbatim trigger", "확인하다", "회의가 끝나기 전에 다음 할 일을 정할 때 담당자를 확인한다", "refuse_moment", "the Host's moment, verbatim"),
  f("meeting", "moment/near verbatim", "확인하다", "회의가 끝나기 전에 담당자와 마감일을 확인한다", "refuse_moment", "the Host's moment, shortened"),
  f("meeting", "moment/every time", "확인하다", "회의 때마다 담당자와 마감일을 확인한다", "refuse_moment", "frequency over the Host's occasion"),
  f("handover", "moment/넘길 때", "말하다", "업무를 넘길 때 해야 할 일을 말한다", "refuse_moment", "restates the handover moment"),
  f("handover", "moment/전에", "말하다", "업무를 넘기기 전에 완료 시점을 말한다", "refuse_moment", "same occasion, different particle"),
  f("shift", "moment/시작할 때", "복창하다", "인수인계를 시작할 때 투약량을 복창한다", "refuse_moment", "the Host's moment"),
  f("shift", "moment/매번", "복창하다", "매번 투약량을 복창한다", "refuse_moment", "bare frequency adverbial is a moment claim"),
  f("support", "moment/종료하기 전에", "기록하다", "문의를 종료하기 전에 다음 조치를 기록한다", "refuse_moment", "the Host's moment"),
  f("release", "moment/승인하기 전에", "확인하다", "배포를 승인하기 전에 점검 항목을 확인한다", "refuse_moment", "the Host's moment"),
  f("release", "moment/항상", "확인하다", "항상 점검 항목을 확인한다", "refuse_moment", "bare frequency adverbial"),

  // ── 10 MIXED SCRIPT — 5 legitimate, 5 real leaks ───────────────────────────
  f("support", "mixed-ok/KPI", "확인하다", "KPI를 확인한다", "accept", "acronym as object — must survive"),
  f("support", "mixed-ok/CRM", "기록하다", "CRM에 다음 조치를 기록한다", "accept", "product category — must survive"),
  f("shift", "mixed-ok/QR", "스캔하다", "QR 코드를 스캔한다", "accept", "code type — must survive"),
  f("support", "mixed-ok/Slack", "공유하다", "Slack에 요약을 공유한다", "accept", "product name — must survive"),
  f("release", "mixed-ok/API+HIPAA", "확인하다", "API 점검과 HIPAA 항목을 확인한다", "accept", "two acronyms, still Korean prose"),
  f("meeting", "mixed-leak/during", "확인하다", "during the meeting 담당자를 확인한다", "refuse_moment", "English moment inside Korean"),
  f("meeting", "mixed-leak/actor EN", "확인하다", "the team leader가 담당자를 확인한다", "refuse_actor", "English actor with Korean marker"),
  f("handover", "mixed-leak/before EN", "말하다", "before handover 해야 할 일을 말한다", "refuse_moment", "English moment clause"),
  f("release", "mixed-leak/every release", "확인하다", "every release 점검 항목을 확인한다", "refuse_moment", "English frequency"),
  f("shift", "mixed-leak/you EN", "복창하다", "you 투약량을 복창한다", "refuse_actor", "English second person"),

  // ── 6 KO LANGUAGE MISMATCH (fully English prose for a KO training) ─────────
  f("meeting", "lang/full EN clean", "confirm", "the owner and deadline", "refuse_language", "no Korean at all in a KO training"),
  f("handover", "lang/full EN", "state", "the tasks and the completion time", "refuse_language", "no Korean at all"),
  f("shift", "lang/full EN", "read", "the dose back aloud", "refuse_language", "no Korean at all"),
  f("support", "lang/full EN", "log", "the next step in the ticket", "refuse_language", "no Korean at all"),
  f("release", "lang/full EN", "check", "each item on the list", "refuse_language", "no Korean at all"),
  f("meeting", "lang/acronym only", "check", "the KPI", "refuse_language", "acronyms do not make it Korean"),
];

/** EN regression: the same authority questions, in the locale the detectors were built for. */
export const EN_ACTION_FIXTURES: readonly Fixture[] = [
  f("meeting", "en/clean", "confirm", "the owner and deadline", "accept", "clean English action"),
  f("meeting", "en/actor 'you'", "you", "confirm the owner and deadline", "refuse_actor", "second person at the head — currently caught"),
  f("meeting", "en/moment 'during'", "confirm", "the owner and deadline during the meeting", "refuse_moment", "currently caught"),
  f("meeting", "en/moment 'at the end'", "confirm", "the owner and deadline at the end of the meeting", "refuse_moment", "currently caught"),
  f("meeting", "en/moment 'every week'", "confirm", "the owner and deadline every week", "refuse_moment", "currently caught"),
  f("meeting", "en/acronym", "check", "the KPI dashboard", "accept", "Latin acronym in an English action"),
];

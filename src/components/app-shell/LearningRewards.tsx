"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LearningAchievement, LearningRewardBadge, LearningRewardBadgeId, LearningRewardsSummary, LearningRewardsSyncResult } from "@/domain/learning-rewards/types";
import styles from "./LearningRewards.module.css";

const ENDPOINT = "/api/me/learning-rewards";
const REQUEST_TIMEOUT_MS = 15_000;
const COPY = {
  en: {
    title: "Your learning", total: "Total Learning XP", level: "Level", week: "This week", goal: "suggested weekly goal",
    next: (level: number, xp: number) => `${xp.toLocaleString()} XP to Level ${level}`,
    collection: "Your collection", earned: "Earned", inProgress: "In progress", notAvailable: "Not available yet", all: "Explore all badges", fewer: "Show fewer badges",
    badges: (n: number, total: number) => `${n} of ${total} earned`, back: "Back to your collection", condition: "How to earn", progress: "Your progress",
    feature: "Feature on my profile", featured: "Featured on your profile", syncing: "Checking your recent learning…", saving: "Saving…", retry: "Try again",
    loadError: "Your Learning XP couldn't be loaded. Your learning records are unchanged.",
    syncError: "Your recent learning couldn't be checked for rewards. These are your last confirmed totals. Try again to check saved completions.",
    featureError: "Your featured badge couldn't be saved. Try again.",
    acknowledgeError: "Your achievement view couldn't be saved. Your earned rewards are unchanged. Try again to continue.",
    timezone: (tz: string) => `Weekly goal resets Monday at 5 a.m. · ${tz}`,
    complete: "This week's suggested goal is complete.", encouragement: "Learn, practice, return, and reflect on what happened.",
    separate: "Learning XP records participation in this program. Earlier Arena points stay separate. Levels and badges do not certify clinical ability.",
    unavailable: "This badge needs an assigned learning path or a team process that isn't available yet. Your completed learning still counts.",
    celebration: "A step forward", added: (xp: number) => `+${xp.toLocaleString()} Learning XP`, replay: "Replay animation", continue: "Continue learning", dismiss: "Got it",
    noBonus: "Your learning earned this. Replaying the animation doesn't add rewards.", history: "Recent achievements", team: "Better together",
    teamNote: "Team goals will appear when your organization has a verified weekly learning group. Individual learning is available now.",
  },
  ko: {
    title: "나의 배움", total: "누적 Learning XP", level: "레벨", week: "이번 주", goal: "권장 주간 목표",
    next: (level: number, xp: number) => `레벨 ${level}까지 ${xp.toLocaleString()} XP`,
    collection: "나의 배지", earned: "획득", inProgress: "진행 중", notAvailable: "아직 준비 중", all: "모든 배지 보기", fewer: "간단히 보기",
    badges: (n: number, total: number) => `${total}개 중 ${n}개 획득`, back: "배지 목록으로", condition: "획득 조건", progress: "진행 상황",
    feature: "프로필에 표시", featured: "프로필에 표시 중", syncing: "최근 학습을 확인하고 있습니다…", saving: "저장 중…", retry: "다시 시도",
    loadError: "Learning XP를 불러오지 못했습니다. 학습 기록은 그대로 보존되어 있습니다.",
    syncError: "최근 학습의 보상을 확인하지 못했습니다. 마지막으로 확인한 점수를 표시합니다. 다시 시도하면 저장된 완료 기록을 확인합니다.",
    featureError: "프로필 배지를 저장하지 못했습니다. 다시 시도해 주세요.",
    acknowledgeError: "달성을 확인한 기록을 저장하지 못했습니다. 획득한 보상은 그대로입니다. 다시 시도해 주세요.",
    timezone: (tz: string) => `주간 목표는 월요일 오전 5시에 새로 시작합니다 · ${tz}`,
    complete: "이번 주 권장 목표를 달성했습니다.", encouragement: "배우고, 연습하고, 다시 살펴보고, 적용한 경험을 돌아보세요.",
    separate: "Learning XP는 이 프로그램의 학습 참여 기록입니다. 이전 Arena 점수와 별도로 쌓입니다. 레벨과 배지는 임상 능력을 인증하지 않습니다.",
    unavailable: "배정된 학습 경로나 팀 운영 절차가 준비되면 획득할 수 있습니다. 완료한 학습은 계속 기록됩니다.",
    celebration: "한 걸음 더 성장했습니다", added: (xp: number) => `Learning XP +${xp.toLocaleString()}`, replay: "애니메이션 다시 보기", continue: "학습 계속하기", dismiss: "확인",
    noBonus: "학습으로 이룬 달성입니다. 애니메이션을 다시 봐도 보상은 추가되지 않습니다.", history: "최근 달성", team: "함께 성장하기",
    teamNote: "조직의 주간 학습 구성원이 확정되면 팀 목표를 확인할 수 있습니다. 개인 학습은 지금도 진행할 수 있습니다.",
  },
};

const KOREAN_BADGES: Record<string, { name: string; description: string }> = {
  first: { name: "첫걸음", description: "필수 학습과 정리까지 마친 첫 Learn을 완료하세요." },
  circle: { name: "한 과정의 완성", description: "동일한 학습 과정에서 필수로 배정된 Learn, Practice, Revisit, Follow-up을 모두 완료하세요. 여러 주에 걸쳐도 인정됩니다." },
  second: { name: "다시 살펴보기", description: "최초 학습이나 연습 이후 72시간 이상 지나 배정된 다른 변형 사례를 처음 완료하세요." },
  weeks: { name: "네 번의 학습 주간", description: "서로 다른 네 주에 각각 권장 60 XP 목표를 달성하세요. 연속일 필요는 없습니다." },
  patient: { name: "환자 대화 학습 경로", description: "Patient Communication 경로에서 서로 다른 승인 학습 과정 세 개의 필수 단계를 마치세요." },
  clinical: { name: "임상 사례 탐색", description: "서로 다른 Clinical Discovery 사례 다섯 개에서 독립적인 평가와 계획을 제출하고 참고 접근을 검토하세요." },
  follow: { name: "경험을 돌아보다", description: "서로 다른 배정의 기한이 도래한 Follow-up 세 개에 응답하세요. 적용 여부와 관계없이 인정됩니다." },
  insight: { name: "팀의 배움에 기여", description: "공유에 동의한 학습 사례가 지정 검토자의 확인을 거쳐 조직 Learning Brief에 채택되면 획득합니다." },
  together: { name: "함께 달성", description: "팀이 첫 월간 공동 목표를 달성한 달에 의미 있는 학습 행동으로 참여하세요." },
  return: { name: "30일 뒤 다시 확인", description: "배정된 30일 Follow-up이 도래했을 때 결과나 장애물을 기록하세요. 30일간 지속 적용했다는 인증은 아닙니다." },
  level10: { name: "레벨 10", description: "Learning XP로 레벨 10에 도달하세요." },
  level50: { name: "레벨 50", description: "Learning XP로 레벨 50에 도달하세요. 이후에도 레벨은 계속 올라갑니다." },
};

/** Small native vector marks, using the same stroke treatment as the app's tab icons. */
function BadgeMark({ icon }: { icon: string }) {
  const marks: Record<string, ReactNode> = {
    sprout: <><path d="M12 21v-8M12 16C6 16 3 12 3 7c6 0 9 3 9 9ZM12 13c0-6 3-9 9-9 0 6-3 9-9 9Z" /></>,
    "circle-check": <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 6-6" /></>,
    "scan-eye": <><path d="M4 8V4h4m8 0h4v4m0 8v4h-4M8 20H4v-4M4 12s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5Z" /><circle cx="12" cy="12" r="2" /></>,
    "calendar-check": <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4m8-4v4M4 10h16m-12 5 3 3 5-5" /></>,
    "messages-square": <><path d="M4 4h13v10H8l-4 4V4Zm5 13h7l4 4V9" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    footprints: <><ellipse cx="8" cy="8" rx="3" ry="5" transform="rotate(-15 8 8)" /><ellipse cx="16" cy="15" rx="3" ry="5" transform="rotate(15 16 15)" /><path d="m7 16 1 2m7-13 1-2" /></>,
    lightbulb: <><path d="M9 18h6m-5 3h4M9 15c0-2-4-3-4-7a7 7 0 0 1 14 0c0 4-4 5-4 7H9Z" /></>,
    "users-round": <><circle cx="9" cy="8" r="3" /><path d="M3 21v-2a6 6 0 0 1 12 0v2m2-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5" /></>,
    "calendar-range": <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4m8-4v4M4 10h16M8 15h8m-8 3h4" /></>,
    sparkles: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" /></>,
    gem: <><path d="m3 9 4-5h10l4 5-9 12L3 9Zm0 0h18M7 4l5 17 5-17" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{marks[icon] ?? marks.sparkles}</svg>;
}

export function LearningRewardsMedal({ badge, large = false }: { badge: Pick<LearningRewardBadge, "id" | "icon" | "frame" | "earnedAt">; large?: boolean }) {
  const number = badge.id === "level10" ? "10" : badge.id === "level50" ? "50" : null;
  return <span aria-hidden="true" className={`${styles.medal} ${styles[badge.frame]} ${badge.earnedAt ? "" : styles.unearned} ${large ? styles.largeMedal : ""}`}>
    <span className={styles.medalFace}>{number ? <span className={styles.medalNumber}>{number}</span> : <BadgeMark icon={badge.icon} />}</span>
  </span>;
}

type Reply = { ok?: boolean; enabled?: boolean; summary?: LearningRewardsSummary } & Partial<LearningRewardsSyncResult>;
type Celebration = { xp: number; achievements: LearningAchievement[] };

function canonicalSummary(value: LearningRewardsSummary | undefined): value is LearningRewardsSummary {
  return !!value && typeof value.totalXp === "number" && typeof value.weeklyXp === "number" && !!value.level && Array.isArray(value.badges) && Array.isArray(value.recentAchievements);
}

function unseenAchievements(summary: LearningRewardsSummary, newlyEarned: LearningAchievement[] = []) {
  return [...new Map([...(summary.pendingAchievements ?? []), ...newlyEarned].map(achievement => [achievement.id, achievement])).values()];
}

/** Server-owned values only: mount/reselect reconciles saved completions, then displays the projection. */
export default function LearningRewards({ locale, refreshKey }: { locale: string; refreshKey?: number }) {
  const lang = locale === "ko" ? "ko" : "en";
  const t = COPY[lang];
  const [state, setState] = useState<"unknown" | "disabled" | "ready" | "failed">("unknown");
  const [summary, setSummary] = useState<LearningRewardsSummary | null>(null);
  const [error, setError] = useState<"load" | "sync" | "feature" | "acknowledge" | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyKind, setBusyKind] = useState<"sync" | "feature" | "acknowledge">("sync");
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<LearningRewardBadgeId | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [animationKey, setAnimationKey] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const generation = useRef(0);
  const detailTitle = useRef<HTMLHeadingElement>(null);
  const badgeButtons = useRef(new Map<string, HTMLButtonElement>());
  const selected = summary?.badges.find(b => b.id === selectedId) ?? null;

  useEffect(() => {
    const current = ++generation.current;
    const abort = new AbortController();
    const timeout = window.setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
    controller.current = abort;
    busyRef.current = true;
    setBusy(true);
    setBusyKind("sync");
    setState("unknown");
    setSummary(null);
    setError(null);
    setSelectedId(null);
    setCelebration(null);
    void (async () => {
      let enabled = false;
      try {
        const get = await fetch(ENDPOINT, { credentials: "include", cache: "no-store", signal: abort.signal });
        if (!get.ok) throw Error("LOAD_FAILED");
        const first = await get.json() as Reply;
        if (generation.current !== current) return;
        if (abort.signal.aborted) throw Error("LOAD_FAILED");
        if (first.ok === true && first.enabled === false) { setState("disabled"); return; }
        if (first.ok !== true || first.enabled !== true || !canonicalSummary(first.summary)) throw Error("LOAD_FAILED");
        enabled = true;
        setState("ready");
        setSummary(first.summary);
        const pending = unseenAchievements(first.summary);
        if (pending.length > 0) setCelebration({ xp: 0, achievements: pending });
        const post = await fetch(ENDPOINT, { method: "POST", credentials: "include", cache: "no-store", signal: abort.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "sync" }) });
        if (!post.ok) throw Error("SYNC_FAILED");
        const synced = await post.json() as Reply;
        if (generation.current !== current) return;
        if (abort.signal.aborted) throw Error("SYNC_FAILED");
        if (synced.ok === true && synced.enabled === false) { setSummary(null); setState("disabled"); return; }
        if (synced.ok !== true || synced.enabled !== true || !canonicalSummary(synced.summary)) throw Error("SYNC_FAILED");
        setSummary(synced.summary);
        const achievements = unseenAchievements(synced.summary, Array.isArray(synced.newAchievements) ? synced.newAchievements : []);
        const xp = typeof synced.xpAwarded === "number" ? synced.xpAwarded : 0;
        if (achievements.length > 0 || xp > 0) setCelebration({ xp, achievements });
        else setCelebration(null);
      } catch {
        if (generation.current !== current) return;
        setError(enabled ? "sync" : "load");
        if (!enabled) setState("failed");
      } finally {
        window.clearTimeout(timeout);
        if (generation.current === current) { busyRef.current = false; setBusy(false); }
      }
    })();
    return () => { window.clearTimeout(timeout); controller.current?.abort(); abort.abort(); generation.current++; };
  }, [refreshKey, attempt]);

  useEffect(() => { if (selectedId) detailTitle.current?.focus(); }, [selectedId]);

  async function feature(badge: LearningRewardBadge) {
    if (busyRef.current || !badge.earnedAt) return;
    const current = generation.current;
    const abort = new AbortController();
    const timeout = window.setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
    controller.current = abort;
    busyRef.current = true;
    setBusy(true);
    setBusyKind("feature");
    setError(null);
    try {
      const res = await fetch(ENDPOINT, { method: "POST", credentials: "include", cache: "no-store", signal: abort.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "feature", badgeId: badge.id }) });
      if (!res.ok) throw Error("FEATURE_FAILED");
      const reply = await res.json() as Reply;
      if (current !== generation.current) return;
      if (reply.ok === true && reply.enabled === false) { setSummary(null); setState("disabled"); return; }
      if (reply.ok !== true || reply.enabled !== true || !canonicalSummary(reply.summary)) throw Error("FEATURE_FAILED");
      setSummary(reply.summary);
    } catch { if (current === generation.current) setError("feature"); }
    finally { window.clearTimeout(timeout); if (current === generation.current) { busyRef.current = false; setBusy(false); } }
  }

  async function acknowledgeCelebration() {
    if (busyRef.current || !celebration) return;
    const achievementIds = celebration.achievements.map(a => a.id);
    if (achievementIds.length === 0) { setCelebration(null); return; }
    const current = generation.current;
    const abort = new AbortController();
    const timeout = window.setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
    controller.current = abort;
    busyRef.current = true;
    setBusy(true);
    setBusyKind("acknowledge");
    setError(null);
    try {
      const res = await fetch(ENDPOINT, { method: "POST", credentials: "include", cache: "no-store", signal: abort.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "acknowledge", achievementIds }) });
      if (!res.ok) throw Error("ACKNOWLEDGEMENT_FAILED");
      const reply = await res.json() as Reply;
      if (current !== generation.current) return;
      if (reply.ok === true && reply.enabled === false) { setSummary(null); setState("disabled"); return; }
      if (reply.ok !== true || reply.enabled !== true || !canonicalSummary(reply.summary)) throw Error("ACKNOWLEDGEMENT_FAILED");
      setSummary(reply.summary);
      setCelebration(null);
    } catch { if (current === generation.current) setError("acknowledge"); }
    finally { window.clearTimeout(timeout); if (current === generation.current) { busyRef.current = false; setBusy(false); } }
  }

  function leaveDetail() {
    const id = selected?.id;
    setSelectedId(null);
    if (id) requestAnimationFrame(() => badgeButtons.current.get(id)?.focus());
  }

  if (state === "unknown" || state === "disabled") return null;
  if (!summary) return <section className={styles.root} aria-label={t.title} data-testid="learning-rewards-error">
    <p className={styles.note} role="alert">{t.loadError}</p>
    <button type="button" className={styles.textButton} onClick={() => setAttempt(n => n + 1)}>{t.retry}</button>
  </section>;

  const badgeName = (badge: LearningRewardBadge) => lang === "ko" ? KOREAN_BADGES[badge.id]?.name ?? badge.name : badge.name;
  const badgeDescription = (badge: LearningRewardBadge) => lang === "ko" ? KOREAN_BADGES[badge.id]?.description ?? badge.description : badge.description;
  const earned = summary.badges.filter(b => b.earnedAt);
  const gallery = expanded ? summary.badges : [...earned, ...summary.badges.filter(b => !b.earnedAt)].slice(0, 3);
  const featured = summary.badges.find(b => b.id === summary.featuredBadgeId && b.earnedAt);
  const mainAchievement = celebration?.achievements.find(a => a.kind === "milestone") ?? celebration?.achievements[0];
  const mainBadgeId = mainAchievement?.id.startsWith("level:") ? `level${mainAchievement.id.slice(6)}` : mainAchievement?.id.replace(/^badge:/, "");
  const mainBadge = summary.badges.find(b => b.id === mainBadgeId);
  const otherAchievementTitles = [...new Set(celebration?.achievements.map(a => a.title))].filter(title => title !== mainAchievement?.title);

  return <section className={styles.root} aria-label={t.title} data-testid="learning-rewards">
    <p className={styles.eyebrow}>{t.title}</p>
    <div className={styles.top}>
      <div><strong className={styles.total} data-testid="learning-total-xp">{summary.totalXp.toLocaleString()}</strong><span className={styles.totalLabel}>{t.total}</span></div>
      <div className={styles.level} aria-label={`${t.level} ${summary.level.current}`}><small>{t.level}</small><strong data-testid="learning-level">{summary.level.current}</strong></div>
    </div>
    <p className={styles.progressCaption}>{t.next(summary.level.next, summary.level.xpToNextLevel)}</p>
    <progress className={styles.bar} value={summary.level.xpIntoLevel} max={summary.level.xpForNextLevel} aria-label={lang === "ko" ? "다음 레벨까지 진행 상황" : "Progress to the next level"} />
    {featured ? <p className={styles.featured}>{t.featured}: {badgeName(featured)}</p> : null}
    <div className={styles.week}><h3>{t.week}</h3><strong data-testid="learning-weekly-xp">{summary.weeklyXp.toLocaleString()} / {summary.weeklyGoal.toLocaleString()} XP</strong></div>
    <progress className={styles.bar} value={summary.weeklyXp} max={summary.weeklyGoal} aria-label={t.goal} />
    <p className={`${styles.note} ${styles.weekNote}`}>{summary.weeklyGoalReached ? t.complete : t.encouragement}</p>
    <p className={styles.note}>{t.timezone(summary.week.timezone)}</p>
    {busy ? <p className={`${styles.note} ${styles.weekNote}`} role="status">{busyKind === "sync" ? t.syncing : t.saving}</p> : null}
    {error ? <div className={styles.error} role="alert"><p>{error === "feature" ? t.featureError : error === "acknowledge" ? t.acknowledgeError : t.syncError}</p><button type="button" className={styles.textButton} disabled={busy} onClick={() => error === "feature" && selected ? void feature(selected) : error === "acknowledge" ? void acknowledgeCelebration() : setAttempt(n => n + 1)}>{t.retry}</button></div> : null}

    {celebration && celebration.achievements.length === 0 ? <div className={styles.xpToast} role="status" data-testid="learning-xp-toast"><p>{t.added(celebration.xp)}</p><button type="button" className={styles.textButton} onClick={() => setCelebration(null)}>{t.dismiss}</button></div> : null}
    {celebration && celebration.achievements.length > 0 ? <div className={`${styles.celebration} ${styles.playing}`} key={animationKey} data-testid="learning-celebration" aria-live="polite">
      {mainBadge ? <LearningRewardsMedal badge={mainBadge} large /> : <span className={`${styles.medal} ${styles.circle} ${styles.largeMedal}`} aria-hidden="true"><span className={styles.medalFace}><BadgeMark icon="sparkles" /></span></span>}
      <h3>{mainAchievement?.title ?? t.celebration}</h3>
      {celebration.xp > 0 ? <p>{t.added(celebration.xp)}</p> : null}
      {otherAchievementTitles.length > 0 ? <ul className={styles.celebrationList}>{otherAchievementTitles.map(title => <li key={title}>{title}</li>)}</ul> : null}
      <p>{t.noBonus}</p>
      <button type="button" className={styles.button} disabled={busy} onClick={() => void acknowledgeCelebration()}>{t.continue}</button>
      <button type="button" className={styles.textButton} onClick={() => setAnimationKey(n => n + 1)}>{t.replay}</button>
    </div> : null}

    <div className={styles.collection}><h3>{t.collection}</h3><span>{t.badges(earned.length, summary.badges.length)}</span></div>
    {selected ? <div className={styles.detail} data-testid="learning-badge-detail">
      <button type="button" className={styles.textButton} onClick={leaveDetail}>← {t.back}</button>
      <LearningRewardsMedal badge={selected} large />
      <h4 tabIndex={-1} ref={detailTitle} className={styles.detailTitle}>{badgeName(selected)}</h4>
      <p className={styles.detailStatus}>{selected.earnedAt ? t.earned : !selected.available ? t.notAvailable : t.inProgress}</p>
      <div className={styles.condition}><p className={styles.eyebrow}>{t.condition}</p><p className={styles.description}>{badgeDescription(selected)}</p>
        {selected.available || selected.earnedAt ? <><p className={styles.note}>{t.progress}: {selected.progress.toLocaleString()} / {selected.target.toLocaleString()}</p><progress className={styles.bar} value={selected.progress} max={selected.target} aria-label={`${badgeName(selected)} ${t.progress}`} /></> : <p className={styles.note}>{t.unavailable}</p>}
      </div>
      {selected.earnedAt ? summary.featuredBadgeId === selected.id ? <p className={styles.featured}>{t.featured}</p> : <button type="button" className={styles.button} disabled={busy} onClick={() => void feature(selected)}>{t.feature}</button> : null}
    </div> : <>
      <div className={styles.grid} data-testid="learning-badge-grid">{gallery.map(badge => <button key={badge.id} ref={node => { if (node) badgeButtons.current.set(badge.id, node); else badgeButtons.current.delete(badge.id); }} type="button" className={`${styles.badgeButton} ${badge.earnedAt ? styles.earned : ""}`} aria-label={`${badgeName(badge)} · ${badge.earnedAt ? t.earned : badge.available ? t.inProgress : t.notAvailable}`} onClick={() => setSelectedId(badge.id)}>
        <LearningRewardsMedal badge={badge} /><span className={styles.badgeName}>{badgeName(badge)}</span><span className={styles.badgeStatus}>{badge.earnedAt ? t.earned : badge.available ? t.inProgress : t.notAvailable}</span>
      </button>)}</div>
      <div className={styles.actions}><button type="button" className={styles.textButton} onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>{expanded ? t.fewer : t.all} →</button></div>
    </>}
    {summary.recentAchievements.length > 0 ? <details className={styles.note}><summary className={styles.textButton}>{t.history}</summary><ul className={styles.history}>{summary.recentAchievements.map(a => <li key={a.id}><span>{a.title}</span><time dateTime={a.earnedAt}>{new Date(a.earnedAt).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", { month: "short", day: "numeric", timeZone: summary.week.timezone })}</time></li>)}</ul></details> : null}
    <div className={styles.team}><h3>{t.team}</h3><p className={styles.note}>{t.teamNote}</p></div>
    <p className={`${styles.note} ${styles.separate}`}>{t.separate}</p>
  </section>;
}

/**
 * THE ONE SERVER-OWNED CONSENT AUTHORITY (Slice 3.2R-R9A).
 *
 * WHAT WAS WRONG. Consent had no server authority at all. The required version was a constant
 * inside a browser component (`AcceptClient.tsx`), the API accepted any string matching
 * `/^\d{4}-\d{2}-[a-z0-9\-]+$/`, and the gate asked only whether `arena_profiles.consent_version`
 * was truthy. So a new legal version would have re-consented NOBODY — all 31 users carried a
 * truthy value and would have passed forever — and a crafted POST of `2099-12-anything` would
 * have satisfied the gate permanently.
 *
 * WORSE, AND MEASURED. The displayed text was a hardcoded JSX document sitting beside an
 * unrelated version string, so the two could drift — and they did. Commit `7afd272a` replaced a
 * bare "[PLACEHOLDER] The final legal text is being prepared by attorneys" notice with the full
 * disclosure naming third-party AI processing, +114/-6 lines, while `CONSENT_VERSION` stayed
 * `2026-05-pending-v1`. Among the 13 rows recorded under that version, some users consented to a
 * notice that disclosed nothing and others to one that disclosed subprocessors, and the ledger
 * cannot tell them apart. That history is not repairable and is deliberately left alone; this
 * module exists so it cannot happen again.
 *
 * SO THE DOCUMENT IS THE AUTHORITY, not a string beside it. Version, locale, placeholder status
 * and the legal prose live in ONE object, and the fingerprint is DERIVED from that prose
 * (`consent-fingerprint.ts`). Editing a word changes the fingerprint, and a fingerprint that no
 * longer matches the active document is refused — so text can never again change silently under
 * a fixed version.
 *
 * NO node:crypto HERE, DELIBERATELY. `middleware.ts` imports `ACTIVE_CONSENT_VERSION` from this
 * file and runs in the edge middleware bundle. The hash lives in a sibling module that imports
 * this one; that keeps a single source of truth for the document while keeping the gate's import
 * free of Node built-ins. The fingerprint is derived data, never a second authority.
 *
 * THE PROSE IS NOT EDITED BY THIS SLICE. Every string below is the byte-equivalent of what
 * `page.tsx` already rendered, `[PLACEHOLDER]`/`[KO_PENDING]` era included. R9A is the mechanism;
 * the final legal copy is external input that has not arrived.
 */

/** App locale (route segment) → the BCP-47 code stored on the acceptance row. */
export const CONSENT_LOCALES = ["en-US", "ko-KR"] as const;
export type ConsentLocale = (typeof CONSENT_LOCALES)[number];

/**
 * THE ACTIVE CONSENT VERSION — the server's answer to "what must be accepted right now?".
 *
 * UNCHANGED BY R9A ON PURPOSE. This slice builds the mechanism against the CURRENT placeholder
 * document so that no live user is disturbed by the deployment. Bumping this is what will one
 * day force re-consent, and that is a Founder action taken with final legal copy in hand.
 */
export const ACTIVE_CONSENT_VERSION = "2026-05-v1";

/**
 * Is the active document still placeholder text awaiting counsel?
 *
 * DERIVED, NEVER HARDCODED AT THE WRITE SITE. The audit writer previously stamped
 * `placeholder: true` into every row unconditionally, so a final legal acceptance would have
 * been recorded as a placeholder one. It now reads this, and a final document simply declares
 * `placeholder: false` with no change to the writer.
 */
export type ConsentClassification = "placeholder" | "final";

/** One run of text inside a paragraph or bullet. `strong` is the only emphasis the prose uses. */
export type ConsentInline = string | { readonly strong: string };

export type ConsentSection = {
  readonly heading: string;
  /** Text before any list. */
  readonly paragraphs: readonly (readonly ConsentInline[])[];
  readonly bullets: readonly (readonly ConsentInline[])[];
  /** Text after the list — the subprocessor section closes with one. */
  readonly trailing: readonly (readonly ConsentInline[])[];
};

export type ConsentDocument = {
  readonly version: string;
  readonly locale: ConsentLocale;
  readonly classification: ConsentClassification;
  readonly title: string;
  readonly sections: readonly ConsentSection[];
};

const section = (
  heading: string,
  paragraphs: readonly (readonly ConsentInline[])[],
  bullets: readonly (readonly ConsentInline[])[] = [],
  trailing: readonly (readonly ConsentInline[])[] = [],
): ConsentSection => ({ heading, paragraphs, bullets, trailing });

const EN: ConsentDocument = {
  version: ACTIVE_CONSENT_VERSION,
  locale: "en-US",
  classification: "placeholder",
  title: "bty — information notice and consent",
  sections: [
    section("What bty does", [
      [
        "bty is a training tool for your dental practice. It helps your team practice leadership, decision-making, and integrity skills through realistic scenarios. You'll work through situations, make choices, reflect on what happened, and your patterns develop over time.",
      ],
    ]),
    section(
      "What we collect",
      [["When you use bty, we collect:"]],
      [
        [{ strong: "Account information" }, " — your name, work email, and your role at the practice"],
        [
          { strong: "Training activity" },
          " — the scenarios you engage with, the choices you make, the reflections you write, and how your patterns develop over time",
        ],
        [
          { strong: "Technical information" },
          " — standard things like browser type and IP address, for security and reliability",
        ],
      ],
    ),
    section("A note on patient information", [
      [
        "Do not include patient names or protected health information (PHI) in your training reflections or chat messages. bty is not a clinical record system, and your reflections are processed by third-party AI services (see below).",
      ],
    ]),
    section("Why we collect it", [
      [
        "Your training activity helps bty personalize scenarios to your growth and lets your practice understand team-wide patterns.",
      ],
    ]),
    section(
      "What services help run bty",
      [
        [
          "bty uses these services to operate. Each handles your information under its own privacy commitments:",
        ],
      ],
      [
        [{ strong: "Cloudflare" }, " — hosts the bty application"],
        [{ strong: "Supabase" }, " — stores your account and training records"],
        [{ strong: "OpenAI" }, " — supports chat, mentor, and training-related AI features"],
      ],
      [
        [
          "When you write reflections or use chat features, the text you enter may be sent to these AI services for processing.",
        ],
      ],
    ),
    section(
      "Important notes",
      [],
      [
        [
          "bty is part of your work environment. Your practice's employee handbook covers how bty fits into your role.",
        ],
        ["If you have questions or concerns, contact your practice admin."],
        ["You may request deletion of your account information through your practice administrator."],
      ],
    ),
    section(
      "Your acknowledgment",
      [["By clicking ", { strong: "Accept" }, ", you acknowledge that:"]],
      [
        ["You've read this notice"],
        ["You understand bty is part of your work training"],
        ["You consent to bty collecting and using your information as described above"],
      ],
    ),
  ],
};

const KO: ConsentDocument = {
  version: ACTIVE_CONSENT_VERSION,
  locale: "ko-KR",
  classification: "placeholder",
  title: "bty 안내 및 동의",
  sections: [
    section("bty란", [
      [
        "bty는 치과 진료실 팀을 위한 훈련 도구입니다. 실제 진료 환경에서 마주칠 수 있는 상황을 통해 리더십, 의사결정, 그리고 정직성과 관련된 역량을 연습할 수 있도록 돕습니다. 시나리오를 마주하고, 선택하고, 결과를 돌아보는 과정에서 사용자의 행동 패턴이 시간에 따라 발전합니다.",
      ],
    ]),
    section(
      "수집하는 정보",
      [["bty 사용 시 다음 정보가 수집됩니다."]],
      [
        [{ strong: "계정 정보" }, " — 이름, 직장 이메일, 진료실 내 역할"],
        [{ strong: "훈련 활동" }, " — 참여한 시나리오, 선택한 응답, 작성한 성찰 내용, 그리고 시간에 따른 패턴 변화"],
        [{ strong: "기술 정보" }, " — 보안 및 안정성을 위한 브라우저 종류, IP 주소 등 일반적인 기술 데이터"],
      ],
    ),
    section("환자 정보 관련 주의", [
      [
        "훈련 성찰이나 채팅 메시지에 환자 이름, 환자 식별 정보 또는 보호 대상 건강정보(PHI)를 포함하지 마십시오. bty는 진료기록 시스템이 아니며, 사용자가 입력한 성찰 내용은 아래에 명시된 AI 서비스로 전송되어 처리될 수 있습니다.",
      ],
    ]),
    section("수집 목적", [
      [
        "훈련 활동 정보는 사용자의 성장에 맞게 시나리오를 조정하고, 진료팀 전체의 패턴을 이해하는 데 사용됩니다.",
      ],
    ]),
    section(
      "bty 운영에 사용되는 서비스",
      [
        [
          "bty는 다음 서비스를 통해 운영됩니다. 각 서비스는 자체 개인정보 처리 방침에 따라 사용자 정보를 다룹니다.",
        ],
      ],
      [
        [{ strong: "Cloudflare" }, " — bty 애플리케이션 호스팅"],
        [{ strong: "Supabase" }, " — 계정 및 훈련 기록 저장"],
        [{ strong: "OpenAI" }, " — 채팅, 멘토 기능, 그리고 훈련 관련 AI 기능 지원"],
      ],
      [
        [
          "성찰을 작성하거나 채팅 기능을 사용할 때, 입력하신 내용은 위 AI 서비스로 전송되어 처리될 수 있습니다.",
        ],
      ],
    ),
    section(
      "중요 사항",
      [],
      [
        [
          "bty는 업무 환경의 일부입니다. 진료실의 직원 핸드북에 bty가 사용자의 역할에 어떻게 포함되는지 안내되어 있습니다.",
        ],
        ["문의 사항이 있을 경우 진료실 관리자에게 연락하십시오."],
        ["계정 정보의 삭제는 진료실 관리자를 통해 요청하실 수 있습니다."],
      ],
    ),
    section(
      "동의",
      [[{ strong: "동의합니다" }, " 버튼을 누르시면 다음 내용에 동의하는 것으로 간주됩니다."]],
      [
        ["본 안내를 읽으셨습니다"],
        ["bty가 업무 훈련의 일부임을 이해하셨습니다"],
        ["위에 설명된 내용에 따라 bty가 정보를 수집하고 사용하는 것에 동의하셨습니다"],
      ],
    ),
  ],
};

const DOCUMENTS: Readonly<Record<ConsentLocale, ConsentDocument>> = { "en-US": EN, "ko-KR": KO };

export function isConsentLocale(v: unknown): v is ConsentLocale {
  return typeof v === "string" && (CONSENT_LOCALES as readonly string[]).includes(v);
}

/**
 * The active document for a locale, or null when the locale is not one we publish.
 *
 * There is no fallback to English. A learner may only accept the document they were actually
 * shown, and silently serving another language's text under their locale would break exactly
 * that promise.
 */
export function activeConsentDocument(locale: unknown): ConsentDocument | null {
  return isConsentLocale(locale) ? DOCUMENTS[locale] : null;
}

/** Is this the version the server currently requires? */
export function isActiveConsentVersion(version: unknown): boolean {
  return typeof version === "string" && version === ACTIVE_CONSENT_VERSION;
}

/** Does this profile's stored consent satisfy the gate? Exact equality — never truthiness. */
export function consentSatisfied(profileConsentVersion: unknown): boolean {
  return isActiveConsentVersion(profileConsentVersion);
}

/**
 * The canonical serialization that the fingerprint is taken over.
 *
 * DETERMINISM IS STRUCTURAL, exactly as in `proposal-digest.ts`: everything is emitted as
 * ARRAYS in declaration order, so no object-key ordering can change the value. Inline runs
 * become `["t", text]` or `["s", text]` so that moving a word into or out of bold changes the
 * fingerprint — emphasis is part of how a legal sentence reads.
 *
 * Version, locale and classification are inside the payload, so the same prose under a
 * different version, a different language, or a placeholder/final change can never collide.
 */
export function canonicalConsentPayload(doc: ConsentDocument): string {
  const inlines = (runs: readonly ConsentInline[]) =>
    runs.map((r) => (typeof r === "string" ? ["t", r] : ["s", r.strong]));
  return JSON.stringify([
    doc.version,
    doc.locale,
    doc.classification,
    doc.title,
    doc.sections.map((s) => [
      s.heading,
      s.paragraphs.map(inlines),
      s.bullets.map(inlines),
      s.trailing.map(inlines),
    ]),
  ]);
}

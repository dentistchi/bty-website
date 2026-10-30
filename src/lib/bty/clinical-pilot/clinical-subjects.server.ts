import type { DiscoveryChannel, DiscoveryFact, DiscoveryPatient } from "@/domain/clinical-pilot/discovery";
import { HISTORY_INTENTS, factsForIntent, type HistoryIntentId } from "./clinical-intents.server";

/** Interpretation metadata, not additional facts or modified patient packs.
 * Call only after the router's existing hidden-answer/advice/security gates.
 * Resolve scoped segments instead of running broad legacy patterns over those
 * same segments again. Unscoped segments still need the ordinary router.
 */
export type MissingClinicalSubject = {
  id: string; topic: string; channel: DiscoveryChannel; missingAnswer: string;
};
export type ClinicalSubjectSegment = {
  text: string; factIds: string[]; missing: MissingClinicalSubject[];
  historySelections: { id: HistoryIntentId; factIds: string[] }[];
  /** Existing history recognition must not re-add a broader drug/cold/onset result. */
  suppressHistoryIntentIds: ("cold-history" | "medications" | "symptom-onset")[];
};
export type ClinicalSubjectScope = {
  factIds: string[]; missing: MissingClinicalSubject[];
  segments: ClinicalSubjectSegment[]; unscopedClauses: string[]; hasNegatedRequest: boolean;
};
type Subject = {
  id: string; topic: string; channel: DiscoveryChannel;
  test: RegExp; suffixes: readonly string[]; metadata?: RegExp;
  blocked?: RegExp; requiresMetadata?: boolean;
  suppress?: ClinicalSubjectSegment["suppressHistoryIntentIds"];
};

const suffix = (fact: DiscoveryFact) => fact.id.slice(fact.id.lastIndexOf(":") + 1);
const metadata = (fact: DiscoveryFact) => `${suffix(fact)} ${fact.topic}`;
const dedupe = <T,>(values: T[]) => [...new Set(values)];

// More specific protocols name the requested subject. Teeth/crown/implant/lesion
// nouns occurring as the target of that protocol do not select their own findings.
const SUBJECTS: readonly Subject[] = [
  { id: "periodontal-probing", topic: "Periodontal probing", channel: "exam",
    test: /\b(?:prob(?:e|ing)|pockets?|periodontal chart(?:ing)?|gum depths?)\b/iu,
    suffixes: ["probing", "local-probing", "adjacent-periodontal", "periodontal"], metadata: /\b(?:probing|pockets?|periodontal assessment)\b/iu },
  { id: "cusp-bite-test", topic: "Cusp-specific bite test", channel: "exam",
    test: /\bbite[ -]test\b|\btooth slooth\b/iu, suffixes: ["bite-test"], metadata: /\b(?:bite test|cusp-specific)\b/iu },
  { id: "gingival-examination", topic: "Gingival examination", channel: "exam",
    test: /\b(?:inspect|examine|assess|check)\b.{0,65}\b(?:gingiva|gingival tissue|gums?|periodontal health)\b/iu,
    suffixes: ["gingiva", "periodontal", "recession"], metadata: /\b(?:gingival|gingiva|periodontal assessment)\b/iu },
  { id: "occlusal-examination", topic: "Occlusal contacts and clearance", channel: "exam",
    test: /\b(?:occlus(?:al|ion)|articulating|centric relation|overjet|overbite)\b|\b(?:check|assess|examine|evaluate)\b.{0,25}\b(?:the )?bite\b(?![ -]test)|\b(?:palatal|lingual|anterior)\b.{0,35}\b(?:room|clearance)\b|\b(?:room|clearance)\b.{0,35}\b(?:palatal|lingual|veneer)\b/iu,
    suffixes: ["occlusion", "occlusal"], metadata: /\b(?:occlusal|occlusion|anterior clearance)\b/iu },
  { id: "caries-risk", topic: "Dentition-wide caries risk assessment", channel: "exam",
    test: /\bcaries[- ]risk\b/iu, suffixes: ["caries-risk", "risk-cause"], metadata: /\bcaries (?:risk|assessment)\b/iu },
  { id: "apical-imaging", topic: "Periapical imaging and apical status", channel: "exam",
    test: /\b(?:periapical|apical) (?:radiolucenc(?:y|ies)|lesions?|status|change)\b|\b(?:radiolucenc(?:y|ies)|lesions?)\b.{0,30}\b(?:apical|root tip)\b|\b(?:image|film|picture|radiograph)\b.{0,35}\b(?:apex|root tip|root end)\b|\b(?:apex|root tip|root end)\b.{0,35}\b(?:image|film|picture|radiograph)\b/iu,
    blocked: /\b(?:cbct|cone[- ]beam|3[- ]?d|three[- ]dimensional)\b/iu,
    suffixes: ["pa", "apical", "radiographic-comparison"], metadata: /\b(?:periapical|apical)\b/iu, requiresMetadata: true },
  { id: "bitewing-imaging", topic: "Bitewing imaging and radiographic caries depth", channel: "exam",
    test: /\b(?:bitewings?|bwx|bw)\b/iu,
    suffixes: ["bitewing", "radiograph"], metadata: /\b(?:bitewing|radiographic caries depth)\b/iu },
  { id: "previous-imaging", topic: "Previous radiographic comparison", channel: "exam",
    test: /\b(?:compare|comparison|previous|prior|old|serial)\b.{0,45}\b(?:films?|radiographs?|images?|x[- ]?rays?)\b/iu,
    suffixes: ["previous-images", "radiographic-comparison", "pa"], metadata: /\b(?:previous radiographic|comparable periapical|imaging comparison|bone-level comparison)\b/iu, requiresMetadata: true },
  { id: "other-third-molars", topic: "Other third molars", channel: "exam",
    test: /\bother\b.{0,16}\b(?:wisdom teeth|third molars?)\b|\ball (?:four|4)\b.{0,20}\b(?:wisdom|third)\b/iu,
    suffixes: ["other-third-molars"], metadata: /\bother third molars\b/iu },
  { id: "lymph-nodes", topic: "Cervical lymph-node examination", channel: "exam",
    test: /\b(?:lymph nodes?|lymphadenopathy|cervical nodes?)\b/iu,
    suffixes: ["nodes"], metadata: /\b(?:lymph|cervical nodes)\b/iu },
  { id: "tmj-examination", topic: "Temporomandibular joint examination", channel: "exam",
    test: /\b(?:tmjs?|temporomandibular joints?|condyles?)\b|\bjoint (?:palpation|tenderness|examination)\b/iu,
    suffixes: ["joint", "muscles-tmj"], metadata: /\b(?:joint examination|tmj examination)\b/iu },
  { id: "adjacent-examination", topic: "Adjacent tooth and tissue assessment", channel: "exam",
    test: /\b(?:adjacent|neighbou?ring|neighboring)\b.{0,30}\b(?:teeth|tooth|tissue)\b/iu,
    suffixes: ["adjacent", "adjacent-teeth"], metadata: /\badjacent.*\b(?:tooth|teeth|tissue|control)\b/iu },
  { id: "endodontic-seal", topic: "Root-filling quality and coronal seal", channel: "exam",
    test: /\b(?:root[- ]filling|obturation|endodontic (?:quality|seal))\b/iu,
    suffixes: ["endodontic-seal"], metadata: /\b(?:root filling|coronal seal)\b/iu, requiresMetadata: true },
  { id: "restoration-margins", topic: "Restoration margin examination", channel: "exam",
    test: /\b(?:filling|restoration|crown)\b.{0,25}\bmargins?\b|\bmargins?\b.{0,25}\b(?:filling|restoration|crown)\b/iu,
    suffixes: ["margins", "crown-margins", "crown-integrity", "abutment-assessment"], metadata: /\b(?:margin|margins|crown integrity)\b/iu, requiresMetadata: true },
  { id: "coronal-seal", topic: "Coronal seal and crown margins", channel: "exam",
    test: /\bcoronal seal\b/iu, suffixes: ["endodontic-seal", "crown-margins"], metadata: /\b(?:coronal seal|crown.margin)\b/iu },
  { id: "gingival-margin-height", topic: "Gingival margin relationships", channel: "exam",
    test: /\b(?:gingival margins?|gum ?lines?)\b.{0,35}\b(?:compare|symmetr|asymmetr|height|#\s*\d)|\b(?:compare|measure|check)\b.{0,25}\bgingival margins?\b/iu,
    suffixes: ["margin-height", "smile-gingiva"], metadata: /\b(?:gingival margin relationship|gingival relationships)\b/iu },
  { id: "restorability", topic: "Lesion depth and tooth restorability", channel: "exam",
    test: /\b(?:restorabilit(?:y|ies)|restorable|ferrule|remaining (?:sound )?(?:tooth )?structure)\b|\bhow deep\b.{0,35}\b(?:lesions?|caries|decay)\b/iu,
    suffixes: ["restorability", "remaining-structure", "tooth-status"], metadata: /\b(?:restorability|remaining tooth structure|existing tooth assessment)\b/iu },
  { id: "defect-morphology", topic: "Bone-defect morphology and remaining support", channel: "exam",
    test: /\b(?:defect morphology|shape of (?:the )?defect|remaining (?:bony|bone) support|circumferential (?:bone|support))\b/iu,
    suffixes: ["defect"], metadata: /\bdefect morphology\b/iu },
  { id: "fixture-mobility", topic: "Implant fixture and crown stability", channel: "exam",
    test: /\b(?:fixture|implant|crown)\b.{0,40}\b(?:mobility|mobile|stability|stable|loose)|\b(?:mobility|stability)\b.{0,35}\b(?:fixture|implant|crown)\b/iu,
    suffixes: ["stability", "components", "crown"], metadata: /\b(?:fixture and crown stability|restoration retention and mobility)\b/iu },
  { id: "sinus-imaging", topic: "Sinus imaging finding", channel: "exam",
    test: /\bsinus\b.{0,40}\b(?:image|imaging|appearance|pathology)|\b(?:image|imaging|appearance)\b.{0,40}\bsinus\b/iu,
    suffixes: ["sinus-image"], metadata: /\bsinus imaging\b/iu },
  { id: "three-dimensional-assessment", topic: "Three-dimensional imaging assessment", channel: "exam",
    test: /\b(?:cbct|cone[- ]beam|(?:3[- ]?d|three[- ]dimensional) (?:scan|image|imaging|view|root|assessment|relationship)|three dimensions)\b/iu,
    suffixes: ["cbct", "cbct-dimensions", "defect", "surgical"], metadata: /\b(?:cone-beam|cbct|three-dimensional)\b/iu },
  { id: "three-dimensional-measurements", topic: "Detailed three-dimensional measurements", channel: "exam",
    test: /\b(?:cbct|3[- ]?d|three[- ]dimensional)\b.{0,80}\b(?:measurements?|dimensions?)\b|\b(?:measurements?|dimensions?)\b.{0,80}\bcbct\b/iu,
    suffixes: ["cbct-dimensions"], metadata: /\b(?:cbct|three-dimensional) (?:site )?dimensions\b/iu, requiresMetadata: true },
  { id: "prescriber-plan", topic: "Prescriber advice and medication-change plan", channel: "exam",
    test: /\b(?:prescriber|cardiologist|physician|clinician)\b.{0,55}\b(?:advice|plan|document|medication[- ]change)|\bmedication[- ]change plan\b/iu,
    suffixes: ["prescriber"], metadata: /\bprescriber advice\b/iu, suppress: ["medications"] },
  { id: "medication-indication", topic: "Indication for the reported medication", channel: "patient",
    test: /\b(?:what|which) condition\b.{0,40}\b(?:prescribed|taking|take|for)|\b(?:medication|medicine|drug|injection)\b.{0,30}\b(?:indication|prescribed for)|\bwhy\b.{0,30}\bprescribed\b|\bwhy\b.{0,30}\b(?:take|taking|receive|receiving)\b.{0,25}\b(?:medication|medicine|drug|prolia|denosumab|injection)\b/iu,
    suffixes: ["indication", "medication"], metadata: /\b(?:indication|medication indication)\b/iu, requiresMetadata: true, suppress: ["medications"] },
  { id: "medication-duration", topic: "Duration of medication treatment", channel: "patient",
    test: /\b(?:how many years|how long|duration)\b.{0,50}\b(?:prolia|denosumab|medication|medicine|injections?)\b/iu,
    suffixes: ["duration"], metadata: /\bduration of (?:medication|prolia|denosumab|antiresorptive).*treatment\b/iu, requiresMetadata: true, suppress: ["medications", "symptom-onset"] },
  { id: "additional-medications", topic: "Complete or additional medication list", channel: "patient",
    test: /\b(?:other|additional|complete)\b.{0,22}\b(?:medicines?|medications?|drugs?|tablets?|supplements?)\b|\b(?:taken|taking|take)\b.{0,25}\b(?:for pain|painkillers?|analgesics?)\b/iu,
    suffixes: ["medications"], metadata: /\b(?:complete medication|medications used after)\b/iu, suppress: ["medications"] },
  { id: "cold-sensitivity", topic: "Patient-reported cold sensitivity", channel: "patient",
    test: /\b(?:cold|chilled|iced|icy)\b/iu,
    suffixes: ["cold", "symptoms"], metadata: /\bcold sensitivity\b/iu, suppress: ["cold-history"],
    blocked: /\b(?:common cold|cold (?:and|or) flu|cold medicine|cold[- ]?test|endo[- ]?ice|refrigerant|pulp test|thermal test|ept)\b|\btest\w*\b.{0,25}\bcold\b/iu },
  { id: "spontaneous-pain", topic: "Spontaneous pain history", channel: "patient",
    test: /\b(?:spontaneous|unprovoked|on its own|by itself)\b|\bwithout\b.{0,12}\b(?:eating|chewing|biting|a trigger)\b/iu,
    suffixes: ["spontaneous"], metadata: /\bspontaneous pain\b/iu },
  { id: "biting-pain", topic: "Pain with biting or chewing", channel: "patient",
    test: /\b(?:hurt|pain|sore|ache)\b.{0,30}\b(?:bite|biting|chew|chewing)\b|\b(?:bite|biting|chew|chewing)\b.{0,30}\b(?:hurt|pain|sore|ache)\b/iu,
    suffixes: ["biting", "chewing", "symptom-course", "symptoms", "pain"], metadata: /\b(?:biting|chewing|functional symptoms)\b/iu,
    requiresMetadata: true, blocked: /\b(?:without|not|never)\b.{0,15}\b(?:eating|chewing|biting)\b|\btobacco\b/iu },
  { id: "dry-mouth", topic: "Subjective dry-mouth symptoms", channel: "patient",
    test: /\b(?:dry mouth|dryness|xerostomia)\b|\bmouth\b.{0,20}\bdry\b/iu,
    suffixes: ["dry-mouth"], metadata: /\bdry-mouth symptoms\b/iu },
  { id: "dietary-exposures", topic: "Diet and drink exposures", channel: "patient",
    test: /\b(?:diet|dietary|acidic drinks|sugar intake|snack\w*)\b|\bwhat\b.{0,25}\b(?:sip|drink|eat)\b.{0,30}\b(?:day|daily|regularly|usually)\b/iu,
    suffixes: ["diet"], metadata: /\bdiet(?:ary)?\b/iu },
  { id: "facial-swelling", topic: "Current facial swelling history", channel: "patient",
    test: /\b(?:facial swelling|swollen face)\b|\bswelling\b.{0,30}\b(?:face|facial)\b/iu,
    suffixes: ["current-swelling", "swelling", "infection-symptoms"], metadata: /\b(?:current facial swelling|facial swelling history)\b/iu },
  { id: "fever-history", topic: "Fever history", channel: "patient",
    test: /\b(?:fever|febrile)\b/iu, suffixes: ["current-fever", "fever", "infection-symptoms"], metadata: /\bfever\b/iu },
  { id: "swelling-episodes", topic: "Previous swelling episodes", channel: "patient",
    test: /\b(?:how many|how often|times|episodes)\b.{0,55}\b(?:swelling|swollen|swelled)|\b(?:swelling|swollen|swelled)\b.{0,30}\b(?:before|previously|times|episodes)\b/iu,
    suffixes: ["episodes"], metadata: /\bprevious swelling episodes\b/iu },
  { id: "loosening-recurrence", topic: "Recurrent restoration loosening", channel: "patient",
    test: /\b(?:retighten\w*|tighten\w*|loosen\w*)\b.{0,40}\b(?:often|again|times|twice|already)|\b(?:often|times|twice|already)\b.{0,45}\b(?:retighten\w*|tighten\w*|loosen\w*|happened)\b/iu,
    suffixes: ["recurrence"], metadata: /\brecurrent loosening\b/iu },
  { id: "treatment-goals", topic: "Patient treatment goals", channel: "patient",
    test: /\bwhat\b.{0,25}\bmatters most\b|\bwhat\b.{0,25}\b(?:like|want)\b.{0,30}\b(?:change|improve|achieve)\b/iu,
    suffixes: ["goals", "preferences", "treatment-goal", "appearance"], metadata: /\b(?:treatment preferences|esthetic concern|patient goals)\b/iu },
  { id: "treatment-timing", topic: "Treatment time preferences", channel: "patient",
    test: /\b(?:how quickly|how soon|how fast)\b.{0,50}\b(?:hoping|want|change|improve|treatment)|\b(?:time|timing) preferences\b/iu,
    suffixes: ["timing", "preferences", "constraints"], metadata: /\b(?:time preferences|same-day replacement preferences)\b/iu },
  { id: "spacing-history", topic: "Spacing history and progression", channel: "patient",
    test: /\b(?:how long|when|since)\b.{0,40}\b(?:spaces?|spacing|gaps?)\b|\b(?:spaces?|spacing|gaps?)\b.{0,35}\b(?:changed|progressed|widened|started)\b/iu,
    suffixes: ["spacing-history"], metadata: /\bspacing progression\b/iu, suppress: ["symptom-onset"] },
  { id: "current-symptoms", topic: "Current presenting symptoms", channel: "patient",
    test: /\b(?:bothering|hurting)\b.{0,20}\b(?:now|lately|currently)|\bwhat (?:problems|symptoms)\b.{0,30}\b(?:noticing|experiencing|having)\b/iu,
    suffixes: ["symptoms", "pain"], metadata: /\b(?:current symptoms|presenting implant symptoms|current discomfort)\b/iu },
  { id: "anxiety-sedation-history", topic: "Anxiety and sedation history", channel: "patient",
    test: /\b(?:anxious|anxiety|nervous|sedation)\b/iu, suffixes: ["medical"], metadata: /\b(?:anxiety|sedation)\b/iu, requiresMetadata: true },
  { id: "recent-prosthetic-history", topic: "Recent crown, implant-crown or partial-denture history", channel: "patient",
    test: /\brecent\b.{0,70}\b(?:crowns?|partial dentures?|prosthe(?:tic|sis))\b/iu,
    suffixes: [], metadata: /\brecent crown history\b/iu },
  { id: "symptom-timing", topic: "Time-of-day symptom pattern", channel: "patient",
    test: /\btime of day\b|\b(?:morning|evening)\b.{0,25}\b(?:worse|worst|pain|ache|hurt)\b/iu,
    suffixes: ["timing-stress", "night"], metadata: /\b(?:symptom timing|nocturnal pain)\b/iu, suppress: ["symptom-onset"] },
  { id: "smile-phenotype", topic: "Smile line and gingival phenotype", channel: "exam",
    test: /\b(?:smile line|phenotype|biotype|gingival tissue thickness)\b/iu,
    suffixes: ["smile-phenotype", "smile-gingiva"], metadata: /\b(?:smile line|gingival phenotype)\b/iu },
];

function selectFacts(subject: Subject, patient: DiscoveryPatient): string[] {
  const candidates = patient.facts.filter(fact => fact.channel === subject.channel);
  if (subject.id === "cold-sensitivity") {
    const specific = candidates.filter(fact => suffix(fact) === "cold" || /\bcold\b/iu.test(fact.topic));
    if (specific.length) return specific.map(fact => fact.id);
    return factsForIntent("cold-history", patient).filter(fact => /\b(?:symptoms?|sensitivity)\b/iu.test(fact.topic)
      && !/\b(?:progression|course|diet|contributing)\b/iu.test(fact.topic)).map(fact => fact.id);
  }
  for (const name of subject.suffixes) {
    const matches = candidates.filter(fact => suffix(fact) === name
      && (!subject.requiresMetadata || subject.metadata?.test(metadata(fact))));
    if (matches.length) return matches.map(fact => fact.id);
  }
  const matches = subject.metadata ? candidates.filter(fact => subject.metadata!.test(metadata(fact))) : [];
  // Metadata fallback must be unambiguous. The router can request clarification
  // rather than choose among unrelated clinical facts with overlapping labels.
  return matches.length === 1 ? [matches[0]!.id] : [];
}

type ClinicalClausePlan = { active: string[]; declined: string[] };

const independentHead = /^(?:(?:please|then)\s+)?(?:can|could|does|do|did|has|have|is|are|was|were|when|why|what|which|how|check|look(?:\s+at)?|visually|inspect|examine|assess|evaluate|measure|record|probe|palpate|percuss|perform|test|obtain|order|compare)\b/iu;
// Named protocols/stimuli can be elliptical objects of the same request. A tooth
// number alone is not a new protocol ("compare margins of #8 and #9").
const ellipticalHead = /^(?:(?:a|an|the)\s+)?(?:pa\b|periapical\b|cbct\b|cone[- ]beam\b|occlus(?:al|ion)\b|caries[- ]risk\b|coronal seal\b|(?:cold|hot|warm|heat|chilled|iced|icy|chew(?:ing)?|bit(?:e|ing))\b|(?:masseters?|temporalis|muscles?|transillumination|percussion|palpation|probing|ept)\b|#\s*\d{1,2}\s+(?:position|eruption|margins?|contacts?|mobility)\b)/iu;
const declinedExam = /^(?:(?:please|then)\s+)?(?:do\s+not|don't|never|skip|omit|avoid|defer|hold\s+off(?:\s+on)?)\b/iu;

function composeClinicalClauses(text: string, channel: "patient" | "exam"): ClinicalClausePlan {
  const active: string[] = [], declined: string[] = [];
  for (const sentence of text.normalize("NFKC").replace(/[‘’]/gu, "'").split(/[?;!]+|\.(?:\s|$)/u)) {
    const clause = sentence.trim();
    if (!clause) continue;
    let start = 0;
    const matches = [...clause.matchAll(/\b(?:and|also|plus|or)\s+/giu)];
    for (const match of matches) {
      const right = clause.slice(match.index! + match[0].length).trimStart();
      const left = clause.slice(start, match.index!).trim();
      // OR belongs to an existing absent trigger here; treating the second noun
      // as positive would change "without eating OR chewing" to chewing pain.
      const sharedNegativeTrigger = channel === "patient" && /^(?:and|or)\b/iu.test(match[0])
        && !independentHead.test(right)
        && /\b(?:without|not|never)\b.{0,30}\b(?:eat(?:ing)?|chew(?:ing)?|bit(?:e|ing))\b/iu.test(left);
      const boundary = !sharedNegativeTrigger && (independentHead.test(right) || ellipticalHead.test(right));
      if (!boundary) continue;
      add(left);
      start = match.index! + match[0].length;
    }
    add(clause.slice(start).trim());
  }
  return { active, declined };
  function add(clause: string) {
    if (!clause) return;
    (channel === "exam" && declinedExam.test(clause) ? declined : active).push(clause);
  }
}


export const splitClinicalClauses = (text: string) => composeClinicalClauses(text, "patient").active;

export function scopeClinicalSubject(text: string, channel: DiscoveryChannel, patient: DiscoveryPatient): ClinicalSubjectScope | undefined {
  // The aliases below describe the authored Dr. Chi catalog, not arbitrary packs.
  if (!/^drchi-\d{3}$/u.test(patient.caseId)) return;
  // Historical Case 001 source/variant A interpretation remains untouched.
  if (patient.caseId === "drchi-001" && !patient.version.endsWith("-variant-b")) return;
  if (!text.trim() || text.length > 10000) return;
  const segments: ClinicalSubjectSegment[] = [], unscopedClauses: string[] = [];
  let hasNegatedRequest = false;
  const clauses = composeClinicalClauses(text, channel);
  hasNegatedRequest = clauses.declined.length > 0;
  for (const clause of clauses.active) {
    const subjects = SUBJECTS.filter(subject => subject.channel === channel && subject.test.test(clause) && !subject.blocked?.test(clause)
      // Radiographic depth is different from remaining sound structure; an explicit
      // restorability/ferrule request in the same clause still retains that subject.
      && !(subject.id === "restorability" && /\b(?:bitewing|bwx|radiograph|x[- ]?ray)\b/iu.test(clause)
        && !/\b(?:restorab\w*|ferrule|remaining structure)\b/iu.test(clause))
      && !(subject.id === "gingival-examination" && /\b(?:phenotype|biotype|tissue thickness|smile line)\b/iu.test(clause)));
    if (!subjects.length) { unscopedClauses.push(clause); continue; }
    const missing: MissingClinicalSubject[] = [];
    const historySelections: ClinicalSubjectSegment["historySelections"] = [];
    const factIds = subjects.flatMap(subject => {
      const ids = selectFacts(subject, patient);
      if (subject.id === "cold-sensitivity") {
        const intent = HISTORY_INTENTS.find(item => item.id === "cold-history")!;
        historySelections.push({ id: intent.id, factIds: ids });
        if (!ids.length) missing.push(intent);
      } else if (!ids.length) missing.push({ id: `clinical-subject:${subject.id}`, topic: subject.topic, channel: subject.channel,
        missingAnswer: `${subject.topic}: information is not supplied in this case. No normal or negative finding is established.` });
      return ids;
    });
    segments.push({ text: clause, factIds: dedupe(factIds), missing, historySelections,
      suppressHistoryIntentIds: dedupe(subjects.flatMap(subject => subject.suppress ?? [])) });
  }
  if (!segments.length && !hasNegatedRequest) return;
  return { factIds: dedupe(segments.flatMap(segment => segment.factIds)), missing: segments.flatMap(segment => segment.missing),
    segments, unscopedClauses, hasNegatedRequest };
}

type PriorRequest = { question: string; channel: DiscoveryChannel; factIds: string[] };
/** Bounded repeat only: no new hidden fact is selected from a bare pronoun. */
export function repeatClinicalFollowup(text: string, patient: DiscoveryPatient, context: readonly PriorRequest[]): string | null | undefined {
  if (!/^drchi-\d{3}$/u.test(patient.caseId)) return;
  if (patient.caseId === "drchi-001" && !patient.version.endsWith("-variant-b")) return;
  const question = text.trim();
  const persistence = /^(?:(?:and|so)\s+)?(?:how long does (?:that|it|this|the sensation|that sensation|the feeling|that feeling) last|does (?:that|it|this|the sensation|that sensation|the feeling|that feeling) (?:linger|last|stay|hang around)(?: (?:a long time|for a while))?(?: (?:afterwards|afterward|after the drink is gone))?)[?.!\s]*$/iu;
  const treatmentTime = /^(?:roughly |about )?how long ago was (?:that|it|this) (?:done|placed|put in|completed)[?.!\s]*$/iu;
  const recurrenceConfirmation = /^(?:so |and )?(?:this|that|it) has happened (?:twice|again|before)(?: already)?[?.!\s]*$/iu;
  if (![persistence, treatmentTime, recurrenceConfirmation].some(pattern => pattern.test(question))) return;
  const last = context.at(-1);
  const unresolved = persistence.test(question) ? null : undefined;
  if (last?.factIds.length !== 1) return unresolved;
  const fact = patient.facts.find(f => f.id === last.factIds[0] && f.available !== false && f.channel === "patient");
  if (!fact) return unresolved;
  if (persistence.test(question) && suffix(fact) === "cold") return fact.id;
  if (treatmentTime.test(question) && /\b(?:treatment|restoration|implant|endodontic|root canal)\b/iu.test(metadata(fact))
    && /\b(?:years?|months?|weeks?|days?|ago|long time)\b/iu.test(fact.answer)) return fact.id;
  if (recurrenceConfirmation.test(question) && suffix(fact) === "recurrence") return fact.id;
  return unresolved;
}

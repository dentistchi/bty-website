import type { DiscoveryChannel, DiscoveryFact, DiscoveryPatient } from "@/domain/clinical-pilot/discovery";
import { CASE_DETAIL_REVIEW_VERSION } from "./case-detail-variants.server";
import { isNextCaseDetailReview, nextCaseDetailSubject, nextCaseDetailFactTeeth, nextCaseDetailFactMatchesClause } from "./case-detail-next-subjects.server";

/** Subject metadata for the three review packs only. No answers or diagnoses are
 * created here; a selection can disclose only a registered fixed patient fact. */
export const isCaseDetailReview = (patient: DiscoveryPatient) => (patient.version === CASE_DETAIL_REVIEW_VERSION
  && ["drchi-005", "drchi-006", "drchi-011"].includes(patient.caseId)) || isNextCaseDetailReview(patient);
type Subject = { id: string; topic: string; channel: DiscoveryChannel; suffixes: string[];
  historyIntentIds?: ("endodontic-history" | "cold-history" | "symptom-onset")[] };
const subject = (id: string, topic: string, channel: DiscoveryChannel, ...suffixes: string[]): Subject => ({ id, topic, channel, suffixes });
const suffix = (fact: DiscoveryFact) => fact.id.slice(fact.id.lastIndexOf(":") + 1);

export function caseDetailSubject(text: string, channel: DiscoveryChannel, patient: DiscoveryPatient): Subject | undefined {
  if (isNextCaseDetailReview(patient)) return nextCaseDetailSubject(text, channel, patient);
  if (!isCaseDetailReview(patient) || /\b(?:would|should|recommend|prescribe|replace|retighten|tighten|adjust)\b/iu.test(text)) return;
  const q = text.trim();
  const c = patient.caseId;
  const objectiveOrder = channel === "exam" && /^\s*(?:check|assess|examine|evaluate|measure|record|observe|test|inspect|perform)\b/iu.test(q)
    && !/\b(?:history|reported|reports|patient says)\b/iu.test(q);
  if (c === "drchi-005" && objectiveOrder && /\b(?:occlus\w*|contacts?|bite)\b/iu.test(q)
    && /\b(?:sideways|lateral|excurs\w*|jaw moves?)\b/iu.test(q)) {
    return subject("occlusal-excursions", "Occlusal contacts during lateral jaw movement", "exam", "occlusal-excursions");
  }
  // Recorded history remains history even when entered through Examine or test.
  // An explicit examination request in Patient mode never reveals exam findings.
  if (c === "drchi-005" && /\bcrown\b/iu.test(q) && /\b(?:when|how long|placed|fitted|delivered|history)\b/iu.test(q)) {
    return subject("crown-treatment-timing", "Timing of crown placement", "patient", "crown-history");
  }
  if (c === "drchi-011" && /\b(?:when|how long|notice\w*|started|episode|since)\b/iu.test(q)
    && /\b(?:moving|movement|loose|loosening)\b/iu.test(q)) {
    return subject("current-loosening-onset", "Onset of the current loosening episode", "patient", "current-loosening-duration");
  }
  if (c === "drchi-005" && /\b(?:spontaneous|unprovoked|on its own|by itself)\b|\bwithout\b.{0,20}\b(?:chewing|biting|eating)\b/iu.test(q)) {
    return subject("spontaneous-pain", "Spontaneous pain history", "patient", "spontaneous");
  }
  if (c === "drchi-005" && /\b(?:night|sleep)\b/iu.test(q) && /\b(?:pain|hurt|ache|wake|waking|woken)\b/iu.test(q)) {
    return subject("nocturnal-pain", "Nocturnal pain history", "patient", "night");
  }
  if (c === "drchi-005" && /\b(?:severity|intensity|scale)\b|\bhow (?:bad|severe|strong)\b|out of (?:10|ten)/iu.test(q)) {
    return subject("pain-severity", "Pain severity", "patient", "pain-severity");
  }
  if (!objectiveOrder && /\bjaw\b/iu.test(q) && /\b(?:back\w*|sideways|side|shift\w*|move\w*|reposition\w*)\b/iu.test(q)) {
    return subject("jaw-repositioning-history", "Patient-reported jaw repositioning", "patient",
      c === "drchi-005" ? "jaw-shift" : c === "drchi-006" ? "bite-and-habits" : "bite-history");
  }
  if (!objectiveOrder && /\bbite\b.{0,35}\b(?:feel|off|wrong|fit|problem|comfortable)\b|\b(?:closing|close)\b.{0,35}\b(?:teeth|bite)\b.{0,25}\b(?:feel|comfortable)\b/iu.test(q)) {
    return subject("bite-perception", "Patient perception of the bite", "patient", c === "drchi-006" ? "bite-and-habits" : "bite-history");
  }
  if (/\b(?:grind\w*|clench\w*|bruxism|parafunction)\b/iu.test(q) && !/\b(?:wear|facets?|attrition)\b/iu.test(q)) {
    return subject("parafunction-history", "Reported grinding and clenching history", "patient", "parafunction");
  }
  if (/\b(?:night ?guard|occlusal guard|splint)\b/iu.test(q)) return subject("night-guard-history", "Night-guard history", "patient", "night-guard");
  if (channel !== "exam") return;

  if (c === "drchi-005") {
    const controls = /\b(?:adjacent|neighbou?ring|neighboring|controls?)\b|(?:#\s*|\btooth\s*)?(?:29|31)\b/iu.test(q);
    const controlTeeth = [...new Set(caseDetailRequestedTeeth(q).filter(tooth => tooth === 29 || tooth === 31))];
    const individual = controlTeeth.length === 1 ? `-${controlTeeth[0]}` : "";
    if (controls && /\b(?:cold|ice|iced|refrigerant)\b/iu.test(q)) return subject("adjacent-cold-test", "Cold testing of adjacent controls", "exam", `adjacent-cold${individual}`);
    if (controls && /\b(?:tap\w*|percuss\w*|knock\w*)\b/iu.test(q)) return subject("adjacent-percussion", "Percussion of adjacent controls", "exam", `adjacent-percussion${individual}`);
    if (/\b(?:root fracture|vertical fracture|crack depth|crack extent|fracture extent)\b/iu.test(q)) return subject("covered-fracture-extent", "Covered fracture extent", "exam", "covered-fracture-extent");
    if (/\bbite\b.{0,25}\bhigh\b|\bhigh\b.{0,25}\bbite\b|\blight closure\b|\bpremature contact\b/iu.test(q)) return subject("occlusal-contacts", "Current occlusal contacts", "exam", "occlusion");
  }
  if (c === "drchi-006") {
    if (/\b(?:crack|fracture|line)\b/iu.test(q) && /\b(?:depth|extent|extend\w*|beneath|toward the root|root extension)\b/iu.test(q)) return subject("crack-extent", "Unestablished crack extent", "exam", "crack-extent");
    if (/\b(?:transilluminat\w*|illuminat\w*)\b|\b(?:shine|pass)\b.{0,25}\blight\b/iu.test(q)) return subject("transillumination", "Transillumination", "exam", "transillumination");
    if (/\b(?:cusp|wall)\b/iu.test(q) && /\b(?:thick\w*|thin\w*|measur\w*|gauge)\b/iu.test(q)) return subject("cusp-thickness", "Accessible cusp-wall thickness", "exam", "cusp-thickness");
    if (/\bcusps?\b/iu.test(q) && /\b(?:test|pressure|loading|release)\b/iu.test(q)) return subject("cusp-bite-test", "Cusp-specific bite testing", "exam", "bite-test");
    if (/\b(?:other|additional|another|besides|only)\b/iu.test(q) && /\b(?:restorations?|fillings?|filled|restored|treated)\b/iu.test(q)) return subject("other-restorations", "Other restorations in the dentition", "exam", "other-restorations");
    if (/\b(?:lower (?:anterior|front|incisors?)|mandibular anterior)\b/iu.test(q)) return subject("lower-anterior-caries", "Lower-anterior caries examination", "exam", "lower-anterior-caries");
    if (/\broots?\b/iu.test(q) && /\b(?:caries|decay|cavities|surfaces?)\b/iu.test(q)) return subject("root-caries", "Root-surface caries examination", "exam", "root-caries");
  }
  if (c === "drchi-011") {
    if (/\b(?:prior|previous|old|past|earlier|both)\b/iu.test(q) && /\b(?:bite|occlus\w*|contacts?)\b/iu.test(q)) return subject("previous-occlusion", "Documented prior occlusal findings", "exam", "previous-occlusion");
    if (/\b(?:torque|ncm|n-cm|newton|tightening specification)\b/iu.test(q)) return subject("torque-specification", "Manufacturer-specific torque specification", "exam", "torque-specification");
    if (/\b(?:compatib\w*|manufacturer|implant (?:system|brand)|platform|part numbers?|component numbers?|correct parts?)\b/iu.test(q)) return subject("component-compatibility", "Component identity and compatibility", "exam", "component-compatibility");
    if (/\b(?:source|determine whether|whether|or)\b/iu.test(q) && /\b(?:moving|movement|mobility)\b/iu.test(q)
      && /\b(?:crown|restoration|assembly|abutment)\b/iu.test(q) && /\b(?:fixture|implant body|implant)\b/iu.test(q)) {
      return subject("restorative-movement-source", "Directed source-of-movement assessment", "exam", "components");
    }
    if (/\b(?:fixture|implant body|implant itself)\b/iu.test(q) && /\b(?:mobile|mobility|stability|stable|move\w*|test|independently)\b/iu.test(q)) return subject("fixture-stability", "Isolated fixture stability", "exam", "fixture-stability");
    if (/\b(?:connection|interface)\b/iu.test(q) && /\b(?:inspect|examine|check|look|integrity|internal|magnification)\b/iu.test(q)) return subject("connection-examination", "Accessible connection examination", "exam", "connection-examination");
    if (/\bscrew\b/iu.test(q) && /\b(?:inspect|examine|look|condition|integrity|wear|fracture|retrieved|removed|damage)\b/iu.test(q)) return subject("screw-examination", "Retrieved screw examination", "exam", "screw-examination");
    if (/\b(?:crown|restoration)\b/iu.test(q) && /\b(?:mobile|mobility|moving|loose|retention)\b/iu.test(q)) return subject("crown-mobility", "Initial restoration mobility", "exam", "crown");
  }
  if (/\b(?:tap\w*|percuss\w*|knock\w*)\b/iu.test(q)) return subject("percussion", "Percussion response", "exam", "percussion");
  if (/\b(?:cold[- ]?test|thermal test|endo[- ]?ice)\b|\b(?:apply|use|test)\b.{0,30}\b(?:cold|ice|refrigerant)\b/iu.test(q)) {
    return subject("cold-sensibility-test", "Cold sensibility testing", "exam", "cold-test");
  }
}

/** New copy retains several original facts without toothNumbers. Their subject is
 * explicit in this review's case design, not inferred from an arbitrary query. */
const focalSources: Record<string, readonly string[]> = {
  "drchi-005": ["rct-history", "symptom-course", "pa", "swelling", "percussion"],
  "drchi-006": ["symptoms", "restoration-history", "restoration", "cusp-line", "probing"],
  "drchi-011": ["history", "recurrence", "pain", "crown", "swelling", "pa"],
};
export function caseDetailFactTeeth(patient: DiscoveryPatient, fact: DiscoveryFact): readonly number[] | undefined {
  if (fact.toothNumbers) return fact.toothNumbers;
  if (isNextCaseDetailReview(patient)) return nextCaseDetailFactTeeth(patient, fact);
  return isCaseDetailReview(patient) && focalSources[patient.caseId]?.includes(suffix(fact)) ? [30] : undefined;
}
export function isGlobalDetailRequest(question: string, patient: DiscoveryPatient, fact: DiscoveryFact): boolean {
  if (!isCaseDetailReview(patient) || patient.caseId !== "drchi-006") return false;
  return (suffix(fact) === "other-restorations" && /\b(?:other|additional|another|besides|only)\b/iu.test(question)
    && /\b(?:restorations?|fillings?|filled|restored|treated)\b/iu.test(question))
    || (suffix(fact) === "caries-risk" && /\b(?:caries[- ]risk|whole[- ]mouth|dentition[- ]wide)\b/iu.test(question));
}

export function caseDetailRequestedTeeth(question: string): number[] {
  return [...question.matchAll(/(?:#\s*|\btooth\s*(?:number\s*)?#?\s*)([1-9]|[12]\d|3[0-2])\b/giu)]
    .map(match => Number(match[1]));
}
export function caseDetailFactMatchesClause(question: string, patient: DiscoveryPatient, fact: DiscoveryFact): boolean {
  if (!isCaseDetailReview(patient)) return true;
  if (!nextCaseDetailFactMatchesClause(question, patient, fact)) return false;
  const requested = caseDetailRequestedTeeth(question);
  const teeth = caseDetailFactTeeth(patient, fact);
  // A one-tooth order must not acquire both independent control findings.
  if (patient.caseId === "drchi-005" && ["adjacent-cold", "adjacent-percussion"].includes(suffix(fact))
    && requested.length === 1 && (requested[0] === 29 || requested[0] === 31)) return false;
  return !requested.length || !teeth || teeth.some(tooth => requested.includes(tooth)) || isGlobalDetailRequest(question, patient, fact);
}
export function caseDetailSubjectTarget(topic: string, question: string, patient: DiscoveryPatient): { topic: string; idSuffix: string } {
  const teeth = isCaseDetailReview(patient) ? caseDetailRequestedTeeth(question) : [];
  return { topic: teeth.length ? `${topic} for tooth ${teeth.map(tooth => `#${tooth}`).join(", ")}` : topic,
    idSuffix: teeth.length ? `:tooth-${teeth.join("-")}` : "" };
}

type PriorRequest = { question: string; channel: DiscoveryChannel; factIds: string[] };
export function repeatCaseDetailFact(question: string, patient: DiscoveryPatient, context: readonly PriorRequest[]): DiscoveryFact | undefined {
  if (!isCaseDetailReview(patient) || patient.caseId !== "drchi-006"
    || !/^(?:(?:and|what|how)\s+)?(?:about\s+)?(?:on\s+)?(?:the\s+)?other teeth[?.!\s]*$/iu.test(question.trim())) return;
  const previous = context.at(-1);
  if (previous?.factIds.length !== 1 || previous.factIds[0] !== `${patient.caseId}:other-restorations`) return;
  return patient.facts.find(fact => fact.id === previous.factIds[0] && fact.available !== false);
}

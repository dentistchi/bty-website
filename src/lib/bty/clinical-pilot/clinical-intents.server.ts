import type { DiscoveryFact, DiscoveryPatient } from "@/domain/clinical-pilot/discovery";

export type HistoryIntentId = "endodontic-history" | "cold-history" | "allergies" | "medications" | "symptom-onset";
export type HistoryIntentDefinition = {
  id: HistoryIntentId;
  topic: string;
  channel: "patient";
  canonicalQueries: readonly string[];
  missingAnswer: string;
};

/** Interpretation metadata, never additional patient truth or a mutation of a frozen pack. */
export const HISTORY_INTENTS: readonly HistoryIntentDefinition[] = [
  { id: "endodontic-history", topic: "Prior root canal treatment history", channel: "patient",
    canonicalQueries: ["root canal", "RCT", "endodontic treatment"],
    missingAnswer: "Prior root canal treatment history is not specified in this case." },
  { id: "cold-history", topic: "Patient-reported cold sensitivity", channel: "patient",
    canonicalQueries: ["cold", "cold sensitivity", "cold drinks"],
    missingAnswer: "Cold-sensitivity history is not specified in this case. This does not establish that cold sensitivity is absent." },
  { id: "allergies", topic: "Known allergy history", channel: "patient",
    canonicalQueries: ["allergies", "allergic"],
    missingAnswer: "Allergy history is not specified in this case. No negative allergy history is established." },
  { id: "medications", topic: "Current medication history", channel: "patient",
    canonicalQueries: ["medications", "medicine", "prescriptions", "What medication are you taking?", "blood thinner", "anticoagulant", "antiresorptive medication"],
    missingAnswer: "Medication history is not specified in this case. This does not establish that the patient takes no medications." },
  { id: "symptom-onset", topic: "Onset and course of the presenting symptom", channel: "patient",
    canonicalQueries: ["When did this discomfort start?", "When did it start?", "How long have the symptoms been present?", "pain started"],
    missingAnswer: "The onset of the presenting symptom is not specified in this case." },
];

const normalize = (value: string) => value.normalize("NFKC").replace(/[‘’]/gu, "'").trim();
const advice = /\b(?:recommend|recommended|prescribe|prescribed|prognosis|success rate|treatment plan|treatment options?|should|ought|need|needs|necessary|best treatment)\b/iu;
const endodontic = /\b(?:root[- ]canal(?:s|l?ed)?|rct|endo(?:dontic(?:ally)?)?)\b/iu;
const endodonticAssessment = /\b(?:quality|obturation|gutta[- ]?percha|missed canals?|underfill(?:ed)?|overfill(?:ed)?|short fill|root filling|root[- ]filling|retreatment|re[- ]treatment|apical lesion|periapical lesion|fracture|crack|diagnosis|failed|failure|infection)\b/iu;
const coldExamination = /\b(?:cold[- ]?(?:test|testing)|test(?:ing)?[^.!?]{0,25}cold|endo[- ]?ice|refrigerant|ept|electric(?:al)?|pulp(?:al)? (?:sensibility|vitality)|(?:sensibility|vitality) test(?:ing)?|thermal test(?:ing)?)\b/iu;
const onset = /\bwhen\b[^.!?]{0,50}\b(?:start|started|begin|began|notice|noticed|onset)\b|\bhow long\b[^.!?]{0,60}\b(?:pain|symptoms?|discomfort|soreness|sore|lesion|ulcer|problem|been (?:there|present|happening|going on))\b|\b(?:pain|symptoms?|discomfort|soreness|sore|lesion|ulcer)\b[^.!?]{0,50}\b(?:duration|onset|start|started|begin|began|how long)\b|\b(?:symptom onset|pain duration|onset of (?:pain|symptoms?|discomfort))\b/iu;

/** Conservative recognition of history, excluding examination orders and treatment advice. */
export function recognizeHistoryIntents(text: string): HistoryIntentDefinition[] {
  const question = normalize(text);
  if (!question || advice.test(question)) return [];
  const ids = new Set<HistoryIntentId>();
  const symptomOnset = onset.test(question)
    && !( /\b(?:filling|restoration|crown|implant|extraction|missing tooth|prolia|denosumab|injection|medication)\b/iu.test(question)
      && !/\b(?:pain|symptoms?|discomfort|soreness|sore|lesion|ulcer)\b/iu.test(question));
  if (symptomOnset) ids.add("symptom-onset");
  const endodonticCue = /\b(?:done|completed|performed|treated|prior|previous|history|before|ever|had|have|underwent|when|ago|already|status)\b/iu.test(question)
    || /^(?:any\s+)?(?:root[- ]canal|rct|endo(?:dontic(?:ally)?)?)(?:\s+(?:tx|treatment))?[?.!]*$/iu.test(question);
  if (endodontic.test(question) && endodonticCue && !endodonticAssessment.test(question)
    && (!symptomOnset || /\b(?:done|completed|performed|prior|previous|history)\b/iu.test(question))) ids.add("endodontic-history");
  if (/\b(?:cold|chilled)\b/iu.test(question) && !coldExamination.test(question)
    && !/\b(?:common cold|cold medicine|cough|flu|congestion|runny nose)\b/iu.test(question)) ids.add("cold-history");
  if (/\b(?:allerg(?:y|ies|ic)|nkda|nka|drug reactions?|adverse (?:drug )?reactions?)\b/iu.test(question)
    && !/\ballerg\w*[^.!?]{0,20}\b(?:test|testing|management|treatment)\b/iu.test(question)) ids.add("allergies");
  const medicationQuestion = question.replace(/\b(?:medication|medicine|meds|drug|prescription)\s+allerg(?:y|ies)\b/giu, "allergies")
    .replace(/\ballerg(?:y|ies|ic)\s+to\s+(?:any\s+)?(?:medications?|medicines?|meds|drugs?)\b/giu, "allergies");
  if (/\b(?:medications?|medicines?|meds|prescriptions?|pills|supplements|drug list|current drugs)\b|\bwhat\b[^.!?]{0,25}\b(?:taking|take)\b/iu.test(medicationQuestion)
    && !/\b(?:prescription (?:paste|toothpaste)|prescribe|prescribing|dose adjustment|medication change|drug interaction)\b/iu.test(question)) ids.add("medications");
  return HISTORY_INTENTS.filter(intent => ids.has(intent.id));
}

function patternMatches(fact: DiscoveryFact, query: string): boolean {
  return fact.patterns.some(pattern => {
    if (!pattern || pattern.length > 500) return false;
    try { return new RegExp(pattern, "iu").test(query); } catch { return false; }
  });
}

/** Select only authored patient facts. Canonical queries must not be generic "treatment history". */
export function factsForIntent(intent: HistoryIntentDefinition | HistoryIntentId, patient: DiscoveryPatient): DiscoveryFact[] {
  const definition = typeof intent === "string" ? HISTORY_INTENTS.find(item => item.id === intent)! : intent;
  if (!definition) return [];
  return patient.facts.filter(fact => {
    if (fact.channel !== "patient") return false;
    if (definition.id === "symptom-onset") {
      // "When/how long" alone also matches old crowns, implants and medication timing.
      const metadata = `${fact.id} ${fact.topic}`;
      if (!/\b(?:onset|duration|course)\b/iu.test(metadata)
        || !/\b(?:symptom|symptoms|pain|discomfort|soreness|sore|lesion|ulcer|postoperative)\b/iu.test(metadata)) return false;
    }
    return definition.canonicalQueries.some(query => patternMatches(fact, query));
  });
}

export const historyIntents = HISTORY_INTENTS;
